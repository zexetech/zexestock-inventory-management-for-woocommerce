import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
} ) );

beforeEach( () => {
	jest.clearAllMocks();
	( api.getSupplierProductsList as jest.Mock ).mockResolvedValue( {
		items: [],
		total: 0,
	} );
} );

function renderDialog(
	overrides: Partial< React.ComponentProps< typeof CreatePODialog > > = {}
) {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	const onOpenChange = jest.fn();
	render(
		<QueryClientProvider client={ queryClient }>
			<CreatePODialog
				open
				onOpenChange={ onOpenChange }
				{ ...overrides }
			/>
		</QueryClientProvider>
	);
	return { onOpenChange, queryClient };
}

const SUPPLIER_A = {
	id: 1,
	name: 'Acme Co',
	discount_percent: 10,
	tax_rate_percent: 5,
};
const SUPPLIER_B = {
	id: 2,
	name: 'Beta Supplies',
	discount_percent: 5,
	tax_rate_percent: 2,
};

async function pickSupplier(
	user: ReturnType< typeof userEvent.setup >,
	trigger: RegExp,
	name: string
) {
	await user.click( screen.getByRole( 'button', { name: trigger } ) );
	await user.click( await screen.findByText( name ) );
}

function makeEditingPO( overrides: Partial< PurchaseOrder > = {} ) {
	return {
		id: 55,
		po_number: 'PO-000055',
		supplier_id: 9,
		supplier_name: 'Archived Supplier Ltd',
		status: 'draft',
		currency: 'USD',
		internal_notes: null,
		supplier_notes: 'please rush',
		email_to: null,
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
				purchase_price: null,
			},
		],
		...overrides,
	} as PurchaseOrder;
}

describe( 'CreatePODialog enrichment fields', () => {
	beforeEach( () => {
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [
				{
					id: 1,
					name: 'Acme Co',
					discount_percent: 10,
					tax_rate_percent: 5,
				},
			],
			total: 1,
		} );
	} );

	it( 'shows a live totals breakdown as discount/tax/fee/shipping change', async () => {
		const user = userEvent.setup();
		renderDialog();

		await user.type( screen.getByLabelText( /discount %/i ), '10' );
		await user.type( screen.getByLabelText( /tax rate %/i ), '5' );

		expect( await screen.findByText( /subtotal/i ) ).toBeInTheDocument();
	} );

	it( 'submits new PO fields on create', async () => {
		( api.createPurchaseOrder as jest.Mock ).mockResolvedValue( {} );
		const user = userEvent.setup();

		// Selecting a supplier and adding a line item is exercised by the
		// existing CreatePOButton.test.tsx integration test; here we only
		// assert the new numeric fields flow into the submit payload once a
		// submit is possible, via the supplier/item state seeded through
		// initialSupplierId/initialItems.
		renderDialog( {
			initialSupplierId: 1,
			initialItems: [
				{
					product_id: 5,
					product_name: 'Widget',
					quantity_ordered: 2,
					unit_cost: 10,
				},
			],
		} );

		await user.type( screen.getByLabelText( /supplier fee/i ), '2' );
		await user.type( screen.getByLabelText( /shipping cost/i ), '3' );

		await user.click( screen.getByRole( 'button', { name: /^create$/i } ) );

		await waitFor( () =>
			expect( api.createPurchaseOrder ).toHaveBeenCalledWith(
				expect.objectContaining( { supplier_fee: 2, shipping_cost: 3 } )
			)
		);
	} );
} );

describe( 'CreatePODialog supplier rate seeding', () => {
	beforeEach( () => {
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [ SUPPLIER_A, SUPPLIER_B ],
			total: 2,
		} );
	} );

	it( 're-seeds discount and tax from each newly selected supplier', async () => {
		const user = userEvent.setup();
		renderDialog();

		await pickSupplier( user, /select a supplier/i, 'Acme Co' );
		await waitFor( () =>
			expect( screen.getByLabelText( /discount %/i ) ).toHaveValue( 10 )
		);
		expect( screen.getByLabelText( /tax rate %/i ) ).toHaveValue( 5 );

		await pickSupplier( user, /acme co/i, 'Beta Supplies' );

		await waitFor( () =>
			expect( screen.getByLabelText( /discount %/i ) ).toHaveValue( 5 )
		);
		expect( screen.getByLabelText( /tax rate %/i ) ).toHaveValue( 2 );
	} );

	it( 'does not overwrite a manual rate edit when the supplier list refetches', async () => {
		const user = userEvent.setup();
		const { queryClient } = renderDialog();

		await pickSupplier( user, /select a supplier/i, 'Acme Co' );
		await waitFor( () =>
			expect( screen.getByLabelText( /discount %/i ) ).toHaveValue( 10 )
		);

		await user.clear( screen.getByLabelText( /discount %/i ) );
		await user.type( screen.getByLabelText( /discount %/i ), '0' );
		expect( screen.getByLabelText( /discount %/i ) ).toHaveValue( 0 );

		// Changed content, so structural sharing cannot keep the old reference.
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [
				SUPPLIER_A,
				SUPPLIER_B,
				{
					id: 3,
					name: 'Gamma',
					discount_percent: 1,
					tax_rate_percent: 1,
				},
			],
			total: 3,
		} );
		await queryClient.refetchQueries();

		// Wait until the refetched list has rendered before asserting.
		await user.click( screen.getByRole( 'button', { name: /acme co/i } ) );
		expect( await screen.findByText( 'Gamma' ) ).toBeInTheDocument();
		await user.keyboard( '{Escape}' );

		expect( screen.getByLabelText( /discount %/i ) ).toHaveValue( 0 );
	} );

	it( 'seeds rates from the pre-selected supplier on the reorder flow', async () => {
		renderDialog( { initialSupplierId: 2 } );

		await waitFor( () =>
			expect( screen.getByLabelText( /discount %/i ) ).toHaveValue( 5 )
		);
		expect( screen.getByLabelText( /tax rate %/i ) ).toHaveValue( 2 );
	} );
} );

describe( 'CreatePODialog edit mode', () => {
	beforeEach( () => {
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [ SUPPLIER_A, SUPPLIER_B ],
			total: 2,
		} );
		( api.updatePurchaseOrder as jest.Mock ).mockResolvedValue( {} );
	} );

	it( 'is titled as an edit, not a new purchase order', () => {
		renderDialog( { editingPO: makeEditingPO() } );

		expect(
			screen.getByRole( 'heading', { name: /edit purchase order/i } )
		).toBeInTheDocument();
		expect(
			screen.queryByText( /new purchase order/i )
		).not.toBeInTheDocument();
		expect(
			screen.queryByText( /select a supplier and add/i )
		).not.toBeInTheDocument();
	} );

	it( 'shows the supplier read-only and never sends supplier_id', async () => {
		const user = userEvent.setup();
		renderDialog( { editingPO: makeEditingPO() } );

		expect(
			screen.getByText( 'Archived Supplier Ltd' )
		).toBeInTheDocument();
		expect(
			screen.queryByRole( 'button', { name: /select a supplier/i } )
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole( 'button', { name: /archived supplier ltd/i } )
		).not.toBeInTheDocument();

		await user.click( screen.getByRole( 'button', { name: /^save$/i } ) );

		await waitFor( () =>
			expect( api.updatePurchaseOrder ).toHaveBeenCalled()
		);
		const [ id, data ] = ( api.updatePurchaseOrder as jest.Mock ).mock
			.calls[ 0 ];
		expect( id ).toBe( 55 );
		expect( data ).not.toHaveProperty( 'supplier_id' );
	} );

	it( 'sends an emptied supplier note as an empty string so it clears', async () => {
		const user = userEvent.setup();
		renderDialog( { editingPO: makeEditingPO() } );

		await user.clear( screen.getByLabelText( /supplier notes/i ) );
		await user.click( screen.getByRole( 'button', { name: /^save$/i } ) );

		await waitFor( () =>
			expect( api.updatePurchaseOrder ).toHaveBeenCalledWith(
				55,
				expect.objectContaining( { supplier_notes: '' } )
			)
		);
	} );
} );

describe( 'CreatePODialog line item purchase price', () => {
	beforeEach( () => {
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [ SUPPLIER_A ],
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
		( api.createPurchaseOrder as jest.Mock ).mockResolvedValue( {} );
		( api.updatePurchaseOrder as jest.Mock ).mockResolvedValue( {} );
	} );

	function purchasePriceCell( productName: string ) {
		const row = screen.getByText( productName ).closest( 'tr' );
		return row?.querySelector( '[data-testid="po-line-purchase-price"]' );
	}

	it( 'prefills unit cost from the product purchase price and shows it read-only', async () => {
		const user = userEvent.setup();
		renderDialog( { initialSupplierId: 1 } );

		await user.click(
			screen.getByRole( 'button', { name: /add a product/i } )
		);
		await user.click( await screen.findByText( 'Gadget (G-7)' ) );

		expect(
			screen.getByRole( 'columnheader', { name: /purchase price/i } )
		).toBeInTheDocument();
		expect( purchasePriceCell( 'Gadget' ) ).toHaveTextContent( '7.50' );
		const row = screen.getByText( 'Gadget' ).closest( 'tr' ) as HTMLElement;
		expect( row.querySelectorAll( 'input' )[ 1 ] ).toHaveValue( 7.5 );

		await user.click( screen.getByRole( 'button', { name: /^create$/i } ) );
		await waitFor( () =>
			expect( api.createPurchaseOrder ).toHaveBeenCalled()
		);
		const payload = ( api.createPurchaseOrder as jest.Mock ).mock
			.calls[ 0 ][ 0 ];
		expect( payload.items ).toEqual( [
			expect.objectContaining( { product_id: 7, unit_cost: 7.5 } ),
		] );
		expect( payload.items[ 0 ] ).not.toHaveProperty( 'purchase_price' );
	} );

	it( 'leaves unit cost empty when the product has no purchase price', async () => {
		const user = userEvent.setup();
		renderDialog( { initialSupplierId: 1 } );

		await user.click(
			screen.getByRole( 'button', { name: /add a product/i } )
		);
		await user.click( await screen.findByText( 'Gizmo (G-8)' ) );

		const row = screen.getByText( 'Gizmo' ).closest( 'tr' ) as HTMLElement;
		expect( row.querySelectorAll( 'input' )[ 1 ] ).toHaveValue( null );
		expect( purchasePriceCell( 'Gizmo' ) ).toHaveTextContent( /^$/ );
	} );

	it( "shows the product's current purchase price for lines of an edited PO", () => {
		const po = makeEditingPO();
		po.items[ 0 ].purchase_price = '9.25';
		renderDialog( { editingPO: po } );

		expect( purchasePriceCell( 'Widget' ) ).toHaveTextContent( '9.25' );
	} );
} );

describe( 'CreatePODialog product name tooltip', () => {
	beforeEach( () => {
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [ SUPPLIER_A ],
			total: 1,
		} );
	} );

	it( 'shows the full product name on hover', async () => {
		const user = userEvent.setup();
		const longName =
			'Extra Long Industrial Widget With A Very Descriptive Name, Blue';
		const po = makeEditingPO();
		po.items[ 0 ].product_name = longName;
		renderDialog( { editingPO: po } );

		await user.hover( screen.getByText( longName ) );

		expect( await screen.findByRole( 'tooltip' ) ).toHaveTextContent(
			longName
		);
	} );
} );

describe( 'CreatePODialog add linked products', () => {
	function makeLink( overrides: Record< string, unknown > = {} ) {
		return {
			id: 1,
			product_id: 20,
			product_name: 'Bolt',
			sku: 'B-20',
			supplier_sku: 'ACME-B20',
			unit_cost: 2.5,
			currency: 'USD',
			lead_time_days: null,
			minimum_order_qty: null,
			order_multiple: null,
			purchase_unit: null,
			is_active: true,
			created_at: '',
			updated_at: '',
			...overrides,
		};
	}

	beforeEach( () => {
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [ SUPPLIER_A ],
			total: 1,
		} );
		( api.getSupplierProductsList as jest.Mock ).mockResolvedValue( {
			items: [
				makeLink(),
				makeLink( {
					id: 2,
					product_id: 21,
					product_name: 'Nut',
					supplier_sku: null,
					unit_cost: 0.4,
					minimum_order_qty: 50,
					order_multiple: 12,
					purchase_unit: 'box',
				} ),
			],
			total: 2,
		} );
		( api.createPurchaseOrder as jest.Mock ).mockResolvedValue( {} );
	} );

	it( 'is hidden until a supplier is selected', () => {
		renderDialog();

		expect(
			screen.queryByRole( 'button', { name: /add linked products/i } )
		).not.toBeInTheDocument();
	} );

	it( 'adds every linked product with the link cost, SKU and order rules', async () => {
		const user = userEvent.setup();
		renderDialog( { initialSupplierId: 1 } );

		await user.click(
			await screen.findByRole( 'button', {
				name: /add linked products \(2\)/i,
			} )
		);

		expect( screen.getByText( 'Bolt' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Nut' ) ).toBeInTheDocument();
		expect( api.getSupplierProductsList ).toHaveBeenCalledWith( 1, {
			per_page: 200,
		} );

		await user.click( screen.getByRole( 'button', { name: /^create$/i } ) );
		await waitFor( () =>
			expect( api.createPurchaseOrder ).toHaveBeenCalled()
		);
		const payload = ( api.createPurchaseOrder as jest.Mock ).mock
			.calls[ 0 ][ 0 ];
		expect( payload.items ).toEqual( [
			{
				product_id: 20,
				quantity_ordered: 1,
				unit_cost: 2.5,
				supplier_sku: 'ACME-B20',
				purchase_unit: undefined,
			},
			{
				product_id: 21,
				quantity_ordered: 50,
				unit_cost: 0.4,
				supplier_sku: undefined,
				purchase_unit: 'box',
			},
		] );
	} );

	it( 'skips products already on the order and disables once all are added', async () => {
		const user = userEvent.setup();
		renderDialog( { initialSupplierId: 1 } );

		const button = await screen.findByRole( 'button', {
			name: /add linked products \(2\)/i,
		} );
		await user.click( button );

		expect(
			screen.getByRole( 'button', { name: /add linked products/i } )
		).toBeDisabled();
		expect( screen.getAllByText( 'Bolt' ) ).toHaveLength( 1 );
	} );
} );
