import * as React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StockTableScreen } from './StockTableScreen';
import type { Product } from '@/types/api';

jest.mock( './Toolbar', () => ( { Toolbar: () => null } ) );
jest.mock( './VariationRows', () => ( { VariationRows: () => null } ) );
jest.mock( './ExportDialog', () => ( { ExportDialog: () => null } ) );

jest.mock( '@/hooks/useProducts' );
jest.mock( '@/hooks/useBatchSetManageStock', () => ( {
	useBatchSetManageStock: () => ( {
		mutateAsync: jest.fn(),
		isPending: false,
	} ),
} ) );
jest.mock( 'sonner', () => ( {
	toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
} ) );

const { useProducts } = jest.requireMock( '@/hooks/useProducts' ) as {
	useProducts: jest.Mock;
};

function makeProduct(
	id: number,
	type = 'simple',
	manage_stock = true
): Product {
	return {
		id,
		name: `Product ${ id }`,
		sku: `S${ id }`,
		type,
		manage_stock,
		stock_qty: 5,
		stock_status: 'in_stock',
		regular_price: '10',
		sale_price: null,
		image_url: null,
		category: '',
	} as Product;
}

function renderScreen( qc: QueryClient ) {
	return render(
		<QueryClientProvider client={ qc }>
			<StockTableScreen />
		</QueryClientProvider>
	);
}

describe( 'StockTableScreen (free) — selection', () => {
	beforeEach( () => {
		useProducts.mockReset();
	} );

	it( 'select-all selects embedded variations immediately, with no extra fetch', async () => {
		const user = userEvent.setup();
		const qc = new QueryClient( {
			defaultOptions: { queries: { retry: false } },
		} );

		const varA = {
			...makeProduct( 10, 'variable', false ),
			variations: [
				makeProduct( 101, 'variation' ),
				makeProduct( 102, 'variation' ),
			],
		};
		const varB = {
			...makeProduct( 20, 'variable', false ),
			variations: [
				makeProduct( 201, 'variation' ),
				makeProduct( 202, 'variation' ),
				makeProduct( 203, 'variation' ),
			],
		};
		const simple = makeProduct( 30 );

		useProducts.mockReturnValue( {
			data: {
				data: [ varA, varB, simple ],
				meta: { total: 3, total_pages: 1, page: 1 },
			},
			isLoading: false,
			isFetching: false,
			isError: false,
			refetch: jest.fn(),
		} );

		renderScreen( qc );

		const selectAll = screen.getByRole( 'checkbox', {
			name: /select all on this page/i,
		} );
		await user.click( selectAll );

		expect(
			screen.getByText( /\b8 products selected\b/i )
		).toBeInTheDocument();
	} );

	it( 'individual parent clicks select children as soon as that parent is ready, without waiting on siblings', async () => {
		const user = userEvent.setup();
		const qc = new QueryClient( {
			defaultOptions: { queries: { retry: false } },
		} );

		const varA = makeProduct( 10, 'variable', false );
		const varB = makeProduct( 20, 'variable', false );

		useProducts.mockReturnValue( {
			data: {
				data: [ varA, varB ],
				meta: { total: 2, total_pages: 1, page: 1 },
			},
			isLoading: false,
			isFetching: false,
			isError: false,
			refetch: jest.fn(),
		} );

		renderScreen( qc );

		await user.click(
			screen.getByRole( 'checkbox', { name: /select product 10/i } )
		);
		await user.click(
			screen.getByRole( 'checkbox', { name: /select product 20/i } )
		);

		await act( async () => {
			qc.setQueryData(
				[ 'variations', 10 ],
				[
					makeProduct( 101, 'variation' ),
					makeProduct( 102, 'variation' ),
				]
			);
		} );

		expect(
			screen.getByText( /\b4 products selected\b/i )
		).toBeInTheDocument();

		await act( async () => {
			qc.setQueryData(
				[ 'variations', 20 ],
				[
					makeProduct( 201, 'variation' ),
					makeProduct( 202, 'variation' ),
					makeProduct( 203, 'variation' ),
				]
			);
		} );

		expect(
			screen.getByText( /\b7 products selected\b/i )
		).toBeInTheDocument();
	} );

	it( 'grouped product rows are not expandable and their checkbox is disabled', async () => {
		const qc = new QueryClient( {
			defaultOptions: { queries: { retry: false } },
		} );

		const grouped = {
			...makeProduct( 40, 'grouped' ),
			children: [ makeProduct( 41 ), makeProduct( 42 ) ],
		};

		useProducts.mockReturnValue( {
			data: {
				data: [ grouped ],
				meta: { total: 1, total_pages: 1, page: 1 },
			},
			isLoading: false,
			isFetching: false,
			isError: false,
			refetch: jest.fn(),
		} );

		renderScreen( qc );

		expect(
			screen.queryByRole( 'button', { name: /expand variations/i } )
		).not.toBeInTheDocument();

		const checkbox = screen.getByRole( 'checkbox', {
			name: /grouped products can't be bulk edited/i,
		} );
		expect( checkbox ).toBeDisabled();
	} );

	it( 'select-all skips grouped products entirely', async () => {
		const user = userEvent.setup();
		const qc = new QueryClient( {
			defaultOptions: { queries: { retry: false } },
		} );

		const grouped = {
			...makeProduct( 40, 'grouped' ),
			children: [ makeProduct( 41 ), makeProduct( 42 ) ],
		};
		const simple = makeProduct( 30 );

		useProducts.mockReturnValue( {
			data: {
				data: [ grouped, simple ],
				meta: { total: 2, total_pages: 1, page: 1 },
			},
			isLoading: false,
			isFetching: false,
			isError: false,
			refetch: jest.fn(),
		} );

		renderScreen( qc );

		const selectAll = screen.getByRole( 'checkbox', {
			name: /select all on this page/i,
		} );
		await user.click( selectAll );

		expect(
			screen.getByText( /\b1 product(s)? selected\b/i )
		).toBeInTheDocument();
	} );

	it( "selecting a variable parent cascades to its variations, and the parent's own id is included in the count (a variable product can have its own manage_stock flag too)", async () => {
		const user = userEvent.setup();
		const qc = new QueryClient( {
			defaultOptions: { queries: { retry: false } },
		} );

		const varA = {
			...makeProduct( 10, 'variable', false ),
			variations: [
				makeProduct( 101, 'variation' ),
				makeProduct( 102, 'variation' ),
			],
		};

		useProducts.mockReturnValue( {
			data: {
				data: [ varA ],
				meta: { total: 1, total_pages: 1, page: 1 },
			},
			isLoading: false,
			isFetching: false,
			isError: false,
			refetch: jest.fn(),
		} );

		renderScreen( qc );

		await user.click(
			screen.getByRole( 'checkbox', { name: /select product 10/i } )
		);

		expect(
			screen.getByText( /\b3 products selected\b/i )
		).toBeInTheDocument();
	} );
} );
