<?php

defined( 'ABSPATH' ) || exit;

class ZEXST_Installer {

	const DB_VERSION = '1.8.0';

	public static function activate(): void {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		update_option( 'zexst_db_version', self::DB_VERSION, false );
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

		update_option( 'zexst_db_version', self::DB_VERSION, false );
	}

	public static function uninstall(): void {
		$settings = get_option( 'zexst_settings', array() );

		if ( empty( $settings['delete_data_on_uninstall'] ) ) {
			return;
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- uninstall cleanup of the plugin's own options; LIKE patterns bound via prepare() below.
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
				'zexst\_%',
				'\_transient\_zexst\_%'
			)
		);
	}
}
