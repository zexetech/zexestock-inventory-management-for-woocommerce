import * as React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreatePODialog } from '../CreatePODialog';
import * as api from '@/lib/api';
import type { PurchaseOrder } from '@/types/purchase-order';

jest.mock( '@/lib/api', () => ( {
	...jest.requireActual( '@/lib/api' ),
	apiGet: jest.fn(),
	getSuppliers: jest.fn(),
	createPurchaseOrder: jest.fn(),
	updatePurchaseOrder: jest.fn(),
} ) );

const EDITING_PO = {
	id: 55,
	po_number: 'PO-000055',
	supplier_id: 9,
	supplier_name: 'Archived Supplier Ltd',
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
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	render(
		<QueryClientProvider client={ queryClient }>
			<CreatePODialog open onOpenChange={ jest.fn() } { ...overrides } />
		</QueryClientProvider>
	);
}

describe( 'CreatePODialog PO date', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [],
			total: 0,
		} );
		( api.updatePurchaseOrder as jest.Mock ).mockResolvedValue( {} );
	} );

	it( 'uses the plugin DatePicker instead of a native date input', () => {
		renderDialog( { editingPO: EDITING_PO } );

		expect(
			document.querySelector( 'input[type="date"]' )
		).not.toBeInTheDocument();
		expect( screen.getByLabelText( /po date/i ) ).toHaveTextContent(
			'September 24, 2026'
		);
	} );

	it( 'sends the picked day as yyyy-MM-dd', async () => {
		const user = userEvent.setup();
		renderDialog( { editingPO: EDITING_PO } );

		await user.click( screen.getByLabelText( /po date/i ) );
		const grid = await screen.findByRole( 'grid' );
		const day = within( grid )
			.getAllByRole( 'gridcell' )
			.find( ( b ) => ( b.textContent ?? '' ).trim() === '10' );
		await user.click( day as HTMLElement );
		await user.click( screen.getByRole( 'button', { name: /^save$/i } ) );

		await waitFor( () =>
			expect( api.updatePurchaseOrder ).toHaveBeenCalledWith(
				55,
				expect.objectContaining( { po_date: '2026-09-10' } )
			)
		);
	} );
} );
