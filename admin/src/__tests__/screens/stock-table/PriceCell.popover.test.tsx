import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PriceCell } from '@/screens/stock-table/PriceCell';

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

function renderPopover(
	qc: QueryClient,
	props: Partial< React.ComponentProps< typeof PriceCell > > = {}
) {
	return render(
		<QueryClientProvider client={ qc }>
			<PriceCell
				productId={ 1 }
				productName="P1"
				field="sale_price"
				value="19.99"
				dateFromValue={ null }
				dateToValue={ null }
				{ ...props }
			/>
		</QueryClientProvider>
	);
}

describe( 'PriceCell — popover sale-date sync on reopen', () => {
	it( 'reflects updated dateFromValue/dateToValue props when reopened after an external update', () => {
		const qc = new QueryClient( {
			defaultOptions: { queries: { retry: false } },
		} );
		const { rerender } = renderPopover( qc );

		fireEvent.click(
			screen.getByRole( 'button', { name: /Edit Sale Price for P1/i } )
		);
		expect(
			( screen.getByPlaceholderText( 'Start date' ) as HTMLInputElement )
				.value
		).toBe( '' );
		expect(
			( screen.getByPlaceholderText( 'End date' ) as HTMLInputElement )
				.value
		).toBe( '' );

		fireEvent.keyDown( screen.getByLabelText( 'New Sale Price' ), {
			key: 'Escape',
		} );

		rerender(
			<QueryClientProvider client={ qc }>
				<PriceCell
					productId={ 1 }
					productName="P1"
					field="sale_price"
					value="19.99"
					dateFromValue="2026-07-01"
					dateToValue="2026-07-10"
				/>
			</QueryClientProvider>
		);

		fireEvent.click(
			screen.getByRole( 'button', { name: /Edit Sale Price for P1/i } )
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
