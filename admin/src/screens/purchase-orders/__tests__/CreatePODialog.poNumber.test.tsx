import * as React from 'react';
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreatePODialog } from '../CreatePODialog';
import * as api from '@/lib/api';
import type { PurchaseOrder } from '@/types/purchase-order';

jest.mock( '@/lib/api', () => ( {
	...jest.requireActual( '@/lib/api' ),
	apiGet: jest.fn(),
	getSuppliers: jest.fn(),
	getNextPONumber: jest.fn(),
	checkPONumberAvailable: jest.fn(),
	createPurchaseOrder: jest.fn(),
	updatePurchaseOrder: jest.fn(),
} ) );

const EDITING_PO = {
	id: 55,
	po_number: '000055',
	supplier_id: 9,
	supplier_name: 'Acme Co',
	status: 'draft',
	currency: 'USD',
	supplier_notes: '',
	po_date: '2026-09-24',
	discount_percent: 0,
	tax_rate_percent: 0,
	supplier_fee: 0,
	shipping_cost: 0,
	total_cost: 20,
	items: [
		{
			id: 1,
			po_id: 55,
			product_id: 5,
			sku: 'W-5',
			product_name: 'Widget',
			supplier_sku: null,
			purchase_unit: null,
			quantity_ordered: 2,
			quantity_received: 0,
			unit_cost: 10,
		},
	],
} as unknown as PurchaseOrder;

function renderDialog(
	overrides: Partial< React.ComponentProps< typeof CreatePODialog > > = {}
) {
	const onOpenChange = jest.fn();
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	render(
		<QueryClientProvider client={ queryClient }>
			<CreatePODialog
				open
				onOpenChange={ onOpenChange }
				{ ...overrides }
			/>
		</QueryClientProvider>
	);
	return { onOpenChange };
}

describe( 'CreatePODialog PO number', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [],
			total: 0,
		} );
		( api.getNextPONumber as jest.Mock ).mockResolvedValue( {
			po_number: '000057',
		} );
		( api.checkPONumberAvailable as jest.Mock ).mockResolvedValue( {
			available: true,
		} );
		( api.updatePurchaseOrder as jest.Mock ).mockResolvedValue( {} );
	} );

	it( 'pre-fills a numeric-only suggested number on create', async () => {
		renderDialog();

		await waitFor( () =>
			expect( screen.getByLabelText( /po number/i ) ).toHaveValue(
				'000057'
			)
		);
	} );

	it( 'flags a number another PO already uses and blocks saving', async () => {
		( api.checkPONumberAvailable as jest.Mock ).mockResolvedValue( {
			available: false,
		} );
		const user = userEvent.setup();
		renderDialog( { editingPO: EDITING_PO } );

		const input = screen.getByLabelText( /po number/i );
		await user.clear( input );
		await user.type( input, 'ACME-42' );

		expect(
			await screen.findByText( /already exists/i )
		).toBeInTheDocument();
		expect( api.checkPONumberAvailable ).toHaveBeenCalledWith(
			'ACME-42',
			55
		);
		expect(
			screen.getByRole( 'button', { name: /^save$/i } )
		).toBeDisabled();
	} );

	it( 'sends an edited, available number on save', async () => {
		const user = userEvent.setup();
		renderDialog( { editingPO: EDITING_PO } );

		const input = screen.getByLabelText( /po number/i );
		await user.clear( input );
		await user.type( input, 'ACME-42' );
		await waitFor( () =>
			expect( api.checkPONumberAvailable ).toHaveBeenCalledWith(
				'ACME-42',
				55
			)
		);
		await user.click( screen.getByRole( 'button', { name: /^save$/i } ) );

		await waitFor( () =>
			expect( api.updatePurchaseOrder ).toHaveBeenCalledWith(
				55,
				expect.objectContaining( { po_number: 'ACME-42' } )
			)
		);
	} );

	it( 'does not close when clicking outside the dialog', async () => {
		const { onOpenChange } = renderDialog( { editingPO: EDITING_PO } );
		await screen.findByRole( 'dialog' );
		// Radix only attaches its outside-pointer listener after a tick.
		await act( () => new Promise( ( r ) => setTimeout( r, 0 ) ) );

		fireEvent.pointerDown( document.body );

		expect( onOpenChange ).not.toHaveBeenCalled();
	} );
} );
