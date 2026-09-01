import {
	sanitizePrice,
	normalizePrice,
	priceError,
} from '@/screens/stock-table/PriceCell';
import { MAX_PRICE } from '@/lib/validation';

describe( 'sanitizePrice', () => {
	it( 'strips non-digit, non-dot characters', () => {
		expect( sanitizePrice( 'abc12.5xyz' ) ).toBe( '12.5' );
		expect( sanitizePrice( '1,234.56' ) ).toBe( '1234.56' );
		expect( sanitizePrice( '$19.99' ) ).toBe( '19.99' );
	} );

	it( 'keeps only the first decimal point', () => {
		expect( sanitizePrice( '1.2.3' ) ).toBe( '1.23' );
		expect( sanitizePrice( '...5' ) ).toBe( '.5' );
	} );

	it( 'caps the fraction at two decimals', () => {
		expect( sanitizePrice( '12.34567' ) ).toBe( '12.34' );
	} );

	it( 'returns empty string when there is no usable input', () => {
		expect( sanitizePrice( '' ) ).toBe( '' );
		expect( sanitizePrice( 'abc' ) ).toBe( '' );
	} );

	it( 'preserves a trailing dot mid-typing (user not done yet)', () => {
		expect( sanitizePrice( '12.' ) ).toBe( '12.' );
	} );
} );

describe( 'normalizePrice', () => {
	it( 'returns empty string for empty input or bare dot', () => {
		expect( normalizePrice( '' ) ).toBe( '' );
		expect( normalizePrice( '.' ) ).toBe( '' );
	} );

	it( 'strips leading zeros before a non-zero digit', () => {
		expect( normalizePrice( '007' ) ).toBe( '7' );
		expect( normalizePrice( '0019.99' ) ).toBe( '19.99' );
	} );

	it( 'preserves "0.xx" patterns', () => {
		expect( normalizePrice( '0.50' ) ).toBe( '0.50' );
		expect( normalizePrice( '0.05' ) ).toBe( '0.05' );
	} );

	it( 'strips a bare trailing dot', () => {
		expect( normalizePrice( '12.' ) ).toBe( '12' );
	} );

	it( 'is idempotent on already-normalized values', () => {
		expect( normalizePrice( '12.50' ) ).toBe( '12.50' );
		expect( normalizePrice( '5' ) ).toBe( '5' );
	} );
} );

describe( 'priceError', () => {
	it( 'returns null for empty input (clear price is always valid)', () => {
		expect( priceError( '' ) ).toBeNull();
	} );

	it( 'returns null for valid positive prices', () => {
		expect( priceError( '0' ) ).toBeNull();
		expect( priceError( '0.01' ) ).toBeNull();
		expect( priceError( '19.99' ) ).toBeNull();
	} );

	it( 'returns an error for non-numeric strings', () => {
		expect( priceError( 'abc' ) ).toMatch( /valid/i );
	} );

	it( 'returns an error for negative prices', () => {
		expect( priceError( '-5' ) ).toMatch( /negative/i );
	} );

	it( 'returns an error when the value exceeds MAX_PRICE', () => {
		expect( priceError( String( MAX_PRICE + 1 ) ) ).toMatch( /exceed/i );
	} );

	it( 'accepts a value exactly equal to MAX_PRICE', () => {
		expect( priceError( String( MAX_PRICE ) ) ).toBeNull();
	} );
} );
