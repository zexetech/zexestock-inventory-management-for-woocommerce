import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setPrice, setMeta, ApiRequestError } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import type { ProductsResponse } from '@/types/api';

export interface SetPriceVars {
	productId: number;
	productName: string;
	field: 'regular_price' | 'sale_price' | 'purchase_price';
	value: string;
	dateFrom?: string;
	dateTo?: string;
	oldValue?: string | null;
}

type Snapshot = Array< [ readonly unknown[], ProductsResponse | undefined ] >;

export interface UseSetPriceOptions {
	onPriceSuccess?: ( vars: SetPriceVars ) => void;
}

export function useSetPrice( options?: UseSetPriceOptions ) {
	const queryClient = useQueryClient();

	return useMutation<
		{ id: number; regular_price: string; sale_price: string },
		Error,
		SetPriceVars,
		Snapshot
	>( {
		mutationFn: ( { productId, field, value, dateFrom, dateTo } ) => {
			if ( field === 'purchase_price' ) {
				return setMeta( productId, {
					purchase_price: value,
				} ) as unknown as Promise< {
					id: number;
					regular_price: string;
					sale_price: string;
				} >;
			}
			return setPrice( productId, {
				[ field ]: value,
				...( field === 'sale_price' && dateFrom !== undefined
					? { date_on_sale_from: dateFrom }
					: {} ),
				...( field === 'sale_price' && dateTo !== undefined
					? { date_on_sale_to: dateTo }
					: {} ),
			} );
		},

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
												[ vars.field ]: vars.value,
												...( vars.field ===
													'sale_price' &&
												vars.dateFrom !== undefined
													? {
															date_on_sale_from:
																vars.dateFrom ||
																null,
													  }
													: {} ),
												...( vars.field ===
													'sale_price' &&
												vars.dateTo !== undefined
													? {
															date_on_sale_to:
																vars.dateTo ||
																null,
													  }
													: {} ),
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
					: 'Failed to update price'
			);
		},

		onSuccess: ( _data, vars ) => {
			if ( options?.onPriceSuccess ) {
				options.onPriceSuccess( vars );
			} else {
				let label: string;
				if ( vars.field === 'regular_price' ) {
					label = 'Regular price';
				} else if ( vars.field === 'sale_price' ) {
					label = 'Sale price';
				} else {
					label = 'Purchase price';
				}
				toast.success( `${ label } updated (${ vars.productName })` );
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
