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
	getSupplierProductsList: jest.fn(),
	createPurchaseOrder: jest.fn(),
	updatePurchaseOrder: jest.fn(),
	setMeta: jest.fn(),
} ) );

function renderDialog(
	overrides: Partial< React.ComponentProps< typeof CreatePODialog > > = {}
) {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	const invalidate = jest.spyOn( queryClient, 'invalidateQueries' );
	render(
		<QueryClientProvider client={ queryClient }>
			<CreatePODialog open onOpenChange={ jest.fn() } { ...overrides } />
		</QueryClientProvider>
	);
	return { invalidate };
}

function row( name: string ): HTMLElement {
	return screen.getByText( name ).closest( 'tr' ) as HTMLElement;
}

function costInput( name: string ): HTMLInputElement {
	return row( name ).querySelectorAll( 'input' )[ 1 ] as HTMLInputElement;
}

function priceCell( name: string ) {
	return row( name ).querySelector(
		'[data-testid="po-line-purchase-price"]'
	);
}

async function addProduct(
	user: ReturnType< typeof userEvent.setup >,
	label: string
) {
	await user.click(
		screen.getByRole( 'button', { name: /add a product/i } )
	);
	await user.click( await screen.findByText( label ) );
}

async function setCost(
	user: ReturnType< typeof userEvent.setup >,
	name: string,
	value: string
) {
	await user.clear( costInput( name ) );
	await user.type( costInput( name ), value );
}

const SET_AS = /set as purchase price/i;

describe( 'CreatePODialog set cost as purchase price', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [ { id: 1, name: 'Acme Co' } ],
			total: 1,
		} );
		( api.apiGet as jest.Mock ).mockResolvedValue( {
			data: [
				{
					id: 7,
					name: 'Gadget',
					sku: 'G-7',
					purchase_price: '7.50',
					supplier_sku: '',
				},
				{
					id: 8,
					name: 'Gizmo',
					sku: 'G-8',
					purchase_price: null,
					supplier_sku: '',
				},
			],
		} );
		( api.getSupplierProductsList as jest.Mock ).mockResolvedValue( {
			items: [],
			total: 0,
		} );
		( api.setMeta as jest.Mock ).mockResolvedValue( {
			id: 7,
			purchase_price: '8',
			supplier_sku: '',
			barcode: '',
		} );
	} );

	it( 'hides the action while the cost matches the purchase price', async () => {
		const user = userEvent.setup();
		renderDialog( { initialSupplierId: 1 } );
		await addProduct( user, 'Gadget (G-7)' );

		expect(
			within( row( 'Gadget' ) ).queryByRole( 'button', { name: SET_AS } )
		).not.toBeInTheDocument();
	} );

	it( 'writes the cost to the product only after an explicit Yes', async () => {
		const user = userEvent.setup();
		const { invalidate } = renderDialog( { initialSupplierId: 1 } );
		await addProduct( user, 'Gadget (G-7)' );
		await setCost( user, 'Gadget', '8' );

		await user.click(
			within( row( 'Gadget' ) ).getByRole( 'button', { name: SET_AS } )
		);
		const dialog = await screen.findByRole( 'alertdialog' );
		expect( dialog ).toHaveTextContent(
			"Update Gadget's purchase price from 7.50 to 8.00? This changes the product itself, not just this PO."
		);
		expect( api.setMeta ).not.toHaveBeenCalled();

		await user.click(
			within( dialog ).getByRole( 'button', { name: /^yes$/i } )
		);

		await waitFor( () =>
			expect( api.setMeta ).toHaveBeenCalledWith( 7, {
				purchase_price: '8',
			} )
		);
		await waitFor( () =>
			expect( priceCell( 'Gadget' ) ).toHaveTextContent( '8.00' )
		);
		expect( screen.queryByRole( 'alertdialog' ) ).not.toBeInTheDocument();
		expect(
			within( row( 'Gadget' ) ).queryByRole( 'button', { name: SET_AS } )
		).not.toBeInTheDocument();
		expect( invalidate ).toHaveBeenCalledWith( {
			queryKey: [ 'products' ],
		} );
	} );

	it( 'changes nothing when the user answers No', async () => {
		const user = userEvent.setup();
		renderDialog( { initialSupplierId: 1 } );
		await addProduct( user, 'Gadget (G-7)' );
		await setCost( user, 'Gadget', '8' );

		await user.click(
			within( row( 'Gadget' ) ).getByRole( 'button', { name: SET_AS } )
		);
		const dialog = await screen.findByRole( 'alertdialog' );
		await user.click(
			within( dialog ).getByRole( 'button', { name: /^no$/i } )
		);

		expect( screen.queryByRole( 'alertdialog' ) ).not.toBeInTheDocument();
		expect( api.setMeta ).not.toHaveBeenCalled();
		expect( priceCell( 'Gadget' ) ).toHaveTextContent( '7.50' );
		expect( costInput( 'Gadget' ) ).toHaveValue( 8 );
	} );

	it( 'offers to set a price for a product that has none', async () => {
		const user = userEvent.setup();
		renderDialog( { initialSupplierId: 1 } );
		await addProduct( user, 'Gizmo (G-8)' );
		await setCost( user, 'Gizmo', '5' );

		await user.click(
			within( row( 'Gizmo' ) ).getByRole( 'button', { name: SET_AS } )
		);
		expect( await screen.findByRole( 'alertdialog' ) ).toHaveTextContent(
			"Update Gizmo's purchase price from none to 5.00?"
		);
	} );

	it( 'shows the purchase price and offers the action for linked products', async () => {
		( api.getSupplierProductsList as jest.Mock ).mockResolvedValue( {
			items: [
				{
					id: 1,
					product_id: 7,
					product_name: 'Gadget',
					sku: 'G-7',
					supplier_sku: null,
					unit_cost: 6,
					purchase_price: '7.50',
					currency: 'USD',
					lead_time_days: null,
					minimum_order_qty: null,
					order_multiple: null,
					purchase_unit: null,
					is_active: true,
					created_at: '',
					updated_at: '',
				},
			],
			total: 1,
		} );
		const user = userEvent.setup();
		renderDialog( { initialSupplierId: 1 } );
		await user.click(
			await screen.findByRole( 'button', {
				name: /add linked products \(1\)/i,
			} )
		);

		expect( priceCell( 'Gadget' ) ).toHaveTextContent( '7.50' );
		await user.click(
			within( row( 'Gadget' ) ).getByRole( 'button', { name: SET_AS } )
		);
		expect( await screen.findByRole( 'alertdialog' ) ).toHaveTextContent(
			"Update Gadget's purchase price from 7.50 to 6.00?"
		);
	} );

	function editingPOWithWidget( purchasePrice: string | null ) {
		return {
			id: 55,
			po_number: 'PO-000055',
			supplier_id: 9,
			supplier_name: 'Acme Co',
			status: 'draft',
			po_date: '2026-09-24',
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
					purchase_price: purchasePrice,
				},
			],
		} as unknown as PurchaseOrder;
	}

	it( 'offers the action for saved lines whose cost differs from the purchase price', async () => {
		const user = userEvent.setup();
		renderDialog( { editingPO: editingPOWithWidget( '8' ) } );

		expect( row( 'Widget' ) ).toHaveTextContent( '8.00' );
		await user.click(
			within( row( 'Widget' ) ).getByRole( 'button', { name: SET_AS } )
		);
		expect( screen.getByRole( 'alertdialog' ) ).toHaveTextContent(
			"Update Widget's purchase price from 8.00 to 10.00?"
		);
	} );

	it( 'hides the action for saved lines whose cost matches the purchase price', () => {
		renderDialog( { editingPO: editingPOWithWidget( '10' ) } );

		expect(
			within( row( 'Widget' ) ).queryByRole( 'button', { name: SET_AS } )
		).not.toBeInTheDocument();
	} );

	it( 'offers the action in edit mode for newly added lines', async () => {
		const user = userEvent.setup();
		renderDialog( {
			editingPO: {
				id: 55,
				po_number: 'PO-000055',
				supplier_id: 9,
				supplier_name: 'Acme Co',
				status: 'draft',
				po_date: '2026-09-24',
				items: [],
			} as unknown as PurchaseOrder,
		} );
		await addProduct( user, 'Gadget (G-7)' );
		await setCost( user, 'Gadget', '9' );

		expect(
			within( row( 'Gadget' ) ).getByRole( 'button', { name: SET_AS } )
		).toBeInTheDocument();
	} );
} );
