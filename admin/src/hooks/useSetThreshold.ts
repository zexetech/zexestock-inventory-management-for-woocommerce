import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setThreshold, ApiRequestError } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import type { ProductsResponse } from '@/types/api';

export interface SetThresholdVars {
	productId: number;
	productName: string;
	threshold: number | null;
}

type Snapshot = Array< [ readonly unknown[], ProductsResponse | undefined ] >;

export function useSetThreshold() {
	const queryClient = useQueryClient();

	return useMutation<
		{ id: number; threshold: number | null },
		Error,
		SetThresholdVars,
		Snapshot
	>( {
		mutationFn: ( { productId, threshold } ) =>
			setThreshold( productId, threshold ),

		onMutate: async ( vars ) => {
			await queryClient.cancelQueries( { queryKey: [ 'products' ] } );

			const snapshot = queryClient.getQueriesData< ProductsResponse >( {
				queryKey: [ 'products' ],
			} );

			queryClient.setQueriesData< ProductsResponse >(
				{ queryKey: [ 'products' ] },
				( old ) =>
					old
						? {
								...old,
								data: old.data.map( ( p ) =>
									p.id === vars.productId
										? {
												...p,
												low_stock_threshold_override:
													vars.threshold,
										  }
										: p
								),
						  }
						: old
			);

			return snapshot;
		},

		onError: ( err, _vars, snapshot ) => {
			snapshot?.forEach( ( [ key, data ] ) =>
				queryClient.setQueryData( key, data )
			);
			toast.error(
				err instanceof ApiRequestError
					? err.message
					: 'Failed to update threshold'
			);
		},

		onSuccess: ( _data, vars ) => {
			if ( vars.threshold === null ) {
				toast.success(
					`Threshold cleared — using global (${ vars.productName })`
				);
			} else {
				toast.success(
					`Threshold set to ${ vars.threshold } (${ vars.productName })`
				);
			}
		},

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
