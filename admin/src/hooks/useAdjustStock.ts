import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adjustStock, ApiRequestError } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import type {
	Product,
	AdjustStockResponse,
	ProductsResponse,
} from '@/types/api';

type Snapshot = {
	productEntries: Array<
		[ readonly unknown[], ProductsResponse | undefined ]
	>;
	variationEntry: Product[] | undefined;
};

export interface AdjustVars {
	productId: number;
	parentId?: number;
	productName: string;
	adjustment: number;
	currentStock: number | null;
	expectedStock?: number;
}

export interface UseAdjustStockOptions {
	onAdjustSuccess?: ( data: AdjustStockResponse, vars: AdjustVars ) => void;
}

export function useAdjustStock( options?: UseAdjustStockOptions ) {
	const queryClient = useQueryClient();

	return useMutation< AdjustStockResponse, Error, AdjustVars, Snapshot >( {
		mutationFn: ( { productId, adjustment, currentStock, expectedStock } ) =>
			adjustStock( productId, {
				adjustment: ( currentStock ?? 0 ) + adjustment,
				expected_stock: expectedStock,
			} ),

		onMutate: async ( vars ) => {
			await queryClient.cancelQueries( { queryKey: [ 'products' ] } );
			if ( vars.parentId !== undefined ) {
				await queryClient.cancelQueries( {
					queryKey: [ 'variations', vars.parentId ],
				} );
			}

			const productEntries =
				queryClient.getQueriesData< ProductsResponse >( {
					queryKey: [ 'products' ],
				} );
			const variationEntry =
				vars.parentId !== undefined
					? queryClient.getQueryData< Product[] >( [
							'variations',
							vars.parentId,
					  ] )
					: undefined;

			const optimisticStock =
				( vars.currentStock ?? 0 ) + vars.adjustment;

			if ( vars.parentId !== undefined ) {
				queryClient.setQueryData< Product[] >(
					[ 'variations', vars.parentId ],
					( old ) =>
						old?.map( ( v ) =>
							v.id === vars.productId
								? { ...v, stock_qty: optimisticStock }
								: v
						)
				);
			} else {
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
													stock_qty: optimisticStock,
											  }
											: p
									),
							  }
							: old
				);
			}

			return { productEntries, variationEntry };
		},

		onError: ( err, vars, snapshot ) => {
			snapshot?.productEntries.forEach( ( [ key, data ] ) =>
				queryClient.setQueryData( key, data )
			);
			if (
				vars.parentId !== undefined &&
				snapshot?.variationEntry !== undefined
			) {
				queryClient.setQueryData(
					[ 'variations', vars.parentId ],
					snapshot.variationEntry
				);
			}

			if ( err instanceof ApiRequestError && err.status === 409 ) {
				toast.warning( 'Stock changed by someone else — refreshed' );
			} else {
				toast.error(
					err instanceof Error
						? err.message
						: 'Failed to update stock'
				);
			}
		},

		onSuccess: ( data, vars ) => {
			if ( options?.onAdjustSuccess ) {
				options.onAdjustSuccess( data, vars );
			} else {
				const sign = vars.adjustment >= 0 ? '+' : '';
				toast.success(
					`Stock updated (${ vars.productName }: ${ sign }${ vars.adjustment })`
				);
			}
		},

		onSettled: ( _data, _err, vars ) => {
			void queryClient.invalidateQueries( { queryKey: [ 'products' ] } );
			if ( vars.parentId !== undefined ) {
				void queryClient.invalidateQueries( {
					queryKey: [ 'variations', vars.parentId ],
				} );
				void queryClient.invalidateQueries( {
					queryKey: [ 'grouped-children', vars.parentId ],
				} );
			}
		},
	} );
}
