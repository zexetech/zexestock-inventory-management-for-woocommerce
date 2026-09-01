<?php

defined( 'ABSPATH' ) || exit;

class ZEXST_Plugin {

	private static ?ZEXST_Plugin $instance = null;

	public static function instance(): ZEXST_Plugin {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'init', array( 'ZEXST_Ajax_Handler', 'register' ) );
		add_action( 'admin_init', array( $this, 'check_woocommerce_dependency' ) );
		add_action( 'admin_init', array( 'ZEXST_Installer', 'maybe_upgrade' ) );
		add_action( 'admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
		add_action( 'wp_dashboard_setup', array( $this, 'register_wp_dashboard_widget' ) );
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );

		ZEXST_Alerts::register_hooks();

		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_product_page_assets' ) );
		add_action( 'woocommerce_product_options_pricing', array( $this, 'render_purchase_price_field' ) );
		add_action( 'woocommerce_product_options_inventory_product_data', array( $this, 'render_inventory_meta_fields' ) );
		add_action( 'woocommerce_process_product_meta', array( $this, 'save_product_meta_fields' ) );
		add_action( 'woocommerce_variation_options_pricing', array( $this, 'render_variation_meta_fields' ), 10, 3 );
		add_action( 'woocommerce_save_product_variation', array( $this, 'save_variation_meta_fields' ), 10, 2 );
	}

	public function register_rest_routes(): void {
		$api = new ZEXST_REST_API();
		$api->register_routes();
	}

	public function check_woocommerce_dependency(): void {
		if ( class_exists( 'WooCommerce' ) ) {
			return;
		}

		if ( ! function_exists( 'deactivate_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		deactivate_plugins( plugin_basename( ZEXST_PLUGIN_FILE ) );

		add_action(
			'admin_notices',
			function () {
				echo '<div class="notice notice-error"><p>';
				echo esc_html__(
					'ZexeStock requires WooCommerce to be installed and active.',
					'zexestock-inventory-management-for-woocommerce'
				);
				echo '</p></div>';
			}
		);
	}

	public function register_admin_menu(): void {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		add_menu_page(
			__( 'ZexeStock Dashboard', 'zexestock-inventory-management-for-woocommerce' ),
			__( 'ZexeStock', 'zexestock-inventory-management-for-woocommerce' ),
			'manage_woocommerce',
			'zexestock',
			array( 'ZEXST_Admin_Page', 'render_dashboard' ),
			plugin_dir_url( dirname( __FILE__ ) ) . 'admin/images/logo.png',
			56
		);

		add_submenu_page(
			'zexestock',
			__( 'ZexeStock Dashboard', 'zexestock-inventory-management-for-woocommerce' ),
			__( 'Dashboard', 'zexestock-inventory-management-for-woocommerce' ),
			'manage_woocommerce',
			'zexestock',
			array( 'ZEXST_Admin_Page', 'render_dashboard' )
		);

		add_submenu_page(
			'zexestock',
			__( 'Stock Manager', 'zexestock-inventory-management-for-woocommerce' ),
			__( 'Stock Manager', 'zexestock-inventory-management-for-woocommerce' ),
			'manage_woocommerce',
			'zexst-stock-manager',
			array( 'ZEXST_Admin_Page', 'render' )
		);

		add_submenu_page(
			'zexestock',
			__( 'Stock Manager — Settings', 'zexestock-inventory-management-for-woocommerce' ),
			__( 'Settings', 'zexestock-inventory-management-for-woocommerce' ),
			'manage_woocommerce',
			'zexst-settings',
			array( 'ZEXST_Admin_Page', 'render_settings' )
		);
	}

	public function register_wp_dashboard_widget(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}

		wp_add_dashboard_widget(
			'zexst_dashboard_widget',
			__( 'ZexeStock Summary', 'zexestock-inventory-management-for-woocommerce' ),
			array( 'ZEXST_Admin_Page', 'render_wp_dashboard_widget' )
		);
	}

	public function enqueue_admin_assets( string $hook_suffix ): void {
		$all_screens         = array(
			'toplevel_page_zexestock',
			'zexestock_page_zexst-stock-manager',
			'zexestock_page_zexst-settings',
		);
		$dashboard_screens   = array( 'toplevel_page_zexestock' );
		$stock_table_screens = array( 'zexestock_page_zexst-stock-manager' );
		$settings_screens    = array( 'zexestock_page_zexst-settings' );

		if ( ! in_array( $hook_suffix, $all_screens, true ) ) {
			return;
		}

		$zexst_categories_raw  = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false, 'number' => 200 ) );
		$zexst_categories_data = array();
		if ( ! is_wp_error( $zexst_categories_raw ) ) {
			foreach ( $zexst_categories_raw as $zexst_cat ) {
				$zexst_categories_data[] = array(
					'id'   => (int) $zexst_cat->term_id,
					'slug' => $zexst_cat->slug,
					'name' => $zexst_cat->name,
				);
			}
		}

		if ( in_array( $hook_suffix, $dashboard_screens, true ) ) {
			$dashboard_asset_file = ZEXST_PLUGIN_DIR . 'admin/build/dashboard.asset.php';
			$dashboard_asset      = file_exists( $dashboard_asset_file )
				? require $dashboard_asset_file
				: array( 'dependencies' => array(), 'version' => ZEXST_VERSION );

			wp_enqueue_script(
				'zexst-dashboard',
				ZEXST_PLUGIN_URL . 'admin/build/dashboard.js',
				$dashboard_asset['dependencies'],
				$dashboard_asset['version'],
				true
			);

			wp_enqueue_style(
				'zexst-dashboard',
				ZEXST_PLUGIN_URL . 'admin/build/dashboard.css',
				array(),
				$dashboard_asset['version']
			);

			wp_localize_script(
				'zexst-dashboard',
				'zexstData',
				array(
					'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
					'nonce'       => wp_create_nonce( 'zexst_ajax' ),
					'restNonce'   => wp_create_nonce( 'wp_rest' ),
					'restUrl'     => rest_url( 'zexestock/v1/' ),
					'settings'    => array(
						'rowsPerPage'            => (int) zexst_get_setting( 'rows_per_page', 50 ),
						'lowStockThreshold'      => (int) zexst_get_setting( 'low_stock_threshold', 10 ),
						'allowNegativeStock'     => (bool) zexst_get_setting( 'allow_negative_stock', false ),
						'largeAdjustmentWarning' => (int) zexst_get_setting( 'large_adjustment_warning', 500 ),
					),
					'currentUser' => array(
						'id'   => get_current_user_id(),
						'name' => wp_get_current_user()->display_name,
					),
					'currency'    => html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES | ENT_HTML5, 'UTF-8' ),
					'categories'  => $zexst_categories_data,
				)
			);
		}

		if ( in_array( $hook_suffix, $stock_table_screens, true ) ) {
			$stock_table_asset_file = ZEXST_PLUGIN_DIR . 'admin/build/stock-table.asset.php';
			$stock_table_asset      = file_exists( $stock_table_asset_file )
				? require $stock_table_asset_file
				: array( 'dependencies' => array(), 'version' => ZEXST_VERSION );

			wp_enqueue_script(
				'zexst-stock-table',
				ZEXST_PLUGIN_URL . 'admin/build/stock-table.js',
				$stock_table_asset['dependencies'],
				$stock_table_asset['version'],
				true
			);

			wp_enqueue_style(
				'zexst-stock-table',
				ZEXST_PLUGIN_URL . 'admin/build/stock-table.css',
				array(),
				$stock_table_asset['version']
			);

			wp_localize_script(
				'zexst-stock-table',
				'zexstData',
				array(
					'nonce'        => wp_create_nonce( 'wp_rest' ),
					'restNonce'    => wp_create_nonce( 'wp_rest' ),
					'restUrl'      => rest_url( 'zexestock/v1/' ),
					'settings'     => array(
						'rowsPerPage'            => (int) zexst_get_setting( 'rows_per_page', 50 ),
						'lowStockThreshold'      => (int) zexst_get_setting( 'low_stock_threshold', 10 ),
						'allowNegativeStock'     => (bool) zexst_get_setting( 'allow_negative_stock', false ),
						'largeAdjustmentWarning' => (int) zexst_get_setting( 'large_adjustment_warning', 500 ),
					),
					'currentUser'  => array(
						'id'   => get_current_user_id(),
						'name' => wp_get_current_user()->display_name,
					),
					'categories'   => $zexst_categories_data,
					'currency'     => html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES | ENT_HTML5, 'UTF-8' ),
					'pdfObjectUrl' => ZEXST_PLUGIN_URL . 'admin/vendor/pdfobject/pdfobject.min.js',
				)
			);
		}

		if ( in_array( $hook_suffix, $settings_screens, true ) ) {
			$settings_asset_file = ZEXST_PLUGIN_DIR . 'admin/build/settings.asset.php';
			$settings_asset      = file_exists( $settings_asset_file )
				? require $settings_asset_file
				: array( 'dependencies' => array(), 'version' => ZEXST_VERSION );

			wp_enqueue_script(
				'zexst-settings',
				ZEXST_PLUGIN_URL . 'admin/build/settings.js',
				$settings_asset['dependencies'],
				$settings_asset['version'],
				true
			);

			wp_enqueue_style(
				'zexst-settings',
				ZEXST_PLUGIN_URL . 'admin/build/settings.css',
				array(),
				$settings_asset['version']
			);

			wp_localize_script(
				'zexst-settings',
				'zexstData',
				array(
					'nonce'       => wp_create_nonce( 'wp_rest' ),
					'restNonce'   => wp_create_nonce( 'wp_rest' ),
					'restUrl'     => rest_url( 'zexestock/v1/' ),
					'settings'    => array(
						'rowsPerPage'            => (int) zexst_get_setting( 'rows_per_page', 50 ),
						'lowStockThreshold'      => (int) zexst_get_setting( 'low_stock_threshold', 10 ),
						'allowNegativeStock'     => (bool) zexst_get_setting( 'allow_negative_stock', false ),
						'largeAdjustmentWarning' => (int) zexst_get_setting( 'large_adjustment_warning', 500 ),
					),
					'currentUser' => array(
						'id'   => get_current_user_id(),
						'name' => wp_get_current_user()->display_name,
					),
				)
			);
		}

		wp_enqueue_style(
			'zexst-admin',
			ZEXST_PLUGIN_URL . 'admin/css/stock-manager.css',
			array(),
			ZEXST_VERSION
		);
	}

	public function enqueue_product_page_assets( string $hook_suffix ): void {
		if ( ! in_array( $hook_suffix, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}
		$screen = get_current_screen();
		if ( ! $screen || 'product' !== $screen->post_type ) {
			return;
		}
		wp_enqueue_style(
			'zexst-product-fields',
			ZEXST_PLUGIN_URL . 'admin/css/product-fields.css',
			array(),
			ZEXST_VERSION
		);
	}

	private function wrap_field_with_icon( callable $render_fn ): void {
		$icon_url = esc_url( ZEXST_PLUGIN_URL . 'admin/images/logo.png' );
		$prefix   = '<span class="zexst-field-wrapper">'
			. '<span class="zexst-field-prefix">'
			. '<img src="' . $icon_url . '" class="zexst-field-icon" alt="ZexeStock">'
			. '<span class="zexst-field-divider"></span>'
			. '</span>';

		ob_start();
		$render_fn();
		$html = ob_get_clean();

		$html = preg_replace( '/(<input\b[^>]*\/?>)/', $prefix . '$1</span>', $html );

		if ( preg_match( '/(<span[^>]*woocommerce-help-tip[^>]*><\/span>)/', $html, $tip_match ) ) {
			$help_tip = $tip_match[1];
			$html     = str_replace( $help_tip, '', $html );
			$html     = str_replace( '</p>', $help_tip . '</p>', $html );
		}

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $html is WooCommerce's own field markup (already escaped by woocommerce_wp_*_input()) with our hardcoded, esc_url()'d icon prefix spliced in; wp_kses_post() would strip the <input> element.
		echo $html;
	}

	public function render_purchase_price_field(): void {
		global $post;
		$value = get_post_meta( $post->ID, '_zexst_purchase_price', true );
		$this->wrap_field_with_icon( function() use ( $value ) {
			woocommerce_wp_text_input( array(
				'id'            => '_zexst_purchase_price',
				'label'         => __( 'Purchase price ($)', 'zexestock-inventory-management-for-woocommerce' ),
				'placeholder'   => '',
				'description'   => __( 'Internal cost / purchase price. Not shown to customers.', 'zexestock-inventory-management-for-woocommerce' ),
				'desc_tip'      => true,
				'value'         => esc_attr( $value ),
				'type'          => 'text',
				'data_type'     => 'price',
				'class'         => 'wc_input_price',
				'wrapper_class' => 'hide_if_variable hide_if_grouped',
			) );
		} );
	}

	public function render_inventory_meta_fields(): void {
		global $post;
		$supplier_sku = get_post_meta( $post->ID, '_zexst_supplier_sku', true );
		$barcode      = get_post_meta( $post->ID, '_zexst_barcode', true );

		echo '<div class="options_group hide_if_variable hide_if_grouped">';
		echo '<hr style="margin: 12px 0; border-color: #eee;">';

		$this->wrap_field_with_icon( function() use ( $supplier_sku ) {
			woocommerce_wp_text_input( array(
				'id'          => '_zexst_supplier_sku',
				'label'       => __( 'Supplier SKU', 'zexestock-inventory-management-for-woocommerce' ),
				'placeholder' => '',
				'description' => __( 'Supplier or manufacturer SKU / reference code.', 'zexestock-inventory-management-for-woocommerce' ),
				'desc_tip'    => true,
				'value'       => esc_attr( $supplier_sku ),
				'class'       => '',
			) );
		} );

		$this->wrap_field_with_icon( function() use ( $barcode ) {
			woocommerce_wp_text_input( array(
				'id'          => '_zexst_barcode',
				'label'       => __( 'Barcode', 'zexestock-inventory-management-for-woocommerce' ),
				'placeholder' => '',
				'description' => __( 'Product barcode (EAN, UPC, QR, etc.).', 'zexestock-inventory-management-for-woocommerce' ),
				'desc_tip'    => true,
				'value'       => esc_attr( $barcode ),
				'class'       => '',
			) );
		} );

		echo '</div>';
	}

	public function save_product_meta_fields( int $post_id ): void {
		if (
			! isset( $_POST['_wpnonce'] ) ||
			! wp_verify_nonce( sanitize_key( $_POST['_wpnonce'] ), 'update-post_' . $post_id )
		) {
			return;
		}

		if ( isset( $_POST['_zexst_purchase_price'] ) ) {
			$raw = sanitize_text_field( wp_unslash( $_POST['_zexst_purchase_price'] ) );
			if ( '' === $raw ) {
				update_post_meta( $post_id, '_zexst_purchase_price', '' );
			} else {
				update_post_meta( $post_id, '_zexst_purchase_price', wc_format_decimal( $raw ) );
			}
		}

		if ( isset( $_POST['_zexst_supplier_sku'] ) ) {
			update_post_meta(
				$post_id,
				'_zexst_supplier_sku',
				sanitize_text_field( wp_unslash( $_POST['_zexst_supplier_sku'] ) )
			);
		}

		if ( isset( $_POST['_zexst_barcode'] ) ) {
			update_post_meta(
				$post_id,
				'_zexst_barcode',
				sanitize_text_field( wp_unslash( $_POST['_zexst_barcode'] ) )
			);
		}
	}

	public function render_variation_meta_fields( int $loop, array $variation_data, WP_Post $variation ): void {
		$purchase_price = get_post_meta( $variation->ID, '_zexst_purchase_price', true );
		$supplier_sku   = get_post_meta( $variation->ID, '_zexst_supplier_sku', true );
		$barcode        = get_post_meta( $variation->ID, '_zexst_barcode', true );

		$this->wrap_field_with_icon( function() use ( $loop, $purchase_price ) {
			woocommerce_wp_text_input( array(
				'id'            => 'variable_zexst_purchase_price_' . $loop,
				'name'          => 'variable_zexst_purchase_price[' . $loop . ']',
				'label'         => __( 'Purchase price ($)', 'zexestock-inventory-management-for-woocommerce' ),
				'description'   => __( 'Internal cost / purchase price.', 'zexestock-inventory-management-for-woocommerce' ),
				'desc_tip'      => true,
				'value'         => esc_attr( $purchase_price ),
				'type'          => 'text',
				'data_type'     => 'price',
				'class'         => 'wc_input_price',
				'wrapper_class' => 'form-row form-row-first',
			) );
		} );

		$this->wrap_field_with_icon( function() use ( $loop, $barcode ) {
			woocommerce_wp_text_input( array(
				'id'            => 'variable_zexst_barcode_' . $loop,
				'name'          => 'variable_zexst_barcode[' . $loop . ']',
				'label'         => __( 'Barcode', 'zexestock-inventory-management-for-woocommerce' ),
				'description'   => __( 'Product barcode (EAN, UPC, QR, etc.).', 'zexestock-inventory-management-for-woocommerce' ),
				'desc_tip'      => true,
				'value'         => esc_attr( $barcode ),
				'wrapper_class' => 'form-row form-row-first',
			) );
		} );

		$this->wrap_field_with_icon( function() use ( $loop, $supplier_sku ) {
			woocommerce_wp_text_input( array(
				'id'            => 'variable_zexst_supplier_sku_' . $loop,
				'name'          => 'variable_zexst_supplier_sku[' . $loop . ']',
				'label'         => __( 'Supplier SKU', 'zexestock-inventory-management-for-woocommerce' ),
				'description'   => __( 'Supplier or manufacturer SKU / reference code.', 'zexestock-inventory-management-for-woocommerce' ),
				'desc_tip'      => true,
				'value'         => esc_attr( $supplier_sku ),
				'wrapper_class' => 'form-row form-row-last',
			) );
		} );
	}

	public function save_variation_meta_fields( int $variation_id, int $i ): void {
		check_admin_referer( 'woocommerce-save-product' );

		if ( isset( $_POST['variable_zexst_purchase_price'][ $i ] ) ) {
			$raw = sanitize_text_field( wp_unslash( $_POST['variable_zexst_purchase_price'][ $i ] ) );
			update_post_meta( $variation_id, '_zexst_purchase_price', '' === $raw ? '' : wc_format_decimal( $raw ) );
		}

		if ( isset( $_POST['variable_zexst_supplier_sku'][ $i ] ) ) {
			update_post_meta(
				$variation_id,
				'_zexst_supplier_sku',
				sanitize_text_field( wp_unslash( $_POST['variable_zexst_supplier_sku'][ $i ] ) )
			);
		}

		if ( isset( $_POST['variable_zexst_barcode'][ $i ] ) ) {
			update_post_meta(
				$variation_id,
				'_zexst_barcode',
				sanitize_text_field( wp_unslash( $_POST['variable_zexst_barcode'][ $i ] ) )
			);
		}
	}
}
