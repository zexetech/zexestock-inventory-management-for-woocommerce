<?php

/**
 * Plugin Name:       ZexeStock | Inventory Management for WooCommerce
 * Plugin URI:        https://zexelabs.com
 * Description:       The all-in-one stock management plugin for WooCommerce sellers.
 * Version:           1.0.0
 * Requires at least: 6.4
 * Requires PHP:      8.0
 * Author:            ZexeLabs
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       zexestock-inventory-management-for-woocommerce
 * Domain Path:       /languages
 * Requires Plugins:  woocommerce
 *
 * @package ZexeStock
 *
 */
defined( 'ABSPATH' ) || exit;
if ( function_exists( 'zexst_fs' ) ) {
    zexst_fs()->set_basename( false, __FILE__ );
} else {
    if ( !function_exists( 'zexst_fs' ) ) {
        function zexst_fs() {
            global $zexst_fs;
            if ( !isset( $zexst_fs ) ) {
                require_once dirname( __FILE__ ) . '/vendor/freemius/start.php';
                $zexst_fs = fs_dynamic_init( array(
                    'id'               => '27402',
                    'slug'             => 'zexestock',
                    'type'             => 'plugin',
                    'public_key'       => 'pk_ba052c5fcd143c9d238beeaee99a6',
                    'is_premium'       => false,
                    'has_addons'       => false,
                    'has_paid_plans'   => true,
                    'is_org_compliant' => true,
                    'menu'             => array(
                        'slug'    => 'zexestock',
                        'support' => false,
                    ),
                    'is_live'          => true,
                ) );
            }
            return $zexst_fs;
        }

        zexst_fs();
        do_action( 'zexst_fs_loaded' );
    }
    define( 'ZEXST_VERSION', '1.0.0' );
    define( 'ZEXST_PLUGIN_FILE', __FILE__ );
    define( 'ZEXST_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
    define( 'ZEXST_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
    add_action( 'before_woocommerce_init', function () {
        if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
            \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
        }
    } );
    require_once ZEXST_PLUGIN_DIR . 'includes/class-constants.php';
    require_once ZEXST_PLUGIN_DIR . 'includes/class-logger.php';
    require_once ZEXST_PLUGIN_DIR . 'includes/class-installer.php';
    require_once ZEXST_PLUGIN_DIR . 'includes/class-admin-page.php';
    require_once ZEXST_PLUGIN_DIR . 'includes/class-stock-manager.php';
    require_once ZEXST_PLUGIN_DIR . 'includes/class-csv-handler.php';
    require_once ZEXST_PLUGIN_DIR . 'includes/class-analytics.php';
    require_once ZEXST_PLUGIN_DIR . 'includes/class-alerts.php';
    require_once ZEXST_PLUGIN_DIR . 'includes/class-ajax-handler.php';
    require_once ZEXST_PLUGIN_DIR . 'includes/class-rest-api.php';
    require_once ZEXST_PLUGIN_DIR . 'includes/class-plugin.php';
    register_activation_hook( __FILE__, array('ZEXST_Installer', 'activate') );
    register_deactivation_hook( __FILE__, array('ZEXST_Installer', 'deactivate') );
    zexst_fs()->add_action( 'after_uninstall', array('ZEXST_Installer', 'uninstall') );
    zexst_fs()->add_filter( 'pricing/show_annual_in_monthly', '__return_false' );
    ZEXST_Plugin::instance();
}