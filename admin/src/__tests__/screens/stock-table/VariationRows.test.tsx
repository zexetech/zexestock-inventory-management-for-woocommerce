import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VariationRows } from '@/screens/stock-table/VariationRows';
import type { Product } from '@/types/api';

jest.mock( '@/lib/api', () => ( {
	setPrice: jest.fn().mockResolvedValue( {} ),
} ) );
jest.mock( 'sonner', () => ( {
	toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
} ) );
jest.mock( '@/components/ui/date-picker', () => ( {
	DatePicker: ( {
		value,
		placeholder,
	}: {
		value: string;
		placeholder?: string;
	} ) => {
		const ReactModule = require( 'react' );
		return ReactModule.createElement( 'input', {
			placeholder,
			value,
			readOnly: true,
		} );
	},
} ) );

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
	date_on_sale_from: '2026-07-01',
	date_on_sale_to: '2026-07-10',
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

function renderRows() {
	const qc = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	return render(
		<QueryClientProvider client={ qc }>
			<table>
				<tbody>
					<VariationRows
						productId={ 1 }
						visibleColumnIds={ [ 'sale_price' ] }
					/>
				</tbody>
			</table>
		</QueryClientProvider>
	);
}

describe( 'VariationRows — sale price popover dates', () => {
	it( "shows the variation's existing sale schedule dates when the popover opens", () => {
		renderRows();

		fireEvent.click(
			screen.getByRole( 'button', {
				name: /Edit Sale Price for Widget — Red/i,
			} )
		);

		expect(
			( screen.getByPlaceholderText( 'Start date' ) as HTMLInputElement )
				.value
		).toBe( '2026-07-01' );
		expect(
			( screen.getByPlaceholderText( 'End date' ) as HTMLInputElement )
				.value
		).toBe( '2026-07-10' );
	} );
} );
