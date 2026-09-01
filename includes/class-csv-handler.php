<?php

defined( 'ABSPATH' ) || exit;
class ZEXST_Csv_Handler {
    private static function csv_safe( string $value ) : string {
        if ( '' !== $value && in_array( $value[0], array(
            '=',
            '+',
            '-',
            '@',
            "\t",
            "\r"
        ), true ) ) {
            return "'" . $value;
        }
        return $value;
    }

    private const FIELD_LABELS = array(
        'regular_price'     => 'Regular Price',
        'sale_price'        => 'Sale Price',
        'purchase_price'    => 'Purchase Price',
        'supplier_sku'      => 'Supplier SKU',
        'barcode'           => 'Barcode',
        'sku'               => 'SKU',
        'threshold'         => 'Threshold',
        'date_on_sale_from' => 'Sale Start Date',
        'date_on_sale_to'   => 'Sale End Date',
    );

    private const NUMERIC_FIELDS = array('regular_price', 'sale_price', 'purchase_price');

    private const UNDO_NON_STOCK_FIELDS = array(
        'regular_price',
        'sale_price',
        'purchase_price',
        'sku',
        'threshold',
        'date_on_sale_from',
        'date_on_sale_to'
    );

    private static function format_type_column( string $type ) : string {
        if ( 'bulk' === $type ) {
            return __( 'Bulk', 'zexestock-inventory-management-for-woocommerce' );
        }
        if ( 'undo' === $type ) {
            return __( 'Undo', 'zexestock-inventory-management-for-woocommerce' );
        }
        return __( 'Single', 'zexestock-inventory-management-for-woocommerce' );
    }

    private static function format_change_columns( object $row ) : array {
        $type = $row->adjustment_type ?? '';
        $meta = $row->meta ?? null;
        if ( in_array( $type, array('price_change', 'meta_change'), true ) && $meta ) {
            $parsed = json_decode( $meta, true );
            if ( is_array( $parsed ) ) {
                $field_parts = array();
                $before_parts = array();
                $after_parts = array();
                $adjustment_parts = array();
                foreach ( self::FIELD_LABELS as $field => $label ) {
                    if ( !isset( $parsed[$field]['old'], $parsed[$field]['new'] ) ) {
                        continue;
                    }
                    $field_parts[] = $label;
                    $before_parts[] = (string) $parsed[$field]['old'];
                    $after_parts[] = (string) $parsed[$field]['new'];
                    if ( in_array( $field, self::NUMERIC_FIELDS, true ) && is_numeric( $parsed[$field]['old'] ) && is_numeric( $parsed[$field]['new'] ) ) {
                        $delta = (float) $parsed[$field]['new'] - (float) $parsed[$field]['old'];
                        $adjustment_parts[] = sprintf( '%+.2f', $delta );
                    }
                }
                if ( !empty( $field_parts ) ) {
                    return array(
                        implode( ' & ', $field_parts ),
                        implode( '; ', $before_parts ),
                        implode( '; ', $adjustment_parts ),
                        implode( '; ', $after_parts )
                    );
                }
            }
        }
        if ( 'sku_change' === $type && $meta ) {
            $parsed = json_decode( $meta, true );
            if ( is_array( $parsed ) && isset( $parsed['old'], $parsed['new'] ) ) {
                return array(
                    self::FIELD_LABELS['sku'],
                    (string) $parsed['old'],
                    '',
                    (string) $parsed['new']
                );
            }
        }
        if ( 'undo' === $type && $meta ) {
            $parsed = json_decode( $meta, true );
            if ( is_array( $parsed ) && isset( $parsed['field'] ) && in_array( $parsed['field'], self::UNDO_NON_STOCK_FIELDS, true ) ) {
                return array(
                    self::FIELD_LABELS[$parsed['field']],
                    '',
                    '',
                    (string) ($parsed['old_value'] ?? '')
                );
            }
        }
        $adj = (int) $row->adjustment;
        return array(
            __( 'Stock', 'zexestock-inventory-management-for-woocommerce' ),
            (string) (int) $row->previous_stock,
            (( $adj >= 0 ? '+' : '' )) . $adj,
            (string) (int) $row->new_stock
        );
    }

}
