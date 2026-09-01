import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { ProductsResponse } from '@/types/api';

export interface ProductQueryParams {
	page: number;
	pageSize: number;
	search: string;
	searchField: string;
	sortBy: string;
	sortOrder: 'asc' | 'desc';
	stock_status: string;
	category: number;
	product_type: string;
	filters: string;
	include_velocity: boolean;
}

export function useProducts( params: ProductQueryParams ) {
	return useQuery< ProductsResponse >( {
		queryKey: [ 'products', params ],
		queryFn: () =>
			apiGet< ProductsResponse >( 'products', {
				page: params.page,
				per_page: params.pageSize,
				search: params.search,
				search_field: params.searchField || undefined,
				orderby: params.sortBy,
				order: params.sortOrder,
				stock_status: params.stock_status || undefined,
				category: params.category || undefined,
				product_type: params.product_type || undefined,
				filters: params.filters || undefined,
				include_velocity: params.include_velocity || undefined,
			} ),
		staleTime: 30_000,
		gcTime: 5 * 60_000,
		placeholderData: ( prev ) => prev,
	} );
}
