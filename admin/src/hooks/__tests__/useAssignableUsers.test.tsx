import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { useAssignableUsers } from '../useSuppliers';
import * as api from '@/lib/api';

jest.mock( '@/lib/api', () => ( {
	...jest.requireActual( '@/lib/api' ),
	getAssignableUsers: jest.fn(),
} ) );

function wrapper( { children }: { children: React.ReactNode } ) {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	return (
		<QueryClientProvider client={ queryClient }>
			{ children }
		</QueryClientProvider>
	);
}

describe( 'useAssignableUsers', () => {
	it( 'fetches the assignable users list', async () => {
		( api.getAssignableUsers as jest.Mock ).mockResolvedValue( [
			{ id: 1, name: 'Jane Doe' },
		] );

		const { result } = renderHook( () => useAssignableUsers(), {
			wrapper,
		} );

		await waitFor( () =>
			expect( result.current.data ).toEqual( [
				{ id: 1, name: 'Jane Doe' },
			] )
		);
		expect( api.getAssignableUsers ).toHaveBeenCalled();
	} );
} );
