import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductPicker } from '../ProductPicker';
import { apiGet } from '@/lib/api';

jest.mock( '@/lib/api', () => ( {
	...jest.requireActual( '@/lib/api' ),
	apiGet: jest.fn(),
} ) );

function renderPicker(
	overrides: Partial< React.ComponentProps< typeof ProductPicker > > = {}
) {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	const onSelect = jest.fn();
	render(
		<QueryClientProvider client={ queryClient }>
			<ProductPicker onSelect={ onSelect } { ...overrides } />
		</QueryClientProvider>
	);
	return { onSelect };
}

describe( 'ProductPicker', () => {
	beforeEach( () => {
		( apiGet as jest.Mock ).mockResolvedValue( {
			data: [ { id: 1, name: 'Widget One', sku: 'W-1' } ],
		} );
	} );

	it( 'searches products and selects one', async () => {
		const user = userEvent.setup();
		const { onSelect } = renderPicker();

		await user.click(
			screen.getByRole( 'button', { name: /add a product/i } )
		);
		await user.type( screen.getByPlaceholderText( /search/i ), 'widget' );

		await waitFor( () =>
			expect( apiGet ).toHaveBeenCalledWith(
				'products',
				expect.objectContaining( { search: 'widget' } )
			)
		);
		await user.click( screen.getByText( /widget one/i ) );

		expect( onSelect ).toHaveBeenCalledWith(
			expect.objectContaining( { id: 1, name: 'Widget One' } )
		);
	} );

	it( 'fires the product search when the trigger is opened via keyboard', async () => {
		const user = userEvent.setup();
		renderPicker();

		await user.tab();
		expect(
			screen.getByRole( 'button', { name: /add a product/i } )
		).toHaveFocus();
		await user.keyboard( '{Enter}' );

		await waitFor( () =>
			expect( apiGet ).toHaveBeenCalledWith(
				'products',
				expect.objectContaining( { search: undefined } )
			)
		);
		expect( screen.getByText( /widget one/i ) ).toBeInTheDocument();
	} );

	it( 'shows the full product name, wrapped rather than truncated', async () => {
		const longName =
			'Heavy-duty stainless steel industrial shelving unit with five adjustable shelves';
		( apiGet as jest.Mock ).mockResolvedValue( {
			data: [ { id: 1, name: longName, sku: 'SH-5' } ],
		} );
		const user = userEvent.setup();
		renderPicker();

		await user.click(
			screen.getByRole( 'button', { name: /add a product/i } )
		);
		const label = await screen.findByText( `${ longName } (SH-5)` );

		expect( label.className ).toContain( 'whitespace-normal' );
		expect( label.className ).not.toMatch( /(^|\s)truncate(\s|$)/ );
		expect( screen.queryByRole( 'tooltip' ) ).not.toBeInTheDocument();
	} );

	it( 'excludes already-added product ids', async () => {
		( apiGet as jest.Mock ).mockResolvedValue( {
			data: [
				{ id: 1, name: 'Widget One', sku: 'W-1' },
				{ id: 2, name: 'Widget Two', sku: 'W-2' },
			],
		} );
		const user = userEvent.setup();
		renderPicker( { excludeIds: [ 1 ] } );

		await user.click(
			screen.getByRole( 'button', { name: /add a product/i } )
		);

		await waitFor( () =>
			expect( screen.getByText( /widget two/i ) ).toBeInTheDocument()
		);
		expect( screen.queryByText( /widget one/i ) ).not.toBeInTheDocument();
	} );

	describe( 'variable products', () => {
		const VARIATIONS = [
			{
				id: 11,
				parent_id: 10,
				type: 'variation',
				name: 'Red, L',
				sku: 'TS-RL',
			},
			{
				id: 12,
				parent_id: 10,
				type: 'variation',
				name: 'Blue, M',
				sku: 'TS-BM',
			},
		];

		it( 'lists variations under a non-selectable parent header', async () => {
			( apiGet as jest.Mock ).mockResolvedValue( {
				data: [
					{
						id: 10,
						parent_id: 0,
						type: 'variable',
						name: 'T-shirt',
						sku: 'TS',
						variations: VARIATIONS,
					},
				],
			} );
			const user = userEvent.setup();
			const { onSelect } = renderPicker();

			await user.click(
				screen.getByRole( 'button', { name: /add a product/i } )
			);
			await screen.findByText( 'T-shirt - Red, L (TS-RL)' );
			expect(
				screen.getByText( 'T-shirt - Blue, M (TS-BM)' )
			).toBeInTheDocument();

			await user.click( screen.getByText( 'T-shirt (TS)' ) );
			expect( onSelect ).not.toHaveBeenCalled();

			await user.click( screen.getByText( 'T-shirt - Red, L (TS-RL)' ) );
			expect( onSelect ).toHaveBeenCalledWith(
				expect.objectContaining( { id: 11, name: 'T-shirt - Red, L' } )
			);
		} );

		it( 'highlights the parent header and its variations like the stock table', async () => {
			( apiGet as jest.Mock ).mockResolvedValue( {
				data: [
					{
						id: 10,
						parent_id: 0,
						type: 'variable',
						name: 'T-shirt',
						sku: 'TS',
						variations: VARIATIONS,
					},
				],
			} );
			const user = userEvent.setup();
			renderPicker();

			await user.click(
				screen.getByRole( 'button', { name: /add a product/i } )
			);
			const variation = await screen.findByText(
				'T-shirt - Red, L (TS-RL)'
			);

			expect(
				screen.getByText( 'T-shirt (TS)' ).closest( '[aria-disabled]' )
					?.className
			).toContain( 'bg-info-bg' );
			expect( variation.closest( 'button' )?.className ).toContain(
				'bg-row-child-bg'
			);
			expect( variation.className ).toContain( 'border-l-2' );
		} );

		it( 'excludes already-added variations', async () => {
			( apiGet as jest.Mock ).mockResolvedValue( {
				data: [
					{
						id: 10,
						parent_id: 0,
						type: 'variable',
						name: 'T-shirt',
						sku: 'TS',
						variations: VARIATIONS,
					},
				],
			} );
			const user = userEvent.setup();
			renderPicker( { excludeIds: [ 11 ] } );

			await user.click(
				screen.getByRole( 'button', { name: /add a product/i } )
			);
			await screen.findByText( 'T-shirt - Blue, M (TS-BM)' );
			expect(
				screen.queryByText( 'T-shirt - Red, L (TS-RL)' )
			).not.toBeInTheDocument();
		} );

		it( 'fetches variations that were not embedded in the product list', async () => {
			( apiGet as jest.Mock ).mockImplementation( ( path: string ) =>
				Promise.resolve(
					path === 'products/10/variations'
						? VARIATIONS
						: {
								data: [
									{
										id: 10,
										parent_id: 0,
										type: 'variable',
										name: 'T-shirt',
										sku: 'TS',
									},
								],
						  }
				)
			);
			const user = userEvent.setup();
			renderPicker();

			await user.click(
				screen.getByRole( 'button', { name: /add a product/i } )
			);

			expect(
				await screen.findByText( 'T-shirt - Red, L (TS-RL)' )
			).toBeInTheDocument();
			expect( apiGet ).toHaveBeenCalledWith( 'products/10/variations' );
		} );
	} );
} );
