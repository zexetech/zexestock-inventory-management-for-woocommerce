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

export function DeletePODialog( {
	poNumber,
	onOpenChange,
	onConfirm,
	isSaving,
}: {
	poNumber: string | null;
	onOpenChange: ( open: boolean ) => void;
	onConfirm: () => void;
	isSaving: boolean;
} ) {
	return (
		<Dialog open={ poNumber !== null } onOpenChange={ onOpenChange }>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete purchase order</DialogTitle>
					<DialogDescription>
						Delete purchase order { poNumber } and all of its line
						items? This cannot be undone.
					</DialogDescription>
				</DialogHeader>

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
						onClick={ onConfirm }
						disabled={ isSaving }
					>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
