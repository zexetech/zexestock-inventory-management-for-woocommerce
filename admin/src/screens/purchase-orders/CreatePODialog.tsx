import * as React from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
	DialogClose,
} from '@/components/ui/dialog';
import {
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableHead,
	TableCell,
} from '@/components/ui/table';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSetMeta } from '@/hooks/useSetMeta';
import { useSupplierProductsForSupplier } from '@/hooks/useSupplierProducts';
import {
	useCreatePurchaseOrder,
	useUpdatePurchaseOrder,
	useNextPONumber,
	usePONumberAvailable,
} from '@/hooks/usePurchaseOrders';
import { SupplierPicker, SUPPLIER_PICKER_PARAMS } from './SupplierPicker';
import { computePOTotals } from '@/lib/poTotals';
import { computeSuggestedQuantity } from '@/lib/reorder';
import { decodeHtml } from '@/lib/utils';
import {
	MAX_PO_ITEMS,
	MAX_PO_NUMBER_LENGTH,
	MAX_STOCK,
	MAX_UNIT_COST,
	MAX_DISCOUNT_PERCENT,
	MAX_TAX_RATE_PERCENT,
	MAX_SUPPLIER_FEE,
	MAX_SHIPPING_COST,
} from '@/lib/validation';
import type { Product } from '@/types/api';
import type { POItemInput, PurchaseOrder } from '@/types/purchase-order';
import type { Supplier } from '@/types/supplier';
import { ProductPicker } from './ProductPicker';
import { NumericInput } from './NumericInput';

export interface DraftLine extends POItemInput {
	product_name: string;
	purchase_price?: number;

	purchase_price_known?: boolean;
}

interface PendingPriceUpdate {
	productId: number;
	productName: string;
	from: number | undefined;
	to: number;
}

function costDiffersFromPurchasePrice( line: DraftLine ): boolean {
	if ( ! line.purchase_price_known || line.unit_cost === undefined ) {
		return false;
	}
	return (
		line.purchase_price === undefined ||
		Math.abs( line.unit_cost - line.purchase_price ) >= 0.005
	);
}

export function parsePurchasePrice(
	raw: string | null | undefined
): number | undefined {
	if ( typeof raw !== 'string' || raw.trim() === '' ) {
		return undefined;
	}
	const value = Number( raw );
	return Number.isFinite( value ) && value >= 0 ? value : undefined;
}

function linesFromPO( po: PurchaseOrder ): DraftLine[] {
	return po.items.map( ( item ) => ( {
		product_id: item.product_id,
		product_name: item.product_name,
		quantity_ordered: item.quantity_ordered,
		unit_cost: item.unit_cost,
		supplier_sku: item.supplier_sku ?? undefined,
		purchase_unit: item.purchase_unit ?? undefined,
		purchase_price: parsePurchasePrice( item.purchase_price ),
		purchase_price_known: true,
	} ) );
}

export function CreatePODialog( {
	open,
	onOpenChange,
	initialSupplierId,
	initialItems,
	editingPO,
}: {
	open: boolean;
	onOpenChange: ( open: boolean ) => void;
	initialSupplierId?: number;
	initialItems?: DraftLine[];
	editingPO?: PurchaseOrder;
} ) {
	const [ supplierId, setSupplierId ] = React.useState< number | null >(
		editingPO?.supplier_id ?? initialSupplierId ?? null
	);
	const [ lines, setLines ] = React.useState< DraftLine[] >(
		( editingPO && linesFromPO( editingPO ) ) ?? initialItems ?? []
	);
	const [ poNumber, setPoNumber ] = React.useState(
		editingPO?.po_number ?? ''
	);
	const [ debouncedPoNumber, setDebouncedPoNumber ] = React.useState(
		poNumber.trim()
	);
	// Set once the user types, so a late next-number response can't overwrite it.
	const poNumberTouchedRef = React.useRef( false );
	const [ poDate, setPoDate ] = React.useState( editingPO?.po_date ?? '' );
	const [ supplierNotes, setSupplierNotes ] = React.useState(
		editingPO?.supplier_notes ?? ''
	);
	const [ discountPercent, setDiscountPercent ] = React.useState(
		editingPO?.discount_percent ?? 0
	);
	const [ taxRatePercent, setTaxRatePercent ] = React.useState(
		editingPO?.tax_rate_percent ?? 0
	);
	const [ supplierFee, setSupplierFee ] = React.useState(
		editingPO?.supplier_fee ?? 0
	);
	const [ shippingCost, setShippingCost ] = React.useState(
		editingPO?.shipping_cost ?? 0
	);

	const { data: suppliersData } = useSuppliers( SUPPLIER_PICKER_PARAMS );
	const createPO = useCreatePurchaseOrder();
	const updatePO = useUpdatePurchaseOrder();
	const setMeta = useSetMeta();
	const [ pendingPrice, setPendingPrice ] =
		React.useState< PendingPriceUpdate | null >( null );

	const pendingSeedRef = React.useRef< number | null >( null );

	function applySupplierRates( supplier: Supplier ) {
		setDiscountPercent( supplier.discount_percent ?? 0 );
		setTaxRatePercent( supplier.tax_rate_percent ?? 0 );
	}

	function handleSupplierChange(
		id: number,
		supplier: Supplier | undefined
	) {
		pendingSeedRef.current = null;
		setSupplierId( id );
		if ( supplier ) {
			applySupplierRates( supplier );
		}
	}

	React.useEffect( () => {
		if ( open ) {
			pendingSeedRef.current = editingPO
				? null
				: initialSupplierId ?? null;
			setSupplierId(
				editingPO?.supplier_id ?? initialSupplierId ?? null
			);
			setLines(
				( editingPO && linesFromPO( editingPO ) ) ?? initialItems ?? []
			);
			poNumberTouchedRef.current = false;
			setPoNumber( editingPO?.po_number ?? '' );
			setPoDate( editingPO?.po_date ?? '' );
			setSupplierNotes( editingPO?.supplier_notes ?? '' );
			setDiscountPercent( editingPO?.discount_percent ?? 0 );
			setTaxRatePercent( editingPO?.tax_rate_percent ?? 0 );
			setSupplierFee( editingPO?.supplier_fee ?? 0 );
			setShippingCost( editingPO?.shipping_cost ?? 0 );
		} else {
			pendingSeedRef.current = null;
			setSupplierId( null );
			setLines( [] );
			setPoNumber( '' );
			setPoDate( '' );
			setSupplierNotes( '' );
			setDiscountPercent( 0 );
			setTaxRatePercent( 0 );
			setSupplierFee( 0 );
			setShippingCost( 0 );
		}
	}, [ open, initialSupplierId, initialItems, editingPO ] );

	React.useEffect( () => {
		const pendingId = pendingSeedRef.current;
		if ( pendingId === null ) {
			return;
		}
		const supplier = suppliersData?.items.find(
			( s ) => s.id === pendingId
		);
		if ( supplier ) {
			pendingSeedRef.current = null;
			applySupplierRates( supplier );
		}
	}, [ open, initialSupplierId, editingPO, suppliersData ] );

	const { data: nextNumber } = useNextPONumber( open && ! editingPO );
	React.useEffect( () => {
		if (
			open &&
			! editingPO &&
			nextNumber &&
			! poNumberTouchedRef.current
		) {
			setPoNumber( nextNumber.po_number );
		}
	}, [ open, editingPO, nextNumber ] );

	React.useEffect( () => {
		const timer = setTimeout(
			() => setDebouncedPoNumber( poNumber.trim() ),
			300
		);
		return () => clearTimeout( timer );
	}, [ poNumber ] );

	const trimmedPoNumber = poNumber.trim();
	const { data: poNumberCheck } = usePONumberAvailable(
		debouncedPoNumber,
		editingPO?.id,
		open && debouncedPoNumber !== editingPO?.po_number
	);
	const poNumberTaken =
		poNumberCheck?.available === false &&
		debouncedPoNumber === trimmedPoNumber;
	// Empty is only allowed on create, where the server then assigns one.
	let poNumberError: string | undefined;
	if ( editingPO && trimmedPoNumber === '' ) {
		poNumberError = 'PO number is required.';
	} else if ( poNumberTaken ) {
		poNumberError = 'A purchase order with this number already exists.';
	}

	function addProduct( product: Product ) {
		const purchasePrice = parsePurchasePrice( product.purchase_price );
		setLines( ( prev ) => [
			...prev,
			{
				product_id: product.id,
				product_name: product.name,
				quantity_ordered: 1,
				unit_cost: purchasePrice,
				purchase_price: purchasePrice,
				purchase_price_known: true,
				supplier_sku: product.supplier_sku || undefined,
			},
		] );
	}

	const { data: linkedData, isFetching: linkedFetching } =
		useSupplierProductsForSupplier( open ? supplierId : null, {
			per_page: MAX_PO_ITEMS,
		} );
	const linkedToAdd = ( linkedData?.items ?? [] ).filter(
		( item ) => ! lines.some( ( l ) => l.product_id === item.product_id )
	);

	function addLinkedProducts() {
		const room = MAX_PO_ITEMS - lines.length;
		const newLines = linkedToAdd.slice( 0, Math.max( room, 0 ) ).map(
			( item ): DraftLine => ( {
				product_id: item.product_id,
				product_name: item.product_name,
				// One unit, rounded up to the supplier's pack size and minimum.
				quantity_ordered: Math.ceil(
					computeSuggestedQuantity(
						1,
						0,
						item.order_multiple,
						item.minimum_order_qty
					)
				),
				unit_cost: item.unit_cost,
				supplier_sku: item.supplier_sku ?? undefined,
				purchase_unit: item.purchase_unit ?? undefined,
				purchase_price: parsePurchasePrice( item.purchase_price ),
				purchase_price_known: true,
			} )
		);
		setLines( ( prev ) => [ ...prev, ...newLines ] );
	}

	function updateLine(
		index: number,
		patch: Partial< Omit< DraftLine, 'product_id' | 'product_name' > >
	) {
		setLines( ( prev ) =>
			prev.map( ( line, i ) =>
				i === index ? { ...line, ...patch } : line
			)
		);
	}

	// Only runs after an explicit Yes in the confirmation dialog.
	function confirmPurchasePriceUpdate() {
		if ( ! pendingPrice ) {
			return;
		}
		const { productId, productName, to } = pendingPrice;
		setPendingPrice( null );
		setMeta.mutate(
			{
				productId,
				productName,
				field: 'purchase_price',
				value: String( to ),
			},
			{
				onSuccess: () =>
					setLines( ( prev ) =>
						prev.map( ( line ) =>
							line.product_id === productId
								? { ...line, purchase_price: to }
								: line
						)
					),
			}
		);
	}

	function removeLine( index: number ) {
		setLines( ( prev ) => prev.filter( ( _, i ) => i !== index ) );
	}

	const subtotal = lines.reduce(
		( sum, line ) => sum + line.quantity_ordered * ( line.unit_cost ?? 0 ),
		0
	);
	const totals = computePOTotals(
		subtotal,
		discountPercent,
		taxRatePercent,
		supplierFee,
		shippingCost
	);

	const canSubmit =
		supplierId !== null &&
		lines.length > 0 &&
		lines.length <= MAX_PO_ITEMS &&
		! poNumberError;

	function handleSubmit() {
		if ( ! canSubmit || supplierId === null ) {
			return;
		}
		const fields = {
			items: lines.map(
				( {
					product_name,
					purchase_price,
					// eslint-disable-next-line camelcase
					purchase_price_known,
					...item
				} ) => item
			),
			po_number: trimmedPoNumber || undefined,
			po_date: poDate || undefined,
			discount_percent: discountPercent,
			tax_rate_percent: taxRatePercent,
			supplier_fee: supplierFee,
			shipping_cost: shippingCost,
		};

		if ( editingPO ) {
			// The supplier is fixed once a PO exists, so supplier_id is never
			// sent. Notes go as-is: an empty string is how an update clears them.
			updatePO.mutate(
				{
					id: editingPO.id,
					data: { ...fields, supplier_notes: supplierNotes },
				},
				{ onSuccess: () => onOpenChange( false ) }
			);
		} else {
			createPO.mutate(
				{
					...fields,
					supplier_id: supplierId,
					supplier_notes: supplierNotes || undefined,
				},
				{ onSuccess: () => onOpenChange( false ) }
			);
		}
	}

	return (
		<Dialog open={ open } onOpenChange={ onOpenChange }>
			<DialogContent
				className="max-w-6xl"
				onInteractOutside={ ( e ) => e.preventDefault() }
			>
				<DialogHeader>
					<DialogTitle>
						{ editingPO
							? 'Edit Purchase Order'
							: 'New Purchase Order' }
					</DialogTitle>
					<DialogDescription>
						{ editingPO
							? `Update the items and terms of ${ editingPO.po_number }.`
							: 'Select a supplier and add the products to order.' }
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 max-h-[65vh] overflow-y-auto pr-1">
					<div className="flex flex-col gap-1">
						<span
							id="po-supplier-label"
							className="text-sm font-medium leading-none text-foreground"
						>
							Supplier
						</span>
						{ editingPO ? (
							// Read from the PO's own snapshot, so an inactive or
							// deleted supplier still shows its name.
							<p
								aria-labelledby="po-supplier-label"
								className="text-sm text-foreground"
							>
								{ decodeHtml( editingPO.supplier_name ) }
							</p>
						) : (
							<SupplierPicker
								value={ supplierId }
								onChange={ handleSupplierChange }
							/>
						) }
					</div>

					<div className="grid grid-cols-2 gap-4">
						<Input
							label="PO number"
							id="po-number"
							value={ poNumber }
							maxLength={ MAX_PO_NUMBER_LENGTH }
							placeholder="Auto-generated"
							error={ poNumberError }
							onChange={ ( e ) => {
								poNumberTouchedRef.current = true;
								setPoNumber( e.target.value );
							} }
						/>
						<div className="flex flex-col gap-1">
							<label
								htmlFor="po-date"
								className="text-sm font-medium leading-none text-foreground"
							>
								PO date
							</label>
							{ /* The server fills an empty date with today. */ }
							<DatePicker
								id="po-date"
								value={ poDate }
								onChange={ setPoDate }
								placeholder="Defaults to today"
								className="w-48"
							/>
						</div>
					</div>

					<div>
						<div className="flex items-center justify-between mb-2">
							<span className="text-sm font-medium text-foreground">
								Items
							</span>
							<div className="flex items-center gap-2">
								{ supplierId !== null && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={ addLinkedProducts }
										disabled={
											linkedFetching ||
											linkedToAdd.length === 0 ||
											lines.length >= MAX_PO_ITEMS
										}
										title="Add every product linked to this supplier, using its supplier cost and SKU."
									>
										<Link2 className="h-4 w-4 mr-1.5" />
										Add linked products
										{ linkedToAdd.length > 0 &&
											` (${ linkedToAdd.length })` }
									</Button>
								) }
								<ProductPicker
									onSelect={ addProduct }
									excludeIds={ lines.map(
										( l ) => l.product_id
									) }
								/>
							</div>
						</div>

						{ lines.length > 0 && (
							<TooltipProvider>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Product</TableHead>
											<TableHead className="w-32 min-w-[8rem]">
												Quantity
											</TableHead>
											<TableHead className="w-28">
												Purchase price
											</TableHead>
											<TableHead className="w-44 min-w-[11rem]">
												Unit cost
											</TableHead>
											<TableHead className="w-10" />
										</TableRow>
									</TableHeader>
									<TableBody>
										{ lines.map( ( line, i ) => (
											<TableRow key={ line.product_id }>
												{ /* max-w-0 lets the cell shrink so long names truncate. */ }
												<TableCell className="max-w-0 w-full">
													<Tooltip>
														<TooltipTrigger asChild>
															<span className="block truncate">
																{
																	line.product_name
																}
															</span>
														</TooltipTrigger>
														<TooltipContent>
															{
																line.product_name
															}
														</TooltipContent>
													</Tooltip>
												</TableCell>
												<TableCell>
													<NumericInput
														aria-label={ `Quantity for ${ line.product_name }` }
														integer
														min={ 1 }
														max={ MAX_STOCK }
														value={
															line.quantity_ordered
														}
														onValueChange={ ( v ) =>
															updateLine( i, {
																quantity_ordered:
																	v,
															} )
														}
													/>
												</TableCell>
												<TableCell
													data-testid="po-line-purchase-price"
													className="text-muted-foreground"
												>
													{ line.purchase_price !==
													undefined
														? line.purchase_price.toFixed(
																2
														  )
														: '' }
												</TableCell>
												<TableCell>
													<NumericInput
														aria-label={ `Unit cost for ${ line.product_name }` }
														min={ 0 }
														max={ MAX_UNIT_COST }
														step="0.01"
														className="min-w-[8rem] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
														value={ line.unit_cost }
														onValueChange={ ( v ) =>
															updateLine( i, {
																unit_cost: v,
															} )
														}
													/>
													{ costDiffersFromPurchasePrice(
														line
													) && (
														<Button
															type="button"
															variant="link"
															size="sm"
															className="h-auto p-0 text-xs"
															disabled={
																setMeta.isPending
															}
															onClick={ () =>
																setPendingPrice(
																	{
																		productId:
																			line.product_id,
																		productName:
																			line.product_name,
																		from: line.purchase_price,
																		to:
																			line.unit_cost ??
																			0,
																	}
																)
															}
														>
															Set as purchase
															price
														</Button>
													) }
												</TableCell>
												<TableCell>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={ () =>
															removeLine( i )
														}
														aria-label={ `Remove ${ line.product_name }` }
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</TableCell>
											</TableRow>
										) ) }
									</TableBody>
								</Table>
							</TooltipProvider>
						) }

						{ lines.length === 0 && (
							<p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
								No items yet. Add a product to get started.
							</p>
						) }
					</div>

					<div className="grid grid-cols-2 gap-4">
						<Input
							label="Discount %"
							id="po-discount-percent"
							type="number"
							min={ 0 }
							max={ MAX_DISCOUNT_PERCENT }
							step="0.01"
							value={ discountPercent }
							onChange={ ( e ) => {
								pendingSeedRef.current = null;
								setDiscountPercent(
									Number( e.target.value ) || 0
								);
							} }
						/>
						<Input
							label="Tax rate %"
							id="po-tax-rate-percent"
							type="number"
							min={ 0 }
							max={ MAX_TAX_RATE_PERCENT }
							step="0.01"
							value={ taxRatePercent }
							onChange={ ( e ) => {
								pendingSeedRef.current = null;
								setTaxRatePercent(
									Number( e.target.value ) || 0
								);
							} }
						/>
						<Input
							label="Supplier fee"
							id="po-supplier-fee"
							type="number"
							min={ 0 }
							max={ MAX_SUPPLIER_FEE }
							step="0.01"
							value={ supplierFee }
							onChange={ ( e ) =>
								setSupplierFee( Number( e.target.value ) || 0 )
							}
						/>
						<Input
							label="Shipping cost"
							id="po-shipping-cost"
							type="number"
							min={ 0 }
							max={ MAX_SHIPPING_COST }
							step="0.01"
							value={ shippingCost }
							onChange={ ( e ) =>
								setShippingCost( Number( e.target.value ) || 0 )
							}
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="po-supplier-notes"
							className="text-sm font-medium leading-none text-foreground"
						>
							Supplier notes
						</label>
						<textarea
							id="po-supplier-notes"
							value={ supplierNotes }
							onChange={ ( e ) =>
								setSupplierNotes( e.target.value )
							}
							rows={ 2 }
							className="flex w-full rounded-md border border-solid border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						/>
					</div>

					{ /* Shown regardless of item count — discount/tax/fee/shipping are
						editable, and thus meaningfully affect the total, before any
						line item is added. */ }
					<div className="text-sm text-foreground space-y-0.5">
						<div className="flex justify-between">
							<span>Subtotal</span>
							<span>{ totals.subtotal.toFixed( 2 ) }</span>
						</div>
						<div className="flex justify-between text-muted-foreground">
							<span>Discount</span>
							<span>-{ totals.discountAmt.toFixed( 2 ) }</span>
						</div>
						<div className="flex justify-between text-muted-foreground">
							<span>Tax</span>
							<span>{ totals.taxAmt.toFixed( 2 ) }</span>
						</div>
						<div className="flex justify-between text-muted-foreground">
							<span>Fee + shipping</span>
							<span>
								{ ( supplierFee + shippingCost ).toFixed( 2 ) }
							</span>
						</div>
						<div className="flex justify-between font-medium border-t border-border pt-1 mt-1">
							<span>Total</span>
							<span>{ totals.totalCost.toFixed( 2 ) }</span>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={ () => onOpenChange( false ) }
						disabled={ createPO.isPending || updatePO.isPending }
					>
						Cancel
					</Button>
					<Button
						onClick={ handleSubmit }
						disabled={
							! canSubmit ||
							createPO.isPending ||
							updatePO.isPending
						}
					>
						{ editingPO ? 'Save' : 'Create' }
					</Button>
				</DialogFooter>
			</DialogContent>

			<Dialog
				open={ pendingPrice !== null }
				onOpenChange={ ( next ) => ! next && setPendingPrice( null ) }
			>
				<DialogContent
					role="alertdialog"
					className="z-[60] max-w-md"
					overlayClassName="z-[60]"
				>
					<DialogHeader>
						<DialogTitle>Update purchase price?</DialogTitle>
						<DialogDescription>
							{ pendingPrice &&
								`Update ${ decodeHtml(
									pendingPrice.productName
								) }'s purchase price from ${
									pendingPrice.from !== undefined
										? pendingPrice.from.toFixed( 2 )
										: 'none'
								} to ${ pendingPrice.to.toFixed(
									2
								) }? This changes the product itself, not just this PO.` }
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline">
								No
							</Button>
						</DialogClose>
						<Button
							type="button"
							onClick={ confirmPurchasePriceUpdate }
						>
							Yes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Dialog>
	);
}
