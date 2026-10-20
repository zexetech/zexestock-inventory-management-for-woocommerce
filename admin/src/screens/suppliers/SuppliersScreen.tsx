import * as React from 'react';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableHead,
	TableCell,
} from '@/components/ui/table';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	useSuppliers,
	useCreateSupplier,
	useUpdateSupplier,
	useDeleteSupplier,
} from '@/hooks/useSuppliers';
import type { Supplier, SupplierFormInput } from '@/types/supplier';
import { SupplierFormDialog } from './SupplierFormDialog';
import { SupplierProductsDialog } from './SupplierProductsDialog';

export function SuppliersScreen() {
	const [ search, setSearch ] = React.useState( '' );
	const [ dialogOpen, setDialogOpen ] = React.useState( false );
	const [ editing, setEditing ] = React.useState< Supplier | null >( null );
	const [ deleteTarget, setDeleteTarget ] = React.useState< Supplier | null >(
		null
	);
	const [ productsDialogSupplier, setProductsDialogSupplier ] =
		React.useState< Supplier | null >( null );

	const { data, isLoading } = useSuppliers( { search: search || undefined } );
	const createSupplier = useCreateSupplier();
	const updateSupplier = useUpdateSupplier();
	const deleteSupplier = useDeleteSupplier();

	const suppliers = data?.items ?? [];

	function openCreate() {
		setEditing( null );
		setDialogOpen( true );
	}

	function openEdit( supplier: Supplier ) {
		setEditing( supplier );
		setDialogOpen( true );
	}

	function handleSubmit( formData: SupplierFormInput ) {
		if ( editing ) {
			updateSupplier.mutate(
				{ id: editing.id, data: formData },
				{ onSuccess: () => setDialogOpen( false ) }
			);
		} else {
			createSupplier.mutate( formData, {
				onSuccess: () => setDialogOpen( false ),
			} );
		}
	}

	function handleDelete( supplier: Supplier ) {
		setDeleteTarget( supplier );
	}

	function handleConfirmDelete() {
		if ( ! deleteTarget ) {
			return;
		}
		deleteSupplier.mutate( deleteTarget.id, {
			onSuccess: () => setDeleteTarget( null ),
		} );
	}

	return (
		<div className="min-h-screen flex flex-col">
			<div className="flex-1 p-4 md:p-6 space-y-4 w-full">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold leading-tight">
							Suppliers
						</h1>
					</div>
					<Button onClick={ openCreate }>
						<Plus className="h-4 w-4 mr-1.5" />
						Add New Supplier
					</Button>
				</div>

				<Input
					placeholder="Search suppliers..."
					value={ search }
					onChange={ ( e ) => setSearch( e.target.value ) }
					className="max-w-sm"
				/>

				<div className="rounded-md border border-border overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="text-xs font-semibold">
									Name
								</TableHead>
								<TableHead className="text-xs font-semibold">
									Contact
								</TableHead>
								<TableHead className="text-xs font-semibold">
									Email
								</TableHead>
								<TableHead className="text-xs font-semibold">
									Status
								</TableHead>
								<TableHead className="w-24" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{ isLoading &&
								Array.from( { length: 4 } ).map( ( _, i ) => (
									<TableRow key={ i }>
										<TableCell
											colSpan={ 5 }
											className="py-2"
										>
											<Skeleton className="h-6 w-full" />
										</TableCell>
									</TableRow>
								) ) }

							{ ! isLoading && suppliers.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={ 5 }
										className="text-center text-muted-foreground py-8"
									>
										No suppliers yet.
									</TableCell>
								</TableRow>
							) }

							{ ! isLoading &&
								suppliers.map( ( supplier ) => (
									<TableRow
										key={ supplier.id }
										className="hover:bg-muted/30"
									>
										<TableCell className="py-2 text-sm font-medium">
											{ supplier.name }
										</TableCell>
										<TableCell className="py-2 text-sm">
											{ supplier.contact_name || '—' }
										</TableCell>
										<TableCell className="py-2 text-sm">
											{ supplier.email || '—' }
										</TableCell>
										<TableCell className="py-2 text-sm capitalize">
											{ supplier.status }
										</TableCell>
										<TableCell className="py-2 text-sm">
											<div className="flex items-center gap-1 justify-end">
												<Button
													variant="ghost"
													size="icon"
													onClick={ () =>
														setProductsDialogSupplier(
															supplier
														)
													}
													aria-label={ `View products supplied by ${ supplier.name }` }
												>
													<Package className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onClick={ () =>
														openEdit( supplier )
													}
													aria-label={ `Edit ${ supplier.name }` }
												>
													<Pencil className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onClick={ () =>
														handleDelete( supplier )
													}
													aria-label={ `Delete ${ supplier.name }` }
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								) ) }
						</TableBody>
					</Table>
				</div>
			</div>

			<SupplierFormDialog
				open={ dialogOpen }
				onOpenChange={ setDialogOpen }
				supplier={ editing }
				onSubmit={ handleSubmit }
				isSaving={
					createSupplier.isPending || updateSupplier.isPending
				}
			/>

			<SupplierProductsDialog
				open={ productsDialogSupplier !== null }
				onOpenChange={ ( open ) => {
					if ( ! open ) {
						setProductsDialogSupplier( null );
					}
				} }
				supplierId={ productsDialogSupplier?.id ?? null }
				supplierName={ productsDialogSupplier?.name ?? '' }
			/>

			<Dialog
				open={ !! deleteTarget }
				onOpenChange={ ( open ) => ! open && setDeleteTarget( null ) }
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete supplier</DialogTitle>
						<DialogDescription>
							Delete supplier &quot;{ deleteTarget?.name }&quot;?
							This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={ () => setDeleteTarget( null ) }
							disabled={ deleteSupplier.isPending }
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={ handleConfirmDelete }
							disabled={ deleteSupplier.isPending }
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
