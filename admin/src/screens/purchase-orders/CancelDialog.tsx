import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog';
import { MAX_PO_NOTES_LENGTH } from '@/lib/validation';

export function CancelDialog( {
	open,
	onOpenChange,
	onConfirm,
	isSaving,
}: {
	open: boolean;
	onOpenChange: ( open: boolean ) => void;
	onConfirm: ( reason: string ) => void;
	isSaving: boolean;
} ) {
	const [ reason, setReason ] = React.useState( '' );

	React.useEffect( () => {
		if ( ! open ) {
			setReason( '' );
		}
	}, [ open ] );

	return (
		<Dialog open={ open } onOpenChange={ onOpenChange }>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Cancel purchase order</DialogTitle>
					<DialogDescription>
						Optionally record why this purchase order is being
						cancelled. This cannot be undone.
					</DialogDescription>
				</DialogHeader>

				<textarea
					className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					placeholder="Cancellation reason (optional)"
					value={ reason }
					maxLength={ MAX_PO_NOTES_LENGTH }
					onChange={ ( e ) => setReason( e.target.value ) }
				/>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={ () => onOpenChange( false ) }
						disabled={ isSaving }
					>
						Keep purchase order
					</Button>
					<Button
						variant="destructive"
						onClick={ () => onConfirm( reason ) }
						disabled={ isSaving }
					>
						Cancel purchase order
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
