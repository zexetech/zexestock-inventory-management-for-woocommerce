import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PurchaseOrderDetail } from '../PurchaseOrderDetail';
import * as api from '@/lib/api';
import { generatePOPdf } from '@/lib/export-po-pdf';
import type { PurchaseOrder } from '@/types/purchase-order';

jest.mock( '@/lib/api', () => ( {
	...jest.requireActual( '@/lib/api' ),
	getPurchaseOrder: jest.fn(),
	sendPurchaseOrder: jest.fn(),
	receivePurchaseOrderItems: jest.fn(),
	cancelPurchaseOrder: jest.fn(),
	deletePurchaseOrder: jest.fn(),
	getSuppliers: jest.fn().mockResolvedValue( { items: [], total: 0 } ),
	updatePurchaseOrder: jest.fn(),
} ) );

jest.mock( '@/lib/export-po-pdf', () => ( {
	generatePOPdf: jest.fn().mockResolvedValue( undefined ),
} ) );

function sentPO(): PurchaseOrder {
	return {
		id: 55,
		po_number: 'PO-000056',
		supplier_id: 2,
		supplier_name: 'Acme Co',
		supplier_contact_name: null,
		supplier_email: null,
		supplier_phone: null,
		supplier_address_line_1: null,
		supplier_address_line_2: null,
		supplier_city: null,
		supplier_state: null,
		supplier_postal_code: null,
		supplier_country: null,
		status: 'sent',
		currency: 'USD',
		internal_notes: null,
		supplier_notes: null,
		email_to: null,
		created_by: 1,
		cancelled_by: null,
		cancellation_reason: null,
		po_date: '2026-09-24',
		discount_percent: 0,
		tax_rate_percent: 0,
		supplier_fee: 0,
		shipping_cost: 0,
		total_cost: 40,
		created_at: '2026-09-24 10:00:00',
		updated_at: '2026-09-24 10:00:00',
		sent_at: '2026-09-24 10:05:00',
		last_email_sent_at: null,
		expected_at: null,
		received_at: null,
		cancelled_at: null,
		items: [
			{
				id: 1,
				po_id: 55,
				product_id: 1,
				sku: 'SKU-1',
				product_name: 'Widget 1',
				supplier_sku: null,
				purchase_unit: null,
				quantity_ordered: 4,
				quantity_received: 0,
				unit_cost: 10,
			},
		],
	};
}

function renderDetail( id = 55, onBack = jest.fn() ) {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	render(
		<QueryClientProvider client={ queryClient }>
			<PurchaseOrderDetail id={ id } onBack={ onBack } />
		</QueryClientProvider>
	);
}

describe( 'PurchaseOrderDetail', () => {
	beforeEach( () => {
		( api.getPurchaseOrder as jest.Mock ).mockResolvedValue( sentPO() );
	} );

	it( 'renders PO header, items, and total', async () => {
		renderDetail();

		expect( await screen.findByText( 'PO-000056' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Widget 1' ) ).toBeInTheDocument();
		expect( screen.getByText( 'USD 40.00' ) ).toBeInTheDocument();
	} );

	it( 'receives stock for an item', async () => {
		( api.receivePurchaseOrderItems as jest.Mock ).mockResolvedValue( {
			...sentPO(),
			status: 'received',
		} );

		renderDetail();
		const user = userEvent.setup();
		await screen.findByText( 'PO-000056' );

		await user.click( screen.getByRole( 'button', { name: /receive/i } ) );
		await user.click(
			screen.getByRole( 'button', { name: /confirm receive/i } )
		);

		await waitFor( () =>
			expect( api.receivePurchaseOrderItems ).toHaveBeenCalledWith( 55, [
				{ item_id: 1, quantity_received: 4 },
			] )
		);
	} );

	it( 'hides Delete once a PO is no longer a draft', async () => {
		renderDetail();
		await screen.findByText( 'PO-000056' );

		expect(
			screen.queryByRole( 'button', { name: /delete/i } )
		).not.toBeInTheDocument();
	} );

	it( 'deletes a draft PO after confirming and goes back to the list', async () => {
		( api.getPurchaseOrder as jest.Mock ).mockResolvedValue( {
			...sentPO(),
			status: 'draft',
		} );
		( api.deletePurchaseOrder as jest.Mock ).mockResolvedValue( {
			deleted: true,
		} );
		const onBack = jest.fn();
		renderDetail( 55, onBack );
		const user = userEvent.setup();
		await screen.findByText( 'PO-000056' );

		await user.click( screen.getByRole( 'button', { name: /delete/i } ) );
		expect( api.deletePurchaseOrder ).not.toHaveBeenCalled();
		await user.click( screen.getByRole( 'button', { name: /^delete$/i } ) );

		await waitFor( () =>
			expect( api.deletePurchaseOrder ).toHaveBeenCalledWith( 55 )
		);
		await waitFor( () => expect( onBack ).toHaveBeenCalled() );
	} );

	it( 'downloads the PDF when Download PDF is clicked', async () => {
		renderDetail();
		const user = userEvent.setup();
		await screen.findByText( 'PO-000056' );

		await user.click(
			screen.getByRole( 'button', { name: /download pdf/i } )
		);

		expect( generatePOPdf ).toHaveBeenCalledWith(
			expect.objectContaining( { id: 55, po_number: 'PO-000056' } )
		);
	} );

	it( 'marks a draft purchase order as sent without any email', async () => {
		( api.getPurchaseOrder as jest.Mock ).mockResolvedValue( {
			...sentPO(),
			status: 'draft',
		} );
		( api.sendPurchaseOrder as jest.Mock ).mockResolvedValue( sentPO() );
		renderDetail();
		const user = userEvent.setup();
		await screen.findByText( 'PO-000056' );

		expect(
			screen.queryByRole( 'button', { name: /^send$/i } )
		).not.toBeInTheDocument();
		await user.click(
			screen.getByRole( 'button', { name: /mark as sent/i } )
		);

		await waitFor( () =>
			expect( api.sendPurchaseOrder ).toHaveBeenCalledWith( 55 )
		);
	} );

	it( 'hides Mark as sent once the purchase order is sent', async () => {
		renderDetail();

		expect( await screen.findByText( 'PO-000056' ) ).toBeInTheDocument();
		expect(
			screen.queryByRole( 'button', { name: /mark as sent/i } )
		).not.toBeInTheDocument();
	} );

	it( 'shows an Edit button only for draft purchase orders', async () => {
		( api.getPurchaseOrder as jest.Mock ).mockResolvedValue( {
			...sentPO(),
			status: 'draft',
		} );
		renderDetail();

		expect( await screen.findByText( 'PO-000056' ) ).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: /^edit$/i } )
		).toBeInTheDocument();
	} );

	it( 'hides the Edit button for a sent purchase order', async () => {
		renderDetail();

		expect( await screen.findByText( 'PO-000056' ) ).toBeInTheDocument();
		expect(
			screen.queryByRole( 'button', { name: /^edit$/i } )
		).not.toBeInTheDocument();
	} );

	it( 'shows draft lines read-only; changes go through the Edit dialog', async () => {
		( api.getPurchaseOrder as jest.Mock ).mockResolvedValue( {
			...sentPO(),
			status: 'draft',
		} );
		renderDetail();
		await screen.findByText( 'Widget 1' );

		expect(
			screen.queryByRole( 'button', { name: 'Edit Widget 1' } )
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole( 'button', { name: 'Remove Widget 1' } )
		).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText( 'Quantity for Widget 1' )
		).not.toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: /^edit$/i } )
		).toBeInTheDocument();
	} );

	it( 'shows the totals breakdown', async () => {
		( api.getPurchaseOrder as jest.Mock ).mockResolvedValue( {
			...sentPO(),
			discount_percent: 10,
			tax_rate_percent: 5,
			supplier_fee: 2,
			shipping_cost: 3,
		} );
		renderDetail();

		expect( await screen.findByText( 'PO-000056' ) ).toBeInTheDocument();
		expect( screen.getByText( /subtotal/i ) ).toBeInTheDocument();
	} );
} );
