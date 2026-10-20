import * as React from 'react';
import { PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProductSupplier } from '@/hooks/useSupplierProducts';
import { useLowStockSupplierProducts } from '@/hooks/useLowStockSupplierProducts';
import { computeSuggestedQuantity } from '@/lib/reorder';
import {
	CreatePODialog,
	parsePurchasePrice,
	type DraftLine,
} from '@/screens/purchase-orders/CreatePODialog';
import type { Product } from '@/types/api';

export function CreatePOButton( { product }: { product: Product } ) {
	const [ open, setOpen ] = React.useState( false );

	const { data: link } = useProductSupplier( product.id );
	const supplierId = link?.is_active ? link.supplier_id : null;

	const { data: siblingsData } = useLowStockSupplierProducts(
		open ? supplierId : null,
		product.id
	);

	const threshold =
		product.low_stock_threshold_override ??
		window.zexstData.settings.lowStockThreshold;
	const currentStock = product.stock_qty ?? 0;

	const initialItems = React.useMemo< DraftLine[] >( () => {
		if ( ! link ) {
			return [];
		}
		return [
			{
				product_id: product.id,
				product_name: product.name,
				quantity_ordered: computeSuggestedQuantity(
					threshold,
					currentStock,
					link.order_multiple,
					link.minimum_order_qty
				),
				unit_cost: link.unit_cost,
				supplier_sku: link.supplier_sku ?? undefined,
				purchase_price: parsePurchasePrice( product.purchase_price ),
				purchase_price_known: true,
			},
			...( siblingsData?.items ?? [] ).map(
				( sibling ): DraftLine => ( {
					product_id: sibling.product_id,
					product_name: sibling.product_name,
					quantity_ordered: computeSuggestedQuantity(
						sibling.threshold,
						sibling.stock_qty,
						sibling.order_multiple,
						sibling.minimum_order_qty
					),
					unit_cost: sibling.unit_cost,
					supplier_sku: sibling.supplier_sku ?? undefined,
					purchase_price: parsePurchasePrice(
						sibling.purchase_price
					),
					purchase_price_known: true,
				} )
			),
		];
	}, [ link, siblingsData, product, threshold, currentStock ] );

	if ( ! link || ! link.is_active ) {
		return (
			<Button
				variant="outline"
				size="sm"
				disabled
				title="Link an active supplier to this product to create a purchase order."
			>
				<PackagePlus className="h-4 w-4 mr-1.5" />
				Create PO
			</Button>
		);
	}

	return (
		<>
			<Button
				variant="outline"
				size="sm"
				onClick={ () => setOpen( true ) }
			>
				<PackagePlus className="h-4 w-4 mr-1.5" />
				Create PO
			</Button>
			<CreatePODialog
				open={ open }
				onOpenChange={ setOpen }
				initialSupplierId={ supplierId ?? undefined }
				initialItems={ initialItems }
			/>
		</>
	);
}
