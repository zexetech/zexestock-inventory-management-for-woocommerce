<?php
defined( 'ABSPATH' ) || exit;

class ZEXST_Analytics {

	const CACHE_TTL = HOUR_IN_SECONDS;

	const CACHE_PREFIX = 'zexst_analytics_';

	private static function log_db_error_if_any( string $widget ): void {
		global $wpdb;
		if ( ! empty( $wpdb->last_error ) ) {
			ZEXST_Logger::warning(
				'Analytics query failed',
				array(
					'widget'   => $widget,
					'db_error' => $wpdb->last_error,
				)
			);
		}
	}

	const TRANSIENT_INDEX_OPTION = 'zexst_analytics_transient_index';

	public static function transient_key( string $widget, string $date_from, string $date_to ): string {
		$key = self::CACHE_PREFIX . $widget . '_' . substr( md5( $date_from . '|' . $date_to ), 0, 8 );
		self::register_transient_key( $key );
		return $key;
	}

	private static function register_transient_key( string $key ): void {
		$index = get_option( self::TRANSIENT_INDEX_OPTION, array() );
		if ( ! in_array( $key, $index, true ) ) {
			$index[] = $key;
			update_option( self::TRANSIENT_INDEX_OPTION, $index, false );
		}
	}

	public static function flush_cache(): void {
		$index = get_option( self::TRANSIENT_INDEX_OPTION, array() );
		foreach ( $index as $key ) {
			delete_transient( $key );
		}
		delete_option( self::TRANSIENT_INDEX_OPTION );
	}

	public static function site_date_to_utc( string $date, bool $end_of_day = false ): string {
		$tz = wp_timezone();
		$dt = new \DateTime( $date, $tz );
		if ( $end_of_day ) {
			$dt->setTime( 23, 59, 59 );
		} else {
			$dt->setTime( 0, 0, 0 );
		}
		$dt->setTimezone( new \DateTimeZone( 'UTC' ) );
		return $dt->format( 'Y-m-d H:i:s' );
	}

	public static function get_stock_tier_counts( int $threshold ): array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- stock-tier aggregate over a custom meta join, no object-cache equivalent.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT
					COUNT( DISTINCT p.ID ) AS total,
					SUM( CASE WHEN sq.meta_value IS NULL
					          OR CAST( sq.meta_value AS SIGNED ) <= 0 THEN 1 ELSE 0 END ) AS out_of_stock,
					SUM( CASE WHEN CAST( COALESCE( sq.meta_value, '0' ) AS SIGNED ) > 0
					          AND  CAST( COALESCE( sq.meta_value, '0' ) AS SIGNED ) <= %d THEN 1 ELSE 0 END ) AS low_stock
				FROM {$wpdb->posts} p
				INNER JOIN {$wpdb->postmeta} ms
					ON ms.post_id = p.ID AND ms.meta_key = '_manage_stock' AND ms.meta_value = 'yes'
				LEFT JOIN {$wpdb->postmeta} sq
					ON sq.post_id = p.ID AND sq.meta_key = '_stock'
				WHERE p.post_type   IN ( 'product', 'product_variation' )
				  AND p.post_status IN ( 'publish', 'private' )",
				$threshold
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		return array(
			'total'        => (int) ( $row->total        ?? 0 ),
			'out_of_stock' => (int) ( $row->out_of_stock  ?? 0 ),
			'low_stock'    => (int) ( $row->low_stock     ?? 0 ),
		);
	}

	public static function period_to_dates( string $period ): array {
		$days_map = array( '7d' => 7, '30d' => 30, '60d' => 60, '90d' => 90 );
		$days     = $days_map[ $period ] ?? 30;
		$tz       = wp_timezone();
		$today    = new \DateTime( 'now', $tz );

		return array(
			'date_from' => ( clone $today )->modify( "-{$days} days" )->format( 'Y-m-d' ),
			'date_to'   => $today->format( 'Y-m-d' ),
		);
	}

	public static function get_kpis( string $date_from, string $date_to ): array {
		$key    = self::transient_key( 'kpis', $date_from, $date_to );
		$cached = get_transient( $key );
		if ( false !== $cached ) {
			return $cached;
		}

		global $wpdb;

		$threshold = absint( zexst_get_setting( 'low_stock_threshold', 10 ) );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KPI aggregates over WooCommerce order-lookup and custom meta joins, refreshed via transient cache below.
		$units_sold = (float) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT SUM( opl.product_qty )
				FROM {$wpdb->prefix}wc_order_product_lookup opl
				INNER JOIN {$wpdb->prefix}wc_orders wo ON wo.id = opl.order_id
					AND wo.status IN ('wc-completed', 'wc-processing')
				WHERE opl.date_created BETWEEN %s AND %s",
				self::site_date_to_utc( $date_from, false ),
				self::site_date_to_utc( $date_to, true )
			)
		);
		self::log_db_error_if_any( 'kpis' );

		$avg_stock = (float) $wpdb->get_var(
			"SELECT SUM( CAST( pm.meta_value AS DECIMAL(10,2) ) )
			FROM {$wpdb->posts} p
			INNER JOIN {$wpdb->postmeta} ms ON ( p.ID = ms.post_id AND ms.meta_key = '_manage_stock' AND ms.meta_value = 'yes' )
			INNER JOIN {$wpdb->postmeta} pm ON ( p.ID = pm.post_id AND pm.meta_key = '_stock' )
			WHERE p.post_type IN ( 'product', 'product_variation' )
			  AND p.post_status IN ( 'publish', 'private' )
			  AND CAST( pm.meta_value AS SIGNED ) > 0"
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		$inventory_turnover = $avg_stock > 0 ? round( $units_sold / $avg_stock, 2 ) : 0;

		$tier_counts   = self::get_stock_tier_counts( $threshold );
		$total_managed = $tier_counts['total'];
		$stockout_rate = $total_managed > 0
			? round( ( $tier_counts['out_of_stock'] / $total_managed ) * 100, 1 )
			: 0.0;

		$result = array(
			'inventory_turnover'  => $inventory_turnover,
			'stockout_rate'       => $stockout_rate,
		);

		set_transient( $key, $result, self::CACHE_TTL );

		return $result;
	}

	public static function get_current_stock_summary( int $category_id, string $product_type ): array {
		$valid_product_types = array( 'simple', 'variable', 'external', 'virtual', 'downloadable' );
		$product_type        = in_array( $product_type, $valid_product_types, true ) ? $product_type : '';

		$key    = self::CACHE_PREFIX . 'current_stock_summary_' . md5( $category_id . '|' . $product_type );
		self::register_transient_key( $key );
		$cached = get_transient( $key );
		if ( false !== $cached ) {
			return $cached;
		}

		global $wpdb;

		$joins = "
			FROM {$wpdb->posts} p
			INNER JOIN {$wpdb->postmeta} ms ON ( p.ID = ms.post_id AND ms.meta_key = '_manage_stock' AND ms.meta_value = 'yes' )
			INNER JOIN {$wpdb->postmeta} sq ON ( p.ID = sq.post_id AND sq.meta_key = '_stock' )
			LEFT  JOIN {$wpdb->postmeta} pr ON ( p.ID = pr.post_id AND pr.meta_key = '_price' )
			LEFT  JOIN {$wpdb->postmeta} pp ON ( p.ID = pp.post_id AND pp.meta_key = '_zexst_purchase_price' )
			LEFT  JOIN {$wpdb->postmeta} vm ON ( p.ID = vm.post_id AND vm.meta_key = '_virtual' )
			LEFT  JOIN {$wpdb->postmeta} dm ON ( p.ID = dm.post_id AND dm.meta_key = '_downloadable' )
		";

		if ( '' !== $product_type ) {
			$joins .= "
				LEFT  JOIN (
					SELECT tr.object_id, t.slug AS product_type
					FROM {$wpdb->term_relationships} tr
					INNER JOIN {$wpdb->term_taxonomy} tt ON ( tr.term_taxonomy_id = tt.term_taxonomy_id AND tt.taxonomy = 'product_type' )
					INNER JOIN {$wpdb->terms} t ON ( tt.term_id = t.term_id )
				) type_join ON ( type_join.object_id = CASE WHEN p.post_type = 'product_variation' THEN p.post_parent ELSE p.ID END )
			";
		}

		$where = "
			WHERE p.post_type IN ( 'product', 'product_variation' )
			  AND p.post_status IN ( 'publish', 'private' )
			  AND CAST( sq.meta_value AS SIGNED ) > 0
		";
		$args = array();

		if ( $category_id > 0 ) {
			$where .= "
			  AND EXISTS (
				  SELECT 1
				  FROM {$wpdb->term_relationships} cat_tr
				  INNER JOIN {$wpdb->term_taxonomy} cat_tt
					  ON ( cat_tr.term_taxonomy_id = cat_tt.term_taxonomy_id
						   AND cat_tt.taxonomy = 'product_cat'
						   AND cat_tt.term_id = %d )
				  WHERE cat_tr.object_id = CASE WHEN p.post_type = 'product_variation' THEN p.post_parent ELSE p.ID END
			  )
			";
			$args[] = $category_id;
		}

		if ( '' !== $product_type ) {
			$where .= "
			  AND (
				  CASE
					  WHEN type_join.product_type = 'variable' THEN 'variable'
					  WHEN type_join.product_type = 'external' THEN 'external'
					  WHEN dm.meta_value = 'yes' THEN 'downloadable'
					  WHEN vm.meta_value = 'yes' THEN 'virtual'
					  ELSE 'simple'
				  END
			  ) = %s";
			$args[] = $product_type;
		}

		$sql = "SELECT
				SUM( CAST( sq.meta_value AS DECIMAL(10,2) ) * CAST( pr.meta_value AS DECIMAL(10,2) ) ) AS retail_value,
				SUM( CAST( sq.meta_value AS DECIMAL(10,2) ) * CAST( pp.meta_value AS DECIMAL(10,2) ) ) AS cost_value,
				SUM( CAST( sq.meta_value AS SIGNED ) ) AS total_units
			{$joins}
			{$where}";

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $sql is built from hardcoded join/where fragments; the only branch without prepare() has no dynamic $args to bind.
		$row = empty( $args ) ? $wpdb->get_row( $sql ) : $wpdb->get_row( $wpdb->prepare( $sql, $args ) );
		self::log_db_error_if_any( 'current_stock_summary' );

		$result = array(
			'retail_value' => round( (float) ( $row->retail_value ?? 0 ), 2 ),
			'cost_value'   => round( (float) ( $row->cost_value   ?? 0 ), 2 ),
			'total_units'  => (int) ( $row->total_units ?? 0 ),
			'currency'     => html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES | ENT_HTML5, 'UTF-8' ),
		);

		set_transient( $key, $result, self::CACHE_TTL );

		return $result;
	}

	public static function get_low_stock_summary(): array {
		$key    = self::CACHE_PREFIX . 'low_stock';
		self::register_transient_key( $key );
		$cached = get_transient( $key );
		if ( false !== $cached ) {
			return $cached;
		}

		global $wpdb;

		$threshold = absint( zexst_get_setting( 'low_stock_threshold', 10 ) );
		$critical  = (int) ceil( $threshold / 2 );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $critical/$threshold are cast to int above, not user-supplied SQL; aggregate refreshed via transient cache below.
		$rows = $wpdb->get_results(
			"SELECT
				SUM( CASE WHEN eff <= 0 THEN 1 ELSE 0 END ) AS out_of_stock,
				SUM( CASE WHEN eff > 0 AND eff <= {$critical} THEN 1 ELSE 0 END ) AS critical,
				SUM( CASE WHEN eff > {$critical} AND eff <= {$threshold} THEN 1 ELSE 0 END ) AS warning,
				SUM( CASE WHEN eff > {$threshold} THEN 1 ELSE 0 END ) AS healthy
			FROM (
				SELECT COALESCE( CAST( sq.meta_value AS SIGNED ), 0 ) AS eff
				FROM {$wpdb->posts} p
				INNER JOIN {$wpdb->postmeta} ms ON ( p.ID = ms.post_id AND ms.meta_key = '_manage_stock' AND ms.meta_value = 'yes' )
				LEFT  JOIN {$wpdb->postmeta} sq ON ( p.ID = sq.post_id AND sq.meta_key = '_stock' )
				WHERE p.post_type IN ( 'product', 'product_variation' )
				  AND p.post_status IN ( 'publish', 'private' )
			) AS all_managed_items"
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		$row    = $rows[0] ?? new stdClass();
		$result = array(
			'out_of_stock' => (int) ( $row->out_of_stock ?? 0 ),
			'critical'     => (int) ( $row->critical     ?? 0 ),
			'warning'      => (int) ( $row->warning      ?? 0 ),
			'healthy'      => (int) ( $row->healthy       ?? 0 ),
			'threshold'    => $threshold,
		);

		set_transient( $key, $result, self::CACHE_TTL );

		return $result;
	}

	public static function get_fast_movers( string $date_from, string $date_to ): array {
		$key    = self::transient_key( 'fast_movers', $date_from, $date_to );
		$cached = get_transient( $key );
		if ( false !== $cached ) {
			return $cached;
		}

		global $wpdb;

		$days = max( 1, (int) ( ( strtotime( $date_to ) - strtotime( $date_from ) ) / DAY_IN_SECONDS ) );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- WooCommerce order-lookup aggregate, refreshed via transient cache below.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT
					CASE WHEN opl.variation_id > 0 THEN opl.variation_id ELSE opl.product_id END AS item_id,
					SUM( opl.product_qty ) AS total_qty,
					SUM( opl.product_qty ) / %d AS units_per_day,
					MAX( p.post_title ) AS product_name
				FROM {$wpdb->prefix}wc_order_product_lookup opl
				INNER JOIN {$wpdb->prefix}wc_orders wo ON wo.id = opl.order_id
					AND wo.status IN ('wc-completed', 'wc-processing')
				LEFT JOIN {$wpdb->posts} p ON p.ID = opl.product_id
				WHERE opl.date_created BETWEEN %s AND %s
				GROUP BY CASE WHEN opl.variation_id > 0 THEN opl.variation_id ELSE opl.product_id END
				ORDER BY total_qty DESC
				LIMIT 10",
				$days,
				self::site_date_to_utc( $date_from, false ),
				self::site_date_to_utc( $date_to, true )
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		$items = array();
		foreach ( $rows as $row ) {
			$items[] = array(
				/* translators: %d: product ID, used as a fallback label when the product no longer has a title. */
				'name'          => $row->product_name ?: sprintf( __( 'Product #%d', 'zexestock-inventory-management-for-woocommerce' ), $row->item_id ),
				'total_qty'     => (int) $row->total_qty,
				'units_per_day' => round( (float) $row->units_per_day, 2 ),
			);
		}

		$result = array( 'items' => $items );

		set_transient( $key, $result, self::CACHE_TTL );

		return $result;
	}

	public static function get_top_products( string $date_from, string $date_to ): array {
		$key    = self::transient_key( 'top_products', $date_from, $date_to );
		$cached = get_transient( $key );
		if ( false !== $cached ) {
			return $cached;
		}

		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- WooCommerce order-lookup aggregate, refreshed via transient cache below.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT
					CASE WHEN opl.variation_id > 0 THEN opl.variation_id ELSE opl.product_id END AS item_id,
					SUM( opl.product_qty ) AS total_qty,
					SUM( opl.product_net_revenue ) AS revenue,
					MAX( p.post_title ) AS product_name
				FROM {$wpdb->prefix}wc_order_product_lookup opl
				INNER JOIN {$wpdb->prefix}wc_orders wo ON wo.id = opl.order_id
					AND wo.status IN ('wc-completed', 'wc-processing')
				LEFT JOIN {$wpdb->posts} p ON p.ID = opl.product_id
				WHERE opl.date_created BETWEEN %s AND %s
				GROUP BY CASE WHEN opl.variation_id > 0 THEN opl.variation_id ELSE opl.product_id END
				ORDER BY total_qty DESC
				LIMIT 10",
				self::site_date_to_utc( $date_from, false ),
				self::site_date_to_utc( $date_to, true )
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		self::log_db_error_if_any( 'top_products' );

		$items    = array();
		$currency = html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES | ENT_HTML5, 'UTF-8' );

		foreach ( $rows as $row ) {
			$items[] = array(
				/* translators: %d: product ID, used as a fallback label when the product no longer has a title. */
				'name'      => $row->product_name ?: sprintf( __( 'Product #%d', 'zexestock-inventory-management-for-woocommerce' ), $row->item_id ),
				'total_qty' => (int) $row->total_qty,
				'revenue'   => round( (float) $row->revenue, 2 ),
				'currency'  => $currency,
			);
		}

		$result = array( 'items' => $items );
		set_transient( $key, $result, self::CACHE_TTL );

		return $result;
	}

	public static function get_sales_by_category( string $date_from, string $date_to ): array {
		$key    = self::transient_key( 'sales_by_category', $date_from, $date_to );
		$cached = get_transient( $key );
		if ( false !== $cached ) {
			return $cached;
		}

		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- WooCommerce order-lookup aggregate, refreshed via transient cache below.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT
					t.name AS category,
					SUM( opl.product_net_revenue ) AS revenue,
					SUM( opl.product_qty ) AS total_qty
				FROM {$wpdb->prefix}wc_order_product_lookup opl
				INNER JOIN {$wpdb->prefix}wc_orders wo ON wo.id = opl.order_id
					AND wo.status IN ('wc-completed', 'wc-processing')
				INNER JOIN {$wpdb->term_relationships} tr
					ON tr.object_id = opl.product_id
				INNER JOIN {$wpdb->term_taxonomy} tt
					ON tt.term_taxonomy_id = tr.term_taxonomy_id
					AND tt.taxonomy = 'product_cat'
				INNER JOIN {$wpdb->terms} t ON t.term_id = tt.term_id
				WHERE opl.date_created BETWEEN %s AND %s
				GROUP BY t.term_id, t.name
				ORDER BY revenue DESC
				LIMIT 20",
				self::site_date_to_utc( $date_from, false ),
				self::site_date_to_utc( $date_to, true )
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		self::log_db_error_if_any( 'sales_by_category' );

		$currency = html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$items    = array();

		foreach ( $rows as $row ) {
			$items[] = array(
				'category'  => $row->category,
				'revenue'   => round( (float) $row->revenue, 2 ),
				'total_qty' => (int) $row->total_qty,
			);
		}

		$result = array(
			'items'    => $items,
			'currency' => $currency,
		);
		set_transient( $key, $result, self::CACHE_TTL );

		return $result;
	}

	public static function get_sales_summary( string $date_from, string $date_to ): array {
		$key    = self::transient_key( 'sales_summary', $date_from, $date_to );
		$cached = get_transient( $key );
		if ( false !== $cached ) {
			return $cached;
		}

		global $wpdb;

		$utc_from = self::site_date_to_utc( $date_from, false );
		$utc_to   = self::site_date_to_utc( $date_to, true );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- WooCommerce orders aggregate, refreshed via transient cache below.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT
					COALESCE( SUM( total_amount ), 0 ) AS revenue,
					COUNT( id ) AS orders_count
				FROM {$wpdb->prefix}wc_orders
				WHERE status IN ('wc-completed', 'wc-processing')
				  AND date_created_gmt BETWEEN %s AND %s",
				$utc_from,
				$utc_to
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		self::log_db_error_if_any( 'sales_summary' );

		$revenue = (float) ( $row->revenue ?? 0 );
		$orders  = (int)   ( $row->orders_count ?? 0 );
		$aov     = $orders > 0 ? round( $revenue / $orders, 2 ) : 0.0;

		$result = array(
			'revenue'  => round( $revenue, 2 ),
			'orders'   => $orders,
			'aov'      => $aov,
			'currency' => html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES | ENT_HTML5, 'UTF-8' ),
		);

		set_transient( $key, $result, self::CACHE_TTL );

		return $result;
	}

	public static function get_lost_sales( string $date_from, string $date_to ): array {
		$key    = self::transient_key( 'lost_sales', $date_from, $date_to );
		$cached = get_transient( $key );
		if ( false !== $cached ) {
			return $cached;
		}

		global $wpdb;

		$days = max( 1, (int) ( ( strtotime( $date_to ) - strtotime( $date_from ) ) / DAY_IN_SECONDS ) );

		$base_from = "
			FROM {$wpdb->posts} p
			INNER JOIN {$wpdb->postmeta} ms  ON ( p.ID = ms.post_id  AND ms.meta_key  = '_manage_stock' AND ms.meta_value = 'yes' )
			INNER JOIN {$wpdb->postmeta} sq  ON ( p.ID = sq.post_id  AND sq.meta_key  = '_stock' )
			INNER JOIN {$wpdb->postmeta} ads ON ( p.ID = ads.post_id AND ads.meta_key = '_zexst_avg_daily_sales' )
			LEFT  JOIN {$wpdb->postmeta} pr  ON ( p.ID = pr.post_id  AND pr.meta_key  = '_price' )
			LEFT  JOIN {$wpdb->postmeta} sk  ON ( p.ID = sk.post_id  AND sk.meta_key  = '_sku' )
			WHERE p.post_type IN ( 'product', 'product_variation' )
			  AND p.post_status IN ( 'publish', 'private' )
			  AND CAST( sq.meta_value AS SIGNED ) <= 0
			  AND CAST( ads.meta_value AS DECIMAL(10,4) ) > 0
		";

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $base_from is a hardcoded join/where fragment with no user input, refreshed via transient cache below.
		$total_raw = (float) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COALESCE( SUM(
					CAST( ads.meta_value AS DECIMAL(10,4) ) * %d * CAST( COALESCE( pr.meta_value, 0 ) AS DECIMAL(10,2) )
				), 0 ) {$base_from}",
				$days
			)
		);

		$rows = $wpdb->get_results(
			"SELECT
				p.ID,
				p.post_title,
				sk.meta_value AS sku,
				CAST( COALESCE( ads.meta_value, 0 ) AS DECIMAL(10,4) ) AS avg_daily_sales,
				CAST( COALESCE( pr.meta_value,  0 ) AS DECIMAL(10,2) ) AS price
			{$base_from}
			ORDER BY ( CAST( ads.meta_value AS DECIMAL(10,4) ) * CAST( COALESCE( pr.meta_value, 0 ) AS DECIMAL(10,2) ) ) DESC
			LIMIT 20"
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		$items = array();

		foreach ( $rows as $row ) {
			$avg_daily = (float) $row->avg_daily_sales;
			$price     = (float) $row->price;

			$items[] = array(
				'name'           => esc_html( $row->post_title ),
				'sku'            => esc_html( $row->sku ?? '' ),
				'avg_daily'      => round( $avg_daily, 2 ),
				'days'           => $days,
				'estimated_lost' => round( $avg_daily * $days * $price, 2 ),
				'currency'       => html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES | ENT_HTML5, 'UTF-8' ),
			);
		}

		$result = array(
			'items'      => $items,
			'total_lost' => round( $total_raw, 2 ),
			'currency'   => html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES | ENT_HTML5, 'UTF-8' ),
		);

		set_transient( $key, $result, self::CACHE_TTL );

		return $result;
	}

	public static function get_dashboard_widget_data(): array {
		$cache_key = self::CACHE_PREFIX . 'dashboard_widget';
		self::register_transient_key( $cache_key );
		$cached = get_transient( $cache_key );
		if ( false !== $cached ) {
			return $cached;
		}

		global $wpdb;

		$threshold   = absint( zexst_get_setting( 'low_stock_threshold', 10 ) );
		$tier_counts = self::get_stock_tier_counts( $threshold );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- dashboard-widget aggregate over a custom meta join, refreshed via transient cache below.
		$stock_value = (float) $wpdb->get_var(
			"SELECT SUM( CAST( COALESCE( sq.meta_value, '0' ) AS DECIMAL(10,2) ) * CAST( COALESCE( pr.meta_value, '0' ) AS DECIMAL(10,2) ) )
			FROM {$wpdb->posts} p
			INNER JOIN {$wpdb->postmeta} ms ON ( p.ID = ms.post_id AND ms.meta_key = '_manage_stock' AND ms.meta_value = 'yes' )
			LEFT  JOIN {$wpdb->postmeta} sq ON ( p.ID = sq.post_id AND sq.meta_key = '_stock' )
			LEFT  JOIN {$wpdb->postmeta} pr ON ( p.ID = pr.post_id AND pr.meta_key = '_price' )
			WHERE p.post_type IN ( 'product', 'product_variation' )
			  AND p.post_status IN ( 'publish', 'private' )
			  AND CAST( COALESCE( sq.meta_value, '0' ) AS SIGNED ) > 0
			  AND CAST( COALESCE( pr.meta_value, '0' ) AS DECIMAL(10,2) ) > 0"
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		$result = array(
			'total_managed' => $tier_counts['total'],
			'out_of_stock'  => $tier_counts['out_of_stock'],
			'low_stock'     => $tier_counts['low_stock'],
			'stock_value'   => round( $stock_value, 2 ),
			'currency'      => html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES | ENT_HTML5, 'UTF-8' ),
		);

		set_transient( $cache_key, $result, 5 * MINUTE_IN_SECONDS );

		return $result;
	}
}
