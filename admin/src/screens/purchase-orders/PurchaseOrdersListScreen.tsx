import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableHead,
	TableCell,
} from '@/components/ui/table';
import {
	usePurchaseOrders,
	useDeletePurchaseOrder,
} from '@/hooks/usePurchaseOrders';
import type { POStatus, PurchaseOrderSummary } from '@/types/purchase-order';
import { POStatusBadge } from './POStatusBadge';
import { CreatePODialog } from './CreatePODialog';
import { DeletePODialog } from './DeletePODialog';

const STATUS_OPTIONS: { value: POStatus | 'all'; label: string }[] = [
	{ value: 'all', label: 'All statuses' },
	{ value: 'draft', label: 'Draft' },
	{ value: 'sent', label: 'Sent' },
	{ value: 'partially_received', label: 'Partially received' },
	{ value: 'received', label: 'Received' },
	{ value: 'cancelled', label: 'Cancelled' },
];

export function PurchaseOrdersListScreen( {
	onSelectPO,
}: {
	onSelectPO: ( id: number ) => void;
} ) {
	const [ search, setSearch ] = React.useState( '' );
	const [ status, setStatus ] = React.useState< POStatus | 'all' >( 'all' );
	const [ createOpen, setCreateOpen ] = React.useState( false );
	const [ deleteTarget, setDeleteTarget ] =
		React.useState< PurchaseOrderSummary | null >( null );
	const deletePO = useDeletePurchaseOrder();

	const { data, isLoading } = usePurchaseOrders( {
		search: search || undefined,
		status: status === 'all' ? undefined : status,
	} );

	const orders = data?.items ?? [];

	function handleConfirmDelete() {
		if ( ! deleteTarget ) {
			return;
		}
		deletePO.mutate( deleteTarget.id, {
			onSuccess: () => setDeleteTarget( null ),
		} );
	}

	return (
		<div className="p-6 max-w-6xl mx-auto">
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-xl font-semibold text-foreground">
					Purchase Orders
				</h1>
				<Button onClick={ () => setCreateOpen( true ) }>
					<Plus className="h-4 w-4 mr-1.5" />
					New Purchase Order
				</Button>
			</div>

			<div className="flex items-center gap-3 mb-4">
				<Input
					placeholder="Search PO number or supplier..."
					value={ search }
					onChange={ ( e ) => setSearch( e.target.value ) }
					className="max-w-sm"
				/>
				<Select
					value={ status }
					onValueChange={ ( v ) =>
						setStatus( v as POStatus | 'all' )
					}
				>
					<SelectTrigger className="w-48">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{ STATUS_OPTIONS.map( ( opt ) => (
							<SelectItem key={ opt.value } value={ opt.value }>
								{ opt.label }
							</SelectItem>
						) ) }
					</SelectContent>
				</Select>
			</div>

			<div className="rounded-xl border border-border bg-card shadow-md overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>PO Number</TableHead>
							<TableHead>Supplier</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Total</TableHead>
							<TableHead>Created</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{ isLoading &&
							Array.from( { length: 4 } ).map( ( _, i ) => (
								<TableRow key={ i }>
									<TableCell colSpan={ 6 }>
										<Skeleton className="h-6 w-full" />
									</TableCell>
								</TableRow>
							) ) }

						{ ! isLoading && orders.length === 0 && (
							<TableRow>
								<TableCell
									colSpan={ 6 }
									className="text-center text-muted-foreground py-8"
								>
									No purchase orders yet.
								</TableCell>
							</TableRow>
						) }

						{ ! isLoading &&
							orders.map( ( po ) => (
								<TableRow
									key={ po.id }
									className="cursor-pointer"
									onClick={ () => onSelectPO( po.id ) }
								>
									<TableCell className="font-medium">
										{ po.po_number }
									</TableCell>
									<TableCell>{ po.supplier_name }</TableCell>
									<TableCell>
										<POStatusBadge status={ po.status } />
									</TableCell>
									<TableCell className="text-right">
										{ po.currency }{ ' ' }
										{ po.total_cost.toFixed( 2 ) }
									</TableCell>
									<TableCell>{ po.created_at }</TableCell>
									<TableCell>
										{ po.status === 'draft' && (
											<Button
												variant="ghost"
												size="icon"
												aria-label={ `Delete ${ po.po_number }` }
												onClick={ ( e ) => {
													e.stopPropagation();
													setDeleteTarget( po );
												} }
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										) }
									</TableCell>
								</TableRow>
							) ) }
					</TableBody>
				</Table>
			</div>

			<CreatePODialog
				open={ createOpen }
				onOpenChange={ setCreateOpen }
			/>
			<DeletePODialog
				poNumber={ deleteTarget?.po_number ?? null }
				onOpenChange={ ( open ) => ! open && setDeleteTarget( null ) }
				onConfirm={ handleConfirmDelete }
				isSaving={ deletePO.isPending }
			/>
		</div>
	);
}
