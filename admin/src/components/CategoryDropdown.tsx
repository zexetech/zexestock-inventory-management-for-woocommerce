import * as React from 'react';
import { SearchDropdown } from './SearchDropdown';
import { decodeHtml } from '@/lib/utils';

export type ZexstCategory = { id: number; slug: string; name: string };

export interface CategoryDropdownProps {
	categories: ZexstCategory[];
	value: number;
	onChange: ( val: number ) => void;
	placeholder?: string;
	includeAllOption?: boolean;
	triggerClassName?: string;
}

// SearchDropdown's items list is what "All categories" (id 0) has to be
// injected into — WooCommerce category ids are always positive, so 0 is a
// safe sentinel for "no filter" without colliding with a real category.
export function CategoryDropdown( {
	categories,
	value,
	onChange,
	placeholder = 'All categories',
	includeAllOption = true,
	triggerClassName = 'gap-1.5',
}: CategoryDropdownProps ) {
	const items = includeAllOption
		? [ { id: 0, slug: '', name: placeholder }, ...categories ]
		: categories;

	return (
		<SearchDropdown< ZexstCategory >
			items={ items }
			getId={ ( c ) => c.id }
			getLabel={ ( c ) => ( c.id === 0 ? c.name : decodeHtml( c.name ) ) }
			value={ value > 0 || ! includeAllOption ? value : 0 }
			onChange={ onChange }
			placeholder={ placeholder }
			emptyMessage="No categories found."
			searchPlaceholder="Search categories…"
			triggerClassName={ triggerClassName }
			panelClassName="w-56"
		/>
	);
}
