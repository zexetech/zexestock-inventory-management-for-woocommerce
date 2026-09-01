import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setMeta, ApiRequestError } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import type { ProductsResponse } from '@/types/api';

export type MetaField = 'purchase_price' | 'supplier_sku' | 'barcode';

export interface SetMetaVars {
	productId: number;
	productName: string;
	field: MetaField;
	value: string;
}

type Snapshot = Array< [ readonly unknown[], ProductsResponse | undefined ] >;

const FIELD_LABELS: Record< MetaField, string > = {
	purchase_price: 'Purchase price',
	supplier_sku: 'Supplier SKU',
	barcode: 'Barcode',
};

export function useSetMeta() {
	const queryClient = useQueryClient();

	return useMutation<
		{
			id: number;
			purchase_price: string | null;
			supplier_sku: string;
			barcode: string;
		},
		Error,
		SetMetaVars,
		Snapshot
	>( {
		mutationFn: ( { productId, field, value } ) =>
			setMeta( productId, { [ field ]: value } ),

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
										? { ...p, [ vars.field ]: vars.value }
										: p
								),
						  }
						: old
			);

			return snapshot;
		},

		onError: ( err, vars, snapshot ) => {
			snapshot?.forEach( ( [ key, data ] ) =>
				queryClient.setQueryData( key, data )
			);
			toast.error(
				err instanceof ApiRequestError
					? err.message
					: `Failed to update ${ FIELD_LABELS[ vars.field ] }`
			);
		},

		onSuccess: ( _data, vars ) => {
			toast.success(
				`${ FIELD_LABELS[ vars.field ] } updated (${
					vars.productName
				})`
			);
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
