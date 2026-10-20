import type { ApiError, AdjustStockResponse } from '@/types/api';
import type {
	Supplier,
	SuppliersResponse,
	SupplierFormInput,
	SupplierProductLink,
	SupplierProductLinkInput,
	LowStockSupplierProductsResponse,
	SupplierProductsListResponse,
	AssignableUser,
} from '@/types/supplier';
import type {
	PurchaseOrder,
	PurchaseOrdersResponse,
	POStatus,
	CreatePOInput,
	UpdatePOInput,
	ReceivePOItemInput,
} from '@/types/purchase-order';

export class ApiRequestError extends Error {
	readonly status: number;
	readonly body: ApiError;

	constructor( status: number, body: ApiError ) {
		super( body.message ?? `Request failed with status ${ status }` );
		this.name = 'ApiRequestError';
		this.status = status;
		this.body = body;
	}
}

const _initNonce = window.zexstData?.restNonce ?? window.zexstData?.nonce ?? '';
const _initRestUrl = window.zexstData?.restUrl ?? '/wp-json/zexestock/v1/';

function getNonce(): string {
	return window.zexstData?.restNonce ?? window.zexstData?.nonce ?? _initNonce;
}

function getRestUrl(): string {
	const base = window.zexstData?.restUrl ?? _initRestUrl;
	return base.endsWith( '/' ) ? base : base + '/';
}

async function request< T >(
	path: string,
	options: RequestInit = {}
): Promise< T > {
	const url = getRestUrl() + path.replace( /^\//, '' );

	const headers = new Headers( options.headers );
	headers.set( 'X-WP-Nonce', getNonce() );
	if ( ! headers.has( 'Content-Type' ) && options.body ) {
		headers.set( 'Content-Type', 'application/json' );
	}

	const response = await fetch( url, {
		...options,
		headers,
		credentials: 'include',
	} );

	if ( ! response.ok ) {
		let body: ApiError;
		try {
			body = ( await response.json() ) as ApiError;
		} catch {
			body = { code: 'unknown', message: response.statusText };
		}
		throw new ApiRequestError( response.status, body );
	}

	return response.json() as Promise< T >;
}

export async function apiGet< T >(
	path: string,
	params: Record< string, string | number | boolean | undefined > = {}
): Promise< T > {
	const qs = new URLSearchParams();
	for ( const [ key, value ] of Object.entries( params ) ) {
		if ( value !== undefined && value !== '' ) {
			qs.set( key, String( value ) );
		}
	}
	const query = qs.toString();
	return request< T >( query ? `${ path }?${ query }` : path );
}

export async function apiPost< T >(
	path: string,
	body: unknown
): Promise< T > {
	return request< T >( path, {
		method: 'POST',
		body: JSON.stringify( body ),
	} );
}

export async function apiDelete< T = void >( path: string ): Promise< T > {
	return request< T >( path, { method: 'DELETE' } );
}

/**
 * PATCH helper — sends a JSON body for a partial update.
 * @param path
 * @param body
 */
export async function apiPatch< T >(
	path: string,
	body: unknown
): Promise< T > {
	return request< T >( path, {
		method: 'PATCH',
		body: JSON.stringify( body ),
	} );
}

export async function adjustStock(
	productId: number,
	body: {
		adjustment: number;
		expected_stock?: number;
	}
): Promise< AdjustStockResponse > {
	return apiPost< AdjustStockResponse >(
		`products/${ productId }/adjust`,
		body
	);
}

export async function setPrice(
	productId: number,
	body: {
		regular_price?: string;
		sale_price?: string;
		date_on_sale_from?: string;
		date_on_sale_to?: string;
	}
): Promise< {
	id: number;
	regular_price: string;
	sale_price: string;
	date_on_sale_from: string | null;
	date_on_sale_to: string | null;
} > {
	return apiPost( `products/${ productId }/set-price`, body );
}

export async function setSku(
	productId: number,
	sku: string
): Promise< { id: number; sku: string } > {
	return apiPost( `products/${ productId }/set-sku`, { sku } );
}

export async function setMeta(
	productId: number,
	body: {
		purchase_price?: string;
		supplier_sku?: string;
		barcode?: string;
	}
): Promise< {
	id: number;
	purchase_price: string | null;
	supplier_sku: string;
	barcode: string;
} > {
	return apiPost( `products/${ productId }/set-meta`, body );
}

export async function setThreshold(
	productId: number,
	threshold: number | null
): Promise< { id: number; threshold: number | null } > {
	return request< { id: number; threshold: number | null } >(
		`products/${ productId }/threshold`,
		{
			method: 'PATCH',
			body: JSON.stringify( { threshold } ),
		}
	);
}

export async function batchSetManageStock(
	ids: number[],
	manageStock: boolean
): Promise< {
	results: Array< {
		id: number;
		success: boolean;
		manage_stock?: boolean;
		error?: string;
	} >;
} > {
	return apiPost( 'products/batch-set-manage-stock', {
		ids,
		manage_stock: manageStock,
	} );
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export interface SuppliersParams {
	search?: string;
	status?: 'active' | 'inactive';
	page?: number;
	per_page?: number;
}

/**
 * GET /suppliers — paginated/filtered supplier list.
 * @param params
 */
export async function getSuppliers(
	params: SuppliersParams = {}
): Promise< SuppliersResponse > {
	return apiGet< SuppliersResponse >(
		'suppliers',
		params as Record< string, string | number | boolean | undefined >
	);
}

/**
 * GET /suppliers/{id}
 * @param id
 */
export async function getSupplier( id: number ): Promise< Supplier > {
	return apiGet< Supplier >( `suppliers/${ id }` );
}

/**
 * POST /suppliers
 * @param data
 */
export async function createSupplier(
	data: SupplierFormInput
): Promise< Supplier > {
	return apiPost< Supplier >( 'suppliers', data );
}

/**
 * PATCH /suppliers/{id}
 * @param id
 * @param data
 */
export async function updateSupplier(
	id: number,
	data: Partial< SupplierFormInput >
): Promise< Supplier > {
	return apiPatch< Supplier >( `suppliers/${ id }`, data );
}

/**
 * DELETE /suppliers/{id} — fails with zexst_supplier_in_use (409) if any product is still linked.
 * @param id
 */
export async function deleteSupplier(
	id: number
): Promise< { deleted: true } > {
	return apiDelete< { deleted: true } >( `suppliers/${ id }` );
}

/**
 * GET /suppliers/assignable-users — every user eligible for the supplier
 * "Assigned To" field.
 */
export async function getAssignableUsers(): Promise< AssignableUser[] > {
	return apiGet< AssignableUser[] >( 'suppliers/assignable-users' );
}

// ---------------------------------------------------------------------------
// Product <-> supplier link (one optional supplier per product, v1)
// ---------------------------------------------------------------------------

/**
 * GET /products/{id}/supplier — null when the product has no linked supplier.
 * @param productId
 */
export async function getProductSupplier(
	productId: number
): Promise< SupplierProductLink | null > {
	return apiGet< SupplierProductLink | null >(
		`products/${ productId }/supplier`
	);
}

/**
 * POST /products/{id}/supplier — creates or replaces the product's supplier link.
 * @param productId
 * @param data
 */
export async function setProductSupplier(
	productId: number,
	data: SupplierProductLinkInput
): Promise< SupplierProductLink > {
	return apiPost< SupplierProductLink >(
		`products/${ productId }/supplier`,
		data
	);
}

/**
 * DELETE /products/{id}/supplier
 * @param productId
 */
export async function removeProductSupplier(
	productId: number
): Promise< { removed: true } > {
	return apiDelete< { removed: true } >( `products/${ productId }/supplier` );
}

/**
 * GET /suppliers/{id}/low-stock-products — other low-stock products sharing this active supplier.
 * @param supplierId
 * @param excludeProductId
 */
export async function getLowStockSupplierProducts(
	supplierId: number,
	excludeProductId?: number
): Promise< LowStockSupplierProductsResponse > {
	return apiGet< LowStockSupplierProductsResponse >(
		`suppliers/${ supplierId }/low-stock-products`,
		excludeProductId ? { exclude: excludeProductId } : undefined
	);
}

/**
 * GET /suppliers/{id}/products — paginated listing of a supplier's active product links.
 * @param supplierId
 * @param params
 * @param params.page
 * @param params.per_page
 */
export async function getSupplierProductsList(
	supplierId: number,
	params?: { page?: number; per_page?: number }
): Promise< SupplierProductsListResponse > {
	return apiGet< SupplierProductsListResponse >(
		`/suppliers/${ supplierId }/products`,
		params
	);
}

// ---------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------

export interface PurchaseOrdersParams {
	status?: POStatus;
	supplier_id?: number;
	search?: string;
	page?: number;
	per_page?: number;
}

/**
 * GET /purchase-orders — paginated/filtered PO list (summary shape, no line items).
 * @param params
 */
export async function getPurchaseOrders(
	params: PurchaseOrdersParams = {}
): Promise< PurchaseOrdersResponse > {
	return apiGet< PurchaseOrdersResponse >(
		'purchase-orders',
		params as Record< string, string | number | boolean | undefined >
	);
}

/**
 * GET /purchase-orders/{id} — full PO including line items.
 * @param id
 */
export async function getPurchaseOrder( id: number ): Promise< PurchaseOrder > {
	return apiGet< PurchaseOrder >( `purchase-orders/${ id }` );
}

/**
 * GET /purchase-orders/next-number — the number the create dialog pre-fills.
 */
export async function getNextPONumber(): Promise< { po_number: string } > {
	return apiGet< { po_number: string } >( 'purchase-orders/next-number' );
}

/**
 * GET /purchase-orders/number-available — whether no other PO uses this number.
 * @param poNumber
 * @param excludeId PO being edited, so its own number counts as available.
 */
export async function checkPONumberAvailable(
	poNumber: string,
	excludeId?: number
): Promise< { available: boolean } > {
	return apiGet< { available: boolean } >(
		'purchase-orders/number-available',
		{ po_number: poNumber, exclude_id: excludeId }
	);
}

/**
 * POST /purchase-orders — creates a new draft PO.
 * @param data
 */
export async function createPurchaseOrder(
	data: CreatePOInput
): Promise< PurchaseOrder > {
	return apiPost< PurchaseOrder >( 'purchase-orders', data );
}

/**
 * PATCH /purchase-orders/{id} — draft-only edit; fails with zexst_po_not_editable (409) otherwise.
 * @param id
 * @param data
 */
export async function updatePurchaseOrder(
	id: number,
	data: UpdatePOInput
): Promise< PurchaseOrder > {
	return apiPatch< PurchaseOrder >( `purchase-orders/${ id }`, data );
}

/**
 * DELETE /purchase-orders/{id} — draft-only; fails with zexst_po_not_deletable (409) otherwise.
 * @param id
 */
export async function deletePurchaseOrder(
	id: number
): Promise< { deleted: true } > {
	return apiDelete< { deleted: true } >( `purchase-orders/${ id }` );
}

/**
 * POST /purchase-orders/{id}/send — marks a draft PO as sent. Status change
 * only; no email is sent.
 * @param id
 */
export async function sendPurchaseOrder(
	id: number
): Promise< PurchaseOrder > {
	return apiPost< PurchaseOrder >( `purchase-orders/${ id }/send`, {} );
}

/**
 * POST /purchase-orders/{id}/receive
 * @param id
 * @param items
 */
export async function receivePurchaseOrderItems(
	id: number,
	items: ReceivePOItemInput[]
): Promise< PurchaseOrder > {
	return apiPost< PurchaseOrder >( `purchase-orders/${ id }/receive`, {
		items,
	} );
}

/**
 * POST /purchase-orders/{id}/cancel
 * @param id
 * @param reason
 */
export async function cancelPurchaseOrder(
	id: number,
	reason?: string
): Promise< PurchaseOrder > {
	return apiPost< PurchaseOrder >(
		`purchase-orders/${ id }/cancel`,
		reason ? { reason } : {}
	);
}
