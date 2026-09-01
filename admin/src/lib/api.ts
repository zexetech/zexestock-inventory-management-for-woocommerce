import type { ApiError, AdjustStockResponse } from '@/types/api';

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
