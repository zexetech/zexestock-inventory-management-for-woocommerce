<?php

defined( 'ABSPATH' ) || exit;

class ZEXST_Alerts {

	public static function register_hooks(): void {
		add_action( 'wp_dashboard_setup', array( 'ZEXST_Alerts', 'register_dashboard_widget' ) );
	}

	public static function register_dashboard_widget(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}

		wp_add_dashboard_widget(
			'zexst_low_stock_widget',
			__( 'Warehouse: Stock Alerts', 'zexestock-inventory-management-for-woocommerce' ),
			array( 'ZEXST_Alerts', 'render_dashboard_widget' )
		);
	}

	public static function render_dashboard_widget(): void {
		$threshold = absint( zexst_get_setting( 'low_stock_threshold', 10 ) );
		$products  = self::get_low_stock_products( 10 );
		$total     = self::get_low_stock_count();

		if ( 0 === $total ) {
			echo '<p>' . esc_html__( 'All managed products have sufficient stock.', 'zexestock-inventory-management-for-woocommerce' ) . '</p>';
			return;
		}

		echo '<p class="zexst-widget-summary">';
		echo esc_html(
			sprintf(
				/* translators: 1: number of products at or below the threshold, 2: the low-stock threshold value. */
				_n(
					'%1$d product is at or below the low-stock threshold (%2$d).',
					'%1$d products are at or below the low-stock threshold (%2$d).',
					$total,
					'zexestock-inventory-management-for-woocommerce'
				),
				$total,
				$threshold
			)
		);
		echo '</p>';

		if ( ! empty( $products ) ) {
			echo '<ul class="zexst-widget-list">';

			foreach ( $products as $row ) {
				$qty   = (int) $row->stock_qty;
				$class = $qty <= 0 ? 'zexst-widget-out-of-stock' : 'zexst-widget-low-stock';

				echo '<li class="' . esc_attr( $class ) . '">';
				echo esc_html( $row->product_name );

				if ( $row->sku ) {
					echo ' <small class="zexst-widget-sku">[' . esc_html( $row->sku ) . ']</small>';
				}

				echo ' &mdash; <strong>' . esc_html( (string) $qty ) . '</strong></li>';
			}

			echo '</ul>';
		}

		if ( $total > 10 ) {
			echo '<p><a href="' . esc_url( admin_url( 'admin.php?page=zexst-stock-manager' ) ) . '">'
				. esc_html__( 'View all in Stock Manager \u2192', 'zexestock-inventory-management-for-woocommerce' )
				. '</a></p>';
		}

		echo '<p><a href="' . esc_url( admin_url( 'admin.php?page=zexst-stock-manager' ) ) . '" class="button button-small">'
			. esc_html__( 'Manage Stock', 'zexestock-inventory-management-for-woocommerce' )
			. '</a></p>';
	}

	public static function get_low_stock_count(): int {
		global $wpdb;

		$threshold = absint( zexst_get_setting( 'low_stock_threshold', 10 ) );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- dashboard-widget aggregate over a custom meta join.
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(DISTINCT p.ID)
				FROM {$wpdb->posts} p
				INNER JOIN {$wpdb->postmeta} ms
					ON ms.post_id = p.ID AND ms.meta_key = '_manage_stock' AND ms.meta_value = 'yes'
				LEFT JOIN {$wpdb->postmeta} sq
					ON sq.post_id = p.ID AND sq.meta_key = '_stock'
				LEFT JOIN {$wpdb->postmeta} pt
					ON pt.post_id = p.ID AND pt.meta_key = '_zexst_low_stock_threshold'
				WHERE p.post_type IN ('product','product_variation')
				AND p.post_status IN ('publish','private')
				AND (
					sq.meta_value IS NULL
					OR (
						pt.meta_value IS NOT NULL AND CAST(pt.meta_value AS SIGNED) > 0
						AND CAST(sq.meta_value AS SIGNED) <= CAST(pt.meta_value AS SIGNED)
					)
					OR (
						( pt.meta_value IS NULL OR CAST(pt.meta_value AS SIGNED) <= 0 )
						AND CAST(sq.meta_value AS SIGNED) <= %d
					)
				)",
				$threshold
			)
		);
	}

	private static function get_low_stock_products( int $limit = 0 ): array {
		global $wpdb;

		$threshold = absint( zexst_get_setting( 'low_stock_threshold', 10 ) );

		$query_args = array( $threshold );
		$limit_sql  = '';
		if ( $limit > 0 ) {
			$limit_sql    = ' LIMIT %d';
			$query_args[] = $limit;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- dashboard-widget listing over a custom meta join; $limit_sql is either empty or the literal ' LIMIT %d', with its value bound via $query_args.
		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT
					p.ID,
					CASE WHEN p.post_type = 'product_variation'
						THEN CONCAT(parent.post_title, ' \xe2\x80\x94 ', p.post_title)
						ELSE p.post_title
					END AS product_name,
					sku_meta.meta_value AS sku,
					CAST(sq.meta_value AS SIGNED) AS stock_qty
				FROM {$wpdb->posts} p
				INNER JOIN {$wpdb->postmeta} ms
					ON ms.post_id = p.ID AND ms.meta_key = '_manage_stock' AND ms.meta_value = 'yes'
				LEFT JOIN {$wpdb->postmeta} sq
					ON sq.post_id = p.ID AND sq.meta_key = '_stock'
				LEFT JOIN {$wpdb->postmeta} sku_meta
					ON sku_meta.post_id = p.ID AND sku_meta.meta_key = '_sku'
				LEFT JOIN {$wpdb->postmeta} pt
					ON pt.post_id = p.ID AND pt.meta_key = '_zexst_low_stock_threshold'
				LEFT JOIN {$wpdb->posts} parent
					ON parent.ID = p.post_parent
				WHERE p.post_type IN ('product','product_variation')
				AND p.post_status IN ('publish','private')
				AND (
					sq.meta_value IS NULL
					OR (
						pt.meta_value IS NOT NULL AND CAST(pt.meta_value AS SIGNED) > 0
						AND CAST(sq.meta_value AS SIGNED) <= CAST(pt.meta_value AS SIGNED)
					)
					OR (
						( pt.meta_value IS NULL OR CAST(pt.meta_value AS SIGNED) <= 0 )
						AND CAST(sq.meta_value AS SIGNED) <= %d
					)
				)
				ORDER BY COALESCE(CAST(sq.meta_value AS SIGNED), 0) ASC, product_name ASC{$limit_sql}",
				$query_args
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		return $results;
	}
}
