import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import * as React from 'react';
import { useAdjustStock } from '../useAdjustStock';
import type { ProductsResponse } from '@/types/api';

jest.mock( '@/lib/api', () => ( {
	...jest.requireActual( '@/lib/api' ),
	adjustStock: jest.fn(),
} ) );

jest.mock( 'sonner', () => ( {
	toast: {
		success: jest.fn(),
		error: jest.fn(),
		warning: jest.fn(),
	},
} ) );

import { adjustStock as mockAdjust } from '@/lib/api';
import { toast } from 'sonner';

const mockAdjustFn = mockAdjust as jest.Mock;
const toastSuccess = toast.success as jest.Mock;
const toastError = toast.error as jest.Mock;

function setup() {
	const queryClient = new QueryClient( {
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	} );
	const wrapper = ( { children }: { children: React.ReactNode } ) =>
		React.createElement(
			QueryClientProvider,
			{ client: queryClient },
			children
		);
	return { queryClient, wrapper };
}

const PRODUCT_KEY = [ 'products', {} ];
const mockPage: ProductsResponse = {
	data: [
		{
			id: 1,
			name: 'Widget',
			stock_qty: 50,
			type: 'simple',
			manage_stock: true,
		} as never,
	],
	total: 1,
	totalPages: 1,
};

describe( 'useAdjustStock', () => {
	beforeEach( () => jest.clearAllMocks() );

	it( 'applies optimistic update before the server responds', async () => {
		let resolveCall!: ( v: unknown ) => void;
		mockAdjustFn.mockReturnValue(
			new Promise( ( r ) => {
				resolveCall = r;
			} )
		);

		const { queryClient, wrapper } = setup();
		queryClient.setQueryData( PRODUCT_KEY, mockPage );

		const { result } = renderHook( () => useAdjustStock(), { wrapper } );

		act( () => {
			result.current.mutate( {
				productId: 1,
				productName: 'Widget',
				adjustment: 10,
				currentStock: 50,
			} );
		} );

		await act( async () => {} );
		const optimistic =
			queryClient.getQueryData< ProductsResponse >( PRODUCT_KEY );
		expect( optimistic?.data[ 0 ].stock_qty ).toBe( 60 );

		resolveCall( {
			new_stock: 60,
			previous_stock: 50,
			adjustment: 10,
			stock_status: 'instock',
			sku: '',
		} );
	} );

	it( 'reverts cache on network error', async () => {
		mockAdjustFn.mockRejectedValue( new Error( 'Network error' ) );

		const { queryClient, wrapper } = setup();
		queryClient.setQueryData( PRODUCT_KEY, mockPage );

		const { result } = renderHook( () => useAdjustStock(), { wrapper } );

		await act( async () => {
			await result.current
				.mutateAsync( {
					productId: 1,
					productName: 'Widget',
					adjustment: 10,
					currentStock: 50,
				} )
				.catch( () => {} );
		} );

		const reverted =
			queryClient.getQueryData< ProductsResponse >( PRODUCT_KEY );
		expect( reverted?.data[ 0 ].stock_qty ).toBe( 50 );
	} );

	it( 'shows error toast on failure', async () => {
		mockAdjustFn.mockRejectedValue( new Error( 'Server error' ) );

		const { wrapper } = setup();
		const { result } = renderHook( () => useAdjustStock(), { wrapper } );

		await act( async () => {
			await result.current
				.mutateAsync( {
					productId: 1,
					productName: 'Widget',
					adjustment: 5,
					currentStock: 50,
				} )
				.catch( () => {} );
		} );

		expect( toastError ).toHaveBeenCalled();
	} );

	it( 'shows success toast on success when no onAdjustSuccess callback', async () => {
		mockAdjustFn.mockResolvedValue( {
			new_stock: 60,
			previous_stock: 50,
			adjustment: 10,
			stock_status: 'instock',
			sku: '',
		} );

		const { wrapper } = setup();
		const { result } = renderHook( () => useAdjustStock(), { wrapper } );

		await act( async () => {
			await result.current.mutateAsync( {
				productId: 1,
				productName: 'Widget',
				adjustment: 10,
				currentStock: 50,
			} );
		} );

		expect( toastSuccess ).toHaveBeenCalled();
	} );

	it( 'invalidates products query on settled', async () => {
		mockAdjustFn.mockResolvedValue( {
			new_stock: 60,
			previous_stock: 50,
			adjustment: 10,
			stock_status: 'instock',
			sku: '',
		} );

		const { queryClient, wrapper } = setup();
		queryClient.setQueryData( PRODUCT_KEY, mockPage );
		const spy = jest.spyOn( queryClient, 'invalidateQueries' );

		const { result } = renderHook( () => useAdjustStock(), { wrapper } );

		await act( async () => {
			await result.current.mutateAsync( {
				productId: 1,
				productName: 'Widget',
				adjustment: 10,
				currentStock: 50,
			} );
		} );

		expect( spy ).toHaveBeenCalledWith(
			expect.objectContaining( { queryKey: [ 'products' ] } )
		);
	} );

	it( 'handles null currentStock without throwing', async () => {
		mockAdjustFn.mockResolvedValue( {
			new_stock: 10,
			previous_stock: 0,
			adjustment: 10,
			stock_status: 'instock',
			sku: '',
		} );

		const { queryClient, wrapper } = setup();
		const nullStockPage: ProductsResponse = {
			data: [
				{
					id: 1,
					name: 'Widget',
					stock_qty: null,
					type: 'simple',
					manage_stock: true,
				} as never,
			],
			total: 1,
			totalPages: 1,
		};
		queryClient.setQueryData( PRODUCT_KEY, nullStockPage );

		const { result } = renderHook( () => useAdjustStock(), { wrapper } );

		await expect(
			act( async () => {
				await result.current.mutateAsync( {
					productId: 1,
					productName: 'Widget',
					adjustment: 10,
					currentStock: null,
				} );
			} )
		).resolves.not.toThrow();
	} );
} );
