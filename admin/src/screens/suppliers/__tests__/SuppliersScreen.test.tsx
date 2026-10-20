import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuppliersScreen } from '../SuppliersScreen';
import * as api from '@/lib/api';

jest.mock( '@/lib/api' );

function renderScreen() {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	return render(
		<QueryClientProvider client={ queryClient }>
			<SuppliersScreen />
		</QueryClientProvider>
	);
}

describe( 'SuppliersScreen', () => {
	beforeEach( () => {
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [
				{
					id: 1,
					supplier_code: null,
					name: 'Acme Co',
					contact_name: 'Jo',
					email: 'jo@acme.test',
					phone: null,
					website: null,
					address_line_1: null,
					address_line_2: null,
					city: null,
					state: null,
					postal_code: null,
					country: null,
					currency: 'USD',
					payment_terms: null,
					status: 'active',
					notes: null,
					created_at: '2026-09-24 10:00:00',
					updated_at: '2026-09-24 10:00:00',
				},
			],
			total: 1,
		} );
		( api.getAssignableUsers as jest.Mock ).mockResolvedValue( [
			{ id: 1, name: 'Jane Doe' },
		] );
	} );

	it( 'renders the supplier list', async () => {
		renderScreen();

		expect( await screen.findByText( 'Acme Co' ) ).toBeInTheDocument();
		expect( screen.getByText( 'jo@acme.test' ) ).toBeInTheDocument();
	} );

	it( 'opens the create dialog and submits a new supplier', async () => {
		const user = userEvent.setup();
		( api.createSupplier as jest.Mock ).mockResolvedValue( {
			id: 2,
			name: 'New Supplier',
			status: 'active',
			currency: 'USD',
		} );

		renderScreen();
		await screen.findByText( 'Acme Co' );

		await user.click(
			screen.getByRole( 'button', { name: /add new supplier/i } )
		);
		await user.type( screen.getByLabelText( /^name$/i ), 'New Supplier' );
		await user.click( screen.getByRole( 'button', { name: /^save$/i } ) );

		await waitFor( () =>
			expect( api.createSupplier ).toHaveBeenCalledWith(
				expect.objectContaining( { name: 'New Supplier' } )
			)
		);
	} );

	it( 'opens the products-supplied dialog for a supplier', async () => {
		const user = userEvent.setup();
		( api.getSupplierProductsList as jest.Mock ).mockResolvedValue( {
			items: [],
			total: 0,
		} );

		renderScreen();
		await screen.findByText( 'Acme Co' );

		await user.click(
			screen.getByRole( 'button', {
				name: /view products supplied by acme co/i,
			} )
		);

		expect(
			await screen.findByText( /products supplied by acme co/i )
		).toBeInTheDocument();
	} );
} );
