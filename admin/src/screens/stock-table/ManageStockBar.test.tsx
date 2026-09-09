import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManageStockBar } from './ManageStockBar';
import type { Product } from '@/types/api';

const mockMutateAsync = jest.fn();
jest.mock( '@/hooks/useBatchSetManageStock', () => ( {
	useBatchSetManageStock: () => ( {
		mutateAsync: mockMutateAsync,
		isPending: false,
	} ),
} ) );
jest.mock( 'sonner', () => ( {
	toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
} ) );

function makeProduct( id: number, type: string = 'simple' ): Product {
	return {
		id,
		name: `Product ${ id }`,
		sku: `S${ id }`,
		type,
		manage_stock: false,
		stock_qty: 10,
		stock_status: 'in_stock',
	} as Product;
}

describe( 'ManageStockBar', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		mockMutateAsync.mockResolvedValue( {
			results: [ { id: 1, success: true, manage_stock: true } ],
		} );
	} );

	it( 'renders nothing when nothing is selected', () => {
		const { container } = render(
			<ManageStockBar
				selectedIds={ [] }
				onClearSelection={ jest.fn() }
				currentPageProducts={ [] }
			/>
		);
		expect( container ).toBeEmptyDOMElement();
	} );

	it( 'shows the title and both Enable/Disable actions immediately (no choose step)', () => {
		render(
			<ManageStockBar
				selectedIds={ [ 1 ] }
				onClearSelection={ jest.fn() }
				currentPageProducts={ [ makeProduct( 1 ) ] }
			/>
		);
		expect(
			screen.getByText( 'Manage Stock Tracking' )
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: 'Enable' } )
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: 'Disable' } )
		).toBeInTheDocument();
	} );

	it( 'excludes grouped products from the selected count and shows a skip note', () => {
		render(
			<ManageStockBar
				selectedIds={ [ 1, 2 ] }
				onClearSelection={ jest.fn() }
				currentPageProducts={ [
					makeProduct( 1 ),
					makeProduct( 2, 'grouped' ),
				] }
			/>
		);
		expect( screen.getByText( /1 product selected/i ) ).toBeInTheDocument();
		expect(
			screen.getByText( /1 grouped product will be skipped/i )
		).toBeInTheDocument();
	} );

	it( 'opens a confirm dialog before applying, then runs the mutation on confirm', async () => {
		const onClearSelection = jest.fn();
		render(
			<ManageStockBar
				selectedIds={ [ 1 ] }
				onClearSelection={ onClearSelection }
				currentPageProducts={ [ makeProduct( 1 ) ] }
			/>
		);

		fireEvent.click( screen.getByRole( 'button', { name: 'Enable' } ) );
		expect(
			screen.getByText( /Enable stock management for 1 product/i )
		).toBeInTheDocument();

		fireEvent.click( screen.getByRole( 'button', { name: 'Confirm' } ) );

		await waitFor( () => {
			expect( mockMutateAsync ).toHaveBeenCalledWith( {
				ids: [ 1 ],
				manageStock: true,
			} );
		} );
		await waitFor( () => expect( onClearSelection ).toHaveBeenCalled() );
	} );
} );
