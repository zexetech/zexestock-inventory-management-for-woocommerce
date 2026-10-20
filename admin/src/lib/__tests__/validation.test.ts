import {
	MAX_SUPPLIER_NAME_LENGTH,
	MAX_UNIT_COST,
	MAX_DISCOUNT_PERCENT,
	MAX_TAX_RATE_PERCENT,
	MAX_SUPPLIER_FEE,
	MAX_SHIPPING_COST,
	MAX_SUPPLIER_CUSTOM_FIELDS,
	MAX_SUPPLIER_CUSTOM_FIELD_LENGTH,
} from '../validation';

describe( 'validation constants', () => {
	it( 'mirrors the existing PHP-side supplier/PO limits', () => {
		expect( MAX_SUPPLIER_NAME_LENGTH ).toBe( 255 );
		expect( MAX_UNIT_COST ).toBe( 99_999_999.9999 );
	} );

	it( 'mirrors the new supplier/PO enrichment limits from ZEXST_Constants', () => {
		expect( MAX_DISCOUNT_PERCENT ).toBe( 100 );
		expect( MAX_TAX_RATE_PERCENT ).toBe( 100 );
		expect( MAX_SUPPLIER_FEE ).toBe( 99_999_999.9999 );
		expect( MAX_SHIPPING_COST ).toBe( 99_999_999.9999 );
		expect( MAX_SUPPLIER_CUSTOM_FIELDS ).toBe( 20 );
		expect( MAX_SUPPLIER_CUSTOM_FIELD_LENGTH ).toBe( 255 );
	} );
} );
