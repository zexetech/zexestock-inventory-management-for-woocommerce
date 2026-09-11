import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VariationRows } from '@/screens/stock-table/VariationRows';
import type { Product } from '@/types/api';

const variation: Product = {
	id: 101,
	parent_id: 1,
	type: 'variation',
	name: 'Widget — Red',
	sku: 'SKU-101',
	image_url: '',
	stock_qty: 10,
	stock_status: 'in_stock',
	category: '',
	manage_stock: true,
	regular_price: '19.99',
	sale_price: '14.99',
	date_on_sale_from: null,
	date_on_sale_to: null,
	reserved_qty: 0,
	sold_today: 0,
	sold_last_14_days: 0,
	low_stock_threshold_override: null,
	purchase_price: null,
	supplier_sku: '',
	barcode: '',
};

jest.mock( '@/hooks/useVariations', () => ( {
	useVariations: () => ( {
		data: [ variation ],
		isLoading: false,
		isError: false,
		refetch: jest.fn(),
	} ),
} ) );

function renderRows(
	selectedIds: Set< number >,
	onToggleRow?: ( id: number ) => void
) {
	const qc = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	return render(
		<QueryClientProvider client={ qc }>
			<table>
				<tbody>
					<VariationRows
						productId={ 1 }
						visibleColumnIds={ [ 'select', 'sku' ] }
						selectedIds={ selectedIds }
						onToggleRow={ onToggleRow }
					/>
				</tbody>
			</table>
		</QueryClientProvider>
	);
}

describe( 'VariationRows — select column', () => {
	it( 'renders a checkbox for the variation and toggles it via onToggleRow', () => {
		const onToggleRow = jest.fn();
		renderRows( new Set(), onToggleRow );

		const checkbox = screen.getByRole( 'checkbox', {
			name: /Select Widget — Red/i,
		} );
		expect( checkbox ).not.toBeChecked();

		fireEvent.click( checkbox );
		expect( onToggleRow ).toHaveBeenCalledWith( 101 );
	} );

	it( 'reflects the checked state from selectedIds', () => {
		renderRows( new Set( [ 101 ] ), jest.fn() );

		expect(
			screen.getByRole( 'checkbox', {
				name: /Select Widget — Red/i,
			} )
		).toBeChecked();
	} );

	it( 'renders nothing in the select cell when onToggleRow is not provided', () => {
		renderRows( new Set() );
		expect(
			screen.queryByRole( 'checkbox', { name: /Select Widget/i } )
		).not.toBeInTheDocument();
	} );
} );
