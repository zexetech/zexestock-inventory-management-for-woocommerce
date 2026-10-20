import { computeSuggestedQuantity } from '../reorder';

describe( 'computeSuggestedQuantity', () => {
	it( 'suggests threshold minus current stock when no multiple/minimum apply', () => {
		expect( computeSuggestedQuantity( 10, 4, null, null ) ).toBe( 6 );
	} );

	it( 'never suggests less than 1', () => {
		expect( computeSuggestedQuantity( 10, 15, null, null ) ).toBe( 1 );
	} );

	it( 'rounds up to the order multiple', () => {
		expect( computeSuggestedQuantity( 10, 4, 5, null ) ).toBe( 10 );
	} );

	it( 'raises to the minimum order quantity when higher than the computed amount', () => {
		expect( computeSuggestedQuantity( 10, 8, null, 20 ) ).toBe( 20 );
	} );

	it( 'applies the order multiple before checking the minimum', () => {
		expect( computeSuggestedQuantity( 10, 9, 5, 8 ) ).toBe( 8 );
	} );
} );
