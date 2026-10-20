import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Product } from '@/types/api';

export function useVariations( productId: number, enabled: boolean ) {
	return useQuery< Product[] >( {
		queryKey: [ 'variations', productId ],
		queryFn: () =>
			apiGet< Product[] >( `products/${ productId }/variations` ),
		enabled,
		staleTime: 5 * 60_000,
		gcTime: 5 * 60_000,
		// The stock table re-seeds this cache from every /products response,
		// which embeds each parent's variations. Refetching per parent on
		// mount (select-all expands every parent while a save's products
		// refetch is still in flight) or on window focus would be one request
		// per row. A request is only made when nothing is cached yet.
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	} );
}
