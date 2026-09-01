import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StockTableScreen } from './StockTableScreen';
import type { Product } from '@/types/api';

jest.mock( './Toolbar', () => ( {
	Toolbar: ( props: {
		search: string;
		onSearchChange: ( val: string ) => void;
		onClearFilters: () => void;
		category: number;
		onCategoryChange: ( val: number ) => void;
		productType: string;
		onProductTypeChange: ( val: string ) => void;
	} ) => {
		const ReactModule = require( 'react' );
		return ReactModule.createElement(
			'div',
			null,
			ReactModule.createElement( 'input', {
				'aria-label': 'Search products',
				value: props.search,
				onChange: ( e: React.ChangeEvent< HTMLInputElement > ) =>
					props.onSearchChange( e.target.value ),
			} ),
			ReactModule.createElement(
				'button',
				{ onClick: () => props.onClearFilters() },
				'Clear filters'
			),
			ReactModule.createElement(
				'button',
				{ onClick: () => props.onCategoryChange( 5 ) },
				'Set category'
			),
			ReactModule.createElement(
				'button',
				{ onClick: () => props.onProductTypeChange( 'simple' ) },
				'Set product type'
			),
			ReactModule.createElement(
				'span',
				{ 'data-testid': 'category-value' },
				String( props.category )
			),
			ReactModule.createElement(
				'span',
				{ 'data-testid': 'product-type-value' },
				props.productType
			)
		);
	},
} ) );
jest.mock( './VariationRows', () => ( { VariationRows: () => null } ) );
jest.mock( './GroupedChildRows', () => ( { GroupedChildRows: () => null } ) );
jest.mock( './ExportDialog', () => ( { ExportDialog: () => null } ) );
jest.mock( '@/components/ui/page-overlay', () => ( {
	PageOverlay: () => null,
} ) );

jest.mock( '@/hooks/useProducts' );
jest.mock( '@/lib/api', () => ( {
	setPrice: jest.fn(),
} ) );
jest.mock( 'sonner', () => ( {
	toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
} ) );
jest.mock( '@/components/ui/date-picker', () => ( {
	DatePicker: ( { placeholder }: { placeholder?: string } ) => {
		const ReactModule = require( 'react' );
		return ReactModule.createElement( 'input', { placeholder } );
	},
} ) );

const { useProducts } = jest.requireMock( '@/hooks/useProducts' ) as {
	useProducts: jest.Mock;
};

function makeProduct( id: number ): Product {
	return {
		id,
		name: `Product ${ id }`,
		sku: `S${ id }`,
		type: 'simple',
		manage_stock: true,
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

describe( 'StockTableScreen — Clear filters', () => {
	beforeEach( () => {
		useProducts.mockReset();
		useProducts.mockReturnValue( {
			data: {
				data: [ makeProduct( 1 ) ],
				meta: { total: 1, total_pages: 1, page: 1 },
			},
			isLoading: false,
			isFetching: false,
			isError: false,
			refetch: jest.fn(),
		} );
	} );

	it( 'Clear filters resets search, category, and product type together', async () => {
		const user = userEvent.setup();
		const qc = new QueryClient( {
			defaultOptions: { queries: { retry: false } },
		} );
		renderScreen( qc );

		await user.type( screen.getByLabelText( 'Search products' ), 'widget' );
		await user.click(
			screen.getByRole( 'button', { name: 'Set category' } )
		);
		await user.click(
			screen.getByRole( 'button', { name: 'Set product type' } )
		);

		await user.click(
			screen.getByRole( 'button', { name: 'Clear filters' } )
		);

		expect( screen.getByLabelText( 'Search products' ) ).toHaveValue( '' );
		expect( screen.getByTestId( 'category-value' ) ).toHaveTextContent(
			'0'
		);
		expect( screen.getByTestId( 'product-type-value' ) ).toHaveTextContent(
			''
		);
	} );
} );
