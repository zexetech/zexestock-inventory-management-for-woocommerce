import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setSku, ApiRequestError } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import type { ProductsResponse } from '@/types/api';

export interface SetSkuVars {
	productId: number;
	productName: string;
	sku: string;
	oldSku?: string | null;
}

type Snapshot = Array< [ readonly unknown[], ProductsResponse | undefined ] >;

export interface UseSetSkuOptions {
	onSkuSuccess?: ( vars: SetSkuVars ) => void;
}

export function useSetSku( options?: UseSetSkuOptions ) {
	const queryClient = useQueryClient();

	return useMutation<
		{ id: number; sku: string },
		Error,
		SetSkuVars,
		Snapshot
	>( {
		mutationFn: ( { productId, sku } ) => setSku( productId, sku ),

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
										? { ...p, sku: vars.sku }
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
					: 'Failed to update SKU'
			);
		},

		onSuccess: ( _data, vars ) => {
			if ( options?.onSkuSuccess ) {
				options.onSkuSuccess( vars );
			} else {
				toast.success( `SKU updated (${ vars.productName })` );
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
