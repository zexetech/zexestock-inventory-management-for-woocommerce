import * as React from 'react';
import {
	SearchIcon,
	PinIcon,
	ChevronsUpDown,
	ChevronsDownUp,
	X,
	List,
	Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { ViewsDropdown } from './ViewsDropdown';
import { ColumnVisibilityDropdown } from './ColumnVisibilityDropdown';
import {
	CategoryDropdown,
	type ZexstCategory,
} from '@/components/CategoryDropdown';
import type { Table } from '@tanstack/react-table';
import type { Product } from '@/types/api';
import type { ViewPreset } from '@/types/filters';

interface ToolbarProps {
	search: string;
	onSearchChange: ( val: string ) => void;
	onSearchClear: () => void;
	isFetching: boolean;
	isLoading: boolean;
	activePreset: string;
	onSelectPreset: ( preset: ViewPreset ) => void;
	table: Table< Product >;
	stickyHeader: boolean;
	onToggleStickyHeader: () => void;
	expandableCount: number;
	allExpanded: boolean;
	onExpandCollapseAll: () => void;
	categories: ZexstCategory[];
	category: number;
	onCategoryChange: ( val: number ) => void;
	productType: string;
	onProductTypeChange: ( val: string ) => void;
	searchField: string;
	onSearchFieldChange: ( val: string ) => void;
	onClearFilters: () => void;
	onExportClick: () => void;
}

export function Toolbar( {
	search,
	onSearchChange,
	onSearchClear,
	isFetching,
	isLoading,
	activePreset,
	onSelectPreset,
	table,
	stickyHeader,
	onToggleStickyHeader,
	expandableCount,
	allExpanded,
	onExpandCollapseAll,
	categories,
	category,
	onCategoryChange,
	productType,
	onProductTypeChange,
	searchField,
	onSearchFieldChange,
	onClearFilters,
	onExportClick,
}: ToolbarProps ) {
	const searchRef = React.useRef< HTMLInputElement >( null );

	React.useEffect( () => {
		function onKeyDown( e: KeyboardEvent ) {
			if (
				e.key === '/' &&
				! ( e.target instanceof HTMLInputElement ) &&
				! ( e.target instanceof HTMLTextAreaElement )
			) {
				e.preventDefault();
				searchRef.current?.focus();
			}
		}
		document.addEventListener( 'keydown', onKeyDown );
		return () => document.removeEventListener( 'keydown', onKeyDown );
	}, [] );

	let searchPlaceholder: string;
	if (
		searchField === 'regular_price' ||
		searchField === 'sale_price' ||
		searchField === 'purchase_price'
	) {
		searchPlaceholder = 'e.g. 19.99';
	} else if ( searchField === 'stock' ) {
		searchPlaceholder = 'e.g. 0';
	} else {
		searchPlaceholder = 'Search products…';
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-end gap-2">
				{ ( productType !== '' || category !== 0 ) && (
					<Button
						variant="default"
						size="sm"
						onClick={ onClearFilters }
						className="gap-1.5"
						aria-label="Clear all filters"
					>
						<X className="h-3.5 w-3.5" />
						Clear filters
					</Button>
				) }

				<div className="flex items-center gap-0">
					{ isFetching && ! isLoading && (
						<div
							className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0"
							aria-label="Loading"
						/>
					) }

					<Select
						value={ searchField || 'name_sku' }
						onValueChange={ ( val ) =>
							onSearchFieldChange( val === 'name_sku' ? '' : val )
						}
					>
						<SelectTrigger
							className="h-9 w-auto px-2 gap-1 rounded-r-none border-r-0 focus:ring-0 focus:z-10"
							aria-label="Search field"
						>
							<List className="h-4 w-4 shrink-0 text-muted-foreground" />
						</SelectTrigger>
						<SelectContent align="start">
							<SelectItem value="name_sku">Name / SKU</SelectItem>
							<SelectItem value="name">Name</SelectItem>
							<SelectItem value="sku">SKU</SelectItem>
							<SelectItem value="supplier_sku">
								Supplier SKU
							</SelectItem>
							<SelectItem value="barcode">Barcode</SelectItem>
							<SelectItem value="regular_price">
								Regular price
							</SelectItem>
							<SelectItem value="sale_price">
								Sale price
							</SelectItem>
							<SelectItem value="purchase_price">
								Purchase price
							</SelectItem>
							<SelectItem value="stock">Stock qty</SelectItem>
						</SelectContent>
					</Select>

					<div className="relative flex items-center">
						<SearchIcon className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
						<Input
							ref={ searchRef }
							type="text"
							placeholder={ searchPlaceholder }
							value={ search }
							onChange={ ( e ) =>
								onSearchChange( e.target.value )
							}
							aria-label="Search products"
							className="h-9 w-full max-w-[225px] pl-8 pr-7 rounded-l-none"
						/>
						{ search && (
							<Button
								type="button"
								variant="ghost"
								onClick={ onSearchClear }
								className="absolute right-1 inset-y-0 my-auto h-6 w-6 p-0 flex items-center justify-center text-muted-foreground hover:text-foreground z-10"
								aria-label="Clear search"
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						) }
					</div>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<ViewsDropdown
					activePreset={ activePreset }
					onSelectPreset={ onSelectPreset }
				/>

				<Select
					value={ productType || '__all__' }
					onValueChange={ ( val ) =>
						onProductTypeChange( val === '__all__' ? '' : val )
					}
				>
					<SelectTrigger className="h-8 w-auto justify-start gap-1.5 text-xs font-medium">
						<SelectValue placeholder="All types" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__all__">All types</SelectItem>
						<SelectItem value="simple">Simple</SelectItem>
						<SelectItem value="variable">Variable</SelectItem>
						<SelectItem value="grouped">Grouped</SelectItem>
						<SelectItem value="external">External</SelectItem>
						<SelectItem value="virtual">Virtual</SelectItem>
						<SelectItem value="downloadable">
							Downloadable
						</SelectItem>
					</SelectContent>
				</Select>

				<CategoryDropdown
					categories={ categories }
					value={ category }
					onChange={ onCategoryChange }
				/>

				<div className="flex-1" />

				{ expandableCount > 0 && (
					<Button
						variant={ allExpanded ? 'secondary' : 'outline' }
						size="sm"
						onClick={ onExpandCollapseAll }
						title={
							allExpanded
								? 'Collapse all rows'
								: 'Expand all rows'
						}
						aria-label={
							allExpanded
								? 'Collapse all rows'
								: 'Expand all rows'
						}
						aria-pressed={ allExpanded }
						className="gap-1.5"
					>
						{ allExpanded ? (
							<>
								<ChevronsDownUp className="h-4 w-4" /> Collapse
								All
							</>
						) : (
							<>
								<ChevronsUpDown className="h-4 w-4" /> Expand
								All
							</>
						) }
					</Button>
				) }

				<Button
					variant={ stickyHeader ? 'secondary' : 'outline' }
					size="sm"
					onClick={ onToggleStickyHeader }
					aria-pressed={ stickyHeader }
					title="Fix table header while scrolling"
				>
					<PinIcon className="h-3.5 w-3.5 mr-1" />
					Fix Header
				</Button>

				<ColumnVisibilityDropdown table={ table } />

				<Button
					variant="outline"
					size="sm"
					onClick={ onExportClick }
					className="gap-1.5"
					title="Export products"
				>
					<Download className="h-4 w-4" />
					Export
				</Button>
			</div>
		</div>
	);
}
