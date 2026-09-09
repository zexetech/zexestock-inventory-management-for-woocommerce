import * as React from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useBatchSetManageStock } from '@/hooks/useBatchSetManageStock';
import { PageOverlay } from '@/components/ui/page-overlay';
import type { Product } from '@/types/api';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
	DialogClose,
} from '@/components/ui/dialog';

interface ManageStockBarProps {
	selectedIds: number[];
	onClearSelection: () => void;
	currentPageProducts: Product[];
}

export function ManageStockBar( {
	selectedIds,
	onClearSelection,
	currentPageProducts,
}: ManageStockBarProps ) {
	const { mutateAsync: runBatch, isPending } = useBatchSetManageStock();

	// eslint-disable-next-line @wordpress/no-unused-vars-before-return
	const [ confirmOpen, setConfirmOpen ] = React.useState( false );
	// eslint-disable-next-line @wordpress/no-unused-vars-before-return
	const [ pendingValue, setPendingValue ] = React.useState( true );

	const groupedIdSet = React.useMemo( () => {
		const s = new Set< number >();
		for ( const p of currentPageProducts ) {
			if ( p.type === 'grouped' ) {
				s.add( p.id );
			}
		}
		return s;
	}, [ currentPageProducts ] );

	const count = selectedIds.filter( ( id ) => ! groupedIdSet.has( id ) ).length;
	const skippedCount = selectedIds.length - count;

	if ( selectedIds.length === 0 ) {
		return null;
	}

	function openConfirm( manageStock: boolean ) {
		setPendingValue( manageStock );
		setConfirmOpen( true );
	}

	async function handleConfirmed() {
		setConfirmOpen( false );

		const targetIds = selectedIds.filter( ( id ) => ! groupedIdSet.has( id ) );

		const result = await runBatch( {
			ids: targetIds,
			manageStock: pendingValue,
		} );

		const errors = result.results.filter( ( r ) => ! r.success );

		if ( errors.length === 0 ) {
			toast.success(
				`Stock management ${
					pendingValue ? 'enabled' : 'disabled'
				} for ${ count } product${ count !== 1 ? 's' : '' }`
			);
			onClearSelection();
		} else {
			toast.warning(
				`${ count - errors.length } updated, ${
					errors.length
				} failed`
			);
		}
	}

	const actionLabel = pendingValue ? 'Enable' : 'Disable';

	return (
		<>
			<div
				className="w-full max-w-[480px]"
				role="toolbar"
				aria-label="Bulk action bar"
			>
				<div className="rounded-xl border border-zinc-600 bg-zinc-800 text-zinc-100 shadow-2xl backdrop-blur-sm p-5 flex flex-col gap-4">
					<div className="flex items-center gap-3">
						<span className="rounded-full bg-primary text-primary-foreground text-sm font-semibold px-4 py-1.5 shrink-0">
							{ count } product{ count !== 1 ? 's' : '' } selected
						</span>

						<div className="flex-1" />

						<Button
							variant="outline"
							size="sm"
							onClick={ onClearSelection }
							disabled={ isPending }
							className="bg-transparent hover:bg-zinc-700 text-zinc-100 border-zinc-400 hover:text-zinc-100"
						>
							Clear
						</Button>
					</div>

					<span className="text-sm text-white font-medium">
						Manage Stock Tracking
					</span>

					{ skippedCount > 0 && (
						<p className="text-xs text-zinc-400">
							{ skippedCount } grouped product
							{ skippedCount !== 1 ? 's' : '' } will be skipped —
							select their linked products individually.
						</p>
					) }

					<div className="flex gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={ () => openConfirm( true ) }
							disabled={ isPending || count === 0 }
							className="flex-1 border-zinc-500 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 hover:text-zinc-100 text-sm font-medium py-3 h-auto justify-start"
						>
							<span className="text-base inline-flex items-center gap-1.5">
								<Check className="h-4 w-4" />
								Enable
							</span>
						</Button>

						<Button
							type="button"
							variant="outline"
							onClick={ () => openConfirm( false ) }
							disabled={ isPending || count === 0 }
							className="flex-1 border-zinc-500 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 hover:text-zinc-100 text-sm font-medium py-3 h-auto justify-start"
						>
							<span className="text-base inline-flex items-center gap-1.5">
								<X className="h-4 w-4" />
								Disable
							</span>
						</Button>
					</div>
				</div>
			</div>

			<PageOverlay open={ isPending } message="Applying changes…" />

			<Dialog open={ confirmOpen } onOpenChange={ setConfirmOpen }>
				<DialogContent className="z-[10000]" overlayClassName="z-[10000]">
					<DialogHeader>
						<DialogTitle>Confirm</DialogTitle>
						<DialogDescription>
							{ actionLabel } stock management for { count }{ ' ' }
							product{ count !== 1 ? 's' : '' }.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="ghost" size="sm">
								Cancel
							</Button>
						</DialogClose>
						<Button size="sm" onClick={ () => void handleConfirmed() }>
							Confirm
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
