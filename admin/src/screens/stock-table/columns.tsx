import * as React from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Image } from 'lucide-react';
import type { Product } from '@/types/api';
import { StockCell } from './StockCell';
import { PriceCell } from './PriceCell';
import { SkuCell } from './SkuCell';
import { ThresholdCell } from './ThresholdCell';
import { MetaTextCell } from './MetaTextCell';
import { ProductTypeBadge } from './ProductTypeBadge';
import {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
	TooltipProvider,
} from '@/components/ui/tooltip';

const helper = createColumnHelper< Product >();

function decodeHtml( html: string ): string {
	const el = document.createElement( 'textarea' );
	el.innerHTML = html;
	return el.value;
}

export function buildColumns(
	expandedParentIds: Set< number >,
	onToggleExpand: ( id: number ) => void
) {
	return [
		helper.accessor( 'image_url', {
			id: 'image',
			enableResizing: false,
			header: () => (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center justify-center w-full cursor-default">
								<Image
									className="h-5 w-5 text-muted-foreground"
									aria-label="Image"
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent>Image</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			),
			cell: ( { row } ) => (
				<div className="flex items-center justify-center w-full px-[3px]">
					<img
						src={ row.original.image_url }
						alt=""
						className="h-10 w-10 rounded object-cover"
						loading="lazy"
					/>
				</div>
			),
			enableSorting: false,
			size: 44,
			minSize: 44,
			maxSize: 44,
		} ),

		helper.accessor( 'name', {
			id: 'name',
			header: 'Product',
			cell: ( { row } ) => {
				const { id, name, type } = row.original;
				const editUrl = `/wp-admin/post.php?post=${ id }&action=edit`;
				const isExpandable = type === 'variable';
				const isExpanded = isExpandable && expandedParentIds.has( id );
				return (
					<div className="flex items-center gap-2 min-w-0">
						{ isExpandable && (
							<button
								type="button"
								onClick={ () => onToggleExpand( id ) }
								className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-transform duration-200"
								style={ {
									transform: isExpanded
										? 'rotate(90deg)'
										: 'rotate(0deg)',
									display: 'inline-flex',
								} }
								aria-label={
									isExpanded
										? 'Collapse variations'
										: 'Expand variations'
								}
								aria-expanded={ isExpanded }
							>
								▶
							</button>
						) }
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<a
										href={ editUrl }
										target="_blank"
										rel="noreferrer"
										className="font-bold text-foreground no-underline hover:no-underline truncate whitespace-nowrap block min-w-0"
									>
										{ name }
									</a>
								</TooltipTrigger>
								<TooltipContent>{ name }</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
				);
			},
			enableSorting: true,
		} ),

		helper.accessor( 'sku', {
			id: 'sku',
			header: 'SKU',
			cell: ( { row } ) => (
				<SkuCell
					productId={ row.original.id }
					productName={ row.original.name }
					sku={ row.original.sku }
				/>
			),
			enableSorting: true,
			size: 120,
			minSize: 60,
		} ),

		helper.accessor( 'supplier_sku', {
			id: 'supplier_sku',
			header: 'Supplier SKU',
			cell: ( { row } ) =>
				row.original.type === 'variable' ||
				row.original.type === 'grouped' ? (
					<span className="text-muted-foreground text-sm">—</span>
				) : (
					<MetaTextCell
						productId={ row.original.id }
						productName={ row.original.name }
						field="supplier_sku"
						value={ row.original.supplier_sku ?? '' }
					/>
				),
			enableSorting: true,
			size: 130,
			minSize: 80,
		} ),

		helper.accessor( 'barcode', {
			id: 'barcode',
			header: 'Barcode',
			cell: ( { row } ) =>
				row.original.type === 'variable' ||
				row.original.type === 'grouped' ? (
					<span className="text-muted-foreground text-sm">—</span>
				) : (
					<MetaTextCell
						productId={ row.original.id }
						productName={ row.original.name }
						field="barcode"
						value={ row.original.barcode ?? '' }
					/>
				),
			enableSorting: true,
			size: 130,
			minSize: 80,
		} ),

		helper.accessor( 'type', {
			id: 'type',
			header: 'Type',
			cell: ( { getValue } ) => <ProductTypeBadge type={ getValue() } />,
			enableSorting: true,
			size: 90,
			minSize: 70,
		} ),

		helper.accessor( 'category', {
			id: 'category',
			header: 'Category',
			cell: ( { getValue } ) => {
				const raw = getValue();
				if ( ! raw ) {
					return (
						<span className="text-sm text-muted-foreground">—</span>
					);
				}
				const val = decodeHtml( raw );
				return (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="block max-w-[140px] truncate whitespace-nowrap text-sm text-muted-foreground cursor-default">
									{ val }
								</span>
							</TooltipTrigger>
							<TooltipContent>{ val }</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				);
			},
			enableSorting: true,
		} ),

		helper.accessor( 'stock_status', {
			id: 'stock_status',
			header: 'Status',
			cell: ( { row } ) => {
				if (
					row.original.type === 'variable' ||
					row.original.type === 'grouped'
				) {
					return (
						<span className="text-muted-foreground text-sm">—</span>
					);
				}
				const val = row.original.stock_status;
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
			},
			enableSorting: true,
		} ),

		helper.accessor( 'purchase_price', {
			id: 'purchase_price',
			header: () => (
				<div className="text-center w-full">Purchase Price</div>
			),
			cell: ( { row } ) => (
				<div className="flex justify-center">
					{ row.original.type === 'variable' ||
					row.original.type === 'grouped' ? (
						<span className="text-muted-foreground text-sm">—</span>
					) : (
						<PriceCell
							productId={ row.original.id }
							productName={ row.original.name }
							field="purchase_price"
							value={ row.original.purchase_price ?? null }
						/>
					) }
				</div>
			),
			enableSorting: true,
		} ),

		helper.accessor( 'regular_price', {
			id: 'regular_price',
			header: () => (
				<div className="text-center w-full">Regular Price</div>
			),
			cell: ( { row } ) => (
				<div className="flex justify-center">
					{ row.original.type === 'variable' ||
					row.original.type === 'grouped' ? (
						<span className="text-muted-foreground text-sm">—</span>
					) : (
						<PriceCell
							productId={ row.original.id }
							productName={ row.original.name }
							field="regular_price"
							value={ row.original.regular_price ?? null }
						/>
					) }
				</div>
			),
			enableSorting: true,
		} ),

		helper.accessor( 'sale_price', {
			id: 'sale_price',
			header: () => <div className="text-center w-full">Sale Price</div>,
			cell: ( { row } ) => (
				<div className="flex justify-center">
					{ row.original.type === 'variable' ||
					row.original.type === 'grouped' ? (
						<span className="text-muted-foreground text-sm">—</span>
					) : (
						<PriceCell
							productId={ row.original.id }
							productName={ row.original.name }
							field="sale_price"
							value={ row.original.sale_price ?? null }
							dateFromValue={
								row.original.date_on_sale_from ?? null
							}
							dateToValue={ row.original.date_on_sale_to ?? null }
						/>
					) }
				</div>
			),
			enableSorting: true,
		} ),

		helper.accessor( 'stock_qty', {
			id: 'stock_qty',
			header: 'Stock',
			cell: ( { row } ) => <StockCell product={ row.original } />,
			enableSorting: true,
		} ),

		helper.accessor( 'reserved_qty', {
			id: 'reserved_qty',
			header: () => <div className="text-center w-full">Reserved</div>,
			cell: ( { row } ) => {
				const { type, reserved_qty } = row.original;
				if ( type === 'variable' || type === 'grouped' ) {
					return (
						<span className="text-muted-foreground text-sm flex justify-center">
							—
						</span>
					);
				}
				if ( reserved_qty === 0 ) {
					return (
						<span className="text-muted-foreground text-sm flex justify-center">
							0
						</span>
					);
				}
				return (
					<div className="flex justify-center">
						<span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-warning-bg text-warning-fg">
							{ reserved_qty }
						</span>
					</div>
				);
			},
			enableSorting: false,
		} ),

		helper.accessor( 'low_stock_threshold_override', {
			id: 'low_stock_threshold_override',
			header: 'Threshold',
			cell: ( { row } ) => <ThresholdCell product={ row.original } />,
			enableSorting: true,
			size: 100,
			minSize: 80,
		} ),

		helper.accessor( 'sold_today', {
			id: 'sold_today',
			header: () => <div className="text-center w-full">Sold Today</div>,
			cell: ( { row } ) => {
				const { sold_today } = row.original;
				if ( sold_today === 0 ) {
					return (
						<div className="flex justify-center">
							<span className="text-muted-foreground text-sm">
								—
							</span>
						</div>
					);
				}
				return (
					<div className="flex justify-center">
						<span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold bg-success-bg text-success-fg">
							{ sold_today }
						</span>
					</div>
				);
			},
			enableSorting: true,
			size: 90,
			minSize: 70,
		} ),

		helper.accessor( 'sold_last_14_days', {
			id: 'sold_last_14_days',
			header: () => <div className="text-center w-full">Sold (14d)</div>,
			cell: ( { row } ) => {
				const { sold_last_14_days } = row.original;
				return (
					<div className="flex justify-center">
						<span
							className={
								sold_last_14_days === 0
									? 'text-muted-foreground text-sm'
									: 'text-sm font-medium text-foreground'
							}
						>
							{ sold_last_14_days }
						</span>
					</div>
				);
			},
			enableSorting: true,
			size: 100,
			minSize: 80,
		} ),
	];
}

export const DEFAULT_HIDDEN_COLUMNS: Record< string, boolean > = {
	reserved_qty: false,
	low_stock_threshold_override: false,
	purchase_price: false,
	supplier_sku: false,
	barcode: false,
};
