import * as React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StockCell } from './StockCell';
import type { Product } from '@/types/api';

const mockMutate = jest.fn();

jest.mock( '@/hooks/useAdjustStock', () => ( {
	useAdjustStock: () => ( { mutate: mockMutate, isPending: false } ),
} ) );
jest.mock( 'sonner', () => ( {
	toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
} ) );

function makeProduct( overrides: Partial< Product > = {} ): Product {
	return {
		id: 1,
		parent_id: 0,
		name: 'Widget',
		sku: 'SKU-1',
		type: 'simple',
		manage_stock: true,
		stock_qty: 50,
		stock_status: 'instock',
		...overrides,
	} as Product;
}

function openPopover( product: Product ) {
	render( <StockCell product={ product } /> );
	fireEvent.click(
		screen.getByRole( 'button', {
			name: `Adjust stock for ${ product.name }`,
		} )
	);
}

function typeAdjustment( product: Product, value: string ) {
	const input = screen.getByRole( 'spinbutton', {
		name: `Stock adjustment for ${ product.name }`,
	} );
	fireEvent.change( input, { target: { value } } );
	return input;
}

function clickApply() {
	fireEvent.click( screen.getByRole( 'button', { name: 'Apply' } ) );
}

describe( 'StockCell large-adjustment confirmation', () => {
	beforeEach( () => {
		mockMutate.mockClear();
	} );

	it( 'applies immediately with no dialog when the adjustment is below the warning threshold', () => {
		const product = makeProduct();
		openPopover( product );
		typeAdjustment( product, '10' );
		clickApply();

		expect( mockMutate ).toHaveBeenCalledTimes( 1 );
		expect(
			screen.queryByRole( 'heading', {
				name: /Confirm large adjustment/i,
			} )
		).toBeNull();
	} );

	it( 'shows a confirmation dialog without applying when the adjustment exceeds the warning threshold', () => {
		const product = makeProduct();
		openPopover( product );
		typeAdjustment( product, '600' );
		clickApply();

		expect( mockMutate ).not.toHaveBeenCalled();
		expect(
			screen.getByRole( 'heading', { name: /Confirm large adjustment/i } )
		).toBeInTheDocument();
		expect( screen.getByText( /Widget/ ) ).toBeInTheDocument();
		expect( screen.getByText( /\+600/ ) ).toBeInTheDocument();
		expect( screen.getByText( /from 50 to 650/ ) ).toBeInTheDocument();
	} );

	it( 'applies the adjustment and closes the dialog when Confirm is clicked', () => {
		const product = makeProduct();
		openPopover( product );
		typeAdjustment( product, '600' );
		clickApply();
		fireEvent.click( screen.getByRole( 'button', { name: 'Confirm' } ) );

		expect( mockMutate ).toHaveBeenCalledTimes( 1 );
		expect( mockMutate.mock.calls[ 0 ][ 0 ] ).toMatchObject( {
			adjustment: 600,
		} );
		expect(
			screen.queryByRole( 'heading', {
				name: /Confirm large adjustment/i,
			} )
		).toBeNull();
	} );

	it( 'does not apply and preserves the input when Cancel is clicked', () => {
		const product = makeProduct();
		openPopover( product );
		const input = typeAdjustment( product, '600' );
		clickApply();
		fireEvent.click( screen.getByRole( 'button', { name: 'Cancel' } ) );

		expect( mockMutate ).not.toHaveBeenCalled();
		expect(
			screen.queryByRole( 'heading', {
				name: /Confirm large adjustment/i,
			} )
		).toBeNull();
		expect( input ).toHaveValue( 600 );
		expect(
			screen.getByRole( 'button', { name: 'Apply' } )
		).toBeInTheDocument();
	} );

	it( 'does not apply when Escape is pressed while the dialog is open', () => {
		const product = makeProduct();
		openPopover( product );
		typeAdjustment( product, '600' );
		clickApply();
		fireEvent.keyDown( document, { key: 'Escape' } );

		expect( mockMutate ).not.toHaveBeenCalled();
		expect(
			screen.queryByRole( 'heading', {
				name: /Confirm large adjustment/i,
			} )
		).toBeNull();
	} );

	it( 'does not apply when the overlay is clicked outside the dialog', async () => {
		const product = makeProduct();
		openPopover( product );
		typeAdjustment( product, '600' );
		clickApply();

		await act( async () => {
			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		} );
		fireEvent.pointerDown( document.body );

		expect( mockMutate ).not.toHaveBeenCalled();
		expect(
			screen.queryByRole( 'heading', {
				name: /Confirm large adjustment/i,
			} )
		).toBeNull();
	} );
} );
