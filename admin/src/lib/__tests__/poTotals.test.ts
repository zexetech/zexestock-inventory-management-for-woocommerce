import { computePOTotals } from '../poTotals';

describe( 'computePOTotals', () => {
	it( 'applies discount before tax, then adds flat fee and shipping', () => {
		const result = computePOTotals( 100, 10, 5, 2, 3 );

		expect( result.subtotal ).toBe( 100 );
		expect( result.discountAmt ).toBe( 10 );
		expect( result.taxAmt ).toBe( 4.5 );
		expect( result.totalCost ).toBe( 99.5 );
	} );

	it( 'handles a 100% discount without a negative taxable amount', () => {
		const result = computePOTotals( 50, 100, 20, 0, 0 );

		expect( result.discountAmt ).toBe( 50 );
		expect( result.taxAmt ).toBe( 0 );
		expect( result.totalCost ).toBe( 0 );
	} );

	it( 'matches the zero-rate case (plain subtotal passthrough)', () => {
		const result = computePOTotals( 30, 0, 0, 0, 0 );

		expect( result.totalCost ).toBe( 30 );
	} );
} );
