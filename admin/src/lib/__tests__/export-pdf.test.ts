jest.mock( '@wordpress/date', () => ( {
	dateI18n: () => '2026-01-01',
	getSettings: () => ( { formats: { date: 'Y-m-d' } } ),
} ) );

const mockAutoTable = jest.fn();

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
		setFillColor = jest.fn();
		rect = jest.fn();
		roundedRect = jest.fn();
		setDrawColor = jest.fn();
		setFontSize = jest.fn();
		setFont = jest.fn();
		setTextColor = jest.fn();
		text = jest.fn();
		line = jest.fn();
		setPage = jest.fn();
		getNumberOfPages = () => 1;
		save = jest.fn();
	}
	return { __esModule: true, jsPDF: FakeJsPDF };
} );

import { generateStockPdf } from '../export-pdf';

describe( 'generateStockPdf', () => {
	afterEach( () => {
		mockAutoTable.mockReset();
	} );

	it( 'keeps a row intact on one page instead of splitting it across a page break', async () => {
		await generateStockPdf( [ 'ID', 'Name' ], [ [ 1, 'Widget' ] ], {
			scopeLabel: 'All products',
			totalCount: 1,
			lowStockCount: 0,
			outOfStockCount: 0,
		} );

		expect( mockAutoTable ).toHaveBeenCalledTimes( 1 );
		const options = mockAutoTable.mock.calls[ 0 ][ 1 ];
		expect( options.rowPageBreak ).toBe( 'avoid' );
	} );

	it( 'gives the Sale Start / Sale End date columns a fixed width so "YYYY-MM-DD" never wraps onto a second line', async () => {
		const headers = [ 'ID', 'Name', 'Sale Start', 'Sale End' ];

		await generateStockPdf(
			headers,
			[ [ 1, 'Widget', '2026-06-27', '2026-07-13' ] ],
			{
				scopeLabel: 'All products',
				totalCount: 1,
				lowStockCount: 0,
				outOfStockCount: 0,
			}
		);

		const options = mockAutoTable.mock.calls[ 0 ][ 1 ];
		const saleStartIndex = headers.indexOf( 'Sale Start' );
		const saleEndIndex = headers.indexOf( 'Sale End' );

		expect(
			options.columnStyles[ saleStartIndex ].cellWidth
		).toBeGreaterThanOrEqual( 50 );
		expect(
			options.columnStyles[ saleEndIndex ].cellWidth
		).toBeGreaterThanOrEqual( 50 );
	} );
} );
