/**
 * Reorder-quantity suggestion for the "Create PO" low-stock trigger
 * (components/CreatePOButton.tsx). Pure function so it can be unit
 * tested without mocking the API layer.
 * @param threshold
 * @param currentStock
 * @param orderMultiple
 * @param minimumOrderQty
 */
export function computeSuggestedQuantity(
	threshold: number,
	currentStock: number,
	orderMultiple: number | null,
	minimumOrderQty: number | null
): number {
	let quantity = Math.max( threshold - currentStock, 1 );

	if ( orderMultiple && orderMultiple > 0 ) {
		quantity = Math.ceil( quantity / orderMultiple ) * orderMultiple;
	}

	if ( minimumOrderQty && minimumOrderQty > quantity ) {
		quantity = minimumOrderQty;
	}

	return quantity;
}
