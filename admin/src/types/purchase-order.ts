export type POStatus =
	| 'draft'
	| 'sent'
	| 'partially_received'
	| 'received'
	| 'cancelled';

export interface POItem {
	id: number;
	po_id: number;
	product_id: number;
	sku: string | null;
	product_name: string;
	supplier_sku: string | null;
	purchase_unit: string | null;
	quantity_ordered: number;
	quantity_received: number;
	unit_cost: number;
	/** The product's current purchase price meta, not a snapshot. */
	purchase_price: string | null;
}

export interface PurchaseOrder {
	id: number;
	po_number: string;
	supplier_id: number;
	supplier_name: string;
	supplier_contact_name: string | null;
	supplier_email: string | null;
	supplier_phone: string | null;
	supplier_address_line_1: string | null;
	supplier_address_line_2: string | null;
	supplier_city: string | null;
	supplier_state: string | null;
	supplier_postal_code: string | null;
	supplier_country: string | null;
	status: POStatus;
	currency: string;
	internal_notes: string | null;
	supplier_notes: string | null;
	email_to: string | null;
	created_by: number;
	cancelled_by: number | null;
	cancellation_reason: string | null;
	po_date: string | null;
	discount_percent: number;
	tax_rate_percent: number;
	supplier_fee: number;
	shipping_cost: number;
	total_cost: number;
	created_at: string;
	updated_at: string;
	sent_at: string | null;
	last_email_sent_at: string | null;
	expected_at: string | null;
	received_at: string | null;
	cancelled_at: string | null;
	items: POItem[];
}

export type PurchaseOrderSummary = Omit< PurchaseOrder, 'items' >;

export interface PurchaseOrdersResponse {
	items: PurchaseOrderSummary[];
	total: number;
}

export interface POItemInput {
	product_id: number;
	quantity_ordered: number;
	unit_cost?: number;
	supplier_sku?: string;
	purchase_unit?: string;
}

export interface CreatePOInput {
	supplier_id: number;
	items: POItemInput[];
	po_number?: string;
	po_date?: string;
	internal_notes?: string;
	supplier_notes?: string;
	email_to?: string;
	discount_percent?: number;
	tax_rate_percent?: number;
	supplier_fee?: number;
	shipping_cost?: number;
}

export interface UpdatePOInput {
	items?: POItemInput[];
	po_number?: string;
	po_date?: string;
	internal_notes?: string;
	supplier_notes?: string;
	email_to?: string;
	discount_percent?: number;
	tax_rate_percent?: number;
	supplier_fee?: number;
	shipping_cost?: number;
}

export interface ReceivePOItemInput {
	item_id: number;
	quantity_received: number;
}
