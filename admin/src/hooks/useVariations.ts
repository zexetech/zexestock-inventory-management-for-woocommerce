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
	} );
}
