import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { StockCell } from './StockCell';
import type { Product } from '@/types/api';

jest.mock( '@/hooks/useAdjustStock', () => ( {
	useAdjustStock: () => ( { mutate: jest.fn(), isPending: false } ),
} ) );
jest.mock( 'sonner', () => ( {
	toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
} ) );

function makeProduct( overrides: Partial< Product > = {} ): Product {
	return {
		id: 1,
		name: 'Widget',
		sku: 'SKU-1',
		type: 'simple',
		manage_stock: true,
		stock_qty: 50,
		stock_status: 'instock',
		...overrides,
	} as Product;
}

describe( 'StockCell', () => {
	it( 'shows dash for variable product', () => {
		render( <StockCell product={ makeProduct( { type: 'variable' } ) } /> );
		expect( screen.getByText( /variable/i ) ).toBeInTheDocument();
	} );

	it( 'shows dash for grouped product', () => {
		render( <StockCell product={ makeProduct( { type: 'grouped' } ) } /> );
		expect( screen.getByText( /grouped/i ) ).toBeInTheDocument();
	} );

	it( 'shows "Not managed" when manage_stock is false', () => {
		render(
			<StockCell product={ makeProduct( { manage_stock: false } ) } />
		);
		expect( screen.getByText( /Not managed/i ) ).toBeInTheDocument();
	} );

	it( 'renders a badge trigger (not an input)', () => {
		render( <StockCell product={ makeProduct() } /> );
		expect( screen.queryByRole( 'spinbutton' ) ).toBeNull();
	} );
} );
