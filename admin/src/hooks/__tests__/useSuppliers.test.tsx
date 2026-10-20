import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSuppliers, useCreateSupplier } from '../useSuppliers';
import * as api from '@/lib/api';

jest.mock( '@/lib/api' );

function wrapper( { children }: { children: ReactNode } ) {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	return (
		<QueryClientProvider client={ queryClient }>
			{ children }
		</QueryClientProvider>
	);
}

describe( 'useSuppliers', () => {
	it( 'fetches suppliers with the given params', async () => {
		const response = { items: [], total: 0 };
		( api.getSuppliers as jest.Mock ).mockResolvedValue( response );

		const { result } = renderHook(
			() => useSuppliers( { search: 'acme' } ),
			{
				wrapper,
			}
		);

		await waitFor( () => expect( result.current.isSuccess ).toBe( true ) );
		expect( api.getSuppliers ).toHaveBeenCalledWith( { search: 'acme' } );
		expect( result.current.data ).toEqual( response );
	} );
} );

describe( 'useCreateSupplier', () => {
	it( 'calls createSupplier and invalidates the suppliers query on success', async () => {
		( api.createSupplier as jest.Mock ).mockResolvedValue( {
			id: 1,
			name: 'Acme Co',
		} );

		const { result } = renderHook( () => useCreateSupplier(), { wrapper } );

		result.current.mutate( { name: 'Acme Co' } );

		await waitFor( () => expect( result.current.isSuccess ).toBe( true ) );
		expect( api.createSupplier ).toHaveBeenCalledWith( {
			name: 'Acme Co',
		} );
	} );
} );
