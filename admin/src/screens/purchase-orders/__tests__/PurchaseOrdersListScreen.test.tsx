import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PurchaseOrdersListScreen } from '../PurchaseOrdersListScreen';
import * as api from '@/lib/api';
import { apiGet } from '@/lib/api';

jest.mock( '@/lib/api', () => ( {
	...jest.requireActual( '@/lib/api' ),
	apiGet: jest.fn(),
	getPurchaseOrders: jest.fn(),
	getSuppliers: jest.fn(),
	createPurchaseOrder: jest.fn(),
	deletePurchaseOrder: jest.fn(),
} ) );

function renderScreen( onSelectPO = jest.fn() ) {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	render(
		<QueryClientProvider client={ queryClient }>
			<PurchaseOrdersListScreen onSelectPO={ onSelectPO } />
		</QueryClientProvider>
	);
	return { onSelectPO };
}

describe( 'PurchaseOrdersListScreen', () => {
	beforeEach( () => {
		( api.getPurchaseOrders as jest.Mock ).mockResolvedValue( {
			items: [
				{
					id: 55,
					po_number: 'PO-000056',
					supplier_id: 2,
					supplier_name: 'Acme Co',
					status: 'draft',
					currency: 'USD',
					total_cost: 40,
					created_at: '2026-09-24 10:00:00',
				},
			],
			total: 1,
		} );
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [ { id: 2, name: 'Acme Co', status: 'active' } ],
			total: 1,
		} );
	} );

	it( 'renders the PO list and calls onSelectPO on row click', async () => {
		const { onSelectPO } = renderScreen();
		const user = userEvent.setup();

		expect( await screen.findByText( 'PO-000056' ) ).toBeInTheDocument();

		await user.click( screen.getByText( 'PO-000056' ) );
		expect( onSelectPO ).toHaveBeenCalledWith( 55 );
	} );

	it( 'deletes a draft PO from its row after confirming, without opening it', async () => {
		( api.deletePurchaseOrder as jest.Mock ).mockResolvedValue( {
			deleted: true,
		} );
		const { onSelectPO } = renderScreen();
		const user = userEvent.setup();
		await screen.findByText( 'PO-000056' );

		await user.click(
			screen.getByRole( 'button', { name: /delete po-000056/i } )
		);
		expect( onSelectPO ).not.toHaveBeenCalled();
		await user.click( screen.getByRole( 'button', { name: /^delete$/i } ) );

		await waitFor( () =>
			expect( api.deletePurchaseOrder ).toHaveBeenCalledWith( 55 )
		);
	} );

	it( 'opens the create dialog, adds a product, and submits a new PO', async () => {
		( apiGet as jest.Mock ).mockResolvedValue( {
			data: [ { id: 9, name: 'Widget', sku: 'W-9', type: 'simple' } ],
			meta: { total: 1, total_pages: 1, page: 1, per_page: 20 },
		} );
		( api.createPurchaseOrder as jest.Mock ).mockResolvedValue( {
			id: 60,
			po_number: 'PO-000060',
		} );

		renderScreen();
		const user = userEvent.setup();
		await screen.findByText( 'PO-000056' );

		await user.click(
			screen.getByRole( 'button', { name: /new purchase order/i } )
		);
		await user.click(
			screen.getByRole( 'button', { name: /select a supplier/i } )
		);
		await user.click(
			await screen.findByRole( 'button', { name: /acme co/i } )
		);

		await user.click(
			screen.getByRole( 'button', { name: /add a product/i } )
		);
		await user.click( await screen.findByText( /widget/i ) );

		await user.click( screen.getByRole( 'button', { name: /^create$/i } ) );

		await waitFor( () =>
			expect( api.createPurchaseOrder ).toHaveBeenCalledWith(
				expect.objectContaining( {
					supplier_id: 2,
					items: [
						expect.objectContaining( {
							product_id: 9,
							quantity_ordered: 1,
						} ),
					],
				} )
			)
		);
	} );
} );
