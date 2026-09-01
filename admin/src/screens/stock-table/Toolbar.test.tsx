import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from './Toolbar';
import type { Product } from '@/types/api';
import type { Table } from '@tanstack/react-table';

jest.mock( './ViewsDropdown', () => ( { ViewsDropdown: () => null } ) );
jest.mock( './ColumnVisibilityDropdown', () => ( {
	ColumnVisibilityDropdown: () => null,
} ) );

type ToolbarProps = React.ComponentProps< typeof Toolbar >;

function baseProps( overrides: Partial< ToolbarProps > = {} ): ToolbarProps {
	return {
		search: '',
		onSearchChange: jest.fn(),
		onSearchClear: jest.fn(),
		isFetching: false,
		isLoading: false,
		activePreset: 'all',
		onSelectPreset: jest.fn(),
		table: {} as Table< Product >,
		stickyHeader: false,
		onToggleStickyHeader: jest.fn(),
		expandableCount: 0,
		allExpanded: false,
		onExpandCollapseAll: jest.fn(),
		categories: [],
		category: 0,
		onCategoryChange: jest.fn(),
		productType: '',
		onProductTypeChange: jest.fn(),
		searchField: '',
		onSearchFieldChange: jest.fn(),
		onClearFilters: jest.fn(),
		onExportClick: jest.fn(),
		...overrides,
	};
}

describe( 'Toolbar — Clear filters placement and behavior', () => {
	it( 'does not render Clear filters when no filters are active', () => {
		render( <Toolbar { ...baseProps() } /> );
		expect(
			screen.queryByRole( 'button', { name: /clear all filters/i } )
		).not.toBeInTheDocument();
	} );

	it( 'renders Clear filters to the left of the search input when a filter is active', () => {
		render( <Toolbar { ...baseProps( { category: 5 } ) } /> );

		const clearButton = screen.getByRole( 'button', {
			name: /clear all filters/i,
		} );
		const searchInput = screen.getByRole( 'textbox', {
			name: /search products/i,
		} );

		const position = clearButton.compareDocumentPosition( searchInput );
		expect( position & Node.DOCUMENT_POSITION_FOLLOWING ).toBeTruthy();
	} );

	it( 'calls onClearFilters when clicked', async () => {
		const user = userEvent.setup();
		const onClearFilters = jest.fn();
		render(
			<Toolbar { ...baseProps( { category: 5, onClearFilters } ) } />
		);

		await user.click(
			screen.getByRole( 'button', { name: /clear all filters/i } )
		);

		expect( onClearFilters ).toHaveBeenCalledTimes( 1 );
	} );
} );
