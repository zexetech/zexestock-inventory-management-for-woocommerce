import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePurchaseOrders, useSendPurchaseOrder } from '../usePurchaseOrders';
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

describe( 'usePurchaseOrders', () => {
	it( 'fetches purchase orders with the given params', async () => {
		const response = { items: [], total: 0 };
		( api.getPurchaseOrders as jest.Mock ).mockResolvedValue( response );

		const { result } = renderHook(
			() => usePurchaseOrders( { status: 'draft' } ),
			{ wrapper }
		);

		await waitFor( () => expect( result.current.isSuccess ).toBe( true ) );
		expect( api.getPurchaseOrders ).toHaveBeenCalledWith( {
			status: 'draft',
		} );
	} );
} );

describe( 'useSendPurchaseOrder', () => {
	it( 'calls sendPurchaseOrder with only the po id', async () => {
		( api.sendPurchaseOrder as jest.Mock ).mockResolvedValue( {
			id: 55,
			status: 'sent',
		} );

		const { result } = renderHook( () => useSendPurchaseOrder(), {
			wrapper,
		} );

		result.current.mutate( { id: 55 } );

		await waitFor( () => expect( result.current.isSuccess ).toBe( true ) );
		expect( api.sendPurchaseOrder ).toHaveBeenCalledWith( 55 );
	} );
} );
