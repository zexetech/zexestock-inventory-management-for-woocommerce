import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchDropdown } from './SearchDropdown';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';

interface Item {
	id: number;
	name: string;
}

const ITEMS: Item[] = [
	{ id: 1, name: 'Alpha' },
	{ id: 2, name: 'Beta' },
	{ id: 3, name: 'Gamma' },
];

function renderDropdown(
	overrides: Partial<
		React.ComponentProps< typeof SearchDropdown< Item > >
	> = {}
) {
	const onChange = jest.fn();
	render(
		<SearchDropdown< Item >
			items={ ITEMS }
			getId={ ( i ) => i.id }
			getLabel={ ( i ) => i.name }
			value={ null }
			onChange={ onChange }
			placeholder="Choose…"
			{ ...overrides }
		/>
	);
	return { onChange };
}

describe( 'SearchDropdown', () => {
	it( 'shows the placeholder when nothing is selected', () => {
		renderDropdown();
		expect(
			screen.getByRole( 'button', { name: 'Choose…' } )
		).toBeInTheDocument();
	} );

	it( 'shows the selected item label on the trigger', () => {
		renderDropdown( { value: 2 } );
		expect(
			screen.getByRole( 'button', { name: /beta/i } )
		).toBeInTheDocument();
	} );

	it( 'filters items by search text', async () => {
		const user = userEvent.setup();
		renderDropdown();

		await user.click( screen.getByRole( 'button', { name: 'Choose…' } ) );
		await user.type( screen.getByPlaceholderText( /search/i ), 'ga' );

		expect( screen.getByText( 'Gamma' ) ).toBeInTheDocument();
		expect( screen.queryByText( 'Alpha' ) ).not.toBeInTheDocument();
	} );

	it( 'calls onChange with the item id and closes on selection', async () => {
		const user = userEvent.setup();
		const { onChange } = renderDropdown();

		await user.click( screen.getByRole( 'button', { name: 'Choose…' } ) );
		await user.click( screen.getByText( 'Gamma' ) );

		expect( onChange ).toHaveBeenCalledWith( 3 );
		expect(
			screen.queryByPlaceholderText( /search/i )
		).not.toBeInTheDocument();
	} );

	it( 'shows a fallback message when no items match', async () => {
		const user = userEvent.setup();
		renderDropdown( { emptyMessage: 'Nothing found.' } );

		await user.click( screen.getByRole( 'button', { name: 'Choose…' } ) );
		await user.type( screen.getByPlaceholderText( /search/i ), 'zzz' );

		expect( screen.getByText( 'Nothing found.' ) ).toBeInTheDocument();
	} );
	it( 'resets the caller search via onSearchChange when it closes', async () => {
		const user = userEvent.setup();
		const onSearchChange = jest.fn();
		renderDropdown( { onSearchChange } );

		await user.click( screen.getByRole( 'button', { name: 'Choose…' } ) );
		await user.type( screen.getByPlaceholderText( /search/i ), 'ga' );
		expect( onSearchChange ).toHaveBeenLastCalledWith( 'ga' );

		await user.keyboard( '{Escape}' );

		expect(
			screen.queryByPlaceholderText( /search/i )
		).not.toBeInTheDocument();
		expect( onSearchChange ).toHaveBeenLastCalledWith( '' );
	} );

	it( 'resets the caller search via onSearchChange after a selection', async () => {
		const user = userEvent.setup();
		const onSearchChange = jest.fn();
		renderDropdown( { onSearchChange } );

		await user.click( screen.getByRole( 'button', { name: 'Choose…' } ) );
		await user.type( screen.getByPlaceholderText( /search/i ), 'ga' );
		await user.click( screen.getByText( 'Gamma' ) );

		expect( onSearchChange ).toHaveBeenLastCalledWith( '' );
	} );

	// A non-modal popover portaled to <body> sits outside a Dialog's scroll
	// lock, so wheel events over its list are swallowed. A modal popover
	// installs its own scroll lock (and hides siblings from AT) while open.
	it( 'opens as a modal popover so its list can scroll inside dialogs', async () => {
		const user = userEvent.setup();
		render(
			<>
				<div data-testid="outside">Outside</div>
				<SearchDropdown< Item >
					items={ ITEMS }
					getId={ ( i ) => i.id }
					getLabel={ ( i ) => i.name }
					value={ null }
					onChange={ jest.fn() }
					placeholder="Choose…"
				/>
			</>
		);

		expect( document.body ).not.toHaveAttribute( 'data-scroll-locked' );
		await user.click( screen.getByRole( 'button', { name: 'Choose…' } ) );

		expect( document.body ).toHaveAttribute( 'data-scroll-locked' );
		expect(
			screen.getByTestId( 'outside' ).closest( '[aria-hidden="true"]' )
		).not.toBeNull();
	} );

	// Radix's modal Dialog disables pointer events on <body> and traps focus
	// inside its content, so a panel portaled outside the dialog would be
	// unclickable and lose focus in a real browser.
	it( 'is searchable and selectable when rendered inside a modal dialog', async () => {
		const user = userEvent.setup();
		const onChange = jest.fn();
		render(
			<Dialog open>
				<DialogContent aria-describedby={ undefined }>
					<DialogTitle>Test dialog</DialogTitle>
					<SearchDropdown< Item >
						items={ ITEMS }
						getId={ ( i ) => i.id }
						getLabel={ ( i ) => i.name }
						value={ null }
						onChange={ onChange }
						placeholder="Choose…"
					/>
				</DialogContent>
			</Dialog>
		);

		await user.click( screen.getByRole( 'button', { name: 'Choose…' } ) );
		await user.type( screen.getByPlaceholderText( /search/i ), 'ga' );
		expect( screen.queryByText( 'Alpha' ) ).not.toBeInTheDocument();
		await user.click( screen.getByText( 'Gamma' ) );

		expect( onChange ).toHaveBeenCalledWith( 3 );
	} );

	it( 'supports string ids', async () => {
		const user = userEvent.setup();
		const onChange = jest.fn();
		render(
			<SearchDropdown< { code: string; name: string }, string >
				items={ [
					{ code: 'EUR', name: 'Euro' },
					{ code: 'USD', name: 'US dollar' },
				] }
				getId={ ( c ) => c.code }
				getLabel={ ( c ) => c.name }
				value="USD"
				onChange={ onChange }
			/>
		);

		await user.click(
			screen.getByRole( 'button', { name: /us dollar/i } )
		);
		await user.click( screen.getByText( 'Euro' ) );

		expect( onChange ).toHaveBeenCalledWith( 'EUR' );
	} );

	it( 'offers a clear entry that calls onClear', async () => {
		const user = userEvent.setup();
		const onClear = jest.fn();
		const { onChange } = renderDropdown( {
			value: 2,
			clearOption: { label: 'Unassigned', onClear },
		} );

		await user.click( screen.getByRole( 'button', { name: /beta/i } ) );
		await user.click(
			screen.getByRole( 'button', { name: 'Unassigned' } )
		);

		expect( onClear ).toHaveBeenCalledTimes( 1 );
		expect( onChange ).not.toHaveBeenCalled();
		expect(
			screen.queryByPlaceholderText( /search/i )
		).not.toBeInTheDocument();
	} );

	it( 'renders disabled items as non-selectable headers', async () => {
		const user = userEvent.setup();
		const { onChange } = renderDropdown( {
			isItemDisabled: ( i ) => i.id === 1,
		} );

		await user.click( screen.getByRole( 'button', { name: 'Choose…' } ) );

		expect(
			screen.queryByRole( 'button', { name: /alpha/i } )
		).not.toBeInTheDocument();
		await user.click( screen.getByText( 'Alpha' ) );
		expect( onChange ).not.toHaveBeenCalled();
		expect( screen.getByPlaceholderText( /search/i ) ).toBeInTheDocument();
	} );

	it( 'indents disabled headers by the check-icon width so they align with items', async () => {
		const user = userEvent.setup();
		renderDropdown( { isItemDisabled: ( i ) => i.id === 1 } );

		await user.click( screen.getByRole( 'button', { name: 'Choose…' } ) );

		const header = screen.getByText( 'Alpha' ).closest( '[aria-disabled]' );
		const spacer = header?.firstElementChild;
		expect( spacer?.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		expect( spacer?.className ).toMatch( /\bw-3\.5\b/ );
	} );

	it( 'applies per-item classes from getItemClassName', async () => {
		const user = userEvent.setup();
		renderDropdown( {
			isItemDisabled: ( i ) => i.id === 1,
			getItemClassName: ( i ) => ( i.id === 1 ? 'is-header' : 'is-row' ),
		} );

		await user.click( screen.getByRole( 'button', { name: 'Choose…' } ) );

		expect(
			screen.getByText( 'Alpha' ).closest( '[aria-disabled]' )?.className
		).toContain( 'is-header' );
		expect(
			screen.getByRole( 'button', { name: /beta/i } ).className
		).toContain( 'is-row' );
	} );

	it( 'keeps a long list in a scrollable panel', async () => {
		const user = userEvent.setup();
		const many = Array.from( { length: 250 }, ( _, i ) => ( {
			id: i + 1,
			name: `Item ${ i + 1 }`,
		} ) );
		renderDropdown( { items: many } );

		await user.click( screen.getByRole( 'button', { name: 'Choose…' } ) );

		const last = screen.getByText( 'Item 250' );
		const list = last.closest( '.overflow-y-auto' );
		expect( list ).not.toBeNull();
		expect( list?.className ).toMatch( /max-h-/ );
		expect( list?.querySelectorAll( 'button' ) ).toHaveLength( 250 );
	} );
} );
