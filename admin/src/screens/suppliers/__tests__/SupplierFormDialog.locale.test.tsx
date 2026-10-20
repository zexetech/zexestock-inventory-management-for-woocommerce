import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupplierFormDialog } from '../SupplierFormDialog';
import * as api from '@/lib/api';
import type { Supplier } from '@/types/supplier';

jest.mock( '@/lib/api', () => ( {
	...jest.requireActual( '@/lib/api' ),
	getAssignableUsers: jest.fn(),
} ) );

function renderDialog(
	overrides: Partial< React.ComponentProps< typeof SupplierFormDialog > > = {}
) {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	const onSubmit = jest.fn();
	render(
		<QueryClientProvider client={ queryClient }>
			<SupplierFormDialog
				open
				onOpenChange={ jest.fn() }
				supplier={ null }
				onSubmit={ onSubmit }
				isSaving={ false }
				{ ...overrides }
			/>
		</QueryClientProvider>
	);
	return { onSubmit };
}

const EXISTING = {
	id: 7,
	name: 'Acme',
	status: 'active',
	country: 'United States',
	currency: 'USD',
	assigned_user_id: 1,
} as unknown as Supplier;

describe( 'SupplierFormDialog WooCommerce country/currency pickers', () => {
	const original = window.zexstData;

	beforeEach( () => {
		( api.getAssignableUsers as jest.Mock ).mockResolvedValue( [
			{ id: 1, name: 'Jane Doe' },
		] );
		window.zexstData = {
			...original,
			countries: {
				US: 'United States (US)',
				DE: 'Germany',
				FR: 'France',
			},
			currencies: { USD: 'United States (US) dollar', EUR: 'Euro' },
		};
	} );

	afterEach( () => {
		window.zexstData = original;
	} );

	it( 'stores the picked country by name and the currency by code', async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderDialog();

		await user.type( screen.getByLabelText( /^name$/i ), 'Acme' );

		await user.click( screen.getByLabelText( /^country$/i ) );
		await user.type(
			screen.getByPlaceholderText( /search countries/i ),
			'germ'
		);
		expect( screen.queryByText( 'France' ) ).not.toBeInTheDocument();
		await user.click( screen.getByText( 'Germany' ) );

		await user.click( screen.getByLabelText( /^currency$/i ) );
		await user.type(
			screen.getByPlaceholderText( /search currencies/i ),
			'euro'
		);
		await user.click( screen.getByText( /EUR — Euro/ ) );

		await user.click( screen.getByRole( 'button', { name: /save/i } ) );

		expect( onSubmit ).toHaveBeenCalledWith(
			expect.objectContaining( { country: 'Germany', currency: 'EUR' } )
		);
	} );

	it( 'keeps a stored country that is not in the WooCommerce list', async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderDialog( { supplier: EXISTING } );

		expect( screen.getByLabelText( /^country$/i ) ).toHaveTextContent(
			'United States'
		);
		await user.click( screen.getByRole( 'button', { name: /save/i } ) );

		expect( onSubmit ).toHaveBeenCalledWith(
			expect.objectContaining( {
				country: 'United States',
				currency: 'USD',
			} )
		);
	} );

	it( 'clears the country via the Unspecified entry', async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderDialog( { supplier: EXISTING } );

		await user.click( screen.getByLabelText( /^country$/i ) );
		await user.click(
			screen.getByRole( 'button', { name: 'Unspecified' } )
		);
		await user.click( screen.getByRole( 'button', { name: /save/i } ) );

		expect( onSubmit ).toHaveBeenCalledWith(
			expect.objectContaining( { country: '' } )
		);
	} );

	it( 'can unassign the assigned user', async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderDialog( { supplier: EXISTING } );

		await screen.findByText( 'Jane Doe' );
		await user.click( screen.getByLabelText( /^assigned to$/i ) );
		await user.click(
			screen.getByRole( 'button', { name: 'Unassigned' } )
		);
		await user.click( screen.getByRole( 'button', { name: /save/i } ) );

		expect( onSubmit ).toHaveBeenCalledWith(
			expect.objectContaining( { assigned_user_id: null } )
		);
	} );

	it( 'lists every WooCommerce country in a scrollable panel', async () => {
		const user = userEvent.setup();
		const countries: Record< string, string > = {};
		for ( let i = 0; i < 250; i++ ) {
			countries[ `C${ i }` ] = `Country ${ String( i ).padStart(
				3,
				'0'
			) }`;
		}
		window.zexstData = { ...window.zexstData, countries };
		renderDialog();

		await user.click( screen.getByLabelText( /^country$/i ) );
		const list = screen
			.getByText( 'Country 249' )
			.closest( '.overflow-y-auto' );
		expect( list?.className ).toMatch( /max-h-/ );
		// 250 countries plus the Unspecified entry.
		expect( list?.querySelectorAll( 'button' ) ).toHaveLength( 251 );
	} );
} );
