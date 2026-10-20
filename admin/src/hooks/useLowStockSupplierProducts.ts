import { useQuery } from '@tanstack/react-query';
import { getLowStockSupplierProducts } from '@/lib/api';

export function useLowStockSupplierProducts(
	supplierId: number | null,
	excludeProductId?: number
) {
	return useQuery( {
		queryKey: [
			'suppliers',
			supplierId,
			'low-stock-products',
			excludeProductId,
		],
		queryFn: () =>
			getLowStockSupplierProducts(
				supplierId as number,
				excludeProductId
			),
		enabled: supplierId !== null,
		staleTime: 30_000,
	} );
}
