import * as React from 'react';
import { Download } from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { generateStockPdf } from '@/lib/export-pdf';
import { fetchAllProducts, productsToRows } from '@/lib/export-products';
import { PageOverlay } from '@/components/ui/page-overlay';
import type { Product } from '@/types/api';
import type { ProductQueryParams } from '@/hooks/useProducts';

type ExportScope = 'filtered' | 'all';

export interface ExportDialogProps {
	open: boolean;
	onClose: () => void;
	queryParams: Omit< ProductQueryParams, 'page' | 'pageSize' >;
	activeFilterCount?: number;
	filteredCount?: number;
}

const COLUMNS: { key: keyof Product; label: string }[] = [
	{ key: 'id', label: 'ID' },
	{ key: 'name', label: 'Name' },
	{ key: 'category', label: 'Category' },
	{ key: 'type', label: 'Type' },
	{ key: 'sku', label: 'SKU' },
	{ key: 'supplier_sku', label: 'Supplier SKU' },
	{ key: 'barcode', label: 'Barcode' },
	{ key: 'regular_price', label: 'Regular Price' },
	{ key: 'sale_price', label: 'Sale Price' },
	{ key: 'purchase_price', label: 'Purchase Price' },
	{ key: 'date_on_sale_from', label: 'Sale Start' },
	{ key: 'date_on_sale_to', label: 'Sale End' },
	{ key: 'stock_qty', label: 'Stock Qty' },
	{ key: 'stock_status', label: 'Stock Status' },
	{ key: 'manage_stock', label: 'Manage Stock' },
	{ key: 'reserved_qty', label: 'Reserved Qty' },
	{ key: 'sold_today', label: 'Sold Today' },
	{ key: 'sold_last_14_days', label: 'Sold (14d)' },
	{ key: 'low_stock_threshold_override', label: 'Threshold Override' },
];

const DEFAULT_COLUMN_KEYS: ReadonlySet< keyof Product > = new Set<
	keyof Product
>( [
	'id',
	'name',
	'category',
	'type',
	'sku',
	'barcode',
	'regular_price',
	'sale_price',
	'purchase_price',
	'date_on_sale_from',
	'date_on_sale_to',
	'stock_qty',
	'stock_status',
] );

export function ExportDialog( {
	open,
	onClose,
	queryParams,
	activeFilterCount = 0,
	filteredCount,
}: ExportDialogProps ) {
	const [ scope, setScope ] = React.useState< ExportScope >( 'filtered' );
	const [ isExporting, setIsExporting ] = React.useState( false );
	const [ error, setError ] = React.useState< string | null >( null );

	const [ selectedCols, setSelectedCols ] = React.useState<
		Set< keyof Product >
	>( () => new Set( DEFAULT_COLUMN_KEYS ) );

	const [ trimNames, setTrimNames ] = React.useState( true );
	const [ trimLength, setTrimLength ] = React.useState( '20' );

	function clampTrimLength( raw: string ): number {
		return Math.max( 5, Math.min( 200, parseInt( raw ) || 20 ) );
	}

	React.useEffect( () => {
		if ( open ) {
			setScope( 'filtered' );
			setError( null );
		}
	}, [ open ] );

	function toggleCol( key: keyof Product ) {
		setSelectedCols( ( prev ) => {
			const next = new Set( prev );
			if ( next.has( key ) ) {
				next.delete( key );
			} else {
				next.add( key );
			}
			return next;
		} );
	}

	function selectAll() {
		setSelectedCols( new Set( COLUMNS.map( ( c ) => c.key ) ) );
	}
	function deselectAll() {
		setSelectedCols( new Set() );
	}

	async function handleExport() {
		if ( selectedCols.size === 0 ) {
			setError( 'Select at least one column to export.' );
			return;
		}

		setIsExporting( true );
		setError( null );

		try {
			let products: Product[];

			if ( scope === 'filtered' ) {
				products = await fetchAllProducts( queryParams );
			} else {
				products = await fetchAllProducts( {
					sortBy: 'name',
					sortOrder: 'asc',
				} );
			}

			const colKeys = COLUMNS.filter( ( c ) =>
				selectedCols.has( c.key )
			).map( ( c ) => c.key );
			const headers = COLUMNS.filter( ( c ) =>
				selectedCols.has( c.key )
			).map( ( c ) => c.label );
			const nameTrimLength = trimNames
				? clampTrimLength( trimLength )
				: undefined;
			const rows = productsToRows( products, colKeys, nameTrimLength );

			const lowStock = products.filter(
				( p ) => p.stock_status === 'low_stock'
			).length;
			const outOfStock = products.filter(
				( p ) => p.stock_status === 'out_of_stock'
			).length;

			let scopeLabel: string;
			if ( scope === 'filtered' && activeFilterCount > 0 ) {
				scopeLabel = `Filtered products (${ activeFilterCount } filter${
					activeFilterCount !== 1 ? 's' : ''
				} active)`;
			} else if ( scope === 'filtered' ) {
				scopeLabel = 'All products (no active filters)';
			} else {
				scopeLabel = 'All products in store';
			}

			const parentRowFlags = products.map(
				( p ) => p.type === 'variable'
			);
			await generateStockPdf(
				headers,
				rows,
				{
					scopeLabel,
					totalCount: products.length,
					lowStockCount: lowStock,
					outOfStockCount: outOfStock,
				},
				parentRowFlags
			);

			onClose();
		} catch ( err ) {
			setError(
				err instanceof Error
					? err.message
					: 'Export failed. Please try again.'
			);
		} finally {
			setIsExporting( false );
		}
	}

	const exportLabel = isExporting ? 'Exporting…' : 'Export PDF';

	return (
		<>
			<PageOverlay open={ isExporting } message="Preparing export…" />
			<Dialog open={ open } onOpenChange={ ( v ) => ! v && onClose() }>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Export</DialogTitle>
					</DialogHeader>

					<div className="flex flex-col gap-5 py-1 max-h-[70vh] overflow-y-auto pr-1 overflow-x-hidden">
						<div className="flex flex-col gap-2">
							<span className="text-sm font-medium">
								Products to export
							</span>
							<div className="flex flex-col gap-2">
								<label
									htmlFor="export-scope-filtered"
									className="flex cursor-pointer items-center gap-3 rounded-md border border-input px-4 py-3 text-sm hover:bg-muted"
								>
									<input
										id="export-scope-filtered"
										type="radio"
										name="export-scope"
										value="filtered"
										checked={ scope === 'filtered' }
										onChange={ () =>
											setScope( 'filtered' )
										}
										className="accent-primary"
									/>
									<span>
										Filtered products{ ' ' }
										<span className="text-muted-foreground">
											{ filteredCount !== undefined
												? `(${ filteredCount } product${
														filteredCount !== 1
															? 's'
															: ''
												  })`
												: '(all pages, current filters)' }
										</span>
									</span>
								</label>

								<label
									htmlFor="export-scope-all"
									className="flex cursor-pointer items-center gap-3 rounded-md border border-input px-4 py-3 text-sm hover:bg-muted"
								>
									<input
										id="export-scope-all"
										type="radio"
										name="export-scope"
										value="all"
										checked={ scope === 'all' }
										onChange={ () => setScope( 'all' ) }
										className="accent-primary"
									/>
									<span>
										All products{ ' ' }
										<span className="text-muted-foreground">
											(every product in your store)
										</span>
									</span>
								</label>
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">
									Columns to export
								</span>
								<div className="flex items-center gap-3">
									<button
										type="button"
										onClick={ selectAll }
										className="text-xs text-primary hover:underline"
									>
										Select all
									</button>
									<button
										type="button"
										onClick={ deselectAll }
										className="text-xs text-muted-foreground hover:underline"
									>
										Deselect all
									</button>
								</div>
							</div>
							<div className="grid grid-cols-4 gap-x-3 gap-y-2 rounded-md border border-input p-3">
								{ COLUMNS.map( ( { key, label } ) => (
									<label
										key={ key }
										htmlFor={ `export-col-${ key }` }
										className="flex cursor-pointer items-center gap-1.5 text-xs"
									>
										<Checkbox
											id={ `export-col-${ key }` }
											checked={ selectedCols.has( key ) }
											onCheckedChange={ () =>
												toggleCol( key )
											}
											className="h-3.5 w-3.5"
										/>
										<span className="leading-tight">
											{ label }
										</span>
									</label>
								) ) }
							</div>
							{ selectedCols.size === 0 && (
								<p className="text-xs text-muted-foreground">
									Select at least one column.
								</p>
							) }
						</div>

						{ selectedCols.has( 'name' ) && (
							<div className="flex flex-col gap-2">
								<span className="text-sm font-medium">
									Product name
								</span>
								<div className="flex items-center gap-3 rounded-md border border-input px-4 py-3">
									<Checkbox
										id="trim-names"
										checked={ trimNames }
										onCheckedChange={ ( checked ) =>
											setTrimNames( !! checked )
										}
									/>
									<label
										htmlFor="trim-names"
										className="flex flex-wrap items-center gap-2 text-sm cursor-pointer select-none"
									>
										Trim to
										<input
											type="number"
											min={ 5 }
											max={ 200 }
											value={ trimLength }
											disabled={ ! trimNames }
											onChange={ ( e ) =>
												setTrimLength( e.target.value )
											}
											onBlur={ ( e ) =>
												setTrimLength(
													String(
														clampTrimLength(
															e.target.value
														)
													)
												)
											}
											onClick={ ( e ) =>
												e.stopPropagation()
											}
											className="w-16 rounded border border-input bg-background px-2 py-0.5 text-center text-sm disabled:opacity-40"
										/>
										characters{ ' ' }
										<span className="text-muted-foreground">
											(leave unchecked to keep full name)
										</span>
									</label>
								</div>
							</div>
						) }

						{ error && (
							<p className="text-sm text-destructive">
								{ error }
							</p>
						) }
					</div>

					<DialogFooter>
						<Button
							variant="ghost"
							size="sm"
							onClick={ onClose }
							disabled={ isExporting }
						>
							Cancel
						</Button>
						<Button
							size="sm"
							onClick={ () => void handleExport() }
							disabled={ isExporting || selectedCols.size === 0 }
						>
							{ isExporting ? (
								exportLabel
							) : (
								<>
									<Download className="mr-1.5 h-4 w-4" />
									{ exportLabel }
								</>
							) }
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
