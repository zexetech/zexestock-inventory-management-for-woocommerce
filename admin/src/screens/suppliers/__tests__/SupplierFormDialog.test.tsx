import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupplierFormDialog } from '../SupplierFormDialog';
import * as api from '@/lib/api';

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

describe( 'SupplierFormDialog enrichment fields', () => {
	beforeEach( () => {
		( api.getAssignableUsers as jest.Mock ).mockResolvedValue( [
			{ id: 1, name: 'Jane Doe' },
		] );
	} );

	it( 'submits the new fields entered by the user', async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderDialog();

		await user.type( screen.getByLabelText( /^name$/i ), 'Acme' );
		await user.type( screen.getByLabelText( /tax number/i ), 'TAX-1' );
		await user.type( screen.getByLabelText( /discount %/i ), '10' );
		await user.click( screen.getByRole( 'button', { name: /save/i } ) );

		expect( onSubmit ).toHaveBeenCalledWith(
			expect.objectContaining( {
				name: 'Acme',
				tax_number: 'TAX-1',
				discount_percent: 10,
			} )
		);
	} );

	it( 'adds and removes a custom field row', async () => {
		const user = userEvent.setup();
		renderDialog();

		await user.click(
			screen.getByRole( 'button', { name: /add custom field/i } )
		);
		expect(
			document.getElementById( 'supplier-custom-field-0-label' )
		).toBeInTheDocument();

		await user.click(
			screen.getByRole( 'button', { name: /remove custom field 1/i } )
		);
		expect(
			document.getElementById( 'supplier-custom-field-0-label' )
		).not.toBeInTheDocument();
	} );
} );
