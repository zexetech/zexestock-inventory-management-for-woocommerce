import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Product } from '@/types/api';

export function useGroupedChildren( productId: number, enabled: boolean ) {
	return useQuery< Product[] >( {
		queryKey: [ 'grouped-children', productId ],
		queryFn: () =>
			apiGet< Product[] >( `products/${ productId }/grouped-children` ),
		enabled,
		staleTime: 5 * 60_000,
		gcTime: 5 * 60_000,
	} );
}
