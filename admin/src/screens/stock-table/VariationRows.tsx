import * as React from 'react';
import { CornerDownRight } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { StockCell } from './StockCell';
import { PriceCell } from './PriceCell';
import { MetaTextCell } from './MetaTextCell';
import { SkuCell } from './SkuCell';
import { ThresholdCell } from './ThresholdCell';
import { ProductTypeBadge } from './ProductTypeBadge';
import { useVariations } from '@/hooks/useVariations';
import type { Product, StockStatus } from '@/types/api';

function VariationCell( {
	columnId,
	variation,
}: {
	columnId: string;
	variation: Product;
} ) {
	switch ( columnId ) {
		case 'image':
			return (
				<div className="flex items-center justify-center w-full">
					{ variation.image_url ? (
						<img
							src={ variation.image_url }
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
			const editUrl = `/wp-admin/post.php?post=${ variation.parent_id }&action=edit`;
			return (
				<div className="flex items-center gap-2 pl-6 border-l-2 border-primary/40">
					<CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					<a
						href={ editUrl }
						target="_blank"
						rel="noreferrer"
						className="text-sm text-foreground no-underline hover:no-underline truncate whitespace-nowrap block min-w-0"
					>
						{ variation.name }
					</a>
				</div>
			);
		}
		case 'sku':
			return (
				<SkuCell
					productId={ variation.id }
					productName={ variation.name }
					sku={ variation.sku ?? '' }
				/>
			);
		case 'stock_qty':
			return <StockCell product={ variation } />;
		case 'stock_status': {
			const val: StockStatus | null = variation.stock_status;
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
				<div className="flex justify-center">
					<PriceCell
						productId={ variation.id }
						productName={ variation.name }
						field="regular_price"
						value={ variation.regular_price ?? null }
					/>
				</div>
			);
		case 'sale_price':
			return (
				<div className="flex justify-center">
					<PriceCell
						productId={ variation.id }
						productName={ variation.name }
						field="sale_price"
						value={ variation.sale_price ?? null }
						dateFromValue={ variation.date_on_sale_from ?? null }
						dateToValue={ variation.date_on_sale_to ?? null }
					/>
				</div>
			);
		case 'purchase_price':
			return (
				<div className="flex justify-center">
					<PriceCell
						productId={ variation.id }
						productName={ variation.name }
						field="purchase_price"
						value={ variation.purchase_price ?? null }
					/>
				</div>
			);
		case 'supplier_sku':
			return (
				<MetaTextCell
					productId={ variation.id }
					productName={ variation.name }
					field="supplier_sku"
					value={ variation.supplier_sku ?? '' }
				/>
			);
		case 'barcode':
			return (
				<MetaTextCell
					productId={ variation.id }
					productName={ variation.name }
					field="barcode"
					value={ variation.barcode ?? '' }
				/>
			);
		case 'category':
			return <span className="text-sm text-muted-foreground">—</span>;
		case 'low_stock_threshold_override':
			return <ThresholdCell product={ variation } />;
		case 'type':
			return <ProductTypeBadge type={ variation.type } />;
		case 'sold_today':
			return (
				<div className="flex justify-center">
					{ variation.sold_today === 0 ? (
						<span className="text-muted-foreground text-sm">—</span>
					) : (
						<span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold bg-success-bg text-success-fg">
							{ variation.sold_today }
						</span>
					) }
				</div>
			);
		case 'sold_last_14_days':
			return (
				<div className="flex justify-center">
					<span
						className={
							variation.sold_last_14_days === 0
								? 'text-muted-foreground text-sm'
								: 'text-sm font-medium text-foreground'
						}
					>
						{ variation.sold_last_14_days }
					</span>
				</div>
			);
		default:
			return null;
	}
}

interface VariationRowsProps {
	productId: number;
	visibleColumnIds: string[];
	stockStatus?: string;
}

export function VariationRows( {
	productId,
	visibleColumnIds,
	stockStatus,
}: VariationRowsProps ) {
	const colSpan = visibleColumnIds.length;
	const {
		data: allVariations,
		isLoading,
		isError,
		refetch,
	} = useVariations( productId, true );

	const FILTERABLE_STATUSES = [ 'in_stock', 'low_stock', 'out_of_stock' ];
	const variations =
		stockStatus && FILTERABLE_STATUSES.includes( stockStatus )
			? ( allVariations ?? [] ).filter(
					( v ) => v.stock_status === stockStatus
			  )
			: allVariations;

	if ( isLoading ) {
		return (
			<>
				{ Array.from( { length: 2 } ).map( ( _, i ) => (
					<TableRow key={ i } className="bg-muted/30">
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
							Failed to load variations.
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

	if ( ! variations?.length ) {
		return (
			<TableRow className="bg-muted/20">
				<TableCell
					colSpan={ colSpan }
					className="py-2 pl-8 text-sm text-muted-foreground"
				>
					No variations found.
				</TableCell>
			</TableRow>
		);
	}

	return (
		<>
			{ variations.map( ( variation ) => (
				<TableRow
					key={ variation.id }
					className="!bg-row-child-bg hover:!bg-row-child-bg-hover"
				>
					{ visibleColumnIds.map( ( colId ) => (
						<TableCell key={ colId }>
							<VariationCell
								columnId={ colId }
								variation={ variation }
							/>
						</TableCell>
					) ) }
				</TableRow>
			) ) }
		</>
	);
}
