import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVariations } from '../useVariations';

const mockApiGet = jest.fn();
jest.mock( '@/lib/api', () => ( {
	apiGet: ( ...args: unknown[] ) => mockApiGet( ...args ),
} ) );

function setup() {
	const qc = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	const wrapper = ( { children }: { children: React.ReactNode } ) => (
		<QueryClientProvider client={ qc }>{ children }</QueryClientProvider>
	);
	return { qc, wrapper };
}

describe( 'useVariations', () => {
	beforeEach( () => mockApiGet.mockReset() );

	it( 'does not refetch an invalidated cached entry on mount', async () => {
		const { qc, wrapper } = setup();
		qc.setQueryData( [ 'variations', 7 ], [ { id: 70 } ] );
		await qc.invalidateQueries( {
			queryKey: [ 'variations' ],
			refetchType: 'none',
		} );

		const { result } = renderHook( () => useVariations( 7, true ), {
			wrapper,
		} );

		expect( result.current.data ).toEqual( [ { id: 70 } ] );
		expect( mockApiGet ).not.toHaveBeenCalled();
	} );

	it( 'fetches when nothing is cached', async () => {
		mockApiGet.mockResolvedValue( [ { id: 80 } ] );
		const { wrapper } = setup();

		const { result } = renderHook( () => useVariations( 8, true ), {
			wrapper,
		} );

		await waitFor( () =>
			expect( result.current.data ).toEqual( [ { id: 80 } ] )
		);
		expect( mockApiGet ).toHaveBeenCalledWith( 'products/8/variations' );
	} );
} );
