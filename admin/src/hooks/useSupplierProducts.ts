import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	getProductSupplier,
	setProductSupplier,
	removeProductSupplier,
	getSupplierProductsList,
} from '@/lib/api';
import type {
	SupplierProductLink,
	SupplierProductLinkInput,
} from '@/types/supplier';
import { toast } from '@/components/ui/toast';

export function useProductSupplier( productId: number ) {
	return useQuery< SupplierProductLink | null >( {
		queryKey: [ 'product-supplier', productId ],
		queryFn: () => getProductSupplier( productId ),
		staleTime: 30_000,
	} );
}

export function useSetProductSupplier() {
	const queryClient = useQueryClient();

	return useMutation<
		SupplierProductLink,
		Error,
		{ productId: number; data: SupplierProductLinkInput }
	>( {
		mutationFn: ( { productId, data } ) =>
			setProductSupplier( productId, data ),
		onSuccess: ( _result, { productId } ) => {
			toast.success( 'Supplier assigned' );
			void queryClient.invalidateQueries( {
				queryKey: [ 'product-supplier', productId ],
			} );
			void queryClient.invalidateQueries( {
				queryKey: [ 'supplier-products-for-supplier' ],
			} );
		},
		onError: ( err ) => {
			toast.error( err.message || 'Failed to assign supplier' );
		},
	} );
}

export function useRemoveProductSupplier() {
	const queryClient = useQueryClient();

	return useMutation< { removed: true }, Error, number >( {
		mutationFn: ( productId ) => removeProductSupplier( productId ),
		onSuccess: ( _result, productId ) => {
			toast.success( 'Supplier removed' );
			void queryClient.invalidateQueries( {
				queryKey: [ 'product-supplier', productId ],
			} );
			void queryClient.invalidateQueries( {
				queryKey: [ 'supplier-products-for-supplier' ],
			} );
		},
		onError: ( err ) => {
			toast.error( err.message || 'Failed to remove supplier' );
		},
	} );
}

export function useSupplierProductsForSupplier(
	supplierId: number | null,
	params?: { page?: number; per_page?: number }
) {
	return useQuery( {
		queryKey: [ 'supplier-products-for-supplier', supplierId, params ],
		queryFn: () => getSupplierProductsList( supplierId as number, params ),
		enabled: supplierId !== null,
	} );
}
