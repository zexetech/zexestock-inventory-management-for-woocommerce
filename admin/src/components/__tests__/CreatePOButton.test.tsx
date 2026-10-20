import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreatePOButton } from '../CreatePOButton';
import * as api from '@/lib/api';
import type { Product } from '@/types/api';

jest.mock( '@/lib/api' );

const PRODUCT: Product = {
	id: 9,
	parent_id: 0,
	type: 'simple',
	name: 'Widget',
	sku: 'W-9',
	image_url: '',
	stock_qty: 2,
	stock_status: 'low_stock',
	category: '',
	manage_stock: true,
	regular_price: '10.00',
	sale_price: null,
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

function renderButton() {
	const queryClient = new QueryClient( {
		defaultOptions: { queries: { retry: false } },
	} );
	render(
		<QueryClientProvider client={ queryClient }>
			<CreatePOButton product={ PRODUCT } />
		</QueryClientProvider>
	);
}

describe( 'CreatePOButton', () => {
	it( 'renders a disabled button when the product has no active supplier', async () => {
		( api.getProductSupplier as jest.Mock ).mockResolvedValue( null );
		renderButton();

		expect(
			await screen.findByRole( 'button', { name: /create po/i } )
		).toBeDisabled();
	} );

	it( 'opens the dialog pre-filled with the triggering product and its low-stock siblings', async () => {
		( api.getProductSupplier as jest.Mock ).mockResolvedValue( {
			id: 1,
			supplier_id: 2,
			supplier_name: 'Acme Co',
			product_id: 9,
			supplier_sku: 'ACME-9',
			unit_cost: 3.5,
			currency: 'USD',
			lead_time_days: 7,
			minimum_order_qty: null,
			order_multiple: 5,
			purchase_unit: null,
			is_active: true,
			notes: null,
			created_at: '2026-09-24 10:00:00',
			updated_at: '2026-09-24 10:00:00',
		} );
		( api.getSupplierProductsList as jest.Mock ).mockResolvedValue( {
			items: [],
			total: 0,
		} );
		( api.getLowStockSupplierProducts as jest.Mock ).mockResolvedValue( {
			items: [
				{
					product_id: 11,
					product_name: 'Gizmo',
					sku: 'G-11',
					stock_qty: 1,
					threshold: 10,
					supplier_sku: null,
					unit_cost: 2,
					currency: 'USD',
					lead_time_days: null,
					minimum_order_qty: null,
					order_multiple: null,
					purchase_unit: null,
				},
			],
		} );
		( api.getSuppliers as jest.Mock ).mockResolvedValue( {
			items: [ { id: 2, name: 'Acme Co', status: 'active' } ],
			total: 1,
		} );
		( api.getNextPONumber as jest.Mock ).mockResolvedValue( {
			po_number: '000001',
		} );
		( api.checkPONumberAvailable as jest.Mock ).mockResolvedValue( {
			available: true,
		} );

		renderButton();
		const user = userEvent.setup();

		await user.click(
			await screen.findByRole( 'button', { name: /create po/i } )
		);

		expect( await screen.findByText( 'Widget' ) ).toBeInTheDocument();
		expect( await screen.findByText( 'Gizmo' ) ).toBeInTheDocument();

		await waitFor( () =>
			expect( api.getLowStockSupplierProducts ).toHaveBeenCalledWith(
				2,
				9
			)
		);
	} );
} );
