export interface CustomField {
	label: string;
	value: string;
}

export interface AssignableUser {
	id: number;
	name: string;
}

export interface Supplier {
	id: number;
	supplier_code: string | null;
	name: string;
	contact_name: string | null;
	email: string | null;
	phone: string | null;
	website: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	country: string | null;
	currency: string;
	payment_terms: string | null;
	status: 'active' | 'inactive';
	notes: string | null;
	tax_number: string | null;
	fax: string | null;
	ordering_url: string | null;
	ordering_email: string | null;
	description: string | null;
	assigned_user_id: number | null;
	discount_percent: number | null;
	tax_rate_percent: number | null;
	days_to_cancel: number | null;
	cancelation_policy: string | null;
	custom_fields: CustomField[];
	created_at: string;
	updated_at: string;
}

export interface SuppliersResponse {
	items: Supplier[];
	total: number;
}

export interface SupplierFormInput {
	name: string;
	supplier_code?: string;
	contact_name?: string;
	email?: string;
	phone?: string;
	website?: string;
	address_line_1?: string;
	address_line_2?: string;
	city?: string;
	state?: string;
	postal_code?: string;
	country?: string;
	currency?: string;
	payment_terms?: string;
	status?: 'active' | 'inactive';
	notes?: string;
	tax_number?: string;
	fax?: string;
	ordering_url?: string;
	ordering_email?: string;
	description?: string;
	assigned_user_id?: number | null;
	discount_percent?: number | null;
	tax_rate_percent?: number | null;
	days_to_cancel?: number | null;
	cancelation_policy?: string;
	custom_fields?: CustomField[];
}

export interface SupplierProductLink {
	id: number;
	supplier_id: number;
	supplier_name: string;
	product_id: number;
	supplier_sku: string | null;
	unit_cost: number;
	currency: string;
	lead_time_days: number | null;
	minimum_order_qty: number | null;
	order_multiple: number | null;
	purchase_unit: string | null;
	is_active: boolean;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface SupplierProductLinkInput {
	supplier_id: number;
	supplier_sku?: string;
	unit_cost?: number;
	currency?: string;
	lead_time_days?: number;
	minimum_order_qty?: number;
	order_multiple?: number;
	purchase_unit?: string;
	notes?: string;
}

export interface LowStockSupplierProduct {
	product_id: number;
	product_name: string;
	sku: string;
	stock_qty: number;
	threshold: number;
	supplier_sku: string | null;
	unit_cost: number;
	purchase_price: string | null;
	currency: string;
	lead_time_days: number | null;
	minimum_order_qty: number | null;
	order_multiple: number | null;
	purchase_unit: string | null;
}

export interface LowStockSupplierProductsResponse {
	items: LowStockSupplierProduct[];
}

export interface SupplierProductListItem {
	id: number;
	product_id: number;
	product_name: string;
	sku: string;
	supplier_sku: string | null;
	unit_cost: number;
	purchase_price: string | null;
	currency: string;
	lead_time_days: number | null;
	minimum_order_qty: number | null;
	order_multiple: number | null;
	purchase_unit: string | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface SupplierProductsListResponse {
	items: SupplierProductListItem[];
	total: number;
}
