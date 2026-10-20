import * as React from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
	useSupplierProductsForSupplier,
	useSetProductSupplier,
	useRemoveProductSupplier,
} from '@/hooks/useSupplierProducts';
import { ProductPicker } from '@/screens/purchase-orders/ProductPicker';

export function SupplierProductsDialog( {
	open,
	onOpenChange,
	supplierId,
	supplierName,
}: {
	open: boolean;
	onOpenChange: ( open: boolean ) => void;
	supplierId: number | null;
	supplierName: string;
} ) {
	const { data, isLoading } = useSupplierProductsForSupplier(
		open ? supplierId : null
	);
	const items = data?.items ?? [];
	const setSupplier = useSetProductSupplier();
	const removeSupplier = useRemoveProductSupplier();
	const busy = setSupplier.isPending || removeSupplier.isPending;

	return (
		<Dialog open={ open } onOpenChange={ onOpenChange }>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						Products supplied by { supplierName }
					</DialogTitle>
					<DialogDescription>
						Products currently linked to this supplier. Adding a
						product linked elsewhere moves it to this supplier.
					</DialogDescription>
				</DialogHeader>

				{ supplierId !== null && (
					<ProductPicker
						placeholder="Add product…"
						excludeIds={ items.map( ( item ) => item.product_id ) }
						onSelect={ ( product ) =>
							setSupplier.mutate( {
								productId: product.id,
								data: { supplier_id: supplierId },
							} )
						}
					/>
				) }

				<div className="max-h-[60vh] overflow-y-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Product</TableHead>
								<TableHead>SKU</TableHead>
								<TableHead>Supplier SKU</TableHead>
								<TableHead>Unit cost</TableHead>
								<TableHead>Lead time</TableHead>
								<TableHead>
									<span className="sr-only">Actions</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{ isLoading &&
								Array.from( { length: 3 } ).map( ( _, i ) => (
									<TableRow key={ i }>
										<TableCell colSpan={ 6 }>
											<Skeleton className="h-6 w-full" />
										</TableCell>
									</TableRow>
								) ) }

							{ ! isLoading && items.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={ 6 }
										className="text-center text-muted-foreground py-8"
									>
										No products linked to this supplier yet.
									</TableCell>
								</TableRow>
							) }

							{ ! isLoading &&
								items.map( ( item ) => (
									<TableRow key={ item.id }>
										<TableCell className="font-medium">
											{ item.product_name }
										</TableCell>
										<TableCell>{ item.sku }</TableCell>
										<TableCell>
											{ item.supplier_sku || '—' }
										</TableCell>
										<TableCell>
											{ item.currency }{ ' ' }
											{ item.unit_cost.toFixed( 2 ) }
										</TableCell>
										<TableCell>
											{ item.lead_time_days !== null
												? `${ item.lead_time_days }d`
												: '—' }
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="sm"
												disabled={ busy }
												aria-label={ `Remove ${ item.product_name }` }
												onClick={ () =>
													removeSupplier.mutate(
														item.product_id
													)
												}
											>
												Remove
											</Button>
										</TableCell>
									</TableRow>
								) ) }
						</TableBody>
					</Table>
				</div>
			</DialogContent>
		</Dialog>
	);
}
