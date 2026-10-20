import * as React from 'react';
import { useSuppliers } from '@/hooks/useSuppliers';
import { SearchDropdown } from '@/components/SearchDropdown';
import type { SuppliersParams } from '@/lib/api';
import type { Supplier } from '@/types/supplier';

// Exported so consumers can read the same cached list instead of issuing a
// second, differently-keyed request.
// 100 is the GET /suppliers per_page maximum; more is a 400.
export const SUPPLIER_PICKER_PARAMS: SuppliersParams = {
	status: 'active',
	per_page: 100,
};

export function SupplierPicker( {
	value,
	onChange,
	placeholder = 'Select a supplier',
}: {
	value: number | null;
	onChange: ( supplierId: number, supplier: Supplier | undefined ) => void;
	placeholder?: string;
} ) {
	// Loads the full active-supplier list rather than a live server search
	// (unlike ProductPicker) — supplier counts are typically small and this
	// matches the pre-existing plain <Select> it replaces, which already
	// loaded the full list via the same useSuppliers({ status: 'active' })
	// call.
	const { data } = useSuppliers( SUPPLIER_PICKER_PARAMS );
	const items = data?.items ?? [];

	return (
		<SearchDropdown< Supplier >
			items={ items }
			getId={ ( s ) => s.id }
			getLabel={ ( s ) => s.name }
			value={ value }
			onChange={ ( id ) =>
				onChange(
					id,
					items.find( ( s ) => s.id === id )
				)
			}
			placeholder={ placeholder }
			emptyMessage="No suppliers found."
			searchPlaceholder="Search suppliers…"
			triggerClassName="w-full justify-between"
			panelClassName="w-64"
		/>
	);
}
