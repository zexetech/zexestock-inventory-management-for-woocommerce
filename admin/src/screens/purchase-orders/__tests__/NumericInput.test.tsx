import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumericInput } from '../NumericInput';

function Harness( {
	initial,
	onValueChange,
	integer,
}: {
	initial: number;
	onValueChange: jest.Mock;
	integer?: boolean;
} ) {
	const [ value, setValue ] = React.useState( initial );
	return (
		<NumericInput
			aria-label="Amount"
			min={ 0 }
			max={ 100 }
			integer={ integer }
			value={ value }
			onValueChange={ ( v ) => {
				onValueChange( v );
				setValue( v );
			} }
		/>
	);
}

describe( 'NumericInput', () => {
	it( 'lets a zero value be cleared and retyped', async () => {
		const onValueChange = jest.fn();
		render( <Harness initial={ 0 } onValueChange={ onValueChange } /> );
		const user = userEvent.setup();
		const input = screen.getByLabelText( 'Amount' );

		await user.clear( input );
		expect( input ).toHaveValue( null );
		await user.type( input, '12.5' );

		expect( input ).toHaveValue( 12.5 );
		expect( onValueChange ).toHaveBeenLastCalledWith( 12.5 );
	} );

	it( 'ignores out-of-range and non-integer input', async () => {
		const onValueChange = jest.fn();
		render(
			<Harness initial={ 5 } onValueChange={ onValueChange } integer />
		);
		const user = userEvent.setup();
		const input = screen.getByLabelText( 'Amount' );

		await user.clear( input );
		await user.type( input, '500' );
		expect( onValueChange ).not.toHaveBeenCalledWith( 500 );

		await user.clear( input );
		await user.type( input, '2.5' );
		expect( onValueChange ).not.toHaveBeenCalledWith( 2.5 );
	} );

	it( 'restores the last valid value on blur', async () => {
		const onValueChange = jest.fn();
		render( <Harness initial={ 7 } onValueChange={ onValueChange } /> );
		const user = userEvent.setup();
		const input = screen.getByLabelText( 'Amount' );

		await user.clear( input );
		await user.tab();

		expect( input ).toHaveValue( 7 );
		expect( onValueChange ).not.toHaveBeenCalled();
	} );
} );
