import { buildColumns } from './columns';

describe( 'Free stock-table column order', () => {
	const ids = buildColumns( new Set(), jest.fn() ).map( ( c ) => c.id );

	it( 'orders SKU and Supplier SKU next to each other', () => {
		const start = ids.indexOf( 'sku' );
		expect( ids.slice( start, start + 2 ) ).toEqual( [
			'sku',
			'supplier_sku',
		] );
	} );
} );
