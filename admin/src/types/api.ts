export type ProductType =
	| 'simple'
	| 'variable'
	| 'variation'
	| 'grouped'
	| 'external'
	| 'virtual'
	| 'downloadable';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | '';

export interface Product {
	id: number;
	parent_id: number;
	type: ProductType;
	name: string;
	sku: string;
	image_url: string;
	stock_qty: number | null;
	stock_status: StockStatus | null;
	category: string;
	manage_stock: boolean;
	regular_price: string | null;
	sale_price: string | null;
	date_on_sale_from: string | null;
	date_on_sale_to: string | null;
	reserved_qty: number;
	sold_today: number;
	sold_last_14_days: number;
	low_stock_threshold_override: number | null;
	purchase_price: string | null;
	supplier_sku: string;
	barcode: string;
	variations?: Product[] | null;
	children?: Product[] | null;
}

export interface ApiMeta {
	total: number;
	total_pages: number;
	page: number;
	per_page: number;
}

export interface ProductsResponse {
	data: Product[];
	meta: ApiMeta;
}

export interface AdjustStockResponse {
	product_id: number;
	variation_id: number;
	previous_stock: number | null;
	new_stock: number;
	adjustment: number;
}

export interface ApiError {
	code: string;
	message: string;
	data?: {
		status: number;
		current_stock?: number;
	};
}

