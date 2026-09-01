import { cn, decodeHtml, formatCurrency } from '@/lib/utils';

describe( 'cn', () => {
	it( 'joins multiple class names', () => {
		expect( cn( 'a', 'b' ) ).toBe( 'a b' );
	} );

	it( 'excludes falsy conditionals', () => {
		expect( cn( 'a', false && 'b', null, undefined, 'c' ) ).toBe( 'a c' );
	} );

	it( 'resolves conflicting Tailwind utilities (last wins)', () => {
		expect( cn( 'p-2', 'p-4' ) ).toBe( 'p-4' );
	} );

	it( 'preserves non-conflicting utilities', () => {
		expect( cn( 'px-2', 'py-4' ) ).toBe( 'px-2 py-4' );
	} );
} );

describe( 'decodeHtml', () => {
	it( 'decodes numeric entities', () => {
		expect( decodeHtml( '&#36;' ) ).toBe( '$' );
	} );

	it( 'decodes named entities', () => {
		expect( decodeHtml( '&amp;' ) ).toBe( '&' );
		expect( decodeHtml( '&euro;' ) ).toBe( '€' );
	} );

	it( 'leaves plain strings unchanged', () => {
		expect( decodeHtml( 'plain' ) ).toBe( 'plain' );
	} );
} );

describe( 'formatCurrency', () => {
	it( 'decodes HTML-encoded symbol and uses de-DE number formatting', () => {
		expect( formatCurrency( 90826, '&#36;' ) ).toBe( '90.826,00 $' );
	} );

	it( 'formats zero with two decimals', () => {
		expect( formatCurrency( 0, '$' ) ).toBe( '0,00 $' );
	} );

	it( 'rounds to two decimal places', () => {
		expect( formatCurrency( 1.005, '$' ) ).toMatch( /^1,0[01] \$$/ );
	} );

	it( 'works with the euro symbol', () => {
		expect( formatCurrency( 1234.5, '&euro;' ) ).toBe( '1.234,50 €' );
	} );
} );
