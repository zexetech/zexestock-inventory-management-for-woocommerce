<?php

defined( 'ABSPATH' ) || exit;
class ZEXST_Stock_Manager {
    private const OOS_CHECK_BATCH_SIZE = 500;

    public static function validate_adjustment( int $product_id, int $adjustment ) : int|\WP_Error {
        if ( 0 === $adjustment ) {
            return new \WP_Error('invalid_adjustment', __( 'Adjustment must be a non-zero integer.', 'zexestock-inventory-management-for-woocommerce' ));
        }
        if ( $adjustment < \ZEXST_Constants::MIN_STOCK || $adjustment > \ZEXST_Constants::MAX_STOCK ) {
            return new \WP_Error('adjustment_out_of_range', sprintf(
                /* translators: 1: minimum allowed adjustment, 2: maximum allowed adjustment. */
                __( 'Adjustment must be between %1$s and %2$s.', 'zexestock-inventory-management-for-woocommerce' ),
                number_format( \ZEXST_Constants::MIN_STOCK ),
                number_format( \ZEXST_Constants::MAX_STOCK )
             ));
        }
        $product = wc_get_product( $product_id );
        if ( !$product instanceof WC_Product ) {
            return new \WP_Error('invalid_product', __( 'Product not found.', 'zexestock-inventory-management-for-woocommerce' ));
        }
        if ( !$product->managing_stock() ) {
            return new \WP_Error('not_managed', __( 'Stock management is not enabled for this product.', 'zexestock-inventory-management-for-woocommerce' ));
        }
        $current = (int) $product->get_stock_quantity();
        $new_stock = $current + $adjustment;
        if ( $new_stock < 0 && !zexst_get_setting( 'allow_negative_stock', false ) ) {
            return new \WP_Error('negative_stock', sprintf(
                /* translators: %d: the product's current stock quantity. */
                __( 'Adjustment rejected: stock cannot go below zero. Current stock is %d.', 'zexestock-inventory-management-for-woocommerce' ),
                $current
             ));
        }
        return $new_stock;
    }

    public static function adjust_stock(
        int $product_id,
        int $adjustment,
        string $type = 'manual',
        ?int $expected_stock = null
    ) : array|\WP_Error {
        $validation = self::validate_adjustment( $product_id, $adjustment );
        if ( is_wp_error( $validation ) ) {
            return $validation;
        }
        $product = wc_get_product( $product_id );
        if ( !$product instanceof WC_Product ) {
            return new \WP_Error('invalid_product', __( 'Product not found.', 'zexestock-inventory-management-for-woocommerce' ));
        }
        if ( !$product->managing_stock() ) {
            return new \WP_Error('not_managed', __( 'Stock management is not enabled for this product.', 'zexestock-inventory-management-for-woocommerce' ));
        }
        $previous_stock = (int) $product->get_stock_quantity();
        if ( null !== $expected_stock && $previous_stock !== $expected_stock ) {
            return new \WP_Error('stock_mismatch', sprintf(
                /* translators: %d: the product's current stock quantity. */
                __( 'Stock has changed since you loaded it. Current stock is now %d. Please review and try again.', 'zexestock-inventory-management-for-woocommerce' ),
                $previous_stock
             ), array(
                'current_stock' => $previous_stock,
            ));
        }
        $new_stock = $previous_stock + $adjustment;
        $saved = wc_update_product_stock( $product, $new_stock, 'set' );
        if ( false === $saved ) {
            ZEXST_Logger::error( 'wc_update_product_stock() returned false', array(
                'product_id'     => $product_id,
                'previous_stock' => $previous_stock,
                'new_stock'      => $new_stock,
            ) );
            return new \WP_Error('update_failed', __( 'Failed to update stock. Please try again.', 'zexestock-inventory-management-for-woocommerce' ));
        }
        $product = wc_get_product( $product_id );
        return array(
            'previous_stock' => $previous_stock,
            'adjustment'     => $adjustment,
            'new_stock'      => (int) $product->get_stock_quantity(),
            'stock_status'   => $product->get_stock_status(),
            'sku'            => $product->get_sku(),
        );
    }

    public static function get_product_image_url( int $attachment_id ) : string {
        if ( $attachment_id > 0 ) {
            $url = wp_get_attachment_image_url( $attachment_id, 'thumbnail' );
            if ( $url ) {
                return $url;
            }
        }
        return ( function_exists( 'wc_placeholder_img_src' ) ? wc_placeholder_img_src( 'thumbnail' ) : '' );
    }

    public static function get_products_for_rest( array $params ) : array|\WP_Error {
        global $wpdb;
        $page = max( 1, absint( $params['page'] ?? 1 ) );
        $per_page = min( 200, max( 1, absint( $params['per_page'] ?? 50 ) ) );
        $offset = ($page - 1) * $per_page;
        $search = sanitize_text_field( $params['search'] ?? '' );
        $category = absint( $params['category'] ?? 0 );
        $product_type = sanitize_key( $params['product_type'] ?? '' );
        $threshold = absint( zexst_get_setting( 'low_stock_threshold', 10 ) );
        $orderby_map = array(
            'name'                         => 'p.post_title',
            'sku'                          => 'sku_meta.meta_value',
            'stock_qty'                    => 'CAST(stock_meta.meta_value AS SIGNED)',
            'type'                         => 'type_join.product_type',
            'category'                     => 'categories',
            'stock_status'                 => 'stock_status',
            'regular_price'                => "CAST(NULLIF(regular_price_meta.meta_value, '') AS DECIMAL(10,2))",
            'sale_price'                   => "CAST(NULLIF(sale_price_meta.meta_value, '') AS DECIMAL(10,2))",
            'purchase_price'               => "CAST(NULLIF(purchase_price_meta.meta_value, '') AS DECIMAL(10,2))",
            'supplier_sku'                 => 'supplier_sku_meta.meta_value',
            'barcode'                      => 'barcode_meta.meta_value',
            'low_stock_threshold_override' => 'CAST(threshold_meta.meta_value AS SIGNED)',
            'sold_today'                   => 'sold_today',
            'sold_last_14_days'            => 'sold_last_14_days',
        );
        $orderby_key = sanitize_key( $params['orderby'] ?? 'name' );
        $orderby = $orderby_map[$orderby_key] ?? 'p.post_title';
        $ord_dir = ( 'desc' === strtolower( $params['order'] ?? 'asc' ) ? 'DESC' : 'ASC' );
        if ( in_array( $orderby_key, array('sale_price', 'regular_price', 'purchase_price'), true ) ) {
            $orderby = "ISNULL({$orderby}) ASC, {$orderby}";
        }
        $sales_periods = self::get_sales_period_boundaries( 14 );
        $today_utc = $sales_periods['today_utc'];
        $fourteen_utc = $sales_periods['days_ago_utc'];
        $from_join = "\n\t\t\tFROM {$wpdb->posts} p\n\t\t\tLEFT JOIN {$wpdb->postmeta} manage_meta\n\t\t\t\tON ( p.ID = manage_meta.post_id AND manage_meta.meta_key = '_manage_stock' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} stock_meta\n\t\t\t\tON ( p.ID = stock_meta.post_id AND stock_meta.meta_key = '_stock' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sku_meta\n\t\t\t\tON ( p.ID = sku_meta.post_id AND sku_meta.meta_key = '_sku' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} image_meta\n\t\t\t\tON ( p.ID = image_meta.post_id AND image_meta.meta_key = '_thumbnail_id' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} regular_price_meta\n\t\t\t\tON ( p.ID = regular_price_meta.post_id AND regular_price_meta.meta_key = '_regular_price' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sale_price_meta\n\t\t\t\tON ( p.ID = sale_price_meta.post_id AND sale_price_meta.meta_key = '_sale_price' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sale_date_from_meta\n\t\t\t\tON ( p.ID = sale_date_from_meta.post_id AND sale_date_from_meta.meta_key = '_sale_price_dates_from' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sale_date_to_meta\n\t\t\t\tON ( p.ID = sale_date_to_meta.post_id AND sale_date_to_meta.meta_key = '_sale_price_dates_to' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} purchase_price_meta\n\t\t\t\tON ( p.ID = purchase_price_meta.post_id AND purchase_price_meta.meta_key = '_zexst_purchase_price' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} supplier_sku_meta\n\t\t\t\tON ( p.ID = supplier_sku_meta.post_id AND supplier_sku_meta.meta_key = '_zexst_supplier_sku' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} barcode_meta\n\t\t\t\tON ( p.ID = barcode_meta.post_id AND barcode_meta.meta_key = '_zexst_barcode' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} virtual_meta\n\t\t\t\tON ( p.ID = virtual_meta.post_id AND virtual_meta.meta_key = '_virtual' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} downloadable_meta\n\t\t\t\tON ( p.ID = downloadable_meta.post_id AND downloadable_meta.meta_key = '_downloadable' )\n\t\t\tLEFT JOIN (\n\t\t\t\tSELECT pv.post_parent, COUNT(*) AS variation_count\n\t\t\t\tFROM {$wpdb->posts} pv\n\t\t\t\tWHERE pv.post_type = 'product_variation'\n\t\t\t\t  AND pv.post_status = 'publish'\n\t\t\t\tGROUP BY pv.post_parent\n\t\t\t) var_counts ON ( p.ID = var_counts.post_parent )\n\t\t\tLEFT JOIN (\n\t\t\t\tSELECT tr.object_id, t.slug AS product_type\n\t\t\t\tFROM {$wpdb->term_relationships} tr\n\t\t\t\tINNER JOIN {$wpdb->term_taxonomy} tt\n\t\t\t\t\tON ( tr.term_taxonomy_id = tt.term_taxonomy_id AND tt.taxonomy = 'product_type' )\n\t\t\t\tINNER JOIN {$wpdb->terms} t ON ( tt.term_id = t.term_id )\n\t\t\t) type_join ON ( p.ID = type_join.object_id )\n\t\t\tLEFT JOIN {$wpdb->postmeta} threshold_meta\n\t\t\t\tON ( p.ID = threshold_meta.post_id AND threshold_meta.meta_key = '_zexst_low_stock_threshold' )\n\t\t";
        $cat_join = '';
        if ( $category > 0 ) {
            $cat_join = "\n\t\t\tINNER JOIN {$wpdb->term_relationships} cat_filter_tr ON ( p.ID = cat_filter_tr.object_id )\n\t\t\tINNER JOIN {$wpdb->term_taxonomy} cat_filter_tt\n\t\t\t\tON ( cat_filter_tr.term_taxonomy_id = cat_filter_tt.term_taxonomy_id\n\t\t\t\t     AND cat_filter_tt.taxonomy = 'product_cat'\n\t\t\t\t     AND cat_filter_tt.term_id = %d )\n\t\t\t";
        }
        $base_where = "\n\t\t\tWHERE p.post_type   = 'product'\n\t\t\t  AND p.post_status = 'publish'\n\t\t\t  AND ( manage_meta.meta_value = 'yes' OR var_counts.variation_count > 0 OR type_join.product_type = 'grouped' )\n\t\t";
        $extra_where = '';
        $where_args = array();
        if ( $category > 0 ) {
            $where_args[] = $category;
        }
        if ( '' !== $search ) {
            $allowed_search_fields = array(
                'name_sku',
                'name',
                'sku',
                'supplier_sku',
                'barcode',
                'regular_price',
                'sale_price',
                'purchase_price',
                'stock'
            );
            $search_field = sanitize_key( $params['search_field'] ?? '' );
            if ( !in_array( $search_field, $allowed_search_fields, true ) ) {
                $search_field = 'name_sku';
            }
            $like = '%' . $wpdb->esc_like( $search ) . '%';
            switch ( $search_field ) {
                case 'name':
                    $extra_where .= ' AND p.post_title LIKE %s';
                    $where_args[] = $like;
                    break;
                case 'sku':
                    $extra_where .= ' AND sku_meta.meta_value LIKE %s';
                    $where_args[] = $like;
                    break;
                case 'supplier_sku':
                    $extra_where .= ' AND supplier_sku_meta.meta_value LIKE %s';
                    $where_args[] = $like;
                    break;
                case 'barcode':
                    $extra_where .= ' AND barcode_meta.meta_value LIKE %s';
                    $where_args[] = $like;
                    break;
                case 'regular_price':
                    $extra_where .= ' AND regular_price_meta.meta_value LIKE %s';
                    $where_args[] = $like;
                    break;
                case 'sale_price':
                    $extra_where .= ' AND sale_price_meta.meta_value LIKE %s';
                    $where_args[] = $like;
                    break;
                case 'purchase_price':
                    $extra_where .= ' AND purchase_price_meta.meta_value LIKE %s';
                    $where_args[] = $like;
                    break;
                case 'stock':
                    $extra_where .= ' AND CAST(stock_meta.meta_value AS SIGNED) = %d';
                    $where_args[] = intval( $search );
                    break;
                default:
                    $extra_where .= ' AND ( p.post_title LIKE %s OR sku_meta.meta_value LIKE %s )';
                    $where_args[] = $like;
                    $where_args[] = $like;
                    break;
            }
        }
        $stock_status = sanitize_key( $params['stock_status'] ?? '' );
        if ( '' !== $stock_status ) {
            switch ( $stock_status ) {
                case 'in_stock':
                    $extra_where .= "\n\t\t\t\t\t\tAND (\n\t\t\t\t\t\t\t( manage_meta.meta_value = 'yes' AND CAST( stock_meta.meta_value AS SIGNED ) > {$threshold} )\n\t\t\t\t\t\t\tOR ( var_counts.variation_count > 0 AND EXISTS (\n\t\t\t\t\t\t\t\tSELECT 1\n\t\t\t\t\t\t\t\tFROM {$wpdb->posts} vp\n\t\t\t\t\t\t\t\tINNER JOIN {$wpdb->postmeta} v_ms ON ( vp.ID = v_ms.post_id AND v_ms.meta_key = '_manage_stock' AND v_ms.meta_value = 'yes' )\n\t\t\t\t\t\t\t\tINNER JOIN {$wpdb->postmeta} v_sq ON ( vp.ID = v_sq.post_id AND v_sq.meta_key = '_stock' )\n\t\t\t\t\t\t\t\tWHERE vp.post_parent = p.ID AND vp.post_type = 'product_variation' AND vp.post_status = 'publish'\n\t\t\t\t\t\t\t\t  AND CAST( v_sq.meta_value AS SIGNED ) > {$threshold}\n\t\t\t\t\t\t\t) )\n\t\t\t\t\t\t)";
                    break;
                case 'low_stock':
                    $extra_where .= "\n\t\t\t\t\t\tAND (\n\t\t\t\t\t\t\t( manage_meta.meta_value = 'yes'\n\t\t\t\t\t\t\t  AND CAST( stock_meta.meta_value AS SIGNED ) > 0\n\t\t\t\t\t\t\t  AND CAST( stock_meta.meta_value AS SIGNED ) <= COALESCE( NULLIF( CAST( threshold_meta.meta_value AS SIGNED ), 0 ), {$threshold} ) )\n\t\t\t\t\t\t\tOR ( var_counts.variation_count > 0\n\t\t\t\t\t\t\t  AND EXISTS (\n\t\t\t\t\t\t\t\tSELECT 1\n\t\t\t\t\t\t\t\tFROM {$wpdb->posts} vp\n\t\t\t\t\t\t\t\tINNER JOIN {$wpdb->postmeta} v_ms  ON ( vp.ID = v_ms.post_id  AND v_ms.meta_key  = '_manage_stock' AND v_ms.meta_value = 'yes' )\n\t\t\t\t\t\t\t\tINNER JOIN {$wpdb->postmeta} v_sq  ON ( vp.ID = v_sq.post_id  AND v_sq.meta_key  = '_stock' )\n\t\t\t\t\t\t\t\tLEFT  JOIN {$wpdb->postmeta} v_thr ON ( vp.ID = v_thr.post_id AND v_thr.meta_key = '_zexst_low_stock_threshold' )\n\t\t\t\t\t\t\t\tWHERE vp.post_parent = p.ID AND vp.post_type = 'product_variation' AND vp.post_status = 'publish'\n\t\t\t\t\t\t\t\t  AND CAST( v_sq.meta_value AS SIGNED ) > 0\n\t\t\t\t\t\t\t\t  AND CAST( v_sq.meta_value AS SIGNED ) <= COALESCE( NULLIF( CAST( v_thr.meta_value AS SIGNED ), 0 ), {$threshold} )\n\t\t\t\t\t\t\t  )\n\t\t\t\t\t\t\t  AND NOT EXISTS (\n\t\t\t\t\t\t\t\tSELECT 1\n\t\t\t\t\t\t\t\tFROM {$wpdb->posts} vp2\n\t\t\t\t\t\t\t\tINNER JOIN {$wpdb->postmeta} v_ms2 ON ( vp2.ID = v_ms2.post_id AND v_ms2.meta_key = '_manage_stock' AND v_ms2.meta_value = 'yes' )\n\t\t\t\t\t\t\t\tLEFT  JOIN {$wpdb->postmeta} v_sq2 ON ( vp2.ID = v_sq2.post_id AND v_sq2.meta_key = '_stock' )\n\t\t\t\t\t\t\t\tWHERE vp2.post_parent = p.ID AND vp2.post_type = 'product_variation' AND vp2.post_status = 'publish'\n\t\t\t\t\t\t\t\t  AND ( v_sq2.meta_value IS NULL OR CAST( v_sq2.meta_value AS SIGNED ) <= 0 )\n\t\t\t\t\t\t\t  )\n\t\t\t\t\t\t\t)\n\t\t\t\t\t\t)";
                    break;
                case 'out_of_stock':
                    $oos_grouped_parent_ids = self::get_grouped_parent_ids_with_oos_children();
                    $grouped_or = '';
                    if ( !empty( $oos_grouped_parent_ids ) ) {
                        $gids_in = implode( ',', $oos_grouped_parent_ids );
                        $grouped_or = "\n\t\t\t\t\t\t\tOR ( type_join.product_type = 'grouped' AND p.ID IN ( {$gids_in} ) )";
                    }
                    $extra_where .= "\n\t\t\t\t\t\tAND (\n\t\t\t\t\t\t\t( COALESCE( var_counts.variation_count, 0 ) = 0 AND manage_meta.meta_value = 'yes'\n\t\t\t\t\t\t\t  AND ( stock_meta.meta_value IS NULL OR CAST( stock_meta.meta_value AS SIGNED ) <= 0 ) )\n\t\t\t\t\t\t\tOR ( var_counts.variation_count > 0 AND EXISTS (\n\t\t\t\t\t\t\t\tSELECT 1\n\t\t\t\t\t\t\t\tFROM {$wpdb->posts} vp\n\t\t\t\t\t\t\t\tINNER JOIN {$wpdb->postmeta} v_ms ON ( vp.ID = v_ms.post_id AND v_ms.meta_key = '_manage_stock' AND v_ms.meta_value = 'yes' )\n\t\t\t\t\t\t\t\tLEFT  JOIN {$wpdb->postmeta} v_sq ON ( vp.ID = v_sq.post_id AND v_sq.meta_key = '_stock' )\n\t\t\t\t\t\t\t\tWHERE vp.post_parent = p.ID AND vp.post_type = 'product_variation' AND vp.post_status = 'publish'\n\t\t\t\t\t\t\t\t  AND ( v_sq.meta_value IS NULL OR CAST( v_sq.meta_value AS SIGNED ) <= 0 )\n\t\t\t\t\t\t\t) )\n\t\t\t\t\t\t\t{$grouped_or}\n\t\t\t\t\t\t)";
                    break;
            }
        } elseif ( !empty( $params['low_stock'] ) ) {
            $extra_where .= "\n\t\t\t\tAND (\n\t\t\t\t\t( manage_meta.meta_value = 'yes'\n\t\t\t\t\t  AND CAST( stock_meta.meta_value AS SIGNED ) > 0\n\t\t\t\t\t  AND CAST( stock_meta.meta_value AS SIGNED ) <= COALESCE( NULLIF( CAST( threshold_meta.meta_value AS SIGNED ), 0 ), {$threshold} ) )\n\t\t\t\t\tOR ( var_counts.variation_count > 0\n\t\t\t\t\t  AND EXISTS (\n\t\t\t\t\t\tSELECT 1\n\t\t\t\t\t\tFROM {$wpdb->posts} vp\n\t\t\t\t\t\tINNER JOIN {$wpdb->postmeta} v_ms  ON ( vp.ID = v_ms.post_id  AND v_ms.meta_key  = '_manage_stock' AND v_ms.meta_value = 'yes' )\n\t\t\t\t\t\tINNER JOIN {$wpdb->postmeta} v_sq  ON ( vp.ID = v_sq.post_id  AND v_sq.meta_key  = '_stock' )\n\t\t\t\t\t\tLEFT  JOIN {$wpdb->postmeta} v_thr ON ( vp.ID = v_thr.post_id AND v_thr.meta_key = '_zexst_low_stock_threshold' )\n\t\t\t\t\t\tWHERE vp.post_parent = p.ID AND vp.post_type = 'product_variation' AND vp.post_status = 'publish'\n\t\t\t\t\t\t  AND CAST( v_sq.meta_value AS SIGNED ) > 0\n\t\t\t\t\t\t  AND CAST( v_sq.meta_value AS SIGNED ) <= COALESCE( NULLIF( CAST( v_thr.meta_value AS SIGNED ), 0 ), {$threshold} )\n\t\t\t\t\t  )\n\t\t\t\t\t  AND NOT EXISTS (\n\t\t\t\t\t\tSELECT 1\n\t\t\t\t\t\tFROM {$wpdb->posts} vp2\n\t\t\t\t\t\tINNER JOIN {$wpdb->postmeta} v_ms2 ON ( vp2.ID = v_ms2.post_id AND v_ms2.meta_key = '_manage_stock' AND v_ms2.meta_value = 'yes' )\n\t\t\t\t\t\tLEFT  JOIN {$wpdb->postmeta} v_sq2 ON ( vp2.ID = v_sq2.post_id AND v_sq2.meta_key = '_stock' )\n\t\t\t\t\t\tWHERE vp2.post_parent = p.ID AND vp2.post_type = 'product_variation' AND vp2.post_status = 'publish'\n\t\t\t\t\t\t  AND ( v_sq2.meta_value IS NULL OR CAST( v_sq2.meta_value AS SIGNED ) <= 0 )\n\t\t\t\t\t  )\n\t\t\t\t\t)\n\t\t\t\t)";
        }
        $valid_product_types = array(
            'simple',
            'variable',
            'grouped',
            'external',
            'virtual',
            'downloadable'
        );
        if ( in_array( $product_type, $valid_product_types, true ) ) {
            $extra_where .= "\n\t\t\t\tAND (\n\t\t\t\t\tCASE\n\t\t\t\t\t\tWHEN var_counts.variation_count > 0 THEN 'variable'\n\t\t\t\t\t\tWHEN type_join.product_type = 'grouped' THEN 'grouped'\n\t\t\t\t\t\tWHEN type_join.product_type = 'external' THEN 'external'\n\t\t\t\t\t\tWHEN downloadable_meta.meta_value = 'yes' THEN 'downloadable'\n\t\t\t\t\t\tWHEN virtual_meta.meta_value = 'yes' THEN 'virtual'\n\t\t\t\t\t\tELSE 'simple'\n\t\t\t\t\tEND\n\t\t\t\t) = %s";
            $where_args[] = $product_type;
        }
        $total_sql = "\n\t\t\tSELECT COUNT( DISTINCT p.ID )\n\t\t\tFROM {$wpdb->posts} p\n\t\t\tLEFT JOIN {$wpdb->postmeta} manage_meta\n\t\t\t\tON ( p.ID = manage_meta.post_id AND manage_meta.meta_key = '_manage_stock' )\n\t\t\tLEFT JOIN (\n\t\t\t\tSELECT pv.post_parent, COUNT(*) AS variation_count\n\t\t\t\tFROM {$wpdb->posts} pv\n\t\t\t\tWHERE pv.post_type = 'product_variation'\n\t\t\t\t  AND pv.post_status = 'publish'\n\t\t\t\tGROUP BY pv.post_parent\n\t\t\t) var_counts ON ( p.ID = var_counts.post_parent )\n\t\t\tWHERE p.post_type   = 'product'\n\t\t\t  AND p.post_status = 'publish'\n\t\t\t  AND ( manage_meta.meta_value = 'yes' OR var_counts.variation_count > 0 )\n\t\t";
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- stock-table listing built from hardcoded join/where fragments and %d/%s placeholders bound above; the branch without prepare() has no where clause.
        $total = (int) $wpdb->get_var( $total_sql );
        $count_sql = "SELECT COUNT( DISTINCT p.ID ) {$from_join} {$cat_join} {$base_where} {$extra_where}";
        if ( !empty( $where_args ) ) {
            $filtered = (int) $wpdb->get_var( $wpdb->prepare( $count_sql, $where_args ) );
        } else {
            $filtered = (int) $wpdb->get_var( $count_sql );
        }
        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
        $data_sql = "\n\t\t\tSELECT p.ID, p.post_title,\n\t\t\t\tmanage_meta.meta_value                    AS manage_stock,\n\t\t\t\tstock_meta.meta_value                     AS stock,\n\t\t\t\tsku_meta.meta_value                       AS sku,\n\t\t\t\timage_meta.meta_value                     AS image_id,\n\t\t\t\tvirtual_meta.meta_value                   AS `virtual`,\n\t\t\t\tdownloadable_meta.meta_value               AS downloadable,\n\t\t\t\tregular_price_meta.meta_value             AS regular_price,\n\t\t\t\tsale_price_meta.meta_value                AS sale_price,\n\t\t\t\tsale_date_from_meta.meta_value            AS date_on_sale_from,\n\t\t\t\tsale_date_to_meta.meta_value              AS date_on_sale_to,\n\t\t\t\tpurchase_price_meta.meta_value            AS purchase_price,\n\t\t\t\tsupplier_sku_meta.meta_value              AS supplier_sku,\n\t\t\t\tbarcode_meta.meta_value                   AS barcode,\n\t\t\t\tCOALESCE( var_counts.variation_count, 0 ) AS variation_count,\n\t\t\t\ttype_join.product_type                    AS product_type,\n\t\t\t\tCASE\n\t\t\t\t\tWHEN manage_meta.meta_value != 'yes' THEN ''\n\t\t\t\t\tWHEN stock_meta.meta_value IS NULL\n\t\t\t\t\t     OR CAST( stock_meta.meta_value AS SIGNED ) <= 0 THEN 'out_of_stock'\n\t\t\t\t\tWHEN CAST( stock_meta.meta_value AS SIGNED ) <= {$threshold} THEN 'low_stock'\n\t\t\t\t\tELSE 'in_stock'\n\t\t\t\tEND AS stock_status,\n\t\t\t\t(\n\t\t\t\t\tSELECT GROUP_CONCAT( cat_t.name ORDER BY cat_t.term_id SEPARATOR ', ' )\n\t\t\t\t\tFROM {$wpdb->terms} cat_t\n\t\t\t\t\tINNER JOIN {$wpdb->term_taxonomy} cat_tt\n\t\t\t\t\t\tON ( cat_t.term_id = cat_tt.term_id AND cat_tt.taxonomy = 'product_cat' )\n\t\t\t\t\tINNER JOIN {$wpdb->term_relationships} cat_tr\n\t\t\t\t\t\tON ( cat_tt.term_taxonomy_id = cat_tr.term_taxonomy_id )\n\t\t\t\t\tWHERE cat_tr.object_id = p.ID\n\t\t\t\t) AS categories,\n\t\t\t\tCOALESCE( ( " . self::build_sold_subquery( 'p.ID', false ) . " ), 0 ) AS sold_today,\n\t\t\t\tCOALESCE( ( " . self::build_sold_subquery( 'p.ID', false ) . " ), 0 ) AS sold_last_14_days\n\t\t\t{$from_join}\n\t\t\t{$cat_join}\n\t\t\t{$base_where}\n\t\t\t{$extra_where}\n\t\t\tORDER BY {$orderby} {$ord_dir}\n\t\t\tLIMIT %d OFFSET %d\n\t\t";
        $data_args = array_merge(
            array($today_utc, $fourteen_utc),
            $where_args,
            array($per_page, $offset)
        );
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- see justification above; $data_sql placeholders are bound via $data_args.
        $products = $wpdb->get_results( $wpdb->prepare( $data_sql, $data_args ) );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
        $data = array();
        $all_product_ids = array_map( fn( $p ) => (int) $p->ID, $products );
        $reserved_map = self::get_reserved_qty_map( $all_product_ids );
        update_meta_cache( 'post', $all_product_ids );
        foreach ( $products as $product ) {
            $product_id = (int) $product->ID;
            $is_variable = (int) $product->variation_count > 0;
            $is_grouped = 'grouped' === ($product->product_type ?? '');
            $is_external = 'external' === ($product->product_type ?? '');
            $image_url = self::get_product_image_url( (int) ($product->image_id ?? 0) );
            $manage_stock = 'yes' === ($product->manage_stock ?? '');
            $stock_qty = ( null !== $product->stock ? (int) $product->stock : null );
            $no_own_stock = $is_variable || $is_grouped;
            if ( $is_variable ) {
                $type = 'variable';
            } elseif ( $is_grouped ) {
                $type = 'grouped';
            } elseif ( $is_external ) {
                $type = 'external';
            } else {
                $type = self::resolve_product_type_label( $product->downloadable ?? '', $product->virtual ?? '', 'simple' );
            }
            $per_product_threshold = get_post_meta( $product_id, '_zexst_low_stock_threshold', true );
            $threshold_override = ( '' !== $per_product_threshold && $per_product_threshold > 0 ? (int) $per_product_threshold : null );
            $data[] = array(
                'id'                           => $product_id,
                'parent_id'                    => 0,
                'type'                         => $type,
                'name'                         => $product->post_title,
                'sku'                          => $product->sku ?? '',
                'image_url'                    => $image_url,
                'stock_qty'                    => ( $no_own_stock ? null : $stock_qty ),
                'stock_status'                 => ( $no_own_stock ? null : $product->stock_status ?? '' ),
                'category'                     => $product->categories ?? '',
                'regular_price'                => ( $no_own_stock ? null : $product->regular_price ?? null ),
                'sale_price'                   => ( $no_own_stock ? null : $product->sale_price ?? null ),
                'date_on_sale_from'            => ( $no_own_stock ? null : (( !empty( $product->date_on_sale_from ) ? gmdate( 'Y-m-d', (int) $product->date_on_sale_from ) : null )) ),
                'date_on_sale_to'              => ( $no_own_stock ? null : (( !empty( $product->date_on_sale_to ) ? gmdate( 'Y-m-d', (int) $product->date_on_sale_to ) : null )) ),
                'manage_stock'                 => $manage_stock,
                'reserved_qty'                 => $reserved_map[$product_id] ?? 0,
                'sold_today'                   => (int) ($product->sold_today ?? 0),
                'sold_last_14_days'            => (int) ($product->sold_last_14_days ?? 0),
                'low_stock_threshold_override' => $threshold_override,
                'purchase_price'               => ( $no_own_stock ? null : $product->purchase_price ?? null ),
                'supplier_sku'                 => ( $no_own_stock ? '' : $product->supplier_sku ?? '' ),
                'barcode'                      => ( $no_own_stock ? '' : $product->barcode ?? '' ),
            );
            if ( $threshold_override !== null && !$no_own_stock && $stock_qty !== null ) {
                $last = count( $data ) - 1;
                if ( $stock_qty <= 0 ) {
                    $data[$last]['stock_status'] = 'out_of_stock';
                } elseif ( $stock_qty <= $threshold_override ) {
                    $data[$last]['stock_status'] = 'low_stock';
                } else {
                    $data[$last]['stock_status'] = 'in_stock';
                }
            }
        }
        $variable_ids = array();
        $grouped_ids = array();
        foreach ( $data as $row ) {
            if ( 'variable' === $row['type'] ) {
                $variable_ids[] = $row['id'];
            } elseif ( 'grouped' === $row['type'] ) {
                $grouped_ids[] = $row['id'];
            }
        }
        $variations_by_parent = self::get_variations_batch_for_rest( $variable_ids, $threshold );
        $children_by_parent = self::get_grouped_children_batch_for_rest( $grouped_ids );
        foreach ( $data as &$row ) {
            $row['variations'] = ( 'variable' === $row['type'] ? $variations_by_parent[$row['id']] ?? array() : null );
            $row['children'] = ( 'grouped' === $row['type'] ? $children_by_parent[$row['id']] ?? array() : null );
        }
        unset($row);
        return array(
            'data'        => $data,
            'total'       => $filtered,
            'total_pages' => (int) ceil( $filtered / $per_page ),
        );
    }

    public static function get_variations_batch_for_rest( array $product_ids, int $threshold = 10 ) : array {
        global $wpdb;
        $product_ids = array_values( array_unique( array_filter( array_map( 'absint', $product_ids ) ) ) );
        if ( empty( $product_ids ) ) {
            return array();
        }
        $by_parent = array_fill_keys( $product_ids, array() );
        $threshold = ( $threshold > 0 ? $threshold : absint( zexst_get_setting( 'low_stock_threshold', 10 ) ) );
        $sales_periods = self::get_sales_period_boundaries( 14 );
        $today_utc = $sales_periods['today_utc'];
        $fourteen_utc = $sales_periods['days_ago_utc'];
        $ids_in = implode( ',', $product_ids );
        $sql = "\n\t\t\tSELECT pv.ID, pv.post_parent, pv.menu_order,\n\t\t\t\tstock_meta.meta_value         AS stock,\n\t\t\t\tsku_meta.meta_value           AS sku,\n\t\t\t\tmanage_meta.meta_value        AS manage_stock,\n\t\t\t\timage_meta.meta_value         AS image_id,\n\t\t\t\tvirtual_meta.meta_value       AS `virtual`,\n\t\t\t\tdownloadable_meta.meta_value  AS downloadable,\n\t\t\t\tregular_price_meta.meta_value     AS regular_price,\n\t\t\t\tsale_price_meta.meta_value        AS sale_price,\n\t\t\t\tsale_date_from_meta.meta_value    AS date_on_sale_from,\n\t\t\t\tsale_date_to_meta.meta_value      AS date_on_sale_to,\n\t\t\t\tpurchase_price_meta.meta_value    AS purchase_price,\n\t\t\t\tsupplier_sku_meta.meta_value      AS supplier_sku,\n\t\t\t\tbarcode_meta.meta_value           AS barcode,\n\t\t\t\tCASE\n\t\t\t\t\tWHEN manage_meta.meta_value != 'yes' THEN ''\n\t\t\t\t\tWHEN stock_meta.meta_value IS NULL\n\t\t\t\t\t     OR CAST( stock_meta.meta_value AS SIGNED ) <= 0 THEN 'out_of_stock'\n\t\t\t\t\tWHEN CAST( stock_meta.meta_value AS SIGNED ) <= {$threshold} THEN 'low_stock'\n\t\t\t\t\tELSE 'in_stock'\n\t\t\t\tEND AS stock_status,\n\t\t\t\tCOALESCE( ( " . self::build_sold_subquery( 'pv.ID', true ) . " ), 0 ) AS sold_today,\n\t\t\t\tCOALESCE( ( " . self::build_sold_subquery( 'pv.ID', true ) . " ), 0 ) AS sold_last_14_days\n\t\t\tFROM {$wpdb->posts} pv\n\t\t\tLEFT JOIN {$wpdb->postmeta} stock_meta\n\t\t\t\tON ( pv.ID = stock_meta.post_id AND stock_meta.meta_key = '_stock' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sku_meta\n\t\t\t\tON ( pv.ID = sku_meta.post_id AND sku_meta.meta_key = '_sku' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} manage_meta\n\t\t\t\tON ( pv.ID = manage_meta.post_id AND manage_meta.meta_key = '_manage_stock' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} image_meta\n\t\t\t\tON ( pv.ID = image_meta.post_id AND image_meta.meta_key = '_thumbnail_id' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} virtual_meta\n\t\t\t\tON ( pv.ID = virtual_meta.post_id AND virtual_meta.meta_key = '_virtual' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} downloadable_meta\n\t\t\t\tON ( pv.ID = downloadable_meta.post_id AND downloadable_meta.meta_key = '_downloadable' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} regular_price_meta\n\t\t\t\tON ( pv.ID = regular_price_meta.post_id AND regular_price_meta.meta_key = '_regular_price' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sale_price_meta\n\t\t\t\tON ( pv.ID = sale_price_meta.post_id AND sale_price_meta.meta_key = '_sale_price' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sale_date_from_meta\n\t\t\t\tON ( pv.ID = sale_date_from_meta.post_id AND sale_date_from_meta.meta_key = '_sale_price_dates_from' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sale_date_to_meta\n\t\t\t\tON ( pv.ID = sale_date_to_meta.post_id AND sale_date_to_meta.meta_key = '_sale_price_dates_to' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} purchase_price_meta\n\t\t\t\tON ( pv.ID = purchase_price_meta.post_id AND purchase_price_meta.meta_key = '_zexst_purchase_price' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} supplier_sku_meta\n\t\t\t\tON ( pv.ID = supplier_sku_meta.post_id AND supplier_sku_meta.meta_key = '_zexst_supplier_sku' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} barcode_meta\n\t\t\t\tON ( pv.ID = barcode_meta.post_id AND barcode_meta.meta_key = '_zexst_barcode' )\n\t\t\tWHERE pv.post_type   = 'product_variation'\n\t\t\t  AND pv.post_status = 'publish'\n\t\t\t  AND pv.post_parent IN ( {$ids_in} )\n\t\t\tORDER BY pv.post_parent ASC, pv.menu_order ASC, pv.ID ASC\n\t\t";
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $sql is built from hardcoded join fragments and an absint() $threshold; %s placeholders are bound via prepare() args.
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, $today_utc, $fourteen_utc ) );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
        $var_ids = array_map( fn( $v ) => (int) $v->ID, $rows );
        $reserved_map = self::get_reserved_qty_map( $var_ids );
        $var_label_map = self::batch_resolve_variation_labels( $var_ids );
        $parent_thumb_cache = array();
        foreach ( $rows as $var ) {
            $var_id = (int) $var->ID;
            $parent_id = (int) $var->post_parent;
            $manage_stock = 'yes' === ($var->manage_stock ?? '');
            $image_id = (int) ($var->image_id ?? 0);
            if ( $image_id > 0 ) {
                $image_url = self::get_product_image_url( $image_id );
            } else {
                if ( !isset( $parent_thumb_cache[$parent_id] ) ) {
                    $parent_thumb_cache[$parent_id] = self::get_product_image_url( (int) get_post_thumbnail_id( $parent_id ) );
                }
                $image_url = $parent_thumb_cache[$parent_id];
            }
            $per_var_threshold = get_post_meta( $var_id, '_zexst_low_stock_threshold', true );
            $var_threshold_override = ( '' !== $per_var_threshold && $per_var_threshold > 0 ? (int) $per_var_threshold : null );
            $var_stock_qty = ( null !== $var->stock ? (int) $var->stock : null );
            $stock_status = $var->stock_status ?? '';
            if ( $var_threshold_override !== null && $var_stock_qty !== null ) {
                if ( $var_stock_qty <= 0 ) {
                    $stock_status = 'out_of_stock';
                } elseif ( $var_stock_qty <= $var_threshold_override ) {
                    $stock_status = 'low_stock';
                } else {
                    $stock_status = 'in_stock';
                }
            }
            $by_parent[$parent_id][] = array(
                'id'                           => $var_id,
                'parent_id'                    => $parent_id,
                'type'                         => self::resolve_product_type_label( $var->downloadable ?? '', $var->virtual ?? '', 'variation' ),
                'name'                         => $var_label_map[$var_id] ?? '',
                'sku'                          => $var->sku ?? '',
                'image_url'                    => $image_url,
                'stock_qty'                    => $var_stock_qty,
                'stock_status'                 => $stock_status,
                'category'                     => '',
                'regular_price'                => $var->regular_price ?? null,
                'sale_price'                   => $var->sale_price ?? null,
                'date_on_sale_from'            => ( !empty( $var->date_on_sale_from ) ? gmdate( 'Y-m-d', (int) $var->date_on_sale_from ) : null ),
                'date_on_sale_to'              => ( !empty( $var->date_on_sale_to ) ? gmdate( 'Y-m-d', (int) $var->date_on_sale_to ) : null ),
                'manage_stock'                 => $manage_stock,
                'reserved_qty'                 => $reserved_map[$var_id] ?? 0,
                'sold_today'                   => (int) ($var->sold_today ?? 0),
                'sold_last_14_days'            => (int) ($var->sold_last_14_days ?? 0),
                'low_stock_threshold_override' => $var_threshold_override,
                'purchase_price'               => $var->purchase_price ?? null,
                'supplier_sku'                 => $var->supplier_sku ?? '',
                'barcode'                      => $var->barcode ?? '',
            );
        }
        return $by_parent;
    }

    public static function get_product_variations_for_rest( int $product_id ) : array {
        return self::get_variations_batch_for_rest( array($product_id) )[$product_id] ?? array();
    }

    public static function get_grouped_children_batch_for_rest( array $product_ids ) : array {
        global $wpdb;
        $product_ids = array_values( array_unique( array_filter( array_map( 'absint', $product_ids ) ) ) );
        if ( empty( $product_ids ) ) {
            return array();
        }
        $by_parent = array_fill_keys( $product_ids, array() );
        $children_order = array();
        $child_to_parent = array();
        foreach ( $product_ids as $parent_id ) {
            $product = wc_get_product( $parent_id );
            if ( !$product instanceof \WC_Product_Grouped ) {
                continue;
            }
            $ids = array_map( 'absint', $product->get_children() );
            $children_order[$parent_id] = $ids;
            foreach ( $ids as $child_id ) {
                $child_to_parent[$child_id] = $parent_id;
            }
        }
        if ( empty( $child_to_parent ) ) {
            return $by_parent;
        }
        $threshold = absint( zexst_get_setting( 'low_stock_threshold', 10 ) );
        $sales_periods = self::get_sales_period_boundaries( 14 );
        $today_utc = $sales_periods['today_utc'];
        $fourteen_utc = $sales_periods['days_ago_utc'];
        $all_child_ids = array_keys( $child_to_parent );
        $ids_in = implode( ',', $all_child_ids );
        $sql = "\n\t\t\tSELECT p.ID, p.post_title,\n\t\t\t\tmanage_meta.meta_value  AS manage_stock,\n\t\t\t\tstock_meta.meta_value   AS stock,\n\t\t\t\tsku_meta.meta_value     AS sku,\n\t\t\t\timage_meta.meta_value   AS image_id,\n\t\t\t\tvirtual_meta.meta_value AS `virtual`,\n\t\t\t\tdownloadable_meta.meta_value AS downloadable,\n\t\t\t\tregular_price_meta.meta_value     AS regular_price,\n\t\t\t\tsale_price_meta.meta_value        AS sale_price,\n\t\t\t\tsale_date_from_meta.meta_value    AS date_on_sale_from,\n\t\t\t\tsale_date_to_meta.meta_value      AS date_on_sale_to,\n\t\t\t\tpurchase_price_meta.meta_value    AS purchase_price,\n\t\t\t\tsupplier_sku_meta.meta_value      AS supplier_sku,\n\t\t\t\tbarcode_meta.meta_value           AS barcode,\n\t\t\t\tCASE\n\t\t\t\t\tWHEN manage_meta.meta_value != 'yes' THEN ''\n\t\t\t\t\tWHEN stock_meta.meta_value IS NULL\n\t\t\t\t\t     OR CAST( stock_meta.meta_value AS SIGNED ) <= 0 THEN 'out_of_stock'\n\t\t\t\t\tWHEN CAST( stock_meta.meta_value AS SIGNED ) <= {$threshold} THEN 'low_stock'\n\t\t\t\t\tELSE 'in_stock'\n\t\t\t\tEND AS stock_status,\n\t\t\t\tCOALESCE( ( " . self::build_sold_subquery( 'p.ID', false ) . " ), 0 ) AS sold_today,\n\t\t\t\tCOALESCE( ( " . self::build_sold_subquery( 'p.ID', false ) . " ), 0 ) AS sold_last_14_days\n\t\t\tFROM {$wpdb->posts} p\n\t\t\tLEFT JOIN {$wpdb->postmeta} manage_meta\n\t\t\t\tON ( p.ID = manage_meta.post_id AND manage_meta.meta_key = '_manage_stock' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} stock_meta\n\t\t\t\tON ( p.ID = stock_meta.post_id AND stock_meta.meta_key = '_stock' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sku_meta\n\t\t\t\tON ( p.ID = sku_meta.post_id AND sku_meta.meta_key = '_sku' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} image_meta\n\t\t\t\tON ( p.ID = image_meta.post_id AND image_meta.meta_key = '_thumbnail_id' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} virtual_meta\n\t\t\t\tON ( p.ID = virtual_meta.post_id AND virtual_meta.meta_key = '_virtual' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} downloadable_meta\n\t\t\t\tON ( p.ID = downloadable_meta.post_id AND downloadable_meta.meta_key = '_downloadable' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} regular_price_meta\n\t\t\t\tON ( p.ID = regular_price_meta.post_id AND regular_price_meta.meta_key = '_regular_price' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sale_price_meta\n\t\t\t\tON ( p.ID = sale_price_meta.post_id AND sale_price_meta.meta_key = '_sale_price' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sale_date_from_meta\n\t\t\t\tON ( p.ID = sale_date_from_meta.post_id AND sale_date_from_meta.meta_key = '_sale_price_dates_from' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} sale_date_to_meta\n\t\t\t\tON ( p.ID = sale_date_to_meta.post_id AND sale_date_to_meta.meta_key = '_sale_price_dates_to' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} purchase_price_meta\n\t\t\t\tON ( p.ID = purchase_price_meta.post_id AND purchase_price_meta.meta_key = '_zexst_purchase_price' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} supplier_sku_meta\n\t\t\t\tON ( p.ID = supplier_sku_meta.post_id AND supplier_sku_meta.meta_key = '_zexst_supplier_sku' )\n\t\t\tLEFT JOIN {$wpdb->postmeta} barcode_meta\n\t\t\t\tON ( p.ID = barcode_meta.post_id AND barcode_meta.meta_key = '_zexst_barcode' )\n\t\t\tWHERE p.ID IN ( {$ids_in} )\n\t\t\t  AND p.post_type   = 'product'\n\t\t\t  AND p.post_status = 'publish'\n\t\t";
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $sql is built from hardcoded join fragments, an absint() $threshold, and $ids_in (absint()-mapped IDs); %s placeholders are bound via prepare() args.
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, $today_utc, $fourteen_utc ) );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
        $indexed = array();
        foreach ( $rows as $row ) {
            $indexed[(int) $row->ID] = $row;
        }
        $reserved_map = self::get_reserved_qty_map( $all_child_ids );
        foreach ( $children_order as $parent_id => $ordered_ids ) {
            foreach ( $ordered_ids as $child_id ) {
                if ( !isset( $indexed[$child_id] ) ) {
                    continue;
                }
                $row = $indexed[$child_id];
                $manage_stock = 'yes' === ($row->manage_stock ?? '');
                $image_url = self::get_product_image_url( (int) ($row->image_id ?? 0) );
                $per_child_threshold = get_post_meta( $child_id, '_zexst_low_stock_threshold', true );
                $child_threshold_override = ( '' !== $per_child_threshold && $per_child_threshold > 0 ? (int) $per_child_threshold : null );
                $child_stock_qty = ( null !== $row->stock ? (int) $row->stock : null );
                $stock_status = $row->stock_status ?? '';
                if ( $child_threshold_override !== null && $child_stock_qty !== null ) {
                    if ( $child_stock_qty <= 0 ) {
                        $stock_status = 'out_of_stock';
                    } elseif ( $child_stock_qty <= $child_threshold_override ) {
                        $stock_status = 'low_stock';
                    } else {
                        $stock_status = 'in_stock';
                    }
                }
                $by_parent[$parent_id][] = array(
                    'id'                           => $child_id,
                    'parent_id'                    => $parent_id,
                    'type'                         => self::resolve_product_type_label( $row->downloadable ?? '', $row->virtual ?? '', 'simple' ),
                    'name'                         => $row->post_title,
                    'sku'                          => $row->sku ?? '',
                    'image_url'                    => $image_url,
                    'stock_qty'                    => $child_stock_qty,
                    'stock_status'                 => $stock_status,
                    'category'                     => '',
                    'regular_price'                => $row->regular_price ?? null,
                    'sale_price'                   => $row->sale_price ?? null,
                    'date_on_sale_from'            => ( !empty( $row->date_on_sale_from ) ? gmdate( 'Y-m-d', (int) $row->date_on_sale_from ) : null ),
                    'date_on_sale_to'              => ( !empty( $row->date_on_sale_to ) ? gmdate( 'Y-m-d', (int) $row->date_on_sale_to ) : null ),
                    'manage_stock'                 => $manage_stock,
                    'reserved_qty'                 => $reserved_map[$child_id] ?? 0,
                    'sold_today'                   => (int) ($row->sold_today ?? 0),
                    'sold_last_14_days'            => (int) ($row->sold_last_14_days ?? 0),
                    'low_stock_threshold_override' => $child_threshold_override,
                    'purchase_price'               => $row->purchase_price ?? null,
                    'supplier_sku'                 => $row->supplier_sku ?? '',
                    'barcode'                      => $row->barcode ?? '',
                );
            }
        }
        return $by_parent;
    }

    public static function get_grouped_children_for_rest( int $product_id ) : array {
        return self::get_grouped_children_batch_for_rest( array($product_id) )[$product_id] ?? array();
    }

    private static function get_sales_period_boundaries( int $days_back ) : array {
        $tz = wp_timezone();
        $today_site = new \DateTime('now', $tz);
        $today_site->setTime( 0, 0, 0 );
        $ago_site = clone $today_site;
        $ago_site->modify( "-{$days_back} days" );
        $utc = new \DateTimeZone('UTC');
        $today_utc_dt = clone $today_site;
        $today_utc_dt->setTimezone( $utc );
        $ago_utc_dt = clone $ago_site;
        $ago_utc_dt->setTimezone( $utc );
        return array(
            'today_utc'    => $today_utc_dt->format( 'Y-m-d H:i:s' ),
            'days_ago_utc' => $ago_utc_dt->format( 'Y-m-d H:i:s' ),
        );
    }

    private static function build_sold_subquery( string $id_expr, bool $is_variation ) : string {
        global $wpdb;
        $id_col = ( $is_variation ? 'opl.variation_id' : 'opl.product_id' );
        return "\n\t\t\tSELECT SUM( opl.product_qty )\n\t\t\tFROM {$wpdb->prefix}wc_order_product_lookup opl\n\t\t\tWHERE {$id_col} = {$id_expr}\n\t\t\t  AND opl.date_created >= %s\n\t\t\t  AND (\n\t\t\t      EXISTS (\n\t\t\t          SELECT 1 FROM {$wpdb->prefix}wc_orders wo\n\t\t\t          WHERE wo.id = opl.order_id\n\t\t\t            AND wo.status IN ('wc-completed', 'wc-processing')\n\t\t\t      )\n\t\t\t      OR EXISTS (\n\t\t\t          SELECT 1 FROM {$wpdb->posts} op\n\t\t\t          WHERE op.ID = opl.order_id\n\t\t\t            AND op.post_type = 'shop_order'\n\t\t\t            AND op.post_status IN ('wc-completed', 'wc-processing')\n\t\t\t      )\n\t\t\t  )\n\t\t";
    }

    private static function get_grouped_parent_ids_with_oos_children() : array {
        global $wpdb;
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- static query, no user input; batch-checked below.
        $rows = $wpdb->get_results( "\n\t\t\tSELECT pm.post_id, pm.meta_value\n\t\t\tFROM {$wpdb->postmeta} pm\n\t\t\tINNER JOIN {$wpdb->posts} p\n\t\t\t\tON ( p.ID = pm.post_id AND p.post_type = 'product' AND p.post_status = 'publish' )\n\t\t\tINNER JOIN {$wpdb->term_relationships} tr ON tr.object_id = p.ID\n\t\t\tINNER JOIN {$wpdb->term_taxonomy} tt\n\t\t\t\tON ( tr.term_taxonomy_id = tt.term_taxonomy_id AND tt.taxonomy = 'product_type' )\n\t\t\tINNER JOIN {$wpdb->terms} t\n\t\t\t\tON ( tt.term_id = t.term_id AND t.slug = 'grouped' )\n\t\t\tWHERE pm.meta_key = '_children'\n\t\t\t  AND pm.meta_value NOT IN ( '', 'a:0:{}' )\n\t\t" );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        if ( empty( $rows ) ) {
            return array();
        }
        $parent_to_children = array();
        $all_child_ids = array();
        foreach ( $rows as $row ) {
            $children = maybe_unserialize( $row->meta_value );
            if ( is_array( $children ) && !empty( $children ) ) {
                $children = array_map( 'absint', $children );
                $parent_to_children[(int) $row->post_id] = $children;
                $all_child_ids = array_merge( $all_child_ids, $children );
            }
        }
        if ( empty( $all_child_ids ) ) {
            return array();
        }
        $unique_child_ids = array_unique( $all_child_ids );
        $oos_ids = array();
        foreach ( array_chunk( $unique_child_ids, self::OOS_CHECK_BATCH_SIZE ) as $chunk ) {
            $placeholders = implode( ',', array_fill( 0, count( $chunk ), '%d' ) );
            // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $placeholders is a string of literal %d tokens (one per $chunk item), each bound via the $chunk values passed to prepare() below.
            $chunk_oos_ids = $wpdb->get_col( $wpdb->prepare( "SELECT pm_s.post_id\n\t\t\t\t\tFROM {$wpdb->postmeta} pm_s\n\t\t\t\t\tINNER JOIN {$wpdb->postmeta} pm_ms\n\t\t\t\t\t\tON ( pm_ms.post_id = pm_s.post_id AND pm_ms.meta_key = '_manage_stock' AND pm_ms.meta_value = 'yes' )\n\t\t\t\t\tWHERE pm_s.meta_key = '_stock'\n\t\t\t\t\t  AND pm_s.post_id IN ( {$placeholders} )\n\t\t\t\t\t  AND ( pm_s.meta_value IS NULL OR CAST( pm_s.meta_value AS SIGNED ) <= 0 )", $chunk ) );
            // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
            $oos_ids = array_merge( $oos_ids, $chunk_oos_ids );
        }
        if ( empty( $oos_ids ) ) {
            return array();
        }
        $oos_ids = array_map( 'intval', $oos_ids );
        $result = array();
        foreach ( $parent_to_children as $parent_id => $children ) {
            if ( array_intersect( $children, $oos_ids ) ) {
                $result[] = $parent_id;
            }
        }
        return $result;
    }

    private static function resolve_product_type_label( string $downloadable_meta, string $virtual_meta, string $fallback_type ) : string {
        if ( 'yes' === $downloadable_meta ) {
            return 'downloadable';
        }
        if ( 'yes' === $virtual_meta ) {
            return 'virtual';
        }
        return $fallback_type;
    }

    private static function get_reserved_qty_map( array $product_ids ) : array {
        if ( empty( $product_ids ) ) {
            return array();
        }
        global $wpdb;
        $table = $wpdb->prefix . 'wc_reserved_stock';
        $ids_in = implode( ',', array_map( 'absint', $product_ids ) );
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $table is built from $wpdb->prefix and $ids_in from absint()-mapped IDs; neither is user-supplied SQL.
        $rows = $wpdb->get_results( "SELECT product_id, SUM(stock_quantity) AS reserved FROM {$table} WHERE product_id IN ({$ids_in}) AND expires > NOW() GROUP BY product_id" );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
        $map = array();
        foreach ( $rows as $row ) {
            $map[(int) $row->product_id] = max( 0, (int) $row->reserved );
        }
        return $map;
    }

    private static function batch_resolve_variation_labels( array $var_ids ) : array {
        global $wpdb;
        if ( empty( $var_ids ) ) {
            return array();
        }
        $ids_in = implode( ',', array_map( 'absint', $var_ids ) );
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $ids_in is built from absint()-mapped IDs, not user-supplied SQL.
        $meta_rows = $wpdb->get_results( "SELECT post_id, meta_key, meta_value\n\t\t\t FROM {$wpdb->postmeta}\n\t\t\t WHERE post_id IN ({$ids_in})\n\t\t\t   AND meta_key LIKE 'attribute_%'" );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $attrs_by_var = array();
        $taxonomy_slugs = array();
        foreach ( $meta_rows as $row ) {
            $var_id = (int) $row->post_id;
            $attr_key = $row->meta_key;
            $attr_val = $row->meta_value;
            $attrs_by_var[$var_id][] = array(
                'key'   => $attr_key,
                'value' => $attr_val,
            );
            $taxonomy = str_replace( 'attribute_', '', $attr_key );
            if ( '' !== $attr_val && taxonomy_exists( $taxonomy ) ) {
                $taxonomy_slugs[$taxonomy][$attr_val] = true;
            }
        }
        $term_labels = array();
        foreach ( $taxonomy_slugs as $taxonomy => $slugs ) {
            $terms = get_terms( array(
                'taxonomy'   => $taxonomy,
                'slug'       => array_keys( $slugs ),
                'hide_empty' => false,
            ) );
            if ( is_array( $terms ) ) {
                foreach ( $terms as $term ) {
                    $term_labels[$taxonomy][$term->slug] = $term->name;
                }
            }
        }
        $label_map = array();
        foreach ( $var_ids as $var_id ) {
            $attr_entries = $attrs_by_var[$var_id] ?? array();
            $labels = array();
            foreach ( $attr_entries as $entry ) {
                $attr_val = $entry['value'];
                if ( '' === $attr_val ) {
                    $labels[] = esc_html__( 'Any', 'zexestock-inventory-management-for-woocommerce' );
                    continue;
                }
                $taxonomy = str_replace( 'attribute_', '', $entry['key'] );
                if ( taxonomy_exists( $taxonomy ) ) {
                    $labels[] = $term_labels[$taxonomy][$attr_val] ?? $attr_val;
                } else {
                    $labels[] = $attr_val;
                }
            }
            $label_map[$var_id] = implode( ' / ', array_map( 'esc_html', $labels ) );
        }
        return $label_map;
    }

}
