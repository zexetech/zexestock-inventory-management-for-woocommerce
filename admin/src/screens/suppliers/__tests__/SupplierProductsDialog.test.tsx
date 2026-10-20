import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupplierProductsDialog } from '../SupplierProductsDialog';
import * as api from '@/lib/api';

jest.mock( '@/lib/api' );

function renderDialog( supplierId: number | null ) {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	return render(
		<QueryClientProvider client={ queryClient }>
			<SupplierProductsDialog
				open={ true }
				onOpenChange={ jest.fn() }
				supplierId={ supplierId }
				supplierName="Acme Co"
			/>
		</QueryClientProvider>
	);
}

describe( 'SupplierProductsDialog', () => {
	it( 'renders the linked products for the supplier', async () => {
		( api.getSupplierProductsList as jest.Mock ).mockResolvedValue( {
			items: [
				{
					id: 9,
					product_id: 5,
					product_name: 'Widget',
					sku: 'WID-5',
					supplier_sku: 'ACME-5',
					unit_cost: 3.5,
					currency: 'USD',
					lead_time_days: 7,
					minimum_order_qty: 10,
					order_multiple: 5,
					purchase_unit: 'box',
					is_active: true,
					created_at: '2026-09-24 10:00:00',
					updated_at: '2026-09-24 10:00:00',
				},
			],
			total: 1,
		} );

		renderDialog( 2 );

		expect( await screen.findByText( 'Widget' ) ).toBeInTheDocument();
		expect( screen.getByText( 'ACME-5' ) ).toBeInTheDocument();
	} );

	it( 'shows an empty state when the supplier has no linked products', async () => {
		( api.getSupplierProductsList as jest.Mock ).mockResolvedValue( {
			items: [],
			total: 0,
		} );

		renderDialog( 3 );

		expect(
			await screen.findByText( /no products linked/i )
		).toBeInTheDocument();
	} );

	describe( 'managing links', () => {
		const WIDGET_LINK = {
			id: 9,
			product_id: 5,
			product_name: 'Widget',
			sku: 'WID-5',
			supplier_sku: '',
			unit_cost: 0,
			currency: 'USD',
			lead_time_days: null,
			minimum_order_qty: 1,
			order_multiple: 1,
			purchase_unit: null,
			is_active: true,
			created_at: '2026-09-24 10:00:00',
			updated_at: '2026-09-24 10:00:00',
		};

		beforeEach( () => {
			jest.clearAllMocks();
			( api.getSupplierProductsList as jest.Mock ).mockResolvedValue( {
				items: [ WIDGET_LINK ],
				total: 1,
			} );
			( api.apiGet as jest.Mock ).mockResolvedValue( {
				data: [
					{ id: 5, name: 'Widget', sku: 'WID-5' },
					{ id: 6, name: 'Gadget', sku: 'GAD-6' },
				],
			} );
			( api.setProductSupplier as jest.Mock ).mockResolvedValue( {} );
			( api.removeProductSupplier as jest.Mock ).mockResolvedValue( {
				removed: true,
			} );
		} );

		it( 'links a picked product to the supplier and refreshes the list', async () => {
			const user = userEvent.setup();
			renderDialog( 2 );
			await screen.findByText( 'Widget' );

			await user.click(
				screen.getByRole( 'button', { name: /add product/i } )
			);
			await user.click( await screen.findByText( 'Gadget (GAD-6)' ) );

			await waitFor( () =>
				expect( api.setProductSupplier ).toHaveBeenCalledWith( 6, {
					supplier_id: 2,
				} )
			);
			await waitFor( () =>
				expect( api.getSupplierProductsList ).toHaveBeenCalledTimes( 2 )
			);
		} );

		it( 'does not offer products already linked to this supplier', async () => {
			const user = userEvent.setup();
			renderDialog( 2 );
			await screen.findByText( 'Widget' );

			await user.click(
				screen.getByRole( 'button', { name: /add product/i } )
			);

			await screen.findByText( 'Gadget (GAD-6)' );
			expect(
				screen.queryByText( 'Widget (WID-5)' )
			).not.toBeInTheDocument();
		} );

		it( 'removes a linked product and refreshes the list', async () => {
			const user = userEvent.setup();
			renderDialog( 2 );
			await screen.findByText( 'Widget' );

			await user.click(
				screen.getByRole( 'button', { name: /remove widget/i } )
			);

			await waitFor( () =>
				expect( api.removeProductSupplier ).toHaveBeenCalledWith( 5 )
			);
			await waitFor( () =>
				expect( api.getSupplierProductsList ).toHaveBeenCalledTimes( 2 )
			);
		} );
	} );
} );
