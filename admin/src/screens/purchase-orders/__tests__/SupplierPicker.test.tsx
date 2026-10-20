import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupplierPicker } from '../SupplierPicker';
import * as api from '@/lib/api';

jest.mock( '@/lib/api', () => ( {
	...jest.requireActual( '@/lib/api' ),
	getSuppliers: jest.fn(),
} ) );

function renderPicker(
	overrides: Partial< React.ComponentProps< typeof SupplierPicker > > = {}
) {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	const onChange = jest.fn();
	render(
		<QueryClientProvider client={ queryClient }>
			<SupplierPicker
				value={ null }
				onChange={ onChange }
				{ ...overrides }
			/>
		</QueryClientProvider>
	);
	return { onChange };
}

describe( 'SupplierPicker', () => {
	beforeEach( () => {
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [
				{ id: 1, name: 'Acme Co' },
				{ id: 2, name: 'Beta Supplies' },
			],
			total: 2,
		} );
	} );

	it( 'shows the placeholder when no supplier is selected', () => {
		renderPicker();
		expect(
			screen.getByRole( 'button', { name: /select a supplier/i } )
		).toBeInTheDocument();
	} );

	// GET /suppliers declares per_page maximum 100; anything higher is a 400.
	it( 'requests suppliers within the route per_page limit', async () => {
		renderPicker();

		await waitFor( () => expect( api.getSuppliers ).toHaveBeenCalled() );
		const params = ( api.getSuppliers as jest.Mock ).mock.calls[ 0 ][ 0 ];
		expect( params ).toEqual(
			expect.objectContaining( { status: 'active', per_page: 100 } )
		);
	} );

	it( 'lists active suppliers and selects one', async () => {
		const user = userEvent.setup();
		const { onChange } = renderPicker();

		await user.click(
			screen.getByRole( 'button', { name: /select a supplier/i } )
		);
		await waitFor( () =>
			expect( screen.getByText( 'Acme Co' ) ).toBeInTheDocument()
		);
		await user.click( screen.getByText( 'Acme Co' ) );

		expect( onChange ).toHaveBeenCalledWith(
			1,
			expect.objectContaining( { id: 1, name: 'Acme Co' } )
		);
		expect( api.getSuppliers ).toHaveBeenCalledWith(
			expect.objectContaining( { status: 'active' } )
		);
	} );
} );
