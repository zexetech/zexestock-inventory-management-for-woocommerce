const mockAutoTable = jest.fn();
const mockText = jest.fn();
const mockSave = jest.fn();

jest.mock( 'jspdf-autotable', () => ( {
	__esModule: true,
	default: ( ...args: unknown[] ) => mockAutoTable( ...args ),
} ) );

jest.mock( 'jspdf', () => {
	class FakeJsPDF {
		internal = {
			pageSize: {
				getWidth: () => 595,
				getHeight: () => 842,
			},
		};
		lastAutoTable = { finalY: 300 };
		setFillColor = jest.fn();
		rect = jest.fn();
		setDrawColor = jest.fn();
		setFontSize = jest.fn();
		setFont = jest.fn();
		setTextColor = jest.fn();
		text = ( ...args: unknown[] ) => mockText( ...args );
		splitTextToSize = ( text: string ) => text.split( '\n' );
		line = jest.fn();
		addPage = jest.fn();
		setPage = jest.fn();
		getNumberOfPages = () => 1;
		save = ( ...args: unknown[] ) => mockSave( ...args );
	}
	return { __esModule: true, jsPDF: FakeJsPDF };
} );

import { generatePOPdf, buildPOTotalLines } from '../export-po-pdf';
import type { PurchaseOrder } from '@/types/purchase-order';

function po( overrides: Partial< PurchaseOrder > = {} ): PurchaseOrder {
	return {
		id: 55,
		po_number: 'PO-000056',
		supplier_id: 2,
		supplier_name: 'Acme Co',
		supplier_contact_name: 'Jo',
		supplier_email: 'jo@acme.test',
		supplier_phone: '555',
		supplier_address_line_1: '1 Main St',
		supplier_address_line_2: null,
		supplier_city: 'Metropolis',
		supplier_state: 'NY',
		supplier_postal_code: '10001',
		supplier_country: 'US',
		status: 'draft',
		currency: 'USD',
		internal_notes: 'internal only',
		supplier_notes: 'please rush',
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
		sent_at: null,
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
				supplier_sku: 'ACME-1',
				purchase_unit: null,
				quantity_ordered: 4,
				quantity_received: 0,
				unit_cost: 10,
			},
		],
		...overrides,
	};
}

function allText(): string {
	return mockText.mock.calls
		.map( ( call ) =>
			Array.isArray( call[ 0 ] ) ? call[ 0 ].join( '\n' ) : call[ 0 ]
		)
		.join( '\n' );
}

describe( 'buildPOTotalLines', () => {
	it( 'shows only subtotal and total when there are no adjustments', () => {
		expect( buildPOTotalLines( po() ) ).toEqual( [
			[ 'Subtotal', '40.00' ],
			[ 'Total', 'USD 40.00' ],
		] );
	} );

	it( 'lists each non-zero adjustment with its percentage', () => {
		const lines = buildPOTotalLines(
			po( {
				discount_percent: 10,
				tax_rate_percent: 5,
				supplier_fee: 2,
				shipping_cost: 3,
			} )
		);

		expect( lines ).toEqual( [
			[ 'Subtotal', '40.00' ],
			[ 'Discount (10%)', '-4.00' ],
			[ 'Tax (5%)', '1.80' ],
			[ 'Supplier Fee', '2.00' ],
			[ 'Shipping', '3.00' ],
			[ 'Total', 'USD 42.80' ],
		] );
	} );

	it( 'trims trailing zeros from fractional percentages', () => {
		const lines = buildPOTotalLines( po( { discount_percent: 12.5 } ) );

		expect( lines[ 1 ][ 0 ] ).toBe( 'Discount (12.5%)' );
	} );
} );

describe( 'generatePOPdf', () => {
	afterEach( () => {
		mockAutoTable.mockReset();
		mockText.mockReset();
		mockSave.mockReset();
	} );

	it( 'renders one table row per line item with its line total', async () => {
		await generatePOPdf( po() );

		const options = mockAutoTable.mock.calls[ 0 ][ 1 ];
		expect( options.head ).toEqual( [
			[
				'Product',
				'SKU',
				'Supplier SKU',
				'Qty',
				'Unit Cost',
				'Line Total',
			],
		] );
		expect( options.body ).toEqual( [
			[ 'Widget 1', 'SKU-1', 'ACME-1', '4', '10.00', '40.00' ],
		] );
	} );

	it( 'prints the PO number, date, supplier block and supplier notes', async () => {
		await generatePOPdf( po() );

		const text = allText();
		expect( text ).toContain( 'PO-000056' );
		expect( text ).toContain( '2026-09-24' );
		expect( text ).toContain( 'Acme Co' );
		expect( text ).toContain( 'Metropolis, NY 10001' );
		expect( text ).toContain( 'please rush' );
	} );

	it( 'never prints internal notes', async () => {
		await generatePOPdf( po() );

		expect( allText() ).not.toContain( 'internal only' );
	} );

	it( 'falls back to the creation date when the PO has no date', async () => {
		await generatePOPdf( po( { po_date: null } ) );

		expect( allText() ).toContain( '2026-09-24' );
	} );

	it( 'saves the file under the PO number', async () => {
		await generatePOPdf( po() );

		expect( mockSave ).toHaveBeenCalledWith( 'PO-000056.pdf' );
	} );
} );
