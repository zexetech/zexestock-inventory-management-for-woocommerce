import * as React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { StockCell } from './StockCell';
import { PriceCell } from './PriceCell';
import { MetaTextCell } from './MetaTextCell';
import { SkuCell } from './SkuCell';
import { ThresholdCell } from './ThresholdCell';
import { ProductTypeBadge } from './ProductTypeBadge';
import { useGroupedChildren } from '@/hooks/useGroupedChildren';
import type { Product, StockStatus } from '@/types/api';

function GroupedChildCell( {
	columnId,
	child,
}: {
	columnId: string;
	child: Product;
} ) {
	switch ( columnId ) {
		case 'image':
			return (
				<div className="flex items-center justify-center w-full">
					{ child.image_url ? (
						<img
							src={ child.image_url }
							alt=""
							className="h-10 w-10 rounded object-cover"
							loading="lazy"
						/>
					) : (
						<div className="h-10 w-10 rounded bg-muted" />
					) }
				</div>
			);
		case 'name': {
			const editUrl = `/wp-admin/post.php?post=${ child.id }&action=edit`;
			return (
				<div className="flex items-center gap-2 pl-6 border-l-2 border-warning/60">
					<a
						href={ editUrl }
						target="_blank"
						rel="noreferrer"
						className="text-sm text-foreground no-underline hover:no-underline truncate whitespace-nowrap block min-w-0"
					>
						{ child.name }
					</a>
				</div>
			);
		}
		case 'sku':
			return (
				<SkuCell
					productId={ child.id }
					productName={ child.name }
					sku={ child.sku ?? '' }
				/>
			);
		case 'stock_qty':
			return <StockCell product={ child } />;
		case 'stock_status': {
			const val: StockStatus | null = child.stock_status;
			if ( ! val ) {
				return <span className="text-muted-foreground">—</span>;
			}
			const label: Record< string, string > = {
				in_stock: 'In Stock',
				low_stock: 'Low Stock',
				out_of_stock: 'Out of Stock',
			};
			const colorClass: Record< string, string > = {
				in_stock: 'text-status-in-stock-text',
				low_stock: 'text-status-low-stock-text',
				out_of_stock: 'text-status-out-of-stock-text',
			};
			return (
				<span
					className={ `text-sm font-medium ${
						colorClass[ val ] ?? 'text-muted-foreground'
					}` }
				>
					{ label[ val ] ?? val }
				</span>
			);
		}
		case 'regular_price':
			return (
				<PriceCell
					productId={ child.id }
					productName={ child.name }
					field="regular_price"
					value={ child.regular_price ?? null }
				/>
			);
		case 'sale_price':
			return (
				<PriceCell
					productId={ child.id }
					productName={ child.name }
					field="sale_price"
					value={ child.sale_price ?? null }
				/>
			);
		case 'purchase_price':
			return (
				<PriceCell
					productId={ child.id }
					productName={ child.name }
					field="purchase_price"
					value={ child.purchase_price ?? null }
				/>
			);
		case 'supplier_sku':
			return (
				<MetaTextCell
					productId={ child.id }
					productName={ child.name }
					field="supplier_sku"
					value={ child.supplier_sku ?? '' }
				/>
			);
		case 'barcode':
			return (
				<MetaTextCell
					productId={ child.id }
					productName={ child.name }
					field="barcode"
					value={ child.barcode ?? '' }
				/>
			);
		case 'category':
			return (
				<span className="text-sm text-muted-foreground">
					{ child.category || '—' }
				</span>
			);
		case 'low_stock_threshold_override':
			return <ThresholdCell product={ child } />;
		case 'type':
			return <ProductTypeBadge type={ child.type } />;
		case 'sold_today':
			return (
				<div className="flex justify-center">
					{ child.sold_today === 0 ? (
						<span className="text-muted-foreground text-sm">—</span>
					) : (
						<span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold bg-success-bg text-success-fg">
							{ child.sold_today }
						</span>
					) }
				</div>
			);
		case 'sold_last_14_days':
			return (
				<div className="flex justify-center">
					<span
						className={
							child.sold_last_14_days === 0
								? 'text-muted-foreground text-sm'
								: 'text-sm font-medium text-foreground'
						}
					>
						{ child.sold_last_14_days }
					</span>
				</div>
			);
		default:
			return null;
	}
}

interface GroupedChildRowsProps {
	productId: number;
	visibleColumnIds: string[];
	stockStatus?: string;
}

export function GroupedChildRows( {
	productId,
	visibleColumnIds,
	stockStatus,
}: GroupedChildRowsProps ) {
	const colSpan = visibleColumnIds.length;
	const {
		data: allChildren,
		isLoading,
		isError,
		refetch,
	} = useGroupedChildren( productId, true );

	const FILTERABLE_STATUSES = [ 'in_stock', 'low_stock', 'out_of_stock' ];
	const children =
		stockStatus && FILTERABLE_STATUSES.includes( stockStatus )
			? ( allChildren ?? [] ).filter(
					( c ) => c.stock_status === stockStatus
			  )
			: allChildren;

	if ( isLoading ) {
		return (
			<>
				{ Array.from( { length: 2 } ).map( ( _, i ) => (
					<TableRow key={ i } className="bg-row-child-bg/30">
						{ visibleColumnIds.map( ( colId ) => (
							<TableCell key={ colId }>
								<Skeleton className="h-4 w-full" />
							</TableCell>
						) ) }
					</TableRow>
				) ) }
			</>
		);
	}

	if ( isError ) {
		return (
			<TableRow className="bg-muted/20">
				<TableCell colSpan={ colSpan } className="py-2 pl-8">
					<div className="flex items-center gap-2 text-sm">
						<span className="text-destructive">
							Failed to load grouped children.
						</span>
						<button
							type="button"
							onClick={ () => void refetch() }
							className="text-primary underline hover:no-underline"
						>
							Retry
						</button>
					</div>
				</TableCell>
			</TableRow>
		);
	}

	if ( ! children?.length ) {
		return (
			<TableRow className="bg-muted/20">
				<TableCell
					colSpan={ colSpan }
					className="py-2 pl-8 text-sm text-muted-foreground"
				>
					No child products found.
				</TableCell>
			</TableRow>
		);
	}

	return (
		<>
			{ children.map( ( child ) => (
				<TableRow
					key={ child.id }
					className="!bg-row-child-bg hover:!bg-row-child-bg-hover"
				>
					{ visibleColumnIds.map( ( colId ) => (
						<TableCell key={ colId }>
							<GroupedChildCell
								columnId={ colId }
								child={ child }
							/>
						</TableCell>
					) ) }
				</TableRow>
			) ) }
		</>
	);
}
