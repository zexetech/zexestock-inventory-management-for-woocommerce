import { QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import {
	fetchAllProducts,
	resolveSelectedProducts,
	productsToRows,
} from '../export-products';
import type { Product, ProductsResponse } from '@/types/api';

jest.mock( '@/lib/api', () => ( {
	apiGet: jest.fn(),
} ) );

const mockedApiGet = apiGet as jest.MockedFunction< typeof apiGet >;

function makeProduct( overrides: Partial< Product > = {} ): Product {
	return {
		id: 1,
		parent_id: 0,
		type: 'simple',
		name: 'Product',
		sku: 'SKU',
		image_url: '',
		stock_qty: 10,
		stock_status: 'in_stock',
		category: '',
		days_to_stockout: null,
		manage_stock: true,
		regular_price: null,
		sale_price: null,
		date_on_sale_from: null,
		date_on_sale_to: null,
		reserved_qty: 0,
		sold_today: 0,
		sold_last_14_days: 0,
		low_stock_threshold_override: null,
		purchase_price: null,
		supplier_sku: '',
		barcode: '',
		...overrides,
	};
}

function page( data: Product[], total: number ): ProductsResponse {
	return { data, meta: { total, total_pages: 1, page: 1, per_page: 250 } };
}

describe( 'productsToRows', () => {
	it( 'leaves top-level product names unprefixed', () => {
		const product = makeProduct( { parent_id: 0, name: 'T-Shirt' } );
		const rows = productsToRows( [ product ], [ 'name' ] );
		expect( rows ).toEqual( [ [ 'T-Shirt' ] ] );
	} );

	it( 'prefixes a variation/child name to mark it as belonging to the row above', () => {
		const variation = makeProduct( {
			parent_id: 1,
			type: 'variation',
			name: 'Red / Large',
		} );
		const rows = productsToRows( [ variation ], [ 'name' ] );
		expect( rows ).toEqual( [ [ '— Red / Large' ] ] );
	} );

	it( 'trims the name then applies the child prefix, so the marker is never cut off', () => {
		const variation = makeProduct( {
			parent_id: 1,
			type: 'variation',
			name: 'Red / Extra Large',
		} );
		const rows = productsToRows( [ variation ], [ 'name' ], 5 );
		expect( rows ).toEqual( [ [ '— Red /…' ] ] );
	} );
} );

describe( 'fetchAllProducts', () => {
	afterEach( () => {
		mockedApiGet.mockReset();
	} );

	it( 'forwards category, product_type, searchField, and include_velocity to the API request, matching useProducts', async () => {
		mockedApiGet.mockResolvedValueOnce( page( [], 0 ) );

		await fetchAllProducts( {
			category: 5,
			product_type: 'variable',
			searchField: 'sku',
			include_velocity: true,
		} );

		expect( mockedApiGet ).toHaveBeenCalledWith(
			'products',
			expect.objectContaining( {
				category: 5,
				product_type: 'variable',
				search_field: 'sku',
				include_velocity: true,
			} )
		);
	} );

	it( 'keeps a variable parent immediately followed by its own variations', async () => {
		const parent = makeProduct( {
			id: 1,
			type: 'variable',
			name: 'Hoodie',
		} );
		const v1 = makeProduct( {
			id: 11,
			parent_id: 1,
			type: 'variation',
			name: 'Red',
		} );
		const v2 = makeProduct( {
			id: 12,
			parent_id: 1,
			type: 'variation',
			name: 'Blue',
		} );
		const variableParent = { ...parent, variations: [ v1, v2 ] };

		mockedApiGet.mockResolvedValueOnce( page( [ variableParent ], 1 ) );

		const result = await fetchAllProducts( {} );

		expect( result.map( ( p ) => p.id ) ).toEqual( [ 1, 11, 12 ] );
	} );

	it( "does not duplicate a grouped product's children — they are independent products already returned as their own row", async () => {
		const parent = makeProduct( {
			id: 2,
			type: 'grouped',
			name: 'Gift Set',
		} );
		const c1 = makeProduct( {
			id: 21,
			parent_id: 2,
			type: 'simple',
			name: 'Mug',
		} );
		const groupedParent = { ...parent, children: [ c1 ] };

		mockedApiGet.mockResolvedValueOnce( page( [ groupedParent ], 1 ) );

		const result = await fetchAllProducts( {} );

		expect( result.map( ( p ) => p.id ) ).toEqual( [ 2 ] );
	} );

	it( 'keeps each variable parent grouped with its own variations across multiple top-level products, leaving grouped parents un-nested', async () => {
		const parentA = {
			...makeProduct( { id: 1, type: 'variable', name: 'A' } ),
			variations: [
				makeProduct( {
					id: 11,
					parent_id: 1,
					type: 'variation',
					name: 'A1',
				} ),
			],
		};
		const simpleB = makeProduct( { id: 2, type: 'simple', name: 'B' } );
		const parentC = {
			...makeProduct( { id: 3, type: 'grouped', name: 'C' } ),
			children: [
				makeProduct( {
					id: 31,
					parent_id: 3,
					type: 'simple',
					name: 'C1',
				} ),
			],
		};

		mockedApiGet.mockResolvedValueOnce(
			page( [ parentA, simpleB, parentC ], 3 )
		);

		const result = await fetchAllProducts( {} );

		expect( result.map( ( p ) => p.id ) ).toEqual( [ 1, 11, 2, 3 ] );
	} );

	it( 'preserves grouping across paginated pages', async () => {
		const parentA = {
			...makeProduct( { id: 1, type: 'variable', name: 'A' } ),
			variations: [
				makeProduct( {
					id: 11,
					parent_id: 1,
					type: 'variation',
					name: 'A1',
				} ),
			],
		};
		const filler = Array.from( { length: 249 }, ( _, i ) =>
			makeProduct( {
				id: 1000 + i,
				type: 'simple',
				name: `Filler ${ i }`,
			} )
		);
		const parentB = {
			...makeProduct( { id: 2, type: 'variable', name: 'B' } ),
			variations: [
				makeProduct( {
					id: 21,
					parent_id: 2,
					type: 'variation',
					name: 'B1',
				} ),
			],
		};

		mockedApiGet
			.mockResolvedValueOnce( page( [ parentA, ...filler ], 251 ) )
			.mockResolvedValueOnce( page( [ parentB ], 251 ) );

		const result = await fetchAllProducts( {} );

		expect( mockedApiGet ).toHaveBeenCalledTimes( 2 );
		expect( result.slice( 0, 2 ).map( ( p ) => p.id ) ).toEqual( [
			1, 11,
		] );
		expect( result.slice( -2 ).map( ( p ) => p.id ) ).toEqual( [ 2, 21 ] );
	} );
} );

describe( 'resolveSelectedProducts', () => {
	function makeQueryClient() {
		return new QueryClient( {
			defaultOptions: { queries: { retry: false } },
		} );
	}

	it( 'includes a selected simple product directly, with no parent header', () => {
		const simple = makeProduct( { id: 1, type: 'simple', name: 'Widget' } );
		const result = resolveSelectedProducts(
			[ 1 ],
			[ simple ],
			makeQueryClient()
		);
		expect( result.map( ( p ) => p.id ) ).toEqual( [ 1 ] );
	} );

	it( 'shows the parent row immediately above its selected (cascaded) variations', () => {
		const parent = makeProduct( {
			id: 1,
			type: 'variable',
			name: 'Hoodie',
		} );
		const v1 = makeProduct( {
			id: 11,
			parent_id: 1,
			type: 'variation',
			name: 'Red',
		} );
		const v2 = makeProduct( {
			id: 12,
			parent_id: 1,
			type: 'variation',
			name: 'Blue',
		} );

		const qc = makeQueryClient();
		qc.setQueryData( [ 'variations', 1 ], [ v1, v2 ] );

		const result = resolveSelectedProducts( [ 1, 11, 12 ], [ parent ], qc );

		expect( result.map( ( p ) => p.id ) ).toEqual( [ 1, 11, 12 ] );
	} );

	it( 'shows the parent row above only the children that were individually selected, even when the parent checkbox itself was never checked', () => {
		const parent = makeProduct( {
			id: 1,
			type: 'variable',
			name: 'Hoodie',
		} );
		const v1 = makeProduct( {
			id: 11,
			parent_id: 1,
			type: 'variation',
			name: 'Red',
		} );
		const v2 = makeProduct( {
			id: 12,
			parent_id: 1,
			type: 'variation',
			name: 'Blue',
		} );

		const qc = makeQueryClient();
		qc.setQueryData( [ 'variations', 1 ], [ v1, v2 ] );

		const result = resolveSelectedProducts( [ 11 ], [ parent ], qc );

		expect( result.map( ( p ) => p.id ) ).toEqual( [ 1, 11 ] );
	} );

	it( 'excludes the parent entirely when none of its children are selected or cached', () => {
		const parent = makeProduct( {
			id: 1,
			type: 'variable',
			name: 'Hoodie',
		} );
		const result = resolveSelectedProducts(
			[ 1 ],
			[ parent ],
			makeQueryClient()
		);
		expect( result ).toEqual( [] );
	} );

	it( 'falls back to including an orphaned child whose parent is not on the current page', () => {
		const v1 = makeProduct( {
			id: 11,
			parent_id: 1,
			type: 'variation',
			name: 'Red',
		} );
		const qc = makeQueryClient();
		qc.setQueryData( [ 'variations', 1 ], [ v1 ] );

		const result = resolveSelectedProducts( [ 11 ], [], qc );

		expect( result.map( ( p ) => p.id ) ).toEqual( [ 11 ] );
	} );

	it( 'includes a selected grouped-product child directly, with no parent header — it is an independent product, not a variation', () => {
		const groupedChild = makeProduct( {
			id: 22,
			parent_id: 2,
			type: 'simple',
			name: 'Coaster',
		} );
		const result = resolveSelectedProducts(
			[ 22 ],
			[ groupedChild ],
			makeQueryClient()
		);
		expect( result.map( ( p ) => p.id ) ).toEqual( [ 22 ] );
	} );

	it( 'excludes an unselected grouped parent even when its children are cached under grouped-children', () => {
		const parent = makeProduct( {
			id: 2,
			type: 'grouped',
			name: 'Gift Set',
		} );
		const c1 = makeProduct( {
			id: 21,
			parent_id: 2,
			type: 'simple',
			name: 'Mug',
		} );
		const c2 = makeProduct( {
			id: 22,
			parent_id: 2,
			type: 'simple',
			name: 'Coaster',
		} );

		const qc = makeQueryClient();
		qc.setQueryData( [ 'grouped-children', 2 ], [ c1, c2 ] );

		const result = resolveSelectedProducts( [ 22 ], [ parent ], qc );

		expect( result ).toEqual( [] );
	} );
} );
