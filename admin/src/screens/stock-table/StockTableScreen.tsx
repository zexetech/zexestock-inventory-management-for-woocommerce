import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import {
	useReactTable,
	getCoreRowModel,
	flexRender,
	type SortingState,
	type VisibilityState,
	type ColumnSizingState,
} from '@tanstack/react-table';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useProducts } from '@/hooks/useProducts';
import { buildColumns, DEFAULT_HIDDEN_COLUMNS } from './columns';
import { VariationRows } from './VariationRows';
import { Toolbar } from './Toolbar';
import { ExportDialog } from './ExportDialog';
import type { ViewPreset } from '@/types/filters';

function readUrlParams() {
	const sp = new URLSearchParams( window.location.search );
	return {
		page: Math.max( 1, parseInt( sp.get( 'sp_page' ) ?? '1', 10 ) || 1 ),
		pageSize: ( () => {
			const v = parseInt( sp.get( 'sp_per_page' ) ?? '0', 10 );
			return [ 25, 50, 100, 250 ].includes( v )
				? v
				: window.zexstData?.settings?.rowsPerPage ?? 25;
		} )(),
		search: sp.get( 'sp_search' ) ?? '',
		searchField: sp.get( 'sp_search_field' ) ?? '',
		sortBy: sp.get( 'sp_sort' ) ?? 'name',
		sortOrder: ( sp.get( 'sp_order' ) === 'desc' ? 'desc' : 'asc' ) as
			| 'asc'
			| 'desc',
		stock_status: sp.get( 'zexst_stock_status' ) ?? '',
		category: parseInt( sp.get( 'sp_category' ) ?? '0', 10 ) || 0,
		product_type: sp.get( 'sp_type' ) ?? '',
		preset: sp.get( 'zexst_preset' ) ?? 'all',
	};
}

function writeUrlParams( params: ReturnType< typeof readUrlParams > ) {
	const sp = new URLSearchParams( window.location.search );
	sp.set( 'sp_page', String( params.page ) );
	sp.set( 'sp_per_page', String( params.pageSize ) );
	if ( params.search ) {
		sp.set( 'sp_search', params.search );
	} else {
		sp.delete( 'sp_search' );
	}
	if ( params.searchField ) {
		sp.set( 'sp_search_field', params.searchField );
	} else {
		sp.delete( 'sp_search_field' );
	}
	sp.set( 'sp_sort', params.sortBy );
	sp.set( 'sp_order', params.sortOrder );

	if ( params.stock_status ) {
		sp.set( 'zexst_stock_status', params.stock_status );
	} else {
		sp.delete( 'zexst_stock_status' );
	}
	if ( params.category > 0 ) {
		sp.set( 'sp_category', String( params.category ) );
	} else {
		sp.delete( 'sp_category' );
	}
	if ( params.product_type ) {
		sp.set( 'sp_type', params.product_type );
	} else {
		sp.delete( 'sp_type' );
	}
	if ( params.preset && params.preset !== 'all' ) {
		sp.set( 'zexst_preset', params.preset );
	} else {
		sp.delete( 'zexst_preset' );
	}

	window.history.replaceState(
		null,
		'',
		`${ window.location.pathname }?${ sp.toString() }`
	);
}

const COL_VIS_KEY = 'sp_column_visibility_v2';
const COL_SIZE_KEY = 'sp_column_sizing_v1';
const STICKY_HEADER_KEY = 'sp_sticky_header_v1';

function readStickyHeader(): boolean {
	try {
		return localStorage.getItem( STICKY_HEADER_KEY ) === 'true';
	} catch {
		return false;
	}
}

function writeStickyHeader( val: boolean ) {
	try {
		localStorage.setItem( STICKY_HEADER_KEY, String( val ) );
	} catch {
	}
}

function readColSizing(): ColumnSizingState {
	try {
		const stored = localStorage.getItem( COL_SIZE_KEY );
		if ( stored ) {
			return JSON.parse( stored ) as ColumnSizingState;
		}
	} catch {
	}
	return {};
}

function writeColSizing( state: ColumnSizingState ) {
	try {
		localStorage.setItem( COL_SIZE_KEY, JSON.stringify( state ) );
	} catch {
	}
}

function readColVisibility(): VisibilityState {
	try {
		const stored = localStorage.getItem( COL_VIS_KEY );
		if ( stored ) {
			return JSON.parse( stored ) as VisibilityState;
		}
	} catch {
	}
	return DEFAULT_HIDDEN_COLUMNS;
}

function writeColVisibility( state: VisibilityState ) {
	try {
		localStorage.setItem( COL_VIS_KEY, JSON.stringify( state ) );
	} catch {
	}
}

function getPaginationPages(
	currentPage: number,
	pageCount: number
): ( number | '...' )[] {
	if ( pageCount <= 7 ) {
		return Array.from( { length: pageCount }, ( _, i ) => i + 1 );
	}
	const show = new Set< number >();
	show.add( 1 );
	for ( let p = Math.max( 2, pageCount - 1 ); p <= pageCount; p++ ) {
		show.add( p );
	}
	for (
		let p = Math.max( 2, currentPage - 1 );
		p <= Math.min( pageCount - 1, currentPage + 1 );
		p++
	) {
		show.add( p );
	}
	const sorted = Array.from( show ).sort( ( a, b ) => a - b );
	const result: ( number | '...' )[] = [];
	for ( let i = 0; i < sorted.length; i++ ) {
		if ( i > 0 && sorted[ i ] - sorted[ i - 1 ] > 1 ) {
			result.push( '...' );
		}
		result.push( sorted[ i ] );
	}
	return result;
}

export function StockTableScreen() {
	const categories = window.zexstData?.categories ?? [];

	const [ params, setParams ] = React.useState( readUrlParams );

	const [ searchInput, setSearchInput ] = React.useState( params.search );
	const searchDebounceRef = React.useRef< ReturnType< typeof setTimeout > >();

	const [ exportOpen, setExportOpen ] = React.useState( false );

	const sorting: SortingState = params.sortBy
		? [ { id: params.sortBy, desc: params.sortOrder === 'desc' } ]
		: [];

	const [ colVisibility, setColVisibility ] =
		React.useState< VisibilityState >( readColVisibility );

	const [ colSizing, setColSizing ] =
		React.useState< ColumnSizingState >( readColSizing );

	const [ expandedParentIds, setExpandedParentIds ] = React.useState<
		Set< number >
	>( () => new Set() );

	const queryClient = useQueryClient();

	const toggleExpand = React.useCallback( ( id: number ) => {
		setExpandedParentIds( ( prev ) => {
			const next = new Set( prev );
			if ( next.has( id ) ) {
				next.delete( id );
			} else {
				next.add( id );
			}
			return next;
		} );
	}, [] );

	const [ stickyHeader, setStickyHeader ] =
		React.useState( readStickyHeader );

	function handleToggleStickyHeader() {
		setStickyHeader( ( prev ) => {
			writeStickyHeader( ! prev );
			return ! prev;
		} );
	}

	React.useEffect( () => {
		writeColVisibility( colVisibility );
	}, [ colVisibility ] );

	React.useEffect( () => {
		writeColSizing( colSizing );
	}, [ colSizing ] );

	React.useEffect( () => {
		writeUrlParams( params );
	}, [ params ] );

	React.useEffect( () => {
		setExpandedParentIds( new Set() );
	}, [ params.page ] );

	React.useEffect( () => {
		setExpandedParentIds( new Set() );
	}, [
		params.search,
		params.searchField,
		params.stock_status,
		params.category,
		params.product_type,
		params.preset,
		params.sortBy,
		params.sortOrder,
		params.pageSize,
	] );

	const { data, isLoading, isFetching, isError, refetch } = useProducts( {
		page: params.page,
		pageSize: params.pageSize,
		search: params.search,
		searchField: params.searchField,
		sortBy: params.sortBy,
		sortOrder: params.sortOrder,
		stock_status: params.stock_status,
		category: params.category,
		product_type: params.product_type,
		filters: '',
		include_velocity: false,
	} );

	const products = React.useMemo( () => data?.data ?? [], [ data?.data ] );
	const meta = data?.meta;
	const pageCount = meta?.total_pages ?? 1;

	React.useEffect( () => {
		if ( ! data ) {
			return;
		}
		data.data.forEach( ( p ) => {
			if ( p.type === 'variable' && p.variations ) {
				queryClient.setQueryData(
					[ 'variations', p.id ],
					p.variations
				);
			}
		} );
	}, [ data, queryClient ] );

	const expandableIds = React.useMemo(
		() =>
			products
				.filter( ( p ) => p.type === 'variable' )
				.map( ( p ) => p.id ),
		[ products ]
	);

	const allExpandableExpanded =
		expandableIds.length > 0 &&
		expandableIds.every( ( id ) => expandedParentIds.has( id ) );

	const handleExpandCollapseAll = React.useCallback( () => {
		setExpandedParentIds( ( prev ) => {
			const allExpanded =
				expandableIds.length > 0 &&
				expandableIds.every( ( id ) => prev.has( id ) );
			return allExpanded ? new Set() : new Set( expandableIds );
		} );
	}, [ expandableIds ] );

	const columns = React.useMemo(
		() => buildColumns( expandedParentIds, toggleExpand ),
		[ expandedParentIds, toggleExpand ]
	);

	const table = useReactTable( {
		data: products,
		columns,
		pageCount,
		state: {
			sorting,
			columnVisibility: colVisibility,
			columnSizing: colSizing,
			columnPinning: { left: [ 'image', 'name' ] },
			pagination: {
				pageIndex: params.page - 1,
				pageSize: params.pageSize,
			},
		},
		columnResizeMode: 'onChange',
		enableColumnResizing: true,
		onColumnSizingChange: setColSizing,
		manualPagination: true,
		manualSorting: true,
		manualFiltering: true,
		onSortingChange: ( updater ) => {
			const next =
				typeof updater === 'function' ? updater( sorting ) : updater;
			if ( next.length === 0 ) {
				setParams( ( p ) => ( {
					...p,
					sortBy: 'name',
					sortOrder: 'asc',
					page: 1,
				} ) );
			} else {
				setParams( ( p ) => ( {
					...p,
					sortBy: next[ 0 ].id,
					sortOrder: next[ 0 ].desc ? 'desc' : 'asc',
					page: 1,
				} ) );
			}
		},
		onColumnVisibilityChange: setColVisibility,
		getCoreRowModel: getCoreRowModel(),
	} );

	function changePage( newPage: number ) {
		setParams( ( p ) => ( { ...p, page: newPage } ) );
	}

	function handleSearchChange( val: string ) {
		setSearchInput( val );
		clearTimeout( searchDebounceRef.current );
		searchDebounceRef.current = setTimeout( () => {
			setParams( ( p ) => ( {
				...p,
				search: val,
				page: 1,
				preset: '',
			} ) );
		}, 300 );
	}

	function handleSearchClear() {
		setSearchInput( '' );
		setParams( ( p ) => ( { ...p, search: '', page: 1 } ) );
	}

	function handleSearchFieldChange( val: string ) {
		setParams( ( p ) => ( { ...p, searchField: val, page: 1 } ) );
	}

	function handleCategoryChange( val: number ) {
		setParams( ( p ) => ( { ...p, category: val, page: 1 } ) );
	}

	function handleProductTypeChange( val: string ) {
		setParams( ( p ) => ( { ...p, product_type: val, page: 1 } ) );
	}

	function handleSelectPreset( preset: ViewPreset ) {
		setParams( ( p ) => ( {
			...p,
			page: 1,
			stock_status: preset.stock_status,
			preset: preset.id,
		} ) );
	}

	function handleClearFilters() {
		setSearchInput( '' );
		setParams( ( p ) => ( {
			...p,
			page: 1,
			preset: 'all',
			stock_status: '',
			category: 0,
			product_type: '',
			search: '',
		} ) );
	}

	const from = meta ? ( params.page - 1 ) * params.pageSize + 1 : 0;
	const to = meta ? Math.min( params.page * params.pageSize, meta.total ) : 0;
	const total = meta?.total ?? 0;

	const canPrevPage = params.page > 1;
	const canNextPage = params.page < pageCount;

	let tableBodyContent: React.ReactNode;
	if ( isLoading ) {
		tableBodyContent = Array.from( { length: 10 } ).map( ( _, i ) => (
			<TableRow key={ i }>
				{ table
					.getAllColumns()
					.filter( ( c ) => c.getIsVisible() )
					.map( ( col ) => (
						<TableCell key={ col.id }>
							<Skeleton className="h-4 w-full" />
						</TableCell>
					) ) }
			</TableRow>
		) );
	} else if ( isError ) {
		tableBodyContent = (
			<TableRow>
				<TableCell
					colSpan={ columns.length }
					className="text-center py-12"
				>
					<div className="flex flex-col items-center gap-3">
						<p className="text-destructive font-medium">
							Failed to load products.
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={ () => void refetch() }
						>
							Retry
						</Button>
					</div>
				</TableCell>
			</TableRow>
		);
	} else if ( products.length === 0 ) {
		tableBodyContent = (
			<TableRow>
				<TableCell
					colSpan={ columns.length }
					className="text-center py-12 text-muted-foreground"
				>
					No products found.
				</TableCell>
			</TableRow>
		);
	} else {
		tableBodyContent = table.getRowModel().rows.map( ( row ) => {
			const visibleColumnIds = row
				.getVisibleCells()
				.map( ( c ) => c.column.id );
			const isVariable = row.original.type === 'variable';
			const isExpanded =
				isVariable && expandedParentIds.has( row.original.id );

			const expandedBg = isExpanded ? '!bg-info-bg' : '';
			const stickyBg = isExpanded ? 'bg-info-bg' : 'bg-background';
			return (
				<React.Fragment key={ row.id }>
					<TableRow className={ expandedBg || undefined }>
						{ row.getVisibleCells().map( ( cell ) => (
							<TableCell
								key={ cell.id }
								className={ `align-middle overflow-hidden${
									cell.column.getIsPinned() === 'left'
										? ` sticky z-10 ${ stickyBg }`
										: ''
								}` }
								style={ {
									width: cell.column.getSize()
										? `${ cell.column.getSize() }px`
										: undefined,
									maxWidth: cell.column.getSize()
										? `${ cell.column.getSize() }px`
										: undefined,
									...( ! cell.column.getCanResize() &&
										cell.column.getSize() && {
											minWidth: `${ cell.column.getSize() }px`,
										} ),
									...( cell.column.getIsPinned() ===
										'left' && {
										left: `${ cell.column.getStart(
											'left'
										) }px`,
									} ),
								} }
							>
								{ flexRender(
									cell.column.columnDef.cell,
									cell.getContext()
								) }
							</TableCell>
						) ) }
					</TableRow>
					{ isExpanded && isVariable && (
						<VariationRows
							productId={ row.original.id }
							visibleColumnIds={ visibleColumnIds }
							stockStatus={ params.stock_status || undefined }
						/>
					) }
				</React.Fragment>
			);
		} );
	}

	return (
		<>
			<div className="flex flex-col gap-3 p-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold leading-tight">
							Stock Manager
						</h1>
					</div>
				</div>

				<Toolbar
					search={ searchInput }
					onSearchChange={ handleSearchChange }
					onSearchClear={ handleSearchClear }
					isFetching={ isFetching }
					isLoading={ isLoading }
					activePreset={ params.preset }
					onSelectPreset={ handleSelectPreset }
					table={ table }
					stickyHeader={ stickyHeader }
					onToggleStickyHeader={ handleToggleStickyHeader }
					expandableCount={ expandableIds.length }
					allExpanded={ allExpandableExpanded }
					onExpandCollapseAll={ handleExpandCollapseAll }
					categories={ categories }
					category={ params.category }
					onCategoryChange={ handleCategoryChange }
					productType={ params.product_type }
					onProductTypeChange={ handleProductTypeChange }
					searchField={ params.searchField }
					onSearchFieldChange={ handleSearchFieldChange }
					onClearFilters={ handleClearFilters }
					onExportClick={ () => setExportOpen( true ) }
				/>

				<div
					className={ `rounded-md border ${
						stickyHeader
							? 'overflow-auto max-h-[calc(100vh-220px)]'
							: 'overflow-x-auto'
					}` }
				>
					<Table>
						<TableHeader
							className={
								stickyHeader
									? 'sticky top-0 z-30 bg-muted shadow-sm'
									: undefined
							}
						>
							{ table.getHeaderGroups().map( ( hg ) => (
								<TableRow key={ hg.id }>
									{ hg.headers.map( ( header ) => {
										const canSort =
											header.column.getCanSort();
										const sortDir =
											header.column.getIsSorted();
										let headerBgClass: string;
										if (
											header.column.getIsPinned() ===
											'left'
										) {
											headerBgClass =
												' sticky z-20 bg-muted';
										} else if ( stickyHeader ) {
											headerBgClass = ' bg-muted';
										} else {
											headerBgClass = '';
										}
										return (
											<TableHead
												key={ header.id }
												className={ `relative${ headerBgClass }` }
												style={ {
													width: header.getSize()
														? `${ header.getSize() }px`
														: undefined,
													...( ! header.column.getCanResize() &&
														header.getSize() && {
															minWidth: `${ header.getSize() }px`,
															maxWidth: `${ header.getSize() }px`,
														} ),
													...( header.column.getIsPinned() ===
														'left' && {
														left: `${ header.column.getStart(
															'left'
														) }px`,
													} ),
												} }
											>
												{ ( () => {
													if (
														header.isPlaceholder
													) {
														return null;
													}
													if ( ! canSort ) {
														return flexRender(
															header.column
																.columnDef
																.header,
															header.getContext()
														);
													}
													let sortIcon: React.ReactNode;
													if ( sortDir === 'asc' ) {
														sortIcon = (
															<ChevronUp className="h-3.5 w-3.5" />
														);
													} else if (
														sortDir === 'desc'
													) {
														sortIcon = (
															<ChevronDown className="h-3.5 w-3.5" />
														);
													} else {
														sortIcon = (
															<ChevronsUpDown className="h-3.5 w-3.5" />
														);
													}
													return (
														<button
															type="button"
															onClick={ header.column.getToggleSortingHandler() }
															className="flex items-center gap-1 cursor-pointer select-none text-foreground hover:opacity-80 font-medium text-sm"
														>
															{ flexRender(
																header.column
																	.columnDef
																	.header,
																header.getContext()
															) }
															<span className="text-muted-foreground ml-1">
																{ sortIcon }
															</span>
														</button>
													);
												} )() }
												{ header.column.getCanResize() && (
													<div
														onMouseDown={ header.getResizeHandler() }
														onTouchStart={ header.getResizeHandler() }
														className={ `absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none transition-colors ${
															header.column.getIsResizing()
																? 'bg-primary/60'
																: 'bg-transparent hover:bg-border'
														}` }
													/>
												) }
											</TableHead>
										);
									} ) }
								</TableRow>
							) ) }
						</TableHeader>

						<TableBody>{ tableBodyContent }</TableBody>
					</Table>
				</div>

				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
					<span>
						{ total > 0
							? `Showing ${ from }–${ to } of ${ total.toLocaleString() } products`
							: '' }
					</span>

					<div className="flex items-center gap-4">
						<label
							htmlFor="stock-table-per-page"
							className="flex items-center gap-2 whitespace-nowrap"
						>
							Lines per page:
							<Select
								value={ String( params.pageSize ) }
								onValueChange={ ( val ) =>
									setParams( ( p ) => ( {
										...p,
										pageSize: parseInt( val, 10 ),
										page: 1,
									} ) )
								}
							>
								<SelectTrigger
									id="stock-table-per-page"
									className="h-8 w-20 text-sm"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ [ 25, 50, 100, 250 ].map( ( n ) => (
										<SelectItem
											key={ n }
											value={ String( n ) }
										>
											{ n }
										</SelectItem>
									) ) }
								</SelectContent>
							</Select>
						</label>

						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								disabled={ ! canPrevPage }
								onClick={ () => changePage( params.page - 1 ) }
								aria-label="Previous page"
								className="h-8 w-8 p-0"
							>
								‹
							</Button>

							{ getPaginationPages( params.page, pageCount ).map(
								( pg, i ) =>
									pg === '...' ? (
										<span
											key={ `ellipsis-${ i }` }
											className="flex h-8 w-8 items-center justify-center text-muted-foreground select-none"
										>
											…
										</span>
									) : (
										<Button
											key={ pg }
											variant={
												pg === params.page
													? 'default'
													: 'ghost'
											}
											size="sm"
											onClick={ () => changePage( pg ) }
											className="h-8 w-8 p-0"
											aria-label={ `Page ${ pg }` }
											aria-current={
												pg === params.page
													? 'page'
													: undefined
											}
										>
											{ pg }
										</Button>
									)
							) }

							<Button
								variant="ghost"
								size="sm"
								disabled={ ! canNextPage }
								onClick={ () => changePage( params.page + 1 ) }
								aria-label="Next page"
								className="h-8 w-8 p-0"
							>
								›
							</Button>
						</div>
					</div>
				</div>
			</div>

			<ExportDialog
				open={ exportOpen }
				onClose={ () => setExportOpen( false ) }
				queryParams={ {
					search: params.search,
					sortBy: params.sortBy,
					sortOrder: params.sortOrder,
					stock_status: params.stock_status,
					category: params.category,
					product_type: params.product_type,
					searchField: params.searchField,
					filters: '',
					include_velocity: false,
				} }
				filteredCount={ meta?.total }
			/>
		</>
	);
}
