import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchSetManageStock } from '@/lib/api';

export interface BatchSetManageStockResult {
	results: Array< {
		id: number;
		success: boolean;
		manage_stock?: boolean;
		error?: string;
	} >;
}

export interface BatchSetManageStockVars {
	ids: number[];
	manageStock: boolean;
}

export function useBatchSetManageStock() {
	const queryClient = useQueryClient();

	return useMutation<
		BatchSetManageStockResult,
		Error,
		BatchSetManageStockVars
	>( {
		mutationFn: ( { ids, manageStock } ) =>
			batchSetManageStock( ids, manageStock ),

		onSettled: () => {
			void queryClient.invalidateQueries( { queryKey: [ 'products' ] } );
			void queryClient.invalidateQueries( {
				queryKey: [ 'variations' ],
				// The products refetch embeds variations and re-seeds this cache;
				// refetching every expanded parent here is one request per row.
				refetchType: 'none',
			} );
			void queryClient.invalidateQueries( {
				queryKey: [ 'grouped-children' ],
			} );
		},
	} );
}
