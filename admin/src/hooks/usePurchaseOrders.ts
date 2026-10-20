import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	getPurchaseOrders,
	getPurchaseOrder,
	createPurchaseOrder,
	updatePurchaseOrder,
	sendPurchaseOrder,
	receivePurchaseOrderItems,
	cancelPurchaseOrder,
	getNextPONumber,
	checkPONumberAvailable,
	deletePurchaseOrder,
	type PurchaseOrdersParams,
} from '@/lib/api';
import type {
	PurchaseOrder,
	CreatePOInput,
	UpdatePOInput,
	ReceivePOItemInput,
} from '@/types/purchase-order';
import { toast } from '@/components/ui/toast';

function invalidatePOQueries(
	queryClient: ReturnType< typeof useQueryClient >,
	id?: number
) {
	void queryClient.invalidateQueries( { queryKey: [ 'purchase-orders' ] } );
	if ( id !== undefined ) {
		void queryClient.invalidateQueries( {
			queryKey: [ 'purchase-order', id ],
		} );
	}
}

export function usePurchaseOrders( params: PurchaseOrdersParams = {} ) {
	return useQuery( {
		queryKey: [ 'purchase-orders', params ],
		queryFn: () => getPurchaseOrders( params ),
		staleTime: 30_000,
		gcTime: 5 * 60_000,
		placeholderData: ( prev ) => prev,
	} );
}

export function usePurchaseOrder( id: number ) {
	return useQuery< PurchaseOrder >( {
		queryKey: [ 'purchase-order', id ],
		queryFn: () => getPurchaseOrder( id ),
		staleTime: 30_000,
	} );
}

export function useNextPONumber( enabled: boolean ) {
	return useQuery( {
		queryKey: [ 'purchase-orders', 'next-number' ],
		queryFn: getNextPONumber,
		enabled,
		staleTime: 0,
	} );
}

export function usePONumberAvailable(
	poNumber: string,
	excludeId: number | undefined,
	enabled: boolean
) {
	return useQuery( {
		queryKey: [
			'purchase-orders',
			'number-available',
			poNumber,
			excludeId,
		],
		queryFn: () => checkPONumberAvailable( poNumber, excludeId ),
		enabled: enabled && poNumber !== '',
		staleTime: 0,
	} );
}

export function useCreatePurchaseOrder() {
	const queryClient = useQueryClient();

	return useMutation< PurchaseOrder, Error, CreatePOInput >( {
		mutationFn: ( data ) => createPurchaseOrder( data ),
		onSuccess: () => {
			toast.success( 'Purchase order created' );
			invalidatePOQueries( queryClient );
		},
		onError: ( err ) => {
			toast.error( err.message || 'Failed to create purchase order' );
		},
	} );
}

export function useUpdatePurchaseOrder() {
	const queryClient = useQueryClient();

	return useMutation<
		PurchaseOrder,
		Error,
		{ id: number; data: UpdatePOInput }
	>( {
		mutationFn: ( { id, data } ) => updatePurchaseOrder( id, data ),
		onSuccess: ( _result, { id } ) => {
			toast.success( 'Purchase order updated' );
			invalidatePOQueries( queryClient, id );
		},
		onError: ( err ) => {
			toast.error( err.message || 'Failed to update purchase order' );
		},
	} );
}

export function useDeletePurchaseOrder() {
	const queryClient = useQueryClient();

	return useMutation< { deleted: true }, Error, number >( {
		mutationFn: ( id ) => deletePurchaseOrder( id ),
		onSuccess: ( _result, id ) => {
			toast.success( 'Purchase order deleted' );
			// Removed rather than invalidated: a refetch would just 404.
			queryClient.removeQueries( { queryKey: [ 'purchase-order', id ] } );
			invalidatePOQueries( queryClient );
		},
		onError: ( err ) => {
			toast.error( err.message || 'Failed to delete purchase order' );
		},
	} );
}

export function useSendPurchaseOrder() {
	const queryClient = useQueryClient();

	return useMutation< PurchaseOrder, Error, { id: number } >( {
		mutationFn: ( { id } ) => sendPurchaseOrder( id ),
		onSuccess: ( _result, { id } ) => {
			toast.success( 'Purchase order marked as sent' );
			invalidatePOQueries( queryClient, id );
		},
		onError: ( err ) => {
			toast.error(
				err.message || 'Failed to mark purchase order as sent'
			);
		},
	} );
}

export function useReceivePurchaseOrder() {
	const queryClient = useQueryClient();

	return useMutation<
		PurchaseOrder,
		Error,
		{ id: number; items: ReceivePOItemInput[] }
	>( {
		mutationFn: ( { id, items } ) => receivePurchaseOrderItems( id, items ),
		onSuccess: ( _result, { id } ) => {
			toast.success( 'Stock received' );
			invalidatePOQueries( queryClient, id );
			void queryClient.invalidateQueries( { queryKey: [ 'products' ] } );
		},
		onError: ( err ) => {
			toast.error( err.message || 'Failed to receive stock' );
		},
	} );
}

export function useCancelPurchaseOrder() {
	const queryClient = useQueryClient();

	return useMutation< PurchaseOrder, Error, { id: number; reason?: string } >(
		{
			mutationFn: ( { id, reason } ) => cancelPurchaseOrder( id, reason ),
			onSuccess: ( _result, { id } ) => {
				toast.success( 'Purchase order cancelled' );
				invalidatePOQueries( queryClient, id );
			},
			onError: ( err ) => {
				toast.error( err.message || 'Failed to cancel purchase order' );
			},
		}
	);
}
