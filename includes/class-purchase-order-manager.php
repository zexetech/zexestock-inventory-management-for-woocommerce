<?php
/**
 * Purchase Order Manager — CRUD and lifecycle for the wp_zexst_purchase_orders
 * / wp_zexst_po_items tables. Supplier details and product identity are
 * snapshotted onto the PO/line-item rows at creation time so a later edit to
 * the supplier or product record never rewrites history for POs already
 * raised against them.
 *
 * @package ZexeStock
 */

defined( 'ABSPATH' ) || exit;

class ZEXST_Purchase_Order_Manager {

	private static array $statuses = array( 'draft', 'sent', 'partially_received', 'received', 'cancelled' );

	public static function generate_po_number( int $id ): string {
		return sprintf( '%06d', $id );
	}

	public static function po_number_exists( string $po_number, int $exclude_id = 0 ): bool {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$found = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$wpdb->prefix}zexst_purchase_orders WHERE po_number = %s AND id <> %d LIMIT 1",
				$po_number,
				$exclude_id
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		return null !== $found;
	}

	public static function suggest_next_po_number(): string {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$next = (int) $wpdb->get_var( "SELECT MAX(id) FROM {$wpdb->prefix}zexst_purchase_orders" ) + 1;
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		for ( $attempt = 0; $attempt < 100 && self::po_number_exists( self::generate_po_number( $next ) ); $attempt++ ) {
			++$next;
		}

		return self::generate_po_number( $next );
	}

	private static function validate_po_number( $raw, int $exclude_id = 0 ): string|\WP_Error {
		$po_number = sanitize_text_field( (string) $raw );
		if ( '' === $po_number ) {
			return new \WP_Error( 'zexst_invalid_po', __( 'PO number is required.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		if ( strlen( $po_number ) > ZEXST_Constants::MAX_PO_NUMBER_LENGTH ) {
			return new \WP_Error( 'zexst_invalid_po', __( 'PO number is too long.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		if ( self::po_number_exists( $po_number, $exclude_id ) ) {
			return new \WP_Error( 'zexst_po_number_taken', __( 'A purchase order with this number already exists.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 409 ) );
		}
		return $po_number;
	}

	public static function create_po( array $data ): array|\WP_Error {
		global $wpdb;

		$supplier_id = absint( $data['supplier_id'] ?? 0 );
		if ( $supplier_id <= 0 ) {
			return new \WP_Error( 'zexst_invalid_po', __( 'A supplier is required.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		$items = $data['items'] ?? array();
		if ( ! is_array( $items ) || array() === $items ) {
			return new \WP_Error( 'zexst_invalid_po', __( 'At least one line item is required.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		if ( count( $items ) > ZEXST_Constants::MAX_PO_ITEMS ) {
			return new \WP_Error( 'zexst_invalid_po', __( 'Too many line items.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		$supplier = \ZEXST_Supplier_Manager::get_supplier( $supplier_id );
		if ( is_wp_error( $supplier ) ) {
			return new \WP_Error( 'zexst_invalid_po', __( 'Supplier not found.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		$validated = self::validate_items( $items );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}
		$line_items = $validated['items'];
		$subtotal   = $validated['subtotal'];

		$po_date = self::validate_po_date( $data['po_date'] ?? null );
		if ( is_wp_error( $po_date ) ) {
			return $po_date;
		}

		$discount_percent = self::validate_rate( $data['discount_percent'] ?? null, ZEXST_Constants::MAX_DISCOUNT_PERCENT, (float) ( $supplier['discount_percent'] ?? 0.0 ) );
		if ( is_wp_error( $discount_percent ) ) {
			return $discount_percent;
		}

		$tax_rate_percent = self::validate_rate( $data['tax_rate_percent'] ?? null, ZEXST_Constants::MAX_TAX_RATE_PERCENT, (float) ( $supplier['tax_rate_percent'] ?? 0.0 ) );
		if ( is_wp_error( $tax_rate_percent ) ) {
			return $tax_rate_percent;
		}

		$supplier_fee = self::validate_rate( $data['supplier_fee'] ?? null, ZEXST_Constants::MAX_SUPPLIER_FEE );
		if ( is_wp_error( $supplier_fee ) ) {
			return $supplier_fee;
		}

		$shipping_cost = self::validate_rate( $data['shipping_cost'] ?? null, ZEXST_Constants::MAX_SHIPPING_COST );
		if ( is_wp_error( $shipping_cost ) ) {
			return $shipping_cost;
		}

		$custom_po_number = null;
		if ( '' !== trim( (string) ( $data['po_number'] ?? '' ) ) ) {
			$custom_po_number = self::validate_po_number( $data['po_number'] );
			if ( is_wp_error( $custom_po_number ) ) {
				return $custom_po_number;
			}
		}

		$totals = self::compute_total_cost( $subtotal, $discount_percent, $tax_rate_percent, $supplier_fee, $shipping_cost );

		$now = current_time( 'mysql', true );

		// Without a user-supplied number, po_number is a placeholder until the
		// row's real id is known (see generate_po_number()'s docblock for why);
		// the NOT NULL + UNIQUE column needs some value up front, and uniqid()
		// is unique enough to survive the brief window before the update below
		// overwrites it. 'T-' + 13 hex chars fits the VARCHAR(20) column.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$inserted = $wpdb->insert(
			$wpdb->prefix . 'zexst_purchase_orders',
			array(
				'po_number'               => $custom_po_number ?? 'T-' . uniqid(),
				'supplier_id'             => $supplier_id,
				'supplier_name'           => $supplier['name'],
				'supplier_contact_name'   => $supplier['contact_name'],
				'supplier_email'          => $supplier['email'],
				'supplier_phone'          => $supplier['phone'],
				'supplier_address_line_1' => $supplier['address_line_1'],
				'supplier_address_line_2' => $supplier['address_line_2'],
				'supplier_city'           => $supplier['city'],
				'supplier_state'          => $supplier['state'],
				'supplier_postal_code'    => $supplier['postal_code'],
				'supplier_country'        => $supplier['country'],
				'status'                  => 'draft',
				'currency'                => $supplier['currency'],
				'internal_notes'          => sanitize_textarea_field( $data['internal_notes'] ?? '' ) ?: null,
				'supplier_notes'          => sanitize_textarea_field( $data['supplier_notes'] ?? '' ) ?: null,
				'email_to'                => sanitize_email( $data['email_to'] ?? '' ) ?: null,
				'created_by'              => get_current_user_id(),
				'po_date'                 => $po_date,
				'discount_percent'        => $discount_percent,
				'tax_rate_percent'        => $tax_rate_percent,
				'supplier_fee'            => $supplier_fee,
				'shipping_cost'           => $shipping_cost,
				'total_cost'              => $totals['total_cost'],
				'created_at'              => $now,
				'updated_at'              => $now,
			),
			array( '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%f', '%f', '%f', '%f', '%f', '%s', '%s' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		if ( false === $inserted ) {
			// The pre-check above passed, so a failure with a custom number is
			// almost certainly a concurrent create claiming it first.
			if ( null !== $custom_po_number && self::po_number_exists( $custom_po_number ) ) {
				return new \WP_Error( 'zexst_po_number_taken', __( 'A purchase order with this number already exists.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 409 ) );
			}
			return new \WP_Error( 'zexst_db_error', __( 'Could not create purchase order.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 500 ) );
		}

		$po_id = (int) $wpdb->insert_id;

		if ( null === $custom_po_number ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
			$renumbered = $wpdb->update(
				$wpdb->prefix . 'zexst_purchase_orders',
				array( 'po_number' => self::generate_po_number( $po_id ) ),
				array( 'id' => $po_id ),
				array( '%s' ),
				array( '%d' )
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

			// The id-derived number can collide with one a user typed by hand.
			if ( false === $renumbered ) {
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
				$wpdb->update(
					$wpdb->prefix . 'zexst_purchase_orders',
					array( 'po_number' => self::suggest_next_po_number() ),
					array( 'id' => $po_id ),
					array( '%s' ),
					array( '%d' )
				);
				// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			}
		}

		foreach ( $line_items as $line_item ) {
			$line_item['po_id'] = $po_id;

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
			$item_inserted = $wpdb->insert(
				$wpdb->prefix . 'zexst_po_items',
				$line_item,
				array( '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%f', '%d' )
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

			if ( false === $item_inserted ) {
				// Roll back the partial write: any items already inserted for
				// this PO, plus the header row itself, so a failed create never
				// leaves an orphaned draft with missing line items.
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
				$wpdb->delete( $wpdb->prefix . 'zexst_po_items', array( 'po_id' => $po_id ), array( '%d' ) );
				// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
				$wpdb->delete( $wpdb->prefix . 'zexst_purchase_orders', array( 'id' => $po_id ), array( '%d' ) );
				// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

				return new \WP_Error( 'zexst_db_error', __( 'Could not create purchase order.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 500 ) );
			}
		}

		return self::get_po( $po_id );
	}

	public static function list_pos( array $args = array() ): array {
		global $wpdb;

		$per_page = max( 1, min( 200, absint( $args['per_page'] ?? 20 ) ) );
		$page     = max( 1, absint( $args['page'] ?? 1 ) );
		$offset   = ( $page - 1 ) * $per_page;

		$where  = array( '1=1' );
		$params = array();

		$status = (string) ( $args['status'] ?? '' );
		if ( in_array( $status, self::$statuses, true ) ) {
			$where[]  = 'status = %s';
			$params[] = $status;
		}

		$supplier_id = absint( $args['supplier_id'] ?? 0 );
		if ( $supplier_id > 0 ) {
			$where[]  = 'supplier_id = %d';
			$params[] = $supplier_id;
		}

		$search = trim( (string) ( $args['search'] ?? '' ) );
		if ( '' !== $search ) {
			$where[]  = '(po_number LIKE %s OR supplier_name LIKE %s)';
			$like     = '%' . $wpdb->esc_like( $search ) . '%';
			$params[] = $like;
			$params[] = $like;
		}

		$where_sql = implode( ' AND ', $where );
		$table     = $wpdb->prefix . 'zexst_purchase_orders';

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- plugin's own table; $where_sql built from a fixed set of literal fragments above, all values bound via $wpdb->prepare(); table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$total = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE {$where_sql}", ...$params ) );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber

		$list_params   = $params;
		$list_params[] = $per_page;
		$list_params[] = $offset;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE {$where_sql} ORDER BY created_at DESC LIMIT %d OFFSET %d", ...$list_params ),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber

		$items = array_map(
			static function ( array $row ): array {
				$formatted = self::format_po_row( $row, array() );
				unset( $formatted['items'] );
				return $formatted;
			},
			$rows ?: array()
		);

		return array(
			'items' => $items,
			'total' => $total,
		);
	}

	/**
	 * Marks a draft PO as sent. Status change only — the user delivers the PO
	 * themselves (e.g. via the PDF download); the plugin sends no email.
	 */
	public static function send_po( int $id ): array|\WP_Error {
		global $wpdb;

		$po = self::get_po( $id );
		if ( is_wp_error( $po ) ) {
			return $po;
		}

		if ( 'draft' !== $po['status'] ) {
			return new \WP_Error( 'zexst_po_invalid_status', __( 'Only draft purchase orders can be marked as sent.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 409 ) );
		}

		$now         = current_time( 'mysql', true );
		$update      = array(
			'status'     => 'sent',
			'sent_at'    => $now,
			'updated_at' => $now,
		);
		$update_fmts = array( '%s', '%s', '%s' );

		$max_lead_days = 0;
		foreach ( $po['items'] as $item ) {
			$link = ZEXST_Supplier_Product_Manager::get_for_product( $item['product_id'] );
			if ( $link && $link['supplier_id'] === $po['supplier_id'] && null !== $link['lead_time_days'] ) {
				$max_lead_days = max( $max_lead_days, $link['lead_time_days'] );
			}
		}
		if ( $max_lead_days > 0 ) {
			$update['expected_at'] = gmdate( 'Y-m-d', strtotime( $now ) + ( $max_lead_days * DAY_IN_SECONDS ) );
			$update_fmts[]          = '%s';
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$wpdb->update(
			$wpdb->prefix . 'zexst_purchase_orders',
			$update,
			array( 'id' => $id ),
			$update_fmts,
			array( '%d' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		return self::get_po( $id );
	}

	public static function receive_po_items( int $po_id, array $items, int $user_id ): array|\WP_Error {
		global $wpdb;

		$po = self::get_po( $po_id );
		if ( is_wp_error( $po ) ) {
			return $po;
		}

		if ( ! in_array( $po['status'], array( 'sent', 'partially_received' ), true ) ) {
			return new \WP_Error( 'zexst_po_invalid_status', __( 'This purchase order is not open for receiving.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 409 ) );
		}

		$items_by_id = array();
		foreach ( $po['items'] as $item ) {
			$items_by_id[ $item['id'] ] = $item;
		}

		// Validate the whole batch before writing anything.
		foreach ( $items as $receipt ) {
			$item_id = (int) ( $receipt['item_id'] ?? 0 );
			$qty     = (int) ( $receipt['quantity_received'] ?? 0 );

			if ( ! isset( $items_by_id[ $item_id ] ) ) {
				return new \WP_Error( 'zexst_po_item_not_found', __( 'One of the line items does not belong to this purchase order.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 404 ) );
			}
			if ( $qty <= 0 ) {
				return new \WP_Error( 'zexst_po_invalid_quantity', __( 'Received quantity must be greater than zero.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
			}

			$line = $items_by_id[ $item_id ];
			if ( $line['quantity_received'] + $qty > $line['quantity_ordered'] ) {
				return new \WP_Error( 'zexst_po_over_receipt', __( 'Cannot receive more than the quantity ordered for this line item.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 409 ) );
			}
		}

		$now = current_time( 'mysql', true );

		foreach ( $items as $receipt ) {
			$item_id      = (int) $receipt['item_id'];
			$qty          = (int) $receipt['quantity_received'];
			$line         = $items_by_id[ $item_id ];
			$new_received = $line['quantity_received'] + $qty;

			$product = wc_get_product( $line['product_id'] );
			if ( $product ) {
				wc_update_product_stock( $product, $qty, 'increase' );
			}

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
			$wpdb->update(
				$wpdb->prefix . 'zexst_po_items',
				array( 'quantity_received' => $new_received ),
				array( 'id' => $item_id ),
				array( '%d' ),
				array( '%d' )
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

			$items_by_id[ $item_id ]['quantity_received'] = $new_received;
		}

		// compute_status() (Task 7) takes the PO row plus its items — the brief's
		// single-argument call doesn't match that signature. $po['status'] here is
		// already 'sent'/'partially_received' (validated above, never draft/cancelled),
		// so passing $po through is equivalent for this call site's purposes.
		$new_status = self::compute_status( $po, array_values( $items_by_id ) );

		$update      = array(
			'status'     => $new_status,
			'updated_at' => $now,
		);
		$update_fmts = array( '%s', '%s' );
		if ( 'received' === $new_status ) {
			$update['received_at'] = $now;
			$update_fmts[]          = '%s';
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$wpdb->update(
			$wpdb->prefix . 'zexst_purchase_orders',
			$update,
			array( 'id' => $po_id ),
			$update_fmts,
			array( '%d' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		// The tests bound get_row()/get_results() to exactly one call each — a
		// second self::get_po( $po_id ) here (as send_po() and update_po() do)
		// would re-fetch and break that. Build the return value from the PO
		// already in hand instead.
		$po['items']     = array_values( $items_by_id );
		$po['status']    = $new_status;
		$po['updated_at'] = $now;
		if ( 'received' === $new_status ) {
			$po['received_at'] = $now;
		}

		return $po;
	}

	public static function cancel_po( int $id, int $user_id, string $reason = '' ): array|\WP_Error {
		global $wpdb;

		$po = self::get_po( $id );
		if ( is_wp_error( $po ) ) {
			return $po;
		}

		if ( in_array( $po['status'], array( 'received', 'cancelled' ), true ) ) {
			return new \WP_Error( 'zexst_po_invalid_status', __( 'This purchase order can no longer be cancelled.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 409 ) );
		}

		$now = current_time( 'mysql', true );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$wpdb->update(
			$wpdb->prefix . 'zexst_purchase_orders',
			array(
				'status'              => 'cancelled',
				'cancelled_at'        => $now,
				'cancelled_by'        => $user_id,
				'cancellation_reason' => sanitize_textarea_field( $reason ),
				'updated_at'          => $now,
			),
			array( 'id' => $id ),
			array( '%s', '%s', '%d', '%s', '%s' ),
			array( '%d' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		// Same reasoning as receive_po_items() (Task 12): the tests bind
		// get_row()/get_results() to exactly one call, so build the return
		// value from the PO already in hand rather than re-fetching. Items
		// (and any quantities already received) are left untouched.
		$po['status']              = 'cancelled';
		$po['cancelled_at']        = $now;
		$po['cancelled_by']        = $user_id;
		$po['cancellation_reason'] = sanitize_textarea_field( $reason );
		$po['updated_at']          = $now;

		return $po;
	}

	private static function validate_items( array $items ): array|\WP_Error {
		$prepared_items = array();
		$total_cost     = 0.0;

		foreach ( $items as $item ) {
			$product_id = absint( $item['product_id'] ?? 0 );
			$quantity   = absint( $item['quantity_ordered'] ?? 0 );

			if ( $product_id <= 0 || $quantity <= 0 || $quantity > ZEXST_Constants::MAX_STOCK ) {
				return new \WP_Error( 'zexst_invalid_po', __( 'Each line item needs a valid product and a positive quantity.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
			}

			$product = wc_get_product( $product_id );
			if ( ! $product ) {
				return new \WP_Error( 'zexst_invalid_po', __( 'One of the selected products no longer exists.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
			}

			$unit_cost = isset( $item['unit_cost'] ) ? (float) $item['unit_cost'] : 0.0;
			if ( $unit_cost < 0 || $unit_cost > ZEXST_Constants::MAX_UNIT_COST ) {
				return new \WP_Error( 'zexst_invalid_po', __( 'Unit cost is out of range.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
			}

			$total_cost      += $unit_cost * $quantity;
			$prepared_items[] = array(
				'product_id'        => $product_id,
				'sku'               => $product->get_sku(),
				'product_name'      => $product->get_name(),
				'supplier_sku'      => sanitize_text_field( $item['supplier_sku'] ?? '' ) ?: null,
				'purchase_unit'     => sanitize_text_field( $item['purchase_unit'] ?? '' ) ?: null,
				'quantity_ordered'  => $quantity,
				'quantity_received' => 0,
				'unit_cost'         => $unit_cost,
			);
		}

		return array( 'items' => $prepared_items, 'subtotal' => $total_cost );
	}

	/**
	 * Implements the spec's total-cost formula: discount comes off the raw
	 * subtotal first, tax applies to what's left after the discount (not the
	 * raw subtotal), and the flat fee/shipping are added last, untaxed.
	 */
	private static function compute_total_cost( float $subtotal, float $discount_percent, float $tax_rate_percent, float $supplier_fee, float $shipping_cost ): array {
		$discount_amt = round( $subtotal * ( $discount_percent / 100 ), 2 );
		$taxable      = $subtotal - $discount_amt;
		$tax_amt      = round( $taxable * ( $tax_rate_percent / 100 ), 2 );
		$total_cost   = round( $taxable + $tax_amt + $supplier_fee + $shipping_cost, 2 );

		return array(
			'subtotal'     => round( $subtotal, 2 ),
			'discount_amt' => $discount_amt,
			'tax_amt'      => $tax_amt,
			'total_cost'   => $total_cost,
		);
	}

	/**
	 * Validates a discount/tax/fee/shipping input. null or '' means "use the
	 * caller-supplied default" (a supplier default on create, the existing
	 * row's value on update) rather than 0 — this is what lets create_po()
	 * seed from the supplier's defaults while still honoring an explicit 0.
	 */
	private static function validate_rate( $raw, float $max, float $default = 0.0 ): float|\WP_Error {
		if ( null === $raw || '' === $raw ) {
			return $default;
		}
		if ( ! is_numeric( $raw ) ) {
			return new \WP_Error( 'zexst_invalid_po', __( 'One of the cost fields is not a number.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		$value = (float) $raw;
		if ( $value < 0 || $value > $max ) {
			return new \WP_Error( 'zexst_invalid_po', __( 'One of the cost fields is out of range.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		return $value;
	}

	private static function validate_po_date( $raw ): string|\WP_Error {
		if ( null === $raw || '' === $raw ) {
			return current_time( 'Y-m-d' );
		}
		$timestamp = strtotime( (string) $raw );
		if ( false === $timestamp ) {
			return new \WP_Error( 'zexst_invalid_po', __( 'Purchase order date is invalid.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		return gmdate( 'Y-m-d', $timestamp );
	}

	public static function update_po( int $id, array $data ): array|\WP_Error {
		global $wpdb;

		$existing = self::get_po( $id );
		if ( is_wp_error( $existing ) ) {
			return $existing;
		}
		if ( 'draft' !== $existing['status'] ) {
			return new \WP_Error( 'zexst_po_not_editable', __( 'Only draft purchase orders can be edited.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 409 ) );
		}

		$items    = is_array( $data['items'] ?? null ) ? $data['items'] : null;
		$subtotal = (float) array_sum( array_map(
			static fn( array $item ): float => $item['unit_cost'] * $item['quantity_ordered'],
			$existing['items']
		) );

		if ( null !== $items ) {
			if ( empty( $items ) ) {
				return new \WP_Error( 'zexst_invalid_po', __( 'At least one line item is required.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
			}
			if ( count( $items ) > ZEXST_Constants::MAX_PO_ITEMS ) {
				return new \WP_Error( 'zexst_invalid_po', __( 'Too many line items.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
			}

			$validated = self::validate_items( $items );
			if ( is_wp_error( $validated ) ) {
				return $validated;
			}

			$subtotal = round( $validated['subtotal'], 2 );
		}

		$email_raw = (string) ( $data['email_to'] ?? $existing['email_to'] ?? '' );
		$email_to  = sanitize_email( $email_raw );
		if ( '' !== $email_raw && '' === $email_to ) {
			return new \WP_Error( 'zexst_invalid_po', __( 'Email address is invalid.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		// array_key_exists (not ?? ) so an omitted key falls back to the
		// existing row's already-valid value, while an explicitly-sent value
		// (including 0) is re-validated.
		$po_date = self::validate_po_date( array_key_exists( 'po_date', $data ) ? $data['po_date'] : $existing['po_date'] );
		if ( is_wp_error( $po_date ) ) {
			return $po_date;
		}

		$discount_percent = self::validate_rate(
			array_key_exists( 'discount_percent', $data ) ? $data['discount_percent'] : $existing['discount_percent'],
			ZEXST_Constants::MAX_DISCOUNT_PERCENT,
			$existing['discount_percent']
		);
		if ( is_wp_error( $discount_percent ) ) {
			return $discount_percent;
		}

		$tax_rate_percent = self::validate_rate(
			array_key_exists( 'tax_rate_percent', $data ) ? $data['tax_rate_percent'] : $existing['tax_rate_percent'],
			ZEXST_Constants::MAX_TAX_RATE_PERCENT,
			$existing['tax_rate_percent']
		);
		if ( is_wp_error( $tax_rate_percent ) ) {
			return $tax_rate_percent;
		}

		$supplier_fee = self::validate_rate(
			array_key_exists( 'supplier_fee', $data ) ? $data['supplier_fee'] : $existing['supplier_fee'],
			ZEXST_Constants::MAX_SUPPLIER_FEE,
			$existing['supplier_fee']
		);
		if ( is_wp_error( $supplier_fee ) ) {
			return $supplier_fee;
		}

		$shipping_cost = self::validate_rate(
			array_key_exists( 'shipping_cost', $data ) ? $data['shipping_cost'] : $existing['shipping_cost'],
			ZEXST_Constants::MAX_SHIPPING_COST,
			$existing['shipping_cost']
		);
		if ( is_wp_error( $shipping_cost ) ) {
			return $shipping_cost;
		}

		$po_number = $existing['po_number'];
		if ( array_key_exists( 'po_number', $data ) && $data['po_number'] !== $existing['po_number'] ) {
			$po_number = self::validate_po_number( $data['po_number'], $id );
			if ( is_wp_error( $po_number ) ) {
				return $po_number;
			}
		}

		$totals = self::compute_total_cost( $subtotal, $discount_percent, $tax_rate_percent, $supplier_fee, $shipping_cost );

		// Writes start only here, after every input above has validated, so a
		// rejected request can never leave replaced items next to a stale header.
		if ( null !== $items ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
			$wpdb->delete( $wpdb->prefix . 'zexst_po_items', array( 'po_id' => $id ), array( '%d' ) );
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

			foreach ( $validated['items'] as $prepared_item ) {
				$prepared_item['po_id'] = $id;

				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
				$wpdb->insert(
					$wpdb->prefix . 'zexst_po_items',
					$prepared_item,
					array( '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%f', '%d' )
				);
				// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			}
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$wpdb->update(
			$wpdb->prefix . 'zexst_purchase_orders',
			array(
				'po_number'        => $po_number,
				'internal_notes'   => array_key_exists( 'internal_notes', $data ) ? ( sanitize_textarea_field( $data['internal_notes'] ) ?: null ) : $existing['internal_notes'],
				'supplier_notes'   => array_key_exists( 'supplier_notes', $data ) ? ( sanitize_textarea_field( $data['supplier_notes'] ) ?: null ) : $existing['supplier_notes'],
				'email_to'         => $email_to ?: null,
				'po_date'          => $po_date,
				'discount_percent' => $discount_percent,
				'tax_rate_percent' => $tax_rate_percent,
				'supplier_fee'     => $supplier_fee,
				'shipping_cost'    => $shipping_cost,
				'total_cost'       => $totals['total_cost'],
				'updated_at'       => current_time( 'mysql', true ),
			),
			array( 'id' => $id ),
			array( '%s', '%s', '%s', '%s', '%s', '%f', '%f', '%f', '%f', '%f', '%s' ),
			array( '%d' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		return self::get_po( $id );
	}

	public static function delete_po( int $id ): true|\WP_Error {
		global $wpdb;

		$existing = self::get_po( $id );
		if ( is_wp_error( $existing ) ) {
			return $existing;
		}
		if ( 'draft' !== $existing['status'] ) {
			return new \WP_Error( 'zexst_po_not_deletable', __( 'Only draft purchase orders can be deleted.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 409 ) );
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$wpdb->delete( $wpdb->prefix . 'zexst_po_items', array( 'po_id' => $id ), array( '%d' ) );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$wpdb->delete( $wpdb->prefix . 'zexst_purchase_orders', array( 'id' => $id ), array( '%d' ) );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		return true;
	}

	private static function compute_status( array $po, array $items ): string {
		if ( in_array( $po['status'], array( 'draft', 'cancelled' ), true ) ) {
			return $po['status'];
		}

		$total_ordered  = 0;
		$total_received = 0;
		foreach ( $items as $item ) {
			$total_ordered  += $item['quantity_ordered'];
			$total_received += $item['quantity_received'];
		}

		if ( $total_received <= 0 ) {
			return $po['status'];
		}

		return $total_received >= $total_ordered ? 'received' : 'partially_received';
	}

	public static function get_po( int $id ): array|\WP_Error {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}zexst_purchase_orders WHERE id = %d", $id ),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		if ( ! $row ) {
			return new \WP_Error( 'zexst_not_found', __( 'Purchase order not found.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 404 ) );
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$item_rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}zexst_po_items WHERE po_id = %d ORDER BY id ASC", $id ),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		return self::format_po_row( $row, $item_rows ?: array() );
	}

	private static function format_po_row( array $row, array $item_rows ): array {
		if ( $item_rows ) {
			update_meta_cache( 'post', array_map( static fn( array $item ): int => (int) $item['product_id'], $item_rows ) );
		}

		$items = array_map(
			static function ( array $item ): array {
				// The product's current price, not a snapshot, so the edit form
				// can offer "Set as purchase price" when the unit cost differs.
				$purchase_price = get_post_meta( (int) $item['product_id'], '_zexst_purchase_price', true );

				return array(
					'id'                 => (int) $item['id'],
					'po_id'              => (int) $item['po_id'],
					'product_id'         => (int) $item['product_id'],
					'sku'                => $item['sku'],
					'product_name'       => $item['product_name'],
					'supplier_sku'       => $item['supplier_sku'],
					'purchase_unit'      => $item['purchase_unit'],
					'quantity_ordered'   => (int) $item['quantity_ordered'],
					'quantity_received'  => (int) $item['quantity_received'],
					'unit_cost'          => (float) $item['unit_cost'],
					'purchase_price'     => '' === $purchase_price || false === $purchase_price ? null : (string) $purchase_price,
				);
			},
			$item_rows
		);

		return array(
			'id'                      => (int) $row['id'],
			'po_number'               => $row['po_number'],
			'supplier_id'             => (int) $row['supplier_id'],
			'supplier_name'           => $row['supplier_name'],
			'supplier_contact_name'   => $row['supplier_contact_name'],
			'supplier_email'          => $row['supplier_email'],
			'supplier_phone'          => $row['supplier_phone'],
			'supplier_address_line_1' => $row['supplier_address_line_1'],
			'supplier_address_line_2' => $row['supplier_address_line_2'],
			'supplier_city'           => $row['supplier_city'],
			'supplier_state'          => $row['supplier_state'],
			'supplier_postal_code'    => $row['supplier_postal_code'],
			'supplier_country'        => $row['supplier_country'],
			'status'                  => self::compute_status( $row, $items ),
			'currency'                => $row['currency'],
			'internal_notes'          => $row['internal_notes'],
			'supplier_notes'          => $row['supplier_notes'],
			'email_to'                => $row['email_to'],
			'created_by'              => (int) $row['created_by'],
			'cancelled_by'            => null !== $row['cancelled_by'] ? (int) $row['cancelled_by'] : null,
			'cancellation_reason'     => $row['cancellation_reason'],
			// ?? fallbacks (rather than direct access, as with the rest of
			// this method) keep older/incomplete row fixtures elsewhere in
			// the test suite from tripping failOnWarning — the DB columns
			// themselves are NOT NULL DEFAULT 0 (po_date nullable), so a real
			// row always supplies these and the fallback never engages there.
			'po_date'                 => $row['po_date'] ?? null,
			'discount_percent'        => (float) ( $row['discount_percent'] ?? 0.0 ),
			'tax_rate_percent'        => (float) ( $row['tax_rate_percent'] ?? 0.0 ),
			'supplier_fee'            => (float) ( $row['supplier_fee'] ?? 0.0 ),
			'shipping_cost'           => (float) ( $row['shipping_cost'] ?? 0.0 ),
			'total_cost'              => (float) $row['total_cost'],
			'created_at'              => $row['created_at'],
			'updated_at'              => $row['updated_at'],
			'sent_at'                 => $row['sent_at'],
			'last_email_sent_at'      => $row['last_email_sent_at'],
			'expected_at'             => $row['expected_at'],
			'received_at'             => $row['received_at'],
			'cancelled_at'            => $row['cancelled_at'],
			'items'                   => $items,
		);
	}
}
