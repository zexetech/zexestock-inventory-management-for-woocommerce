import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	getSuppliers,
	createSupplier,
	updateSupplier,
	deleteSupplier,
	getAssignableUsers,
	type SuppliersParams,
} from '@/lib/api';
import type { Supplier, SupplierFormInput } from '@/types/supplier';
import { toast } from '@/components/ui/toast';

export function useSuppliers( params: SuppliersParams = {} ) {
	return useQuery( {
		queryKey: [ 'suppliers', params ],
		queryFn: () => getSuppliers( params ),
		staleTime: 30_000,
		gcTime: 5 * 60_000,
		placeholderData: ( prev ) => prev,
	} );
}

export function useCreateSupplier() {
	const queryClient = useQueryClient();

	return useMutation< Supplier, Error, SupplierFormInput >( {
		mutationFn: ( data ) => createSupplier( data ),
		onSuccess: () => {
			toast.success( 'Supplier created' );
			void queryClient.invalidateQueries( { queryKey: [ 'suppliers' ] } );
		},
		onError: ( err ) => {
			toast.error( err.message || 'Failed to create supplier' );
		},
	} );
}

export function useUpdateSupplier() {
	const queryClient = useQueryClient();

	return useMutation<
		Supplier,
		Error,
		{ id: number; data: Partial< SupplierFormInput > }
	>( {
		mutationFn: ( { id, data } ) => updateSupplier( id, data ),
		onSuccess: () => {
			toast.success( 'Supplier updated' );
			void queryClient.invalidateQueries( { queryKey: [ 'suppliers' ] } );
		},
		onError: ( err ) => {
			toast.error( err.message || 'Failed to update supplier' );
		},
	} );
}

export function useDeleteSupplier() {
	const queryClient = useQueryClient();

	return useMutation< { deleted: true }, Error, number >( {
		mutationFn: ( id ) => deleteSupplier( id ),
		onSuccess: () => {
			toast.success( 'Supplier deleted' );
			void queryClient.invalidateQueries( { queryKey: [ 'suppliers' ] } );
		},
		onError: ( err ) => {
			toast.error( err.message || 'Failed to delete supplier' );
		},
	} );
}

export function useAssignableUsers() {
	return useQuery( {
		queryKey: [ 'assignable-users' ],
		queryFn: () => getAssignableUsers(),
		staleTime: 5 * 60_000,
	} );
}
