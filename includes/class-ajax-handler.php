<?php

defined( 'ABSPATH' ) || exit;
class ZEXST_Ajax_Handler {
    public static function register() : void {
        add_action( 'wp_ajax_zexst_analytics_flush_cache', array('ZEXST_Ajax_Handler', 'handle_analytics_flush_cache') );
        add_action( 'wp_ajax_zexst_analytics_sales_summary', array('ZEXST_Ajax_Handler', 'handle_analytics_sales_summary') );
        add_action( 'wp_ajax_zexst_analytics_kpis', array('ZEXST_Ajax_Handler', 'handle_analytics_kpis') );
        add_action( 'wp_ajax_zexst_analytics_current_stock_value', array('ZEXST_Ajax_Handler', 'handle_analytics_current_stock_value') );
        add_action( 'wp_ajax_zexst_analytics_low_stock', array('ZEXST_Ajax_Handler', 'handle_analytics_low_stock') );
        add_action( 'wp_ajax_zexst_analytics_lost_sales', array('ZEXST_Ajax_Handler', 'handle_analytics_lost_sales') );
        add_action( 'wp_ajax_zexst_analytics_section_summary', array('ZEXST_Ajax_Handler', 'handle_analytics_section_summary') );
        add_action( 'wp_ajax_zexst_analytics_dashboard_bootstrap', array('ZEXST_Ajax_Handler', 'handle_analytics_dashboard_bootstrap') );
    }

    private static function analytics_auth_and_dates() : array {
        if ( !check_ajax_referer( 'zexst_ajax', '_wpnonce', false ) ) {
            wp_send_json_error( array(
                'message' => __( 'Invalid nonce.', 'zexestock-inventory-management-for-woocommerce' ),
            ), 403 );
        }
        if ( !current_user_can( 'manage_woocommerce' ) ) {
            wp_send_json_error( array(
                'message' => __( 'Insufficient permissions.', 'zexestock-inventory-management-for-woocommerce' ),
            ), 403 );
        }
        $period = sanitize_key( $_POST['period'] ?? '30d' );
        $date_from = sanitize_text_field( wp_unslash( $_POST['date_from'] ?? '' ) );
        $date_to = sanitize_text_field( wp_unslash( $_POST['date_to'] ?? '' ) );
        if ( 'custom' === $period && preg_match( '/^\\d{4}-\\d{2}-\\d{2}$/', $date_from ) && preg_match( '/^\\d{4}-\\d{2}-\\d{2}$/', $date_to ) ) {
            return array(
                'date_from' => $date_from,
                'date_to'   => $date_to,
            );
        }
        return ZEXST_Analytics::period_to_dates( $period );
    }

    public static function handle_analytics_sales_summary() : void {
        $dates = self::analytics_auth_and_dates();
        $data = ZEXST_Analytics::get_sales_summary( $dates['date_from'], $dates['date_to'] );
        wp_send_json_success( $data );
    }

    public static function handle_analytics_kpis() : void {
        $dates = self::analytics_auth_and_dates();
        $data = ZEXST_Analytics::get_kpis( $dates['date_from'], $dates['date_to'] );
        wp_send_json_success( $data );
    }

    public static function handle_analytics_current_stock_value() : void {
        self::analytics_auth_and_dates();
        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce verified in analytics_auth_and_dates() above.
        $category_id = absint( $_POST['category'] ?? 0 );
        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce verified in analytics_auth_and_dates() above.
        $product_type = sanitize_key( $_POST['product_type'] ?? '' );
        $data = ZEXST_Analytics::get_current_stock_summary( $category_id, $product_type );
        wp_send_json_success( $data );
    }

    public static function handle_analytics_low_stock() : void {
        self::analytics_auth_and_dates();
        $data = ZEXST_Analytics::get_low_stock_summary();
        wp_send_json_success( $data );
    }

    public static function handle_analytics_lost_sales() : void {
        $dates = self::analytics_auth_and_dates();
        $data = ZEXST_Analytics::get_lost_sales( $dates['date_from'], $dates['date_to'] );
        wp_send_json_success( $data );
    }

    public static function handle_analytics_flush_cache() : void {
        if ( !check_ajax_referer( 'zexst_ajax', '_wpnonce', false ) ) {
            wp_send_json_error( array(
                'message' => __( 'Invalid nonce.', 'zexestock-inventory-management-for-woocommerce' ),
            ), 403 );
        }
        if ( !current_user_can( 'manage_woocommerce' ) ) {
            wp_send_json_error( array(
                'message' => __( 'Insufficient permissions.', 'zexestock-inventory-management-for-woocommerce' ),
            ), 403 );
        }
        ZEXST_Analytics::flush_cache();
        wp_send_json_success( array(
            'message' => __( 'Cache cleared.', 'zexestock-inventory-management-for-woocommerce' ),
        ) );
    }

    public static function handle_analytics_section_summary() : void {
        $dates = self::analytics_auth_and_dates();
        $data = array(
            'top_products'      => ZEXST_Analytics::get_top_products( $dates['date_from'], $dates['date_to'] ),
            'sales_by_category' => ZEXST_Analytics::get_sales_by_category( $dates['date_from'], $dates['date_to'] ),
            'fast_movers'       => ZEXST_Analytics::get_fast_movers( $dates['date_from'], $dates['date_to'] ),
            'lost_sales'        => ZEXST_Analytics::get_lost_sales( $dates['date_from'], $dates['date_to'] ),
        );
        wp_send_json_success( $data );
    }

    public static function handle_analytics_dashboard_bootstrap() : void {
        $dates = self::analytics_auth_and_dates();
        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce verified in analytics_auth_and_dates() above.
        $day_from = sanitize_text_field( wp_unslash( $_POST['day_from'] ?? '' ) );
        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce verified in analytics_auth_and_dates() above.
        $day_to = sanitize_text_field( wp_unslash( $_POST['day_to'] ?? '' ) );
        if ( !preg_match( '/^\\d{4}-\\d{2}-\\d{2}$/', $day_from ) || !preg_match( '/^\\d{4}-\\d{2}-\\d{2}$/', $day_to ) ) {
            $day_from = current_time( 'Y-m-d' );
            $day_to = $day_from;
        }
        $data = array(
            'sales_summary_day'   => ZEXST_Analytics::get_sales_summary( $day_from, $day_to ),
            'lost_sales_day'      => ZEXST_Analytics::get_lost_sales( $day_from, $day_to ),
            'low_stock'           => ZEXST_Analytics::get_low_stock_summary(),
            'current_stock_value' => ZEXST_Analytics::get_current_stock_summary( 0, '' ),
            'section'             => array(
                'top_products'      => ZEXST_Analytics::get_top_products( $dates['date_from'], $dates['date_to'] ),
                'sales_by_category' => ZEXST_Analytics::get_sales_by_category( $dates['date_from'], $dates['date_to'] ),
                'fast_movers'       => ZEXST_Analytics::get_fast_movers( $dates['date_from'], $dates['date_to'] ),
                'lost_sales'        => ZEXST_Analytics::get_lost_sales( $dates['date_from'], $dates['date_to'] ),
            ),
        );
        wp_send_json_success( $data );
    }

}
