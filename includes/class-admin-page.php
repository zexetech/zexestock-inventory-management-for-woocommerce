<?php

defined( 'ABSPATH' ) || exit;

class ZEXST_Admin_Page {

	public static function render_dashboard(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'zexestock-inventory-management-for-woocommerce' ) );
		}

		global $wpdb;

		$threshold = absint( zexst_get_setting( 'low_stock_threshold', 10 ) );

		$tier_counts        = ZEXST_Analytics::get_stock_tier_counts( $threshold );
		$total_managed      = $tier_counts['total'];
		$out_of_stock_count = $tier_counts['out_of_stock'];
		$low_stock_count    = $tier_counts['low_stock'];
		$in_stock_count     = max( 0, $total_managed - $out_of_stock_count - $low_stock_count );

		$product_list_sql = "SELECT
			p.ID,
			CASE WHEN p.post_type = 'product_variation'
				THEN CONCAT(parent.post_title, ' — ', p.post_title)
				ELSE p.post_title
			END AS product_name,
			sku.meta_value AS sku,
			CAST(sq.meta_value AS SIGNED) AS stock_qty
		FROM {$wpdb->posts} p
		INNER JOIN {$wpdb->postmeta} ms
			ON ms.post_id = p.ID AND ms.meta_key = '_manage_stock' AND ms.meta_value = 'yes'
		LEFT JOIN {$wpdb->postmeta} sq ON sq.post_id = p.ID AND sq.meta_key = '_stock'
		LEFT JOIN {$wpdb->postmeta} sku ON sku.post_id = p.ID AND sku.meta_key = '_sku'
		LEFT JOIN {$wpdb->posts} parent ON parent.ID = p.post_parent
		WHERE p.post_type IN ('product','product_variation')
		AND p.post_status IN ('publish','private')";

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- dashboard aggregate over a custom meta join, no object-cache equivalent.
		$out_of_stock_products = $wpdb->get_results(
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $product_list_sql is a static fragment with no user-supplied values.
			$product_list_sql . " AND (sq.meta_value IS NULL OR CAST(sq.meta_value AS SIGNED) <= 0)
			ORDER BY stock_qty ASC, product_name ASC
			LIMIT 15"
		);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- dashboard aggregate over a custom meta join, no object-cache equivalent.
		$low_stock_products = $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $product_list_sql is a static fragment with no user-supplied values; $threshold is bound via prepare() below.
				$product_list_sql . " AND CAST(sq.meta_value AS SIGNED) > 0
				AND CAST(sq.meta_value AS SIGNED) <= %d
				ORDER BY stock_qty ASC, product_name ASC
				LIMIT 15",
				$threshold
			)
		);

		include ZEXST_PLUGIN_DIR . 'admin/views/dashboard.php';
	}

	public static function render(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'zexestock-inventory-management-for-woocommerce' ) );
		}

		include ZEXST_PLUGIN_DIR . 'admin/views/stock-table.php';
	}

	public static function render_wp_dashboard_widget(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}

		$data          = ZEXST_Analytics::get_dashboard_widget_data();
		$dashboard_url = admin_url( 'admin.php?page=zexestock' );
		?>
		<div class="zexst-dash-widget">
			<ul class="zexst-dash-widget-stats">
				<li>
					<span class="zexst-dash-label"><?php esc_html_e( 'Managed Products', 'zexestock-inventory-management-for-woocommerce' ); ?></span>
					<strong><?php echo esc_html( number_format_i18n( $data['total_managed'] ) ); ?></strong>
				</li>
				<li class="zexst-dash-warning">
					<span class="zexst-dash-label"><?php esc_html_e( 'Low Stock', 'zexestock-inventory-management-for-woocommerce' ); ?></span>
					<strong><?php echo esc_html( number_format_i18n( $data['low_stock'] ) ); ?></strong>
				</li>
				<li class="zexst-dash-danger">
					<span class="zexst-dash-label"><?php esc_html_e( 'Out of Stock', 'zexestock-inventory-management-for-woocommerce' ); ?></span>
					<strong><?php echo esc_html( number_format_i18n( $data['out_of_stock'] ) ); ?></strong>
				</li>
				<li>
					<span class="zexst-dash-label"><?php esc_html_e( 'Stock Value', 'zexestock-inventory-management-for-woocommerce' ); ?></span>
					<strong><?php echo esc_html( $data['currency'] . number_format_i18n( $data['stock_value'], 2 ) ); ?></strong>
				</li>
			</ul>

			<p style="margin-top:10px;">
				<a href="<?php echo esc_url( $dashboard_url ); ?>"><?php esc_html_e( 'View Dashboard &rarr;', 'zexestock-inventory-management-for-woocommerce' ); ?></a>
			</p>
		</div>
		<?php
	}

	public static function render_settings(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'zexestock-inventory-management-for-woocommerce' ) );
		}

		if (
			isset( $_POST['action'], $_POST['zexst_reset_nonce'] ) &&
			'zexst_reset_settings' === $_POST['action'] &&
			wp_verify_nonce( sanitize_key( $_POST['zexst_reset_nonce'] ), 'zexst_reset_settings' )
		) {
			update_option( 'zexst_settings', zexst_settings_defaults(), false );
			add_settings_error( 'zexst_settings', 'zexst_reset', __( 'Settings reset to defaults.', 'zexestock-inventory-management-for-woocommerce' ), 'success' );
		}

		include ZEXST_PLUGIN_DIR . 'admin/views/settings.php';
	}
}

function zexst_settings_defaults(): array {
	return array(
		'allow_negative_stock'       => false,
		'low_stock_threshold'        => 10,
		'large_adjustment_warning'   => 500,
		'delete_data_on_uninstall'   => false,
	);
}

function zexst_get_setting( string $key, $default = null ) {
	$settings = get_option( 'zexst_settings', array() );

	if ( ! is_array( $settings ) ) {
		$settings = array();
	}

	if ( array_key_exists( $key, $settings ) ) {
		return $settings[ $key ];
	}

	if ( null !== $default ) {
		return $default;
	}

	$defaults = zexst_settings_defaults();
	return $defaults[ $key ] ?? null;
}
