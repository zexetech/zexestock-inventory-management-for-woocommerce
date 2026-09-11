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
			} );
			void queryClient.invalidateQueries( {
				queryKey: [ 'grouped-children' ],
			} );
		},
	} );
}
