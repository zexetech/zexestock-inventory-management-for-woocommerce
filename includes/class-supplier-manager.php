<?php
/**
 * Supplier Manager — CRUD for the wp_zexst_suppliers table.
 *
 * @package ZexeStock
 */

defined( 'ABSPATH' ) || exit;

class ZEXST_Supplier_Manager {

	private static array $statuses = array( 'active', 'inactive' );

	public static function create_supplier( array $data ): array|\WP_Error {
		global $wpdb;

		$name = sanitize_text_field( $data['name'] ?? '' );
		if ( '' === $name ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Supplier name is required.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		if ( mb_strlen( $name ) > ZEXST_Constants::MAX_SUPPLIER_NAME_LENGTH ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Supplier name is too long.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		$raw_email = (string) ( $data['email'] ?? '' );
		$email     = sanitize_email( $raw_email );
		if ( '' !== $raw_email && '' === $email ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Supplier email is invalid.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		$requested_status = $data['status'] ?? 'active';
		$status           = in_array( $requested_status, self::$statuses, true ) ? $requested_status : 'active';
		$notes  = sanitize_textarea_field( $data['notes'] ?? '' );
		if ( mb_strlen( $notes ) > ZEXST_Constants::MAX_SUPPLIER_NOTES_LENGTH ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Supplier notes are too long.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		$custom_fields = self::validate_custom_fields( $data['custom_fields'] ?? array() );
		if ( is_wp_error( $custom_fields ) ) {
			return $custom_fields;
		}

		$discount_percent = self::validate_percent( $data['discount_percent'] ?? null, ZEXST_Constants::MAX_DISCOUNT_PERCENT );
		if ( is_wp_error( $discount_percent ) ) {
			return $discount_percent;
		}

		$tax_rate_percent = self::validate_percent( $data['tax_rate_percent'] ?? null, ZEXST_Constants::MAX_TAX_RATE_PERCENT );
		if ( is_wp_error( $tax_rate_percent ) ) {
			return $tax_rate_percent;
		}

		$assigned_user_id = self::validate_assigned_user( $data['assigned_user_id'] ?? null );
		if ( is_wp_error( $assigned_user_id ) ) {
			return $assigned_user_id;
		}

		$days_to_cancel = self::validate_days_to_cancel( $data['days_to_cancel'] ?? null );
		if ( is_wp_error( $days_to_cancel ) ) {
			return $days_to_cancel;
		}

		$now = current_time( 'mysql', true );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table (wp_zexst_suppliers), no core API for it; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$inserted = $wpdb->insert(
			$wpdb->prefix . 'zexst_suppliers',
			array(
				'supplier_code'       => sanitize_text_field( $data['supplier_code'] ?? '' ) ?: null,
				'name'                => $name,
				'contact_name'        => sanitize_text_field( $data['contact_name'] ?? '' ) ?: null,
				'email'               => $email ?: null,
				'phone'               => sanitize_text_field( $data['phone'] ?? '' ) ?: null,
				'website'             => esc_url_raw( $data['website'] ?? '' ) ?: null,
				'address_line_1'      => sanitize_text_field( $data['address_line_1'] ?? '' ) ?: null,
				'address_line_2'      => sanitize_text_field( $data['address_line_2'] ?? '' ) ?: null,
				'city'                => sanitize_text_field( $data['city'] ?? '' ) ?: null,
				'state'               => sanitize_text_field( $data['state'] ?? '' ) ?: null,
				'postal_code'         => sanitize_text_field( $data['postal_code'] ?? '' ) ?: null,
				'country'             => sanitize_text_field( $data['country'] ?? '' ) ?: null,
				'currency'            => strtoupper( sanitize_text_field( $data['currency'] ?? 'USD' ) ) ?: 'USD',
				'payment_terms'       => sanitize_text_field( $data['payment_terms'] ?? '' ) ?: null,
				'status'              => $status,
				'notes'               => $notes ?: null,
				'tax_number'          => sanitize_text_field( $data['tax_number'] ?? '' ) ?: null,
				'fax'                 => sanitize_text_field( $data['fax'] ?? '' ) ?: null,
				'ordering_url'        => esc_url_raw( $data['ordering_url'] ?? '' ) ?: null,
				'ordering_email'      => sanitize_email( $data['ordering_email'] ?? '' ) ?: null,
				'description'         => sanitize_textarea_field( $data['description'] ?? '' ) ?: null,
				'assigned_user_id'    => $assigned_user_id,
				'discount_percent'    => $discount_percent,
				'tax_rate_percent'    => $tax_rate_percent,
				'days_to_cancel'      => $days_to_cancel,
				'cancelation_policy'  => sanitize_textarea_field( $data['cancelation_policy'] ?? '' ) ?: null,
				'custom_fields'       => wp_json_encode( $custom_fields ),
				'created_at'          => $now,
				'updated_at'          => $now,
			),
			array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%f', '%f', '%d', '%s', '%s', '%s', '%s' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		if ( false === $inserted ) {
			return new \WP_Error( 'zexst_db_error', __( 'Could not create supplier.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 500 ) );
		}

		return self::get_supplier( (int) $wpdb->insert_id );
	}

	public static function get_supplier( int $id ): array|\WP_Error {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}zexst_suppliers WHERE id = %d", $id ),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		if ( ! $row ) {
			return new \WP_Error( 'zexst_not_found', __( 'Supplier not found.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 404 ) );
		}

		return self::format_row( $row );
	}

	public static function list_suppliers( array $args = array() ): array {
		global $wpdb;

		$per_page = max( 1, min( 200, absint( $args['per_page'] ?? 20 ) ) );
		$page     = max( 1, absint( $args['page'] ?? 1 ) );
		$offset   = ( $page - 1 ) * $per_page;

		$where  = array( '1=1' );
		$params = array();

		$search = trim( (string) ( $args['search'] ?? '' ) );
		if ( '' !== $search ) {
			$where[]  = '(name LIKE %s OR contact_name LIKE %s OR email LIKE %s)';
			$like     = '%' . $wpdb->esc_like( $search ) . '%';
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
		}

		$status = (string) ( $args['status'] ?? '' );
		if ( in_array( $status, self::$statuses, true ) ) {
			$where[]  = 'status = %s';
			$params[] = $status;
		}

		$where_sql = implode( ' AND ', $where );
		$table     = $wpdb->prefix . 'zexst_suppliers';

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- plugin's own table; $where_sql built from a fixed set of literal fragments above, all values bound via $wpdb->prepare(); table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$total = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE {$where_sql}", ...$params ) );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber

		$list_params   = $params;
		$list_params[] = $per_page;
		$list_params[] = $offset;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE {$where_sql} ORDER BY name ASC LIMIT %d OFFSET %d", ...$list_params ),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber

		return array(
			'items' => array_map( array( self::class, 'format_row' ), $rows ?: array() ),
			'total' => $total,
		);
	}

	public static function update_supplier( int $id, array $data ): array|\WP_Error {
		global $wpdb;

		$name = sanitize_text_field( $data['name'] ?? '' );
		if ( '' === $name ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Supplier name is required.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		if ( mb_strlen( $name ) > ZEXST_Constants::MAX_SUPPLIER_NAME_LENGTH ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Supplier name is too long.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		$raw_email = (string) ( $data['email'] ?? '' );
		$email     = sanitize_email( $raw_email );
		if ( '' !== $raw_email && '' === $email ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Supplier email is invalid.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		$requested_status = $data['status'] ?? 'active';
		$status            = in_array( $requested_status, self::$statuses, true ) ? $requested_status : 'active';

		$custom_fields = self::validate_custom_fields( $data['custom_fields'] ?? array() );
		if ( is_wp_error( $custom_fields ) ) {
			return $custom_fields;
		}

		$discount_percent = self::validate_percent( $data['discount_percent'] ?? null, ZEXST_Constants::MAX_DISCOUNT_PERCENT );
		if ( is_wp_error( $discount_percent ) ) {
			return $discount_percent;
		}

		$tax_rate_percent = self::validate_percent( $data['tax_rate_percent'] ?? null, ZEXST_Constants::MAX_TAX_RATE_PERCENT );
		if ( is_wp_error( $tax_rate_percent ) ) {
			return $tax_rate_percent;
		}

		$assigned_user_id = self::validate_assigned_user( $data['assigned_user_id'] ?? null );
		if ( is_wp_error( $assigned_user_id ) ) {
			return $assigned_user_id;
		}

		$days_to_cancel = self::validate_days_to_cancel( $data['days_to_cancel'] ?? null );
		if ( is_wp_error( $days_to_cancel ) ) {
			return $days_to_cancel;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$updated = $wpdb->update(
			$wpdb->prefix . 'zexst_suppliers',
			array(
				'supplier_code'       => sanitize_text_field( $data['supplier_code'] ?? '' ) ?: null,
				'name'                => $name,
				'contact_name'        => sanitize_text_field( $data['contact_name'] ?? '' ) ?: null,
				'email'               => $email ?: null,
				'phone'               => sanitize_text_field( $data['phone'] ?? '' ) ?: null,
				'website'             => esc_url_raw( $data['website'] ?? '' ) ?: null,
				'address_line_1'      => sanitize_text_field( $data['address_line_1'] ?? '' ) ?: null,
				'address_line_2'      => sanitize_text_field( $data['address_line_2'] ?? '' ) ?: null,
				'city'                => sanitize_text_field( $data['city'] ?? '' ) ?: null,
				'state'               => sanitize_text_field( $data['state'] ?? '' ) ?: null,
				'postal_code'         => sanitize_text_field( $data['postal_code'] ?? '' ) ?: null,
				'country'             => sanitize_text_field( $data['country'] ?? '' ) ?: null,
				'currency'            => strtoupper( sanitize_text_field( $data['currency'] ?? 'USD' ) ) ?: 'USD',
				'payment_terms'       => sanitize_text_field( $data['payment_terms'] ?? '' ) ?: null,
				'status'              => $status,
				'notes'               => sanitize_textarea_field( $data['notes'] ?? '' ) ?: null,
				'tax_number'          => sanitize_text_field( $data['tax_number'] ?? '' ) ?: null,
				'fax'                 => sanitize_text_field( $data['fax'] ?? '' ) ?: null,
				'ordering_url'        => esc_url_raw( $data['ordering_url'] ?? '' ) ?: null,
				'ordering_email'      => sanitize_email( $data['ordering_email'] ?? '' ) ?: null,
				'description'         => sanitize_textarea_field( $data['description'] ?? '' ) ?: null,
				'assigned_user_id'    => $assigned_user_id,
				'discount_percent'    => $discount_percent,
				'tax_rate_percent'    => $tax_rate_percent,
				'days_to_cancel'      => $days_to_cancel,
				'cancelation_policy'  => sanitize_textarea_field( $data['cancelation_policy'] ?? '' ) ?: null,
				'custom_fields'       => wp_json_encode( $custom_fields ),
				'updated_at'          => current_time( 'mysql', true ),
			),
			array( 'id' => $id ),
			array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%f', '%f', '%d', '%s', '%s', '%s' ),
			array( '%d' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		if ( false === $updated ) {
			return new \WP_Error( 'zexst_db_error', __( 'Could not update supplier.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 500 ) );
		}

		return self::get_supplier( $id );
	}

	public static function delete_supplier( int $id ): bool|\WP_Error {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$linked = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}zexst_supplier_products WHERE supplier_id = %d", $id )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		if ( $linked > 0 ) {
			return new \WP_Error(
				'zexst_supplier_in_use',
				__( 'Remove this supplier from all linked products before deleting it.', 'zexestock-inventory-management-for-woocommerce' ),
				array( 'status' => 409 )
			);
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$referenced = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}zexst_purchase_orders WHERE supplier_id = %d", $id )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		if ( $referenced > 0 ) {
			return new \WP_Error(
				'zexst_supplier_in_use',
				__( 'This supplier has purchase orders on record and cannot be deleted.', 'zexestock-inventory-management-for-woocommerce' ),
				array( 'status' => 409 )
			);
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- plugin's own table; table names are $wpdb->prefix plus a literal suffix and all values are bound via $wpdb->prepare() or $wpdb format arrays.
		$wpdb->delete( $wpdb->prefix . 'zexst_suppliers', array( 'id' => $id ), array( '%d' ) );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		return true;
	}

	private static function format_row( array $row ): array {
		$row['id']               = (int) $row['id'];
		$row['assigned_user_id'] = isset( $row['assigned_user_id'] ) && null !== $row['assigned_user_id'] ? (int) $row['assigned_user_id'] : null;
		$row['discount_percent'] = isset( $row['discount_percent'] ) && null !== $row['discount_percent'] ? (float) $row['discount_percent'] : null;
		$row['tax_rate_percent'] = isset( $row['tax_rate_percent'] ) && null !== $row['tax_rate_percent'] ? (float) $row['tax_rate_percent'] : null;
		$row['days_to_cancel']   = isset( $row['days_to_cancel'] ) && null !== $row['days_to_cancel'] ? (int) $row['days_to_cancel'] : null;
		$decoded                 = json_decode( (string) ( $row['custom_fields'] ?? '' ), true );
		$row['custom_fields']    = is_array( $decoded ) ? $decoded : array();
		return $row;
	}

	private static function validate_custom_fields( $raw ): array|\WP_Error {
		$shape_error = new \WP_Error( 'zexst_invalid_supplier', __( 'Custom fields must be a list of label/value pairs.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );

		if ( ! is_array( $raw ) || array_keys( $raw ) !== array_keys( array_values( $raw ) ) ) {
			return $shape_error;
		}
		if ( count( $raw ) > ZEXST_Constants::MAX_SUPPLIER_CUSTOM_FIELDS ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Too many custom fields.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}

		$fields = array();
		foreach ( $raw as $field ) {
			if ( ! is_array( $field ) ) {
				return $shape_error;
			}
			$raw_label = $field['label'] ?? '';
			$raw_value = $field['value'] ?? '';
			if ( ! is_string( $raw_label ) || ! is_string( $raw_value ) ) {
				return $shape_error;
			}
			$label = sanitize_text_field( $raw_label );
			$value = sanitize_text_field( $raw_value );
			if ( '' === $label && '' === $value ) {
				continue;
			}
			if ( '' === $label ) {
				return new \WP_Error( 'zexst_invalid_supplier', __( 'Every custom field with a value needs a label.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
			}
			if ( mb_strlen( $label ) > ZEXST_Constants::MAX_SUPPLIER_CUSTOM_FIELD_LENGTH || mb_strlen( $value ) > ZEXST_Constants::MAX_SUPPLIER_CUSTOM_FIELD_LENGTH ) {
				return new \WP_Error( 'zexst_invalid_supplier', __( 'A custom field label or value is too long.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
			}
			$fields[] = array( 'label' => $label, 'value' => $value );
		}

		return $fields;
	}

	private static function validate_percent( $raw, float $max ): float|null|\WP_Error {
		if ( null === $raw || '' === $raw ) {
			return null;
		}
		if ( ! is_numeric( $raw ) ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Percentage must be a number.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		$value = (float) $raw;
		if ( $value < 0 || $value > $max ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Percentage is out of range.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		return $value;
	}

	/**
	 * null or '' unassigns. Anything else must be a positive integer id of an
	 * existing user; absint() is deliberately not used because it would turn
	 * -7 into 7 and silently point the supplier at a different real user.
	 */
	private static function validate_assigned_user( $raw ): int|null|\WP_Error {
		if ( null === $raw || '' === $raw ) {
			return null;
		}
		$user_id = is_bool( $raw ) ? false : filter_var( $raw, FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 1 ) ) );
		if ( false === $user_id ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Assigned user is invalid.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		if ( ! get_user_by( 'id', $user_id ) ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Assigned user does not exist.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		return $user_id;
	}

	private static function validate_days_to_cancel( $raw ): int|null|\WP_Error {
		if ( null === $raw || '' === $raw ) {
			return null;
		}
		$days = is_bool( $raw ) ? false : filter_var( $raw, FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 0 ) ) );
		if ( false === $days ) {
			return new \WP_Error( 'zexst_invalid_supplier', __( 'Days to cancel must be a whole number of 0 or more.', 'zexestock-inventory-management-for-woocommerce' ), array( 'status' => 400 ) );
		}
		return $days;
	}
}
