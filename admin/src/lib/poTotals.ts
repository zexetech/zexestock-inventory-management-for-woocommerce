/**
 * Mirrors ZEXST_Purchase_Order_Manager::compute_total_cost() on the backend
 * (class-purchase-order-manager.php) — that copy is authoritative (what
 * actually gets persisted); this one exists purely for instant client-side
 * live display (CreatePODialog's totals breakdown, PurchaseOrderDetail's
 * read view) before the server round-trips.
 */
export interface POTotals {
	subtotal: number;
	discountAmt: number;
	taxAmt: number;
	totalCost: number;
}

function round2( value: number ): number {
	return Math.round( value * 100 ) / 100;
}

export function computePOTotals(
	subtotal: number,
	discountPercent: number,
	taxRatePercent: number,
	supplierFee: number,
	shippingCost: number
): POTotals {
	const discountAmt = round2( subtotal * ( discountPercent / 100 ) );
	const taxable = subtotal - discountAmt;
	const taxAmt = round2( taxable * ( taxRatePercent / 100 ) );
	const totalCost = round2( taxable + taxAmt + supplierFee + shippingCost );

	return {
		subtotal: round2( subtotal ),
		discountAmt,
		taxAmt,
		totalCost,
	};
}
