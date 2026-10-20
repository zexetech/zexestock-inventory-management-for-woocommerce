<?php

defined( 'ABSPATH' ) || exit;

class ZEXST_Installer {

	const DB_VERSION = '1.10.0';

	public static function activate(): void {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		self::create_tables();
		flush_rewrite_rules();
	}

	public static function deactivate(): void {
		flush_rewrite_rules();
	}

	public static function maybe_upgrade(): void {
		$installed = get_option( 'zexst_db_version', '0.0.0' );

		if ( version_compare( $installed, self::DB_VERSION, '>=' ) ) {
			return;
		}

		$settings = get_option( 'zexst_settings' );
		if ( false !== $settings ) {
			update_option( 'zexst_settings', $settings, false );
		}

		self::create_tables();
	}

	public static function uninstall(): void {
		$settings = get_option( 'zexst_settings', array() );

		if ( empty( $settings['delete_data_on_uninstall'] ) ) {
			return;
		}

		global $wpdb;

		$tables = array( 'zexst_po_items', 'zexst_purchase_orders', 'zexst_supplier_products', 'zexst_suppliers' );
		foreach ( $tables as $table ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own tables (hardcoded names), dropped only on opt-in uninstall.
			$wpdb->query( "DROP TABLE IF EXISTS `{$wpdb->prefix}{$table}`" );
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- uninstall cleanup of the plugin's own options and meta; LIKE patterns bound via prepare().
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s",
				'zexst\_%',
				'\_transient\_zexst\_%',
				'\_transient\_timeout\_zexst\_%'
			)
		);
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->postmeta} WHERE meta_key LIKE %s", '\_zexst\_%' ) );
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->usermeta} WHERE meta_key LIKE %s", 'zexst\_%' ) );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		wp_cache_flush();
	}

	public static function create_tables(): void {
		global $wpdb;

		if ( ! function_exists( 'dbDelta' ) ) {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		}

		dbDelta( self::get_schema( $wpdb->get_charset_collate() ) );

		if ( ! empty( $wpdb->last_error ) ) {
			ZEXST_Logger::error(
				'dbDelta failed for supplier/purchase order tables',
				array( 'db_error' => $wpdb->last_error )
			);
		}

		update_option( 'zexst_db_version', self::DB_VERSION, false );
	}

	private static function get_schema( string $charset_collate ): string {
		global $wpdb;

		$suppliers_table         = $wpdb->prefix . 'zexst_suppliers';
		$supplier_products_table = $wpdb->prefix . 'zexst_supplier_products';
		$purchase_orders_table   = $wpdb->prefix . 'zexst_purchase_orders';
		$po_items_table          = $wpdb->prefix . 'zexst_po_items';

		// Note: dbDelta requires exactly two spaces before PRIMARY KEY and KEY definitions.
		return "CREATE TABLE {$suppliers_table} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_code VARCHAR(50) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  website VARCHAR(255) DEFAULT NULL,
  address_line_1 VARCHAR(255) DEFAULT NULL,
  address_line_2 VARCHAR(255) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  state VARCHAR(100) DEFAULT NULL,
  postal_code VARCHAR(100) DEFAULT NULL,
  country VARCHAR(100) DEFAULT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  payment_terms VARCHAR(100) DEFAULT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT NULL,
  tax_number VARCHAR(50) DEFAULT NULL,
  fax VARCHAR(50) DEFAULT NULL,
  ordering_url VARCHAR(255) DEFAULT NULL,
  ordering_email VARCHAR(255) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  assigned_user_id BIGINT UNSIGNED DEFAULT NULL,
  discount_percent DECIMAL(5,2) DEFAULT NULL,
  tax_rate_percent DECIMAL(5,2) DEFAULT NULL,
  days_to_cancel SMALLINT UNSIGNED DEFAULT NULL,
  cancelation_policy TEXT DEFAULT NULL,
  custom_fields TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY status (status),
  KEY name (name),
  KEY assigned_user_id (assigned_user_id)
) {$charset_collate};

CREATE TABLE {$supplier_products_table} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  supplier_sku VARCHAR(100) DEFAULT NULL,
  unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  lead_time_days SMALLINT UNSIGNED DEFAULT NULL,
  minimum_order_qty DECIMAL(12,3) DEFAULT NULL,
  order_multiple DECIMAL(12,3) DEFAULT NULL,
  purchase_unit VARCHAR(50) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  UNIQUE KEY supplier_product (supplier_id, product_id),
  KEY product_id (product_id),
  KEY supplier_id (supplier_id)
) {$charset_collate};

CREATE TABLE {$purchase_orders_table} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  po_number VARCHAR(20) NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  supplier_name VARCHAR(255) DEFAULT NULL,
  supplier_contact_name VARCHAR(255) DEFAULT NULL,
  supplier_email VARCHAR(255) DEFAULT NULL,
  supplier_phone VARCHAR(50) DEFAULT NULL,
  supplier_address_line_1 VARCHAR(255) DEFAULT NULL,
  supplier_address_line_2 VARCHAR(255) DEFAULT NULL,
  supplier_city VARCHAR(100) DEFAULT NULL,
  supplier_state VARCHAR(100) DEFAULT NULL,
  supplier_postal_code VARCHAR(100) DEFAULT NULL,
  supplier_country VARCHAR(100) DEFAULT NULL,
  status ENUM('draft','sent','partially_received','received','cancelled') NOT NULL DEFAULT 'draft',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  internal_notes TEXT DEFAULT NULL,
  supplier_notes TEXT DEFAULT NULL,
  email_to VARCHAR(255) DEFAULT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  cancelled_by BIGINT UNSIGNED DEFAULT NULL,
  cancellation_reason TEXT DEFAULT NULL,
  po_date DATE DEFAULT NULL,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  tax_rate_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  supplier_fee DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  shipping_cost DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME DEFAULT NULL,
  last_email_sent_at DATETIME DEFAULT NULL,
  expected_at DATE DEFAULT NULL,
  received_at DATETIME DEFAULT NULL,
  cancelled_at DATETIME DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY po_number (po_number),
  KEY supplier_id (supplier_id),
  KEY status (status),
  KEY created_at (created_at),
  KEY sent_at (sent_at),
  KEY expected_at (expected_at)
) {$charset_collate};

CREATE TABLE {$po_items_table} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  po_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(100) DEFAULT NULL,
  product_name VARCHAR(255) NOT NULL,
  supplier_sku VARCHAR(100) DEFAULT NULL,
  purchase_unit VARCHAR(50) DEFAULT NULL,
  quantity_ordered INT UNSIGNED NOT NULL,
  quantity_received INT UNSIGNED NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  PRIMARY KEY  (id),
  KEY po_id (po_id),
  KEY product_id (product_id)
) {$charset_collate};";
	}
}
