import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from '@/components/ui/date-picker';

function Harness( { initial = '' }: { initial?: string } ): JSX.Element {
	const [ v, setV ] = React.useState( initial );
	return <DatePicker value={ v } onChange={ setV } />;
}

describe( 'DatePicker — display', () => {
	it( 'renders placeholder when value is empty', () => {
		render(
			<DatePicker
				value=""
				onChange={ jest.fn() }
				placeholder="Pick a date"
			/>
		);
		expect( screen.getByRole( 'button' ) ).toHaveTextContent(
			'Pick a date'
		);
	} );

	it( 'renders the default placeholder when none provided', () => {
		render( <DatePicker value="" onChange={ jest.fn() } /> );
		expect( screen.getByRole( 'button' ) ).toHaveTextContent(
			'Pick a date'
		);
	} );

	it( 'renders the formatted date for a valid ISO string', () => {
		render( <DatePicker value="2026-05-22" onChange={ jest.fn() } /> );
		expect( screen.getByRole( 'button' ) ).toHaveTextContent(
			'May 22, 2026'
		);
	} );

	it( 'renders placeholder for an invalid date string', () => {
		render( <DatePicker value="not-a-date" onChange={ jest.fn() } /> );
		expect( screen.getByRole( 'button' ) ).toHaveTextContent(
			'Pick a date'
		);
	} );
} );

describe( 'DatePicker — state props', () => {
	it( 'disables the trigger when disabled is set', () => {
		render( <DatePicker value="" onChange={ jest.fn() } disabled /> );
		expect( screen.getByRole( 'button' ) ).toBeDisabled();
	} );

	it( 'adds the info-blue border class when pending is set', () => {
		render( <DatePicker value="" onChange={ jest.fn() } pending /> );
		const trigger = screen.getByRole( 'button' );
		expect( trigger.className ).toMatch( /border-info/ );
	} );

	it( 'omits the info-blue border class when pending is unset', () => {
		render( <DatePicker value="" onChange={ jest.fn() } /> );
		expect( screen.getByRole( 'button' ).className ).not.toMatch(
			/border-info/
		);
	} );
} );

describe( 'DatePicker — interaction', () => {
	it( 'opens the calendar popover when the trigger is clicked', async () => {
		const user = userEvent.setup();
		render( <DatePicker value="2026-05-22" onChange={ jest.fn() } /> );
		await user.click( screen.getByRole( 'button' ) );
		expect( await screen.findByRole( 'grid' ) ).toBeInTheDocument();
	} );

	it( 'closes the popover and emits a YYYY-MM-DD string when a day is selected', async () => {
		const user = userEvent.setup();
		const onChange = jest.fn();
		render( <DatePicker value="2026-05-22" onChange={ onChange } /> );
		await user.click( screen.getByRole( 'button' ) );

		const grid = await screen.findByRole( 'grid' );
		const dayButtons = within( grid )
			.getAllByRole( 'gridcell' )
			.filter( ( b ) => /^\d+$/.test( ( b.textContent ?? '' ).trim() ) );
		expect( dayButtons.length ).toBeGreaterThan( 0 );

		await user.click( dayButtons[ 0 ] );

		expect( onChange ).toHaveBeenCalledTimes( 1 );
		expect( onChange.mock.calls[ 0 ][ 0 ] ).toMatch(
			/^\d{4}-\d{2}-\d{2}$/
		);
		expect( screen.queryByRole( 'grid' ) ).not.toBeInTheDocument();
	} );

	it( 'round-trips through a controlled wrapper (selecting updates the trigger label)', async () => {
		const user = userEvent.setup();
		render( <Harness initial="2026-05-22" /> );
		await user.click( screen.getByRole( 'button' ) );

		const grid = await screen.findByRole( 'grid' );
		const dayButtons = within( grid )
			.getAllByRole( 'gridcell' )
			.filter( ( b ) => /^\d+$/.test( ( b.textContent ?? '' ).trim() ) );
		await user.click( dayButtons[ 0 ] );

		expect( screen.getByRole( 'button' ) ).not.toHaveTextContent(
			'Pick a date'
		);
		expect( screen.getByRole( 'button' ).textContent ).toMatch(
			/\w{3}\s+\d{1,2},\s+\d{4}/
		);
	} );
} );
