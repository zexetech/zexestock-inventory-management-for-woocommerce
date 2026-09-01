import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ExportDialog } from './ExportDialog';

function renderExportDialog( {
	filteredCount,
	activeFilterCount,
}: {
	filteredCount?: number;
	activeFilterCount?: number;
} = {} ) {
	return render(
		<ExportDialog
			open
			onClose={ jest.fn() }
			queryParams={ {} as never }
			filteredCount={ filteredCount }
			activeFilterCount={ activeFilterCount }
		/>
	);
}

describe( 'ExportDialog', () => {
	it( 'lists the Supplier SKU column immediately after the SKU column', () => {
		renderExportDialog();

		const ids = Array.from(
			document.querySelectorAll( '[id^="export-col-"]' )
		).map( ( el ) => el.id );

		expect( ids.indexOf( 'export-col-supplier_sku' ) ).toBe(
			ids.indexOf( 'export-col-sku' ) + 1
		);

		expect( console ).toHaveWarned();
	} );

	it( 'shows the actual number of matching products for the Filtered scope, not the number of active filter conditions', () => {
		renderExportDialog( { filteredCount: 7, activeFilterCount: 1 } );

		expect( screen.getByText( /\(7 products\)/ ) ).toBeInTheDocument();
		expect(
			screen.queryByText( /1 filter active/ )
		).not.toBeInTheDocument();

		expect( console ).toHaveWarned();
	} );
} );
