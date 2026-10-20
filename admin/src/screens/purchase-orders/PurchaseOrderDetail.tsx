import * as React from 'react';
import { ArrowLeft, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableHead,
	TableCell,
} from '@/components/ui/table';
import {
	usePurchaseOrder,
	useSendPurchaseOrder,
	useReceivePurchaseOrder,
	useCancelPurchaseOrder,
	useDeletePurchaseOrder,
} from '@/hooks/usePurchaseOrders';
import { generatePOPdf } from '@/lib/export-po-pdf';
import { computePOTotals } from '@/lib/poTotals';
import type { ReceivePOItemInput } from '@/types/purchase-order';
import { POStatusBadge } from './POStatusBadge';
import { ReceiveDialog } from './ReceiveDialog';
import { CancelDialog } from './CancelDialog';
import { DeletePODialog } from './DeletePODialog';
import { CreatePODialog } from './CreatePODialog';

export function PurchaseOrderDetail( {
	id,
	onBack,
}: {
	id: number;
	onBack: () => void;
} ) {
	const [ receiveOpen, setReceiveOpen ] = React.useState( false );
	const [ cancelOpen, setCancelOpen ] = React.useState( false );
	const [ editOpen, setEditOpen ] = React.useState( false );
	const [ deleteOpen, setDeleteOpen ] = React.useState( false );

	const { data: po, isLoading } = usePurchaseOrder( id );
	const markSent = useSendPurchaseOrder();
	const receivePO = useReceivePurchaseOrder();
	const cancelPO = useCancelPurchaseOrder();
	const deletePO = useDeletePurchaseOrder();

	if ( isLoading || ! po ) {
		return (
			<div className="p-6 flex items-center justify-center">
				<Spinner />
			</div>
		);
	}

	const canEdit = po.status === 'draft';
	const canDelete = po.status === 'draft';
	const canMarkSent = po.status === 'draft';
	const canReceive =
		po.status === 'sent' || po.status === 'partially_received';
	const canCancel =
		po.status === 'draft' ||
		po.status === 'sent' ||
		po.status === 'partially_received';

	function handleReceive( items: ReceivePOItemInput[] ) {
		receivePO.mutate(
			{ id, items },
			{ onSuccess: () => setReceiveOpen( false ) }
		);
	}

	function handleCancel( reason: string ) {
		cancelPO.mutate(
			{ id, reason: reason || undefined },
			{ onSuccess: () => setCancelOpen( false ) }
		);
	}

	function handleDelete() {
		deletePO.mutate( id, { onSuccess: onBack } );
	}

	return (
		<div className="p-6 max-w-4xl mx-auto">
			<Button
				variant="ghost"
				size="sm"
				onClick={ onBack }
				className="mb-4"
			>
				<ArrowLeft className="h-4 w-4 mr-1.5" />
				Back to purchase orders
			</Button>

			<div className="flex items-start justify-between mb-6">
				<div>
					<div className="flex items-center gap-2">
						<h1 className="text-xl font-semibold text-foreground">
							{ po.po_number }
						</h1>
						<POStatusBadge status={ po.status } />
					</div>
					<p className="text-sm text-muted-foreground mt-1">
						{ po.supplier_name }
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={ () => void generatePOPdf( po ) }
					>
						<Download className="h-4 w-4 mr-1.5" />
						Download PDF
					</Button>
					{ canEdit && (
						<Button
							variant="outline"
							onClick={ () => setEditOpen( true ) }
						>
							Edit
						</Button>
					) }
					{ canMarkSent && (
						<Button
							onClick={ () => markSent.mutate( { id } ) }
							disabled={ markSent.isPending }
						>
							Mark as sent
						</Button>
					) }
					{ canReceive && (
						<Button onClick={ () => setReceiveOpen( true ) }>
							Receive
						</Button>
					) }
					{ canCancel && (
						<Button
							variant="destructive"
							onClick={ () => setCancelOpen( true ) }
						>
							Cancel
						</Button>
					) }
					{ canDelete && (
						<Button
							variant="destructive"
							onClick={ () => setDeleteOpen( true ) }
						>
							<Trash2 className="h-4 w-4 mr-1.5" />
							Delete
						</Button>
					) }
				</div>
			</div>

			<div className="rounded-xl border border-border bg-card shadow-md overflow-hidden mb-4">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Product</TableHead>
							<TableHead className="text-right">
								Ordered
							</TableHead>
							<TableHead className="text-right">
								Received
							</TableHead>
							<TableHead className="text-right">
								Unit cost
							</TableHead>
							<TableHead className="text-right">
								Line total
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{ po.items.map( ( item ) => (
							<TableRow key={ item.id }>
								<TableCell>{ item.product_name }</TableCell>
								<TableCell className="text-right">
									{ item.quantity_ordered }
								</TableCell>
								<TableCell className="text-right">
									{ item.quantity_received }
								</TableCell>
								<TableCell className="text-right">
									{ item.unit_cost.toFixed( 2 ) }
								</TableCell>
								<TableCell className="text-right">
									{ (
										item.quantity_ordered * item.unit_cost
									).toFixed( 2 ) }
								</TableCell>
							</TableRow>
						) ) }
					</TableBody>
				</Table>
			</div>

			{ po.po_date && (
				<p className="text-sm text-muted-foreground mb-2">
					PO date: { po.po_date }
				</p>
			) }

			<div className="text-sm text-foreground space-y-0.5 max-w-xs ml-auto">
				{ ( () => {
					const subtotal = po.items.reduce(
						( sum, item ) =>
							sum + item.quantity_ordered * item.unit_cost,
						0
					);
					const totals = computePOTotals(
						subtotal,
						po.discount_percent,
						po.tax_rate_percent,
						po.supplier_fee,
						po.shipping_cost
					);
					return (
						<>
							<div className="flex justify-between">
								<span>Subtotal</span>
								<span>{ totals.subtotal.toFixed( 2 ) }</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span>Discount</span>
								<span>
									-{ totals.discountAmt.toFixed( 2 ) }
								</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span>Tax</span>
								<span>{ totals.taxAmt.toFixed( 2 ) }</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span>Fee + shipping</span>
								<span>
									{ (
										po.supplier_fee + po.shipping_cost
									).toFixed( 2 ) }
								</span>
							</div>
							<div className="flex justify-between font-medium border-t border-border pt-1 mt-1">
								<span>Total</span>
								<span>
									{ po.currency }{ ' ' }
									{ po.total_cost.toFixed( 2 ) }
								</span>
							</div>
						</>
					);
				} )() }
			</div>

			<ReceiveDialog
				open={ receiveOpen }
				onOpenChange={ setReceiveOpen }
				items={ po.items }
				onConfirm={ handleReceive }
				isSaving={ receivePO.isPending }
			/>
			<CancelDialog
				open={ cancelOpen }
				onOpenChange={ setCancelOpen }
				onConfirm={ handleCancel }
				isSaving={ cancelPO.isPending }
			/>
			<DeletePODialog
				poNumber={ deleteOpen ? po.po_number : null }
				onOpenChange={ setDeleteOpen }
				onConfirm={ handleDelete }
				isSaving={ deletePO.isPending }
			/>
			<CreatePODialog
				open={ editOpen }
				onOpenChange={ setEditOpen }
				editingPO={ po }
			/>
		</div>
	);
}
