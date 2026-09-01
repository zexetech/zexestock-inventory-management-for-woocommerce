<?php

defined( 'ABSPATH' ) || exit;
class ZEXST_REST_API {
    const NAMESPACE = 'zexestock/v1';

    const RATE_LIMIT = 100;

    const MAX_SAVED_VIEWS = 20;

    const MAX_VIEW_STATE_DEPTH = 6;

    public function register_routes() : void {
        add_filter( 'rest_post_dispatch', static function ( \WP_REST_Response $response ) : \WP_REST_Response {
            if ( 429 === $response->get_status() ) {
                $response->header( 'Retry-After', '60' );
            }
            return $response;
        } );
        register_rest_route( self::NAMESPACE, '/products', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_products'),
            'permission_callback' => array($this, 'check_stock_permission'),
            'args'                => $this->get_products_schema_args(),
        ) );
        register_rest_route( self::NAMESPACE, '/products/(?P<id>\\d+)/variations', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_variations'),
            'permission_callback' => array($this, 'check_stock_permission'),
            'args'                => array(
                'id' => array(
                    'type'     => 'integer',
                    'minimum'  => 1,
                    'required' => true,
                ),
            ),
        ) );
        register_rest_route( self::NAMESPACE, '/products/(?P<id>\\d+)/grouped-children', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_grouped_children'),
            'permission_callback' => array($this, 'check_stock_permission'),
            'args'                => array(
                'id' => array(
                    'type'     => 'integer',
                    'minimum'  => 1,
                    'required' => true,
                ),
            ),
        ) );
        register_rest_route( self::NAMESPACE, '/products/(?P<id>\\d+)/adjust', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'adjust_stock'),
            'permission_callback' => array($this, 'check_stock_permission'),
            'args'                => $this->get_adjust_schema_args(),
        ) );
        register_rest_route( self::NAMESPACE, '/products/(?P<id>\\d+)/set-price', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'set_price'),
            'permission_callback' => array($this, 'check_stock_permission'),
            'args'                => array(
                'id'                => array(
                    'type'     => 'integer',
                    'minimum'  => 1,
                    'required' => true,
                ),
                'regular_price'     => array(
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => array($this, 'validate_price_param'),
                ),
                'sale_price'        => array(
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => array($this, 'validate_price_param'),
                ),
                'date_on_sale_from' => array(
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'date_on_sale_to'   => array(
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ) );
        register_rest_route( self::NAMESPACE, '/products/(?P<id>\\d+)/set-meta', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'set_meta'),
            'permission_callback' => array($this, 'check_stock_permission'),
            'args'                => array(
                'id'             => array(
                    'type'     => 'integer',
                    'minimum'  => 1,
                    'required' => true,
                ),
                'purchase_price' => array(
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => array($this, 'validate_price_param'),
                ),
                'supplier_sku'   => array(
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'barcode'        => array(
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ) );
        register_rest_route( self::NAMESPACE, '/products/(?P<id>\\d+)/set-sku', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'set_sku'),
            'permission_callback' => array($this, 'check_stock_permission'),
            'args'                => array(
                'sku' => array(
                    'required' => true,
                    'type'     => 'string',
                ),
            ),
        ) );
        register_rest_route( self::NAMESPACE, '/products/(?P<id>\\d+)/threshold', array(
            'methods'             => 'PATCH',
            'callback'            => array($this, 'set_threshold'),
            'permission_callback' => array($this, 'check_stock_permission'),
            'args'                => array(
                'id'        => array(
                    'type'     => 'integer',
                    'minimum'  => 1,
                    'required' => true,
                ),
                'threshold' => array(
                    'type'              => array('integer', 'null'),
                    'minimum'           => 0,
                    'maximum'           => \ZEXST_Constants::MAX_THRESHOLD,
                    'sanitize_callback' => function ( $value ) {
                        return ( null === $value ? null : absint( $value ) );
                    },
                ),
            ),
        ) );
        register_rest_route( self::NAMESPACE, '/settings', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_settings'),
            'permission_callback' => array($this, 'check_settings_permission'),
        ) );
        register_rest_route( self::NAMESPACE, '/settings', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'save_settings'),
            'permission_callback' => array($this, 'check_settings_permission'),
        ) );
    }

    private function check_admin() : bool|\WP_Error {
        if ( !is_user_logged_in() ) {
            return new \WP_Error('rest_not_logged_in', __( 'You must be logged in to access this endpoint.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 401,
            ));
        }
        if ( !current_user_can( 'manage_woocommerce' ) ) {
            return new \WP_Error('rest_forbidden', __( 'Insufficient permissions.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 403,
            ));
        }
        return true;
    }

    public function check_stock_permission() : bool|\WP_Error {
        return $this->check_admin();
    }

    public function check_settings_permission() : bool|\WP_Error {
        return $this->check_admin();
    }

    public function get_products( \WP_REST_Request $request ) : \WP_REST_Response|\WP_Error {
        $params = array(
            'page'             => absint( ( $request->get_param( 'page' ) ?: 1 ) ),
            'per_page'         => min( 250, max( 1, absint( ( $request->get_param( 'per_page' ) ?: 50 ) ) ) ),
            'search'           => sanitize_text_field( ( $request->get_param( 'search' ) ?: '' ) ),
            'search_field'     => sanitize_key( ( $request->get_param( 'search_field' ) ?: '' ) ),
            'category'         => absint( ( $request->get_param( 'category' ) ?: 0 ) ),
            'product_type'     => sanitize_key( ( $request->get_param( 'product_type' ) ?: '' ) ),
            'stock_status'     => sanitize_key( ( $request->get_param( 'stock_status' ) ?: '' ) ),
            'orderby'          => sanitize_key( ( $request->get_param( 'orderby' ) ?: 'name' ) ),
            'order'            => ( 'desc' === strtolower( ( $request->get_param( 'order' ) ?: 'asc' ) ) ? 'desc' : 'asc' ),
            'low_stock'        => (bool) $request->get_param( 'low_stock' ),
        );
        $result = ZEXST_Stock_Manager::get_products_for_rest( $params );
        if ( is_wp_error( $result ) ) {
            return $result;
        }
        $response = new \WP_REST_Response(array(
            'data' => $result['data'],
            'meta' => array(
                'total'       => $result['total'],
                'total_pages' => $result['total_pages'],
                'page'        => $params['page'],
                'per_page'    => $params['per_page'],
            ),
        ), 200);
        $response->header( 'X-WP-Total', $result['total'] );
        $response->header( 'X-WP-TotalPages', $result['total_pages'] );
        $etag_data = implode( ',', array_column( $result['data'], 'id' ) ) . '|' . implode( ',', array_column( $result['data'], 'stock_qty' ) );
        return $this->add_etag_headers( $response, $etag_data, $request );
    }

    public function get_variations( \WP_REST_Request $request ) : \WP_REST_Response|\WP_Error {
        $product_id = absint( $request->get_param( 'id' ) );
        $product = wc_get_product( $product_id );
        if ( !$product instanceof \WC_Product ) {
            return new \WP_Error('product_not_found', __( 'Product not found.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 404,
            ));
        }
        $variations = ZEXST_Stock_Manager::get_product_variations_for_rest( $product_id );
        $response = new \WP_REST_Response($variations, 200);
        $etag_data = implode( ',', array_column( $variations, 'id' ) ) . '|' . implode( ',', array_column( $variations, 'stock_qty' ) );
        return $this->add_etag_headers( $response, $etag_data, $request );
    }

    public function get_grouped_children( \WP_REST_Request $request ) : \WP_REST_Response|\WP_Error {
        $product_id = absint( $request->get_param( 'id' ) );
        $product = wc_get_product( $product_id );
        if ( !$product instanceof \WC_Product ) {
            return new \WP_Error('product_not_found', __( 'Product not found.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 404,
            ));
        }
        if ( !$product instanceof \WC_Product_Grouped ) {
            return new \WP_Error('not_grouped_product', __( 'Product is not a grouped product.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 400,
            ));
        }
        $children = ZEXST_Stock_Manager::get_grouped_children_for_rest( $product_id );
        return new \WP_REST_Response($children, 200);
    }

    public function adjust_stock( \WP_REST_Request $request ) : \WP_REST_Response|\WP_Error {
        $rl = $this->check_rate_limit( get_current_user_id() );
        if ( is_wp_error( $rl ) ) {
            return $rl;
        }
        $product_id = absint( $request->get_param( 'id' ) );
        $target_stock = intval( $request->get_param( 'adjustment' ) );
        $raw_expected = $request->get_param( 'expected_stock' );
        $expected_stock = ( null !== $raw_expected && '' !== $raw_expected ? intval( $raw_expected ) : null );
        $product = wc_get_product( $product_id );
        if ( !$product instanceof \WC_Product ) {
            return new \WP_Error('product_not_found', __( 'Product not found.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 404,
            ));
        }
        $current_stock = (int) $product->get_stock_quantity();
        $adjustment = $target_stock - $current_stock;
        $result = ZEXST_Stock_Manager::adjust_stock(
            $product_id,
            $adjustment,
            'manual',
            $expected_stock
        );
        if ( is_wp_error( $result ) ) {
            $code = $result->get_error_code();
            $error_data = $result->get_error_data( $code );
            if ( 'stock_mismatch' === $code && is_array( $error_data ) ) {
                return new \WP_Error($code, $result->get_error_message(), array(
                    'status'        => 409,
                    'current_stock' => (int) ($error_data['current_stock'] ?? 0),
                ));
            }
            return new \WP_Error($code, $result->get_error_message(), array(
                'status' => 400,
            ));
        }
        return new \WP_REST_Response(array(
            'product_id'     => $product_id,
            'variation_id'   => 0,
            'previous_stock' => $result['previous_stock'] ?? null,
            'new_stock'      => $result['new_stock'],
            'adjustment'     => $adjustment,
            'log_id'         => $result['log_id'],
        ), 200);
    }

    public function validate_revert_item( $item, \WP_REST_Request $request ) : bool {
        $field = $item['field'] ?? '';
        $val = $item['old_value'] ?? null;
        return match ($field) {
            'stock' => is_int( $val ) || is_null( $val ),
            'regular_price', 'sale_price', 'purchase_price' => is_null( $val ) || '' === $val || is_numeric( $val ),
            'sku' => is_string( $val ),
            'threshold' => is_null( $val ) || is_int( $val ) && $val >= 0,
            'date_on_sale_from', 'date_on_sale_to' => is_null( $val ) || is_string( $val ),
            default => false,
        };
    }

    public function set_threshold( \WP_REST_Request $request ) : \WP_REST_Response|\WP_Error {
        $product_id = absint( $request->get_param( 'id' ) );
        $threshold = $request->get_param( 'threshold' );
        $product = wc_get_product( $product_id );
        if ( !$product ) {
            return new \WP_Error('zexst_invalid_product', __( 'Product not found.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 404,
            ));
        }
        if ( null === $threshold ) {
            delete_post_meta( $product_id, '_zexst_low_stock_threshold' );
        } else {
            update_post_meta( $product_id, '_zexst_low_stock_threshold', absint( $threshold ) );
        }
        return new \WP_REST_Response(array(
            'id'        => $product_id,
            'threshold' => $threshold,
        ), 200);
    }

    public function set_price( \WP_REST_Request $request ) : \WP_REST_Response|\WP_Error {
        $rl = $this->check_rate_limit( get_current_user_id() );
        if ( is_wp_error( $rl ) ) {
            return $rl;
        }
        $product_id = absint( $request->get_param( 'id' ) );
        $regular_price = $request->get_param( 'regular_price' );
        $sale_price = $request->get_param( 'sale_price' );
        $date_on_sale_from = $request->get_param( 'date_on_sale_from' );
        $date_on_sale_to = $request->get_param( 'date_on_sale_to' );
        if ( null === $regular_price && null === $sale_price && null === $date_on_sale_from && null === $date_on_sale_to ) {
            return new \WP_Error('zexst_missing_price', __( 'At least one of regular_price, sale_price, date_on_sale_from, or date_on_sale_to is required.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 400,
            ));
        }
        $product = wc_get_product( $product_id );
        if ( !$product || $product->is_type( 'variable' ) ) {
            return new \WP_Error('zexst_invalid_product', __( 'Product not found or is a variable product.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 404,
            ));
        }
        if ( null !== $regular_price ) {
            $product->set_regular_price( wc_format_decimal( $regular_price ) );
        }
        if ( null !== $sale_price ) {
            $product->set_sale_price( ( '' === $sale_price ? '' : wc_format_decimal( $sale_price ) ) );
        }
        if ( null !== $date_on_sale_from ) {
            $product->set_date_on_sale_from( ( '' === $date_on_sale_from ? null : $date_on_sale_from ) );
        }
        if ( null !== $date_on_sale_to ) {
            $product->set_date_on_sale_to( ( '' === $date_on_sale_to ? null : $date_on_sale_to ) );
        }
        $product->save();
        $saved_from = $product->get_date_on_sale_from();
        $saved_to = $product->get_date_on_sale_to();
        return new \WP_REST_Response(array(
            'id'                => $product_id,
            'regular_price'     => $product->get_regular_price(),
            'sale_price'        => $product->get_sale_price(),
            'date_on_sale_from' => ( $saved_from ? $saved_from->date( 'Y-m-d' ) : null ),
            'date_on_sale_to'   => ( $saved_to ? $saved_to->date( 'Y-m-d' ) : null ),
        ), 200);
    }

    public function set_meta( \WP_REST_Request $request ) : \WP_REST_Response|\WP_Error {
        $rl = $this->check_rate_limit( get_current_user_id() );
        if ( is_wp_error( $rl ) ) {
            return $rl;
        }
        $product_id = absint( $request->get_param( 'id' ) );
        $purchase_price = $request->get_param( 'purchase_price' );
        $supplier_sku = $request->get_param( 'supplier_sku' );
        $barcode = $request->get_param( 'barcode' );
        if ( null === $purchase_price && null === $supplier_sku && null === $barcode ) {
            return new \WP_Error('zexst_missing_meta', __( 'At least one of purchase_price, supplier_sku, or barcode is required.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 400,
            ));
        }
        $product = wc_get_product( $product_id );
        if ( !$product ) {
            return new \WP_Error('zexst_invalid_product', __( 'Product not found.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 404,
            ));
        }
        if ( null !== $purchase_price ) {
            $sanitized = ( '' === $purchase_price ? '' : wc_format_decimal( $purchase_price ) );
            update_post_meta( $product_id, '_zexst_purchase_price', $sanitized );
        }
        if ( null !== $supplier_sku ) {
            update_post_meta( $product_id, '_zexst_supplier_sku', sanitize_text_field( $supplier_sku ) );
        }
        if ( null !== $barcode ) {
            update_post_meta( $product_id, '_zexst_barcode', sanitize_text_field( $barcode ) );
        }
        return new \WP_REST_Response(array(
            'id'             => $product_id,
            'purchase_price' => ( get_post_meta( $product_id, '_zexst_purchase_price', true ) ?: null ),
            'supplier_sku'   => ( get_post_meta( $product_id, '_zexst_supplier_sku', true ) ?: '' ),
            'barcode'        => ( get_post_meta( $product_id, '_zexst_barcode', true ) ?: '' ),
        ), 200);
    }

    public function set_sku( \WP_REST_Request $request ) : \WP_REST_Response|\WP_Error {
        $rl = $this->check_rate_limit( get_current_user_id() );
        if ( is_wp_error( $rl ) ) {
            return $rl;
        }
        $product_id = absint( $request->get_param( 'id' ) );
        $sku = trim( $request->get_param( 'sku' ) );
        $product = wc_get_product( $product_id );
        if ( !$product ) {
            return new \WP_Error('zexst_invalid_product', __( 'Product not found.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 404,
            ));
        }
        if ( '' !== $sku ) {
            $existing_id = wc_get_product_id_by_sku( $sku );
            if ( $existing_id && $existing_id !== $product_id ) {
                return new \WP_Error('zexst_sku_conflict', __( 'SKU is already used by another product.', 'zexestock-inventory-management-for-woocommerce' ), array(
                    'status' => 409,
                ));
            }
        }
        $product->set_sku( $sku );
        $product->save();
        return new \WP_REST_Response(array(
            'id'  => $product_id,
            'sku' => $product->get_sku(),
        ), 200);
    }

    private function add_etag_headers( \WP_REST_Response $response, string $etag_data, \WP_REST_Request $request ) : \WP_REST_Response {
        $etag = '"' . md5( $etag_data . '|' . get_current_user_id() ) . '"';
        $if_none_match = trim( $request->get_header( 'If-None-Match' ) );
        if ( $if_none_match === $etag ) {
            return new \WP_REST_Response(null, 304);
        }
        $response->header( 'ETag', $etag );
        $response->header( 'Cache-Control', 'private, no-cache' );
        return $response;
    }

    private function check_rate_limit( int $user_id ) : bool|\WP_Error {
        $key = 'zexst_rl_' . $user_id . '_' . floor( time() / 60 );
        if ( wp_using_ext_object_cache() ) {
            $new_count = wp_cache_incr( $key, 1, 'zexst_rate_limit' );
            if ( false === $new_count ) {
                wp_cache_set(
                    $key,
                    1,
                    'zexst_rate_limit',
                    90
                );
                $new_count = 1;
            }
        } else {
            $current = (int) get_transient( $key );
            $new_count = $current + 1;
            set_transient( $key, $new_count, 90 );
        }
        if ( $new_count > self::RATE_LIMIT ) {
            return new \WP_Error('rate_limit_exceeded', __( 'Too many requests. Please wait before retrying.', 'zexestock-inventory-management-for-woocommerce' ), array(
                'status' => 429,
            ));
        }
        return true;
    }

    public function validate_price_param( $value ) : true|\WP_Error {
        if ( null === $value || '' === $value ) {
            return true;
        }
        $numeric = floatval( $value );
        if ( $numeric < 0 ) {
            return new \WP_Error('rest_invalid_price', __( 'Price cannot be negative.', 'zexestock-inventory-management-for-woocommerce' ));
        }
        if ( $numeric > \ZEXST_Constants::MAX_PRICE ) {
            return new \WP_Error('rest_invalid_price', sprintf(
                /* translators: %s: the maximum allowed price, formatted with number_format(). */
                __( 'Price cannot exceed %s.', 'zexestock-inventory-management-for-woocommerce' ),
                number_format( \ZEXST_Constants::MAX_PRICE, 2 )
             ));
        }
        return true;
    }

    private function get_products_schema_args() : array {
        return array(
            'page'             => array(
                'type'    => 'integer',
                'default' => 1,
                'minimum' => 1,
            ),
            'per_page'         => array(
                'type'    => 'integer',
                'default' => 50,
                'minimum' => 1,
                'maximum' => 250,
            ),
            'search'           => array(
                'type'              => 'string',
                'default'           => '',
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'category'         => array(
                'type'    => 'integer',
                'default' => 0,
                'minimum' => 0,
            ),
            'stock_status'     => array(
                'type'              => 'string',
                'default'           => '',
                'sanitize_callback' => 'sanitize_key',
                'enum'              => array(
                    '',
                    'in_stock',
                    'low_stock',
                    'out_of_stock'
                ),
            ),
            'orderby'          => array(
                'type'              => 'string',
                'default'           => 'name',
                'sanitize_callback' => 'sanitize_key',
                'enum'              => array(
                    'name',
                    'sku',
                    'stock_qty',
                    'type',
                    'category',
                    'stock_status',
                    'regular_price',
                    'sale_price',
                    'purchase_price',
                    'supplier_sku',
                    'barcode',
                    'low_stock_threshold_override',
                    'sold_today',
                    'sold_last_14_days'
                ),
            ),
            'order'            => array(
                'type'              => 'string',
                'default'           => 'asc',
                'sanitize_callback' => 'sanitize_key',
                'enum'              => array('asc', 'desc'),
            ),
            'low_stock'        => array(
                'type'    => 'boolean',
                'default' => false,
            ),
        );
    }

    private function get_adjust_schema_args() : array {
        return array(
            'id'             => array(
                'type'     => 'integer',
                'minimum'  => 1,
                'required' => true,
            ),
            'adjustment'     => array(
                'type'     => 'integer',
                'required' => true,
                'minimum'  => \ZEXST_Constants::MIN_STOCK,
                'maximum'  => \ZEXST_Constants::MAX_STOCK,
            ),
            'expected_stock' => array(
                'type'    => 'integer',
                'minimum' => \ZEXST_Constants::MIN_STOCK,
                'maximum' => \ZEXST_Constants::MAX_STOCK,
            ),
        );
    }

    public function get_settings() : \WP_REST_Response {
        $defaults = zexst_settings_defaults();
        $saved = get_option( 'zexst_settings', array() );
        if ( !is_array( $saved ) ) {
            $saved = array();
        }
        $settings = array_merge( $defaults, $saved );
        $settings['allow_negative_stock'] = (bool) $settings['allow_negative_stock'];
        $settings['low_stock_threshold'] = (int) $settings['low_stock_threshold'];
        $settings['large_adjustment_warning'] = (int) $settings['large_adjustment_warning'];
        $settings['delete_data_on_uninstall'] = (bool) $settings['delete_data_on_uninstall'];
        $response = new \WP_REST_Response($settings, 200);
        $response->header( 'Cache-Control', 'private, max-age=60' );
        $response->header( 'Vary', 'Cookie' );
        return $response;
    }

    public function save_settings( \WP_REST_Request $request ) : \WP_REST_Response|\WP_Error {
        $rl = $this->check_rate_limit( get_current_user_id() );
        if ( is_wp_error( $rl ) ) {
            return $rl;
        }
        $params = $request->get_json_params();
        if ( !is_array( $params ) ) {
            return new \WP_Error('invalid_body', 'Request body must be a JSON object.', array(
                'status' => 400,
            ));
        }
        $existing = get_option( 'zexst_settings', array() );
        if ( !is_array( $existing ) ) {
            $existing = array();
        }
        $allowed_booleans = array(
            'allow_negative_stock',
            'delete_data_on_uninstall'
        );
        $allowed_integers = array('low_stock_threshold', 'large_adjustment_warning');
        $allowed_strings = array();
        $allowed_enums = array();
        $new = $existing;
        foreach ( $allowed_booleans as $key ) {
            if ( isset( $params[$key] ) ) {
                $new[$key] = (bool) $params[$key];
            }
        }
        $integer_max = array(
            'low_stock_threshold'      => \ZEXST_Constants::MAX_THRESHOLD,
            'large_adjustment_warning' => \ZEXST_Constants::MAX_LARGE_ADJ_WARNING,
        );
        foreach ( $allowed_integers as $key ) {
            if ( isset( $params[$key] ) ) {
                $max = $integer_max[$key] ?? PHP_INT_MAX;
                $new[$key] = min( max( 0, (int) $params[$key] ), $max );
            }
        }
        foreach ( $allowed_strings as $key ) {
            if ( isset( $params[$key] ) ) {
                $new[$key] = sanitize_textarea_field( (string) $params[$key] );
            }
        }
        foreach ( $allowed_enums as $key => $values ) {
            if ( isset( $params[$key] ) && in_array( $params[$key], $values, true ) ) {
                $new[$key] = $params[$key];
            }
        }
        update_option( 'zexst_settings', $new, false );
        return $this->get_settings();
    }

}
