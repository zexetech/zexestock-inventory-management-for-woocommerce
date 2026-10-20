<?php
/**
 * Supplier Product Manager — the product <-> supplier purchasing link
 * (wp_zexst_supplier_products). One active row per product in v1: setting a
 * new link deactivates any other row for the same product rather than
 * deleting it, leaving history/cost intact for past POs and a clean
 * migration path to multi-supplier later (see spec "Deferred to future").
 *
 * @package ZexeStock
 */

defined( 'ABSPATH' ) || exit;

class ZEXST_Supplier_Product_Manager {

	public static function get_for_product( int $product_id ): ?array {
		global $wpdb;

		$table           = $wpdb->prefix . 'zexst_supplier_products';
		$suppliers_table = $wpdb->prefix . 'zexst_suppliers';

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own tables; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT sp.*, s.name AS supplier_name
				 FROM {$table} sp
				 INNER JOIN {$suppliers_table} s ON s.id = sp.supplier_id
				 WHERE sp.product_id = %d AND sp.is_active = 1
				 LIMIT 1",
				$product_id
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		return $row ? self::format_row( $row ) : null;
	}

	public static function set_for_product( int $product_id, array $data ): array|\WP_Error {
		global $wpdb;

		$supplier_id = absint( $data['supplier_id'] ?? 0 );
		if ( $supplier_id <= 0 ) {
			return new \WP_Error( 'zexst_invalid_link', __( 'A supplier is required.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		$unit_cost = (float) ( $data['unit_cost'] ?? 0 );
		if ( $unit_cost < 0 || $unit_cost > ZEXST_Constants::MAX_UNIT_COST ) {
			return new \WP_Error( 'zexst_invalid_link', __( 'Unit cost is out of range.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		$table = $wpdb->prefix . 'zexst_supplier_products';
		$now   = current_time( 'mysql', true );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$wpdb->update( $table, array( 'is_active' => 0 ), array( 'product_id' => $product_id ), array( '%d' ), array( '%d' ) );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		$fields = array(
			'supplier_sku'      => sanitize_text_field( $data['supplier_sku'] ?? '' ) ?: null,
			'unit_cost'         => $unit_cost,
			'currency'          => strtoupper( sanitize_text_field( $data['currency'] ?? 'USD' ) ) ?: 'USD',
			'lead_time_days'    => isset( $data['lead_time_days'] ) ? absint( $data['lead_time_days'] ) : null,
			'minimum_order_qty' => isset( $data['minimum_order_qty'] ) ? (float) $data['minimum_order_qty'] : null,
			'order_multiple'    => isset( $data['order_multiple'] ) ? (float) $data['order_multiple'] : null,
			'purchase_unit'     => sanitize_text_field( $data['purchase_unit'] ?? '' ) ?: null,
			'notes'             => sanitize_textarea_field( $data['notes'] ?? '' ) ?: null,
			'is_active'         => 1,
			'updated_at'        => $now,
		);

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$existing_id = $wpdb->get_var(
			$wpdb->prepare( "SELECT id FROM {$table} WHERE supplier_id = %d AND product_id = %d", $supplier_id, $product_id )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		if ( $existing_id ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
			$wpdb->update(
				$table,
				$fields,
				array( 'id' => (int) $existing_id ),
				array( '%s', '%f', '%s', '%d', '%f', '%f', '%s', '%s', '%d', '%s' ),
				array( '%d' )
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$id = (int) $existing_id;
		} else {
			$fields['supplier_id'] = $supplier_id;
			$fields['product_id']  = $product_id;
			$fields['created_at']  = $now;

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
			$wpdb->insert(
				$table,
				$fields,
				array( '%s', '%f', '%s', '%d', '%f', '%f', '%s', '%s', '%d', '%s', '%d', '%d', '%s' )
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$id = (int) $wpdb->insert_id;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own tables; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT sp.*, s.name AS supplier_name FROM {$table} sp
				 INNER JOIN {$wpdb->prefix}zexst_suppliers s ON s.id = sp.supplier_id
				 WHERE sp.id = %d",
				$id
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		return self::format_row( $row );
	}

	public static function get_low_stock_siblings( int $supplier_id, int $exclude_product_id = 0 ): array {
		global $wpdb;

		$table              = $wpdb->prefix . 'zexst_supplier_products';
		$default_threshold  = absint( zexst_get_setting( 'low_stock_threshold', 10 ) );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table plus core wp_posts/wp_postmeta; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT sp.id AS link_id, sp.product_id, sp.supplier_sku, sp.unit_cost, sp.currency,
				        sp.lead_time_days, sp.minimum_order_qty, sp.order_multiple, sp.purchase_unit,
				        p.post_title AS product_name,
				        sku_meta.meta_value AS sku,
				        CAST( stock_meta.meta_value AS SIGNED ) AS stock_qty,
				        thr_meta.meta_value AS threshold_override,
				        pp_meta.meta_value AS purchase_price
				 FROM {$table} sp
				 INNER JOIN {$wpdb->posts} p ON p.ID = sp.product_id
				 INNER JOIN {$wpdb->postmeta} manage_meta ON ( manage_meta.post_id = sp.product_id AND manage_meta.meta_key = '_manage_stock' AND manage_meta.meta_value = 'yes' )
				 INNER JOIN {$wpdb->postmeta} stock_meta ON ( stock_meta.post_id = sp.product_id AND stock_meta.meta_key = '_stock' )
				 LEFT JOIN {$wpdb->postmeta} sku_meta ON ( sku_meta.post_id = sp.product_id AND sku_meta.meta_key = '_sku' )
				 LEFT JOIN {$wpdb->postmeta} thr_meta ON ( thr_meta.post_id = sp.product_id AND thr_meta.meta_key = '_zexst_low_stock_threshold' )
				 LEFT JOIN {$wpdb->postmeta} pp_meta ON ( pp_meta.post_id = sp.product_id AND pp_meta.meta_key = '_zexst_purchase_price' )
				 WHERE sp.supplier_id = %d AND sp.is_active = 1 AND sp.product_id != %d
				 ORDER BY p.post_title ASC",
				$supplier_id,
				$exclude_product_id
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		$siblings = array();
		foreach ( (array) $rows as $row ) {
			$threshold = ( null !== $row['threshold_override'] && '' !== $row['threshold_override'] )
				? absint( $row['threshold_override'] )
				: $default_threshold;
			$stock_qty = (int) $row['stock_qty'];

			if ( $stock_qty > $threshold ) {
				continue;
			}

			$siblings[] = array(
				'product_id'        => (int) $row['product_id'],
				'product_name'      => $row['product_name'],
				'sku'               => $row['sku'] ?? '',
				'stock_qty'         => $stock_qty,
				'threshold'         => $threshold,
				'supplier_sku'      => $row['supplier_sku'],
				'unit_cost'         => (float) $row['unit_cost'],
				'purchase_price'    => self::purchase_price_or_null( $row ),
				'currency'          => $row['currency'],
				'lead_time_days'    => null !== $row['lead_time_days'] ? (int) $row['lead_time_days'] : null,
				'minimum_order_qty' => null !== $row['minimum_order_qty'] ? (float) $row['minimum_order_qty'] : null,
				'order_multiple'    => null !== $row['order_multiple'] ? (float) $row['order_multiple'] : null,
				'purchase_unit'     => $row['purchase_unit'],
			);
		}

		return $siblings;
	}

	public static function list_for_supplier( int $supplier_id, array $args = array() ): array {
		global $wpdb;

		$per_page = max( 1, min( 200, absint( $args['per_page'] ?? 20 ) ) );
		$page     = max( 1, absint( $args['page'] ?? 1 ) );
		$offset   = ( $page - 1 ) * $per_page;

		$table = $wpdb->prefix . 'zexst_supplier_products';

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$total = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE supplier_id = %d AND is_active = 1",
				$supplier_id
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table plus core wp_posts/wp_postmeta; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT sp.id, sp.product_id, p.post_title AS product_name, sku_meta.meta_value AS sku,
				        sp.supplier_sku, sp.unit_cost, sp.currency, sp.lead_time_days,
				        sp.minimum_order_qty, sp.order_multiple, sp.purchase_unit, sp.is_active,
				        sp.created_at, sp.updated_at, pp_meta.meta_value AS purchase_price
				 FROM {$table} sp
				 INNER JOIN {$wpdb->posts} p ON p.ID = sp.product_id
				 LEFT JOIN {$wpdb->postmeta} sku_meta ON ( sku_meta.post_id = sp.product_id AND sku_meta.meta_key = '_sku' )
				 LEFT JOIN {$wpdb->postmeta} pp_meta ON ( pp_meta.post_id = sp.product_id AND pp_meta.meta_key = '_zexst_purchase_price' )
				 WHERE sp.supplier_id = %d AND sp.is_active = 1
				 ORDER BY p.post_title ASC
				 LIMIT %d OFFSET %d",
				$supplier_id,
				$per_page,
				$offset
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		$items = array();
		foreach ( (array) $rows as $row ) {
			$items[] = array(
				'id'                => (int) $row['id'],
				'product_id'        => (int) $row['product_id'],
				'product_name'      => $row['product_name'],
				'sku'               => $row['sku'] ?? '',
				'supplier_sku'      => $row['supplier_sku'],
				'unit_cost'         => (float) $row['unit_cost'],
				'purchase_price'    => self::purchase_price_or_null( $row ),
				'currency'          => $row['currency'],
				'lead_time_days'    => null !== $row['lead_time_days'] ? (int) $row['lead_time_days'] : null,
				'minimum_order_qty' => null !== $row['minimum_order_qty'] ? (float) $row['minimum_order_qty'] : null,
				'order_multiple'    => null !== $row['order_multiple'] ? (float) $row['order_multiple'] : null,
				'purchase_unit'     => $row['purchase_unit'],
				'is_active'         => (bool) (int) $row['is_active'],
				'created_at'        => $row['created_at'],
				'updated_at'        => $row['updated_at'],
			);
		}

		return array(
			'items' => $items,
			'total' => $total,
		);
	}

	public static function remove_for_product( int $product_id ): true|\WP_Error {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$wpdb->delete(
			$wpdb->prefix . 'zexst_supplier_products',
			array( 'product_id' => $product_id, 'is_active' => 1 ),
			array( '%d', '%d' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		return true;
	}

	private static function format_row( array $row ): array {
		return array(
			'id'                => (int) $row['id'],
			'supplier_id'       => (int) $row['supplier_id'],
			'supplier_name'     => $row['supplier_name'] ?? '',
			'product_id'        => (int) $row['product_id'],
			'supplier_sku'      => $row['supplier_sku'],
			'unit_cost'         => (float) $row['unit_cost'],
			'currency'          => $row['currency'],
			'lead_time_days'    => null !== $row['lead_time_days'] ? (int) $row['lead_time_days'] : null,
			'minimum_order_qty' => null !== $row['minimum_order_qty'] ? (float) $row['minimum_order_qty'] : null,
			'order_multiple'    => null !== $row['order_multiple'] ? (float) $row['order_multiple'] : null,
			'purchase_unit'     => $row['purchase_unit'],
			'is_active'         => (bool) (int) $row['is_active'],
			'notes'             => $row['notes'],
			'created_at'        => $row['created_at'],
			'updated_at'        => $row['updated_at'],
		);
	}

	private static function purchase_price_or_null( array $row ): ?string {
		$value = $row['purchase_price'] ?? null;
		return ( null === $value || '' === $value ) ? null : (string) $value;
	}
}
