import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableHead,
	TableCell,
} from '@/components/ui/table';
import type { POItem, ReceivePOItemInput } from '@/types/purchase-order';

function remaining( item: POItem ) {
	return item.quantity_ordered - item.quantity_received;
}

export function ReceiveDialog( {
	open,
	onOpenChange,
	items,
	onConfirm,
	isSaving,
}: {
	open: boolean;
	onOpenChange: ( open: boolean ) => void;
	items: POItem[];
	onConfirm: ( items: ReceivePOItemInput[] ) => void;
	isSaving: boolean;
} ) {
	const [ quantities, setQuantities ] = React.useState<
		Record< number, number >
	>( {} );

	const receivableItems = items.filter( ( item ) => remaining( item ) > 0 );

	React.useEffect( () => {
		if ( open ) {
			setQuantities(
				Object.fromEntries(
					receivableItems.map( ( item ) => [
						item.id,
						remaining( item ),
					] )
				)
			);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ open ] );

	function handleConfirm() {
		const payload: ReceivePOItemInput[] = receivableItems
			.map( ( item ) => ( {
				item_id: item.id,
				quantity_received: quantities[ item.id ] ?? 0,
			} ) )
			.filter( ( entry ) => entry.quantity_received > 0 );

		if ( payload.length === 0 ) {
			return;
		}
		onConfirm( payload );
	}

	return (
		<Dialog open={ open } onOpenChange={ onOpenChange }>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Receive stock</DialogTitle>
					<DialogDescription>
						Enter the quantity received for each item.
					</DialogDescription>
				</DialogHeader>

				<div className="max-h-[60vh] overflow-y-auto pr-1">
					<Table>
						<TableHeader className="sticky top-0 z-10 bg-background">
							<TableRow>
								<TableHead>Product</TableHead>
								<TableHead className="w-32">
									Quantity received
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{ receivableItems.map( ( item ) => (
								<TableRow key={ item.id }>
									<TableCell>{ item.product_name }</TableCell>
									<TableCell>
										<Input
											type="number"
											min={ 0 }
											max={ remaining( item ) }
											value={ quantities[ item.id ] ?? 0 }
											onChange={ ( e ) =>
												setQuantities( ( prev ) => ( {
													...prev,
													[ item.id ]:
														Number(
															e.target.value
														) || 0,
												} ) )
											}
										/>
									</TableCell>
								</TableRow>
							) ) }
						</TableBody>
					</Table>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={ () => onOpenChange( false ) }
						disabled={ isSaving }
					>
						Cancel
					</Button>
					<Button onClick={ handleConfirm } disabled={ isSaving }>
						Confirm receive
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
