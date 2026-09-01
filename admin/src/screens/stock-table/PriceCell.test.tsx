import { sanitizePrice, normalizePrice, priceError } from './PriceCell';

describe( 'sanitizePrice', () => {
	it( 'strips non-numeric characters', () => {
		expect( sanitizePrice( 'abc1.23xyz' ) ).toBe( '1.23' );
	} );

	it( 'keeps only the first decimal point, preserving trailing digits', () => {
		expect( sanitizePrice( '1.2.3' ) ).toBe( '1.23' );
	} );

	it( 'caps at two decimal places', () => {
		expect( sanitizePrice( '1.234' ) ).toBe( '1.23' );
	} );

	it( 'returns empty string for empty input', () => {
		expect( sanitizePrice( '' ) ).toBe( '' );
	} );

	it( 'leaves a plain integer unchanged', () => {
		expect( sanitizePrice( '42' ) ).toBe( '42' );
	} );

	it( 'preserves a leading dot', () => {
		expect( sanitizePrice( '.5' ) ).toBe( '.5' );
	} );
} );

describe( 'normalizePrice', () => {
	it( 'removes leading zeros before a non-zero digit', () => {
		expect( normalizePrice( '01.50' ) ).toBe( '1.50' );
	} );

	it( 'preserves zero before a decimal point', () => {
		expect( normalizePrice( '0.50' ) ).toBe( '0.50' );
	} );

	it( 'strips a trailing dot', () => {
		expect( normalizePrice( '5.' ) ).toBe( '5' );
	} );

	it( 'converts a bare dot to empty string', () => {
		expect( normalizePrice( '.' ) ).toBe( '' );
	} );

	it( 'returns empty string unchanged', () => {
		expect( normalizePrice( '' ) ).toBe( '' );
	} );
} );

describe( 'priceError', () => {
	it( 'returns null for empty string (clear price)', () => {
		expect( priceError( '' ) ).toBeNull();
	} );

	it( 'returns null for a valid decimal', () => {
		expect( priceError( '9.99' ) ).toBeNull();
	} );

	it( 'returns an error string for a negative price', () => {
		expect( priceError( '-1' ) ).not.toBeNull();
	} );

	it( 'returns an error string for non-numeric input', () => {
		expect( priceError( 'abc' ) ).not.toBeNull();
	} );

	it( 'returns null for zero', () => {
		expect( priceError( '0' ) ).toBeNull();
	} );
} );
