import * as React from 'react';
import { ColumnsIcon, ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Table } from '@tanstack/react-table';
import type { Product } from '@/types/api';

const COLUMN_LABELS: Record< string, string > = {
	select: 'Select',
	image: 'Image',
	name: 'Product Name',
	sku: 'SKU',
	type: 'Product Type',
	stock_qty: 'Stock',
	stock_status: 'Status',
	regular_price: 'Regular Price',
	sale_price: 'Sale Price',
	category: 'Category',
	reserved_qty: 'Reserved Stock',
	sold_today: 'Sold Today',
	sold_last_14_days: 'Sold (14 Days)',
	low_stock_threshold_override: 'Low Stock Threshold',
	purchase_price: 'Purchase Price',
	supplier_sku: 'Supplier SKU',
	barcode: 'Barcode',
};

const PINNED = new Set< string >( [ 'name' ] );

interface ColumnVisibilityDropdownProps {
	table: Table< Product >;
}

export function ColumnVisibilityDropdown( {
	table,
}: ColumnVisibilityDropdownProps ) {
	const toggleableColumns = table
		.getAllColumns()
		.filter( ( col ) => col.getCanHide() && ! PINNED.has( col.id ) );

	const allVisible = toggleableColumns.every( ( col ) => col.getIsVisible() );

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="gap-1.5">
					<ColumnsIcon className="h-4 w-4" />
					Columns
					<ChevronDownIcon className="h-3 w-3 opacity-60" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end" className="w-48 p-1">
				<DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
					Show / Hide Columns
				</DropdownMenuLabel>

				<div className="max-h-[min(50vh,16rem)] overflow-y-auto">
					{ toggleableColumns.map( ( col ) => (
						<label
							key={ col.id }
							htmlFor={ `column-toggle-${ col.id }` }
							className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm select-none"
						>
							<Checkbox
								id={ `column-toggle-${ col.id }` }
								checked={ col.getIsVisible() }
								onCheckedChange={ ( checked ) =>
									col.toggleVisibility( !! checked )
								}
							/>
							{ COLUMN_LABELS[ col.id ] ?? col.id }
						</label>
					) ) }
				</div>

				<DropdownMenuSeparator />

				<label
					htmlFor="column-toggle-all"
					className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm select-none text-muted-foreground"
				>
					<Checkbox
						id="column-toggle-all"
						checked={ allVisible }
						onCheckedChange={ ( checked ) =>
							toggleableColumns.forEach( ( col ) =>
								col.toggleVisibility( !! checked )
							)
						}
					/>
					{ allVisible ? 'Hide all' : 'Select all' }
				</label>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
