import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryDropdown } from './CategoryDropdown';
import type { ZexstCategory } from './CategoryDropdown';

const CATEGORIES: ZexstCategory[] = [
	{ id: 1, slug: 'shirts', name: 'Shirts' },
	{ id: 2, slug: 'pants', name: 'Pants' },
	{ id: 3, slug: 'shoes', name: 'Shoes' },
];

function renderDropdown(
	overrides: Partial< React.ComponentProps< typeof CategoryDropdown > > = {}
) {
	const onChange = jest.fn();
	render(
		<CategoryDropdown
			categories={ CATEGORIES }
			value={ 0 }
			onChange={ onChange }
			{ ...overrides }
		/>
	);
	return { onChange };
}

describe( 'CategoryDropdown', () => {
	it( 'shows the default placeholder when no category is selected', () => {
		renderDropdown();
		expect(
			screen.getByRole( 'button', { name: /all categories/i } )
		).toBeInTheDocument();
	} );

	it( 'shows the selected category name on the trigger', () => {
		renderDropdown( { value: 2 } );
		expect(
			screen.getByRole( 'button', { name: /pants/i } )
		).toBeInTheDocument();
	} );

	it( 'uses a custom placeholder when provided and nothing is selected', () => {
		renderDropdown( { placeholder: 'Select…', includeAllOption: false } );
		expect(
			screen.getByRole( 'button', { name: 'Select…' } )
		).toBeInTheDocument();
	} );

	it( 'autofocuses the search input when opened', async () => {
		const user = userEvent.setup();
		renderDropdown();

		await user.click(
			screen.getByRole( 'button', { name: /all categories/i } )
		);

		expect(
			screen.getByPlaceholderText( /search categories/i )
		).toHaveFocus();
	} );

	it( 'filters the category list as the user types', async () => {
		const user = userEvent.setup();
		renderDropdown();

		await user.click(
			screen.getByRole( 'button', { name: /all categories/i } )
		);
		await user.type(
			screen.getByPlaceholderText( /search categories/i ),
			'sho'
		);

		expect( screen.getByText( 'Shoes' ) ).toBeInTheDocument();
		expect( screen.queryByText( 'Shirts' ) ).not.toBeInTheDocument();
		expect( screen.queryByText( 'Pants' ) ).not.toBeInTheDocument();
	} );

	it( 'shows "No categories found." when the search matches nothing', async () => {
		const user = userEvent.setup();
		renderDropdown();

		await user.click(
			screen.getByRole( 'button', { name: /all categories/i } )
		);
		await user.type(
			screen.getByPlaceholderText( /search categories/i ),
			'zzz'
		);

		expect(
			screen.getByText( 'No categories found.' )
		).toBeInTheDocument();
	} );

	it( 'calls onChange with the category id and closes the dropdown when an item is clicked', async () => {
		const user = userEvent.setup();
		const { onChange } = renderDropdown();

		await user.click(
			screen.getByRole( 'button', { name: /all categories/i } )
		);
		await user.click( screen.getByText( 'Shoes' ) );

		expect( onChange ).toHaveBeenCalledWith( 3 );
		expect(
			screen.queryByPlaceholderText( /search categories/i )
		).not.toBeInTheDocument();
	} );

	it( 'shows a checkmark next to the currently selected category and not next to the others', async () => {
		const user = userEvent.setup();
		renderDropdown( { value: 2 } );

		await user.click( screen.getByRole( 'button', { name: /pants/i } ) );

		const dropdownButtons = screen
			.getAllByRole( 'button' )
			.filter( ( btn ) => ! btn.hasAttribute( 'aria-haspopup' ) );
		const pantsBtn = dropdownButtons.find(
			( btn ) => btn.textContent?.includes( 'Pants' )
		);
		const shirtsBtn = dropdownButtons.find(
			( btn ) => btn.textContent?.includes( 'Shirts' )
		);

		const pantsCheck = pantsBtn?.querySelector( 'svg' );
		const shirtsCheck = shirtsBtn?.querySelector( 'svg' );

		expect( pantsCheck ).toHaveClass( 'opacity-100' );
		expect( shirtsCheck ).toHaveClass( 'opacity-0' );
	} );

	it( 'omits the "All categories" row when includeAllOption is false', async () => {
		const user = userEvent.setup();
		renderDropdown( { includeAllOption: false, placeholder: 'Select…' } );

		await user.click( screen.getByRole( 'button', { name: 'Select…' } ) );

		expect(
			screen.queryByText( 'All categories' )
		).not.toBeInTheDocument();
	} );

	it( 'hides the "All categories" row once a search term is entered', async () => {
		const user = userEvent.setup();
		renderDropdown();

		await user.click(
			screen.getByRole( 'button', { name: /all categories/i } )
		);
		const allCatsButtons = screen
			.getAllByRole( 'button' )
			.filter(
				( btn ) =>
					! btn.hasAttribute( 'aria-haspopup' ) &&
					btn.textContent?.includes( 'All categories' )
			);
		expect( allCatsButtons.length ).toBeGreaterThan( 0 );

		await user.type(
			screen.getByPlaceholderText( /search categories/i ),
			'sho'
		);
		const allCatsButtonsAfterSearch = screen
			.queryAllByRole( 'button' )
			.filter(
				( btn ) =>
					! btn.hasAttribute( 'aria-haspopup' ) &&
					btn.textContent?.includes( 'All categories' )
			);
		expect( allCatsButtonsAfterSearch.length ).toBe( 0 );
	} );
} );
