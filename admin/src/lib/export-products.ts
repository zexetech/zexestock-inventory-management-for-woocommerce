import type { QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Product, ProductsResponse } from '@/types/api';
import type { ProductQueryParams } from '@/hooks/useProducts';

const CHILD_NAME_PREFIX = '— ';

function formatCellValue< T extends Product >(
	key: keyof T,
	value: T[ keyof T ]
): string | number {
	if ( value === null || value === undefined ) {
		return '';
	}

	if ( key === 'stock_status' ) {
		const map: Record< string, string > = {
			in_stock: 'In Stock',
			low_stock: 'Low Stock',
			out_of_stock: 'Out of Stock',
			onbackorder: 'On Backorder',
		};
		return map[ String( value ) ] ?? String( value );
	}

	if ( key === 'type' ) {
		const s = String( value );
		return s.charAt( 0 ).toUpperCase() + s.slice( 1 );
	}

	if ( typeof value === 'boolean' ) {
		return value ? 'Yes' : 'No';
	}

	return value as string | number;
}

export function productsToRows< T extends Product >(
	products: T[],
	columnKeys: Array< keyof T >,
	nameTrimLength?: number
): ( string | number )[][] {
	return products.map( ( p ) =>
		columnKeys.map( ( k ) => {
			const val = formatCellValue( k, p[ k ] );
			if ( k === 'name' && typeof val === 'string' ) {
				const trimmed =
					nameTrimLength && val.length > nameTrimLength
						? val.slice( 0, nameTrimLength ) + '…'
						: val;
						
				return p.parent_id
					? `${ CHILD_NAME_PREFIX }${ trimmed }`
					: trimmed;
			}
			return val;
		} )
	);
}

export async function fetchAllProducts(
	queryParams: Partial< Omit< ProductQueryParams, 'page' | 'pageSize' > >,
	exportFormat?: 'csv' | 'xlsx'
): Promise< Product[] > {
	const PER_PAGE = 250;
	const result: Product[] = [];
	let topLevelCount = 0;
	let page = 1;

	while ( true ) {
		const response = await apiGet< ProductsResponse >( 'products', {
			page,
			per_page: PER_PAGE,
			search: queryParams.search || undefined,
			search_field: queryParams.searchField || undefined,
			orderby: queryParams.sortBy || 'name',
			order: queryParams.sortOrder || 'asc',
			stock_status: queryParams.stock_status || undefined,
			category: queryParams.category || undefined,
			product_type: queryParams.product_type || undefined,
			filters: queryParams.filters || undefined,
			include_velocity: queryParams.include_velocity || undefined,
			export_format: exportFormat,
		} );

		response.data.forEach( ( product ) => {
			result.push( product );
			if ( product.type === 'variable' ) {
				result.push( ...( product.variations ?? [] ) );
			}
		} );

		topLevelCount += response.data.length;
		if (
			topLevelCount >= response.meta.total ||
			response.data.length < PER_PAGE
		) {
			break;
		}
		page++;
	}

	return result;
}

export function resolveSelectedProducts(
	selectedIds: number[],
	currentPageProducts: Product[],
	queryClient: QueryClient
): Product[] {
	const selectedSet = new Set( selectedIds );
	const result: Product[] = [];
	const emitted = new Set< number >();

	for ( const product of currentPageProducts ) {
		const isParent = product.type === 'variable';

		if ( ! isParent ) {
			if ( selectedSet.has( product.id ) ) {
				result.push( product );
				emitted.add( product.id );
			}
			continue;
		}

		const cached =
			queryClient.getQueryData< Product[] >( [
				'variations',
				product.id,
			] ) ?? [];
		const matched = cached.filter( ( child ) =>
			selectedSet.has( child.id )
		);
		if ( matched.length === 0 ) {
			continue;
		}

		result.push( product );
		for ( const child of matched ) {
			result.push( child );
			emitted.add( child.id );
		}
	}

	for ( const id of selectedIds ) {
		if ( emitted.has( id ) ) {
			continue;
		}
		const allCaches = queryClient.getQueryCache().getAll();
		for ( const query of allCaches ) {
			const key = query.queryKey;
			if (
				key[ 0 ] === 'variations' &&
				Array.isArray( query.state.data )
			) {
				const child = ( query.state.data as Product[] ).find(
					( c ) => c.id === id
				);
				if ( child ) {
					result.push( child );
					emitted.add( id );
					break;
				}
			}
		}
	}

	return result;
}
