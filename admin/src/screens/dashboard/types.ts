export type DatePeriod = '7d' | '30d' | '60d' | '90d' | 'custom';

export type SalesPeriod = 'day' | 'month' | 'ytd';

export interface DateRange {
	period: DatePeriod;
	dateFrom: string;
	dateTo: string;
}

export interface SalesSummaryData {
	revenue: number;
	orders: number;
	aov: number;
	currency: string;
}

export interface CurrentStockSummaryData {
	retail_value: number;
	cost_value: number;
	total_units: number;
	currency: string;
}

export interface LowStockSummaryData {
	out_of_stock: number;
	critical: number;
	warning: number;
	healthy: number;
	threshold: number;
}

export interface FastMoverItem {
	name: string;
	total_qty: number;
	units_per_day: number;
}

export interface FastMoversData {
	items: FastMoverItem[];
}

export interface LostSalesItem {
	name: string;
	sku: string;
	avg_daily: number;
	days: number;
	estimated_lost: number;
	currency: string;
}

export interface LostSalesData {
	items: LostSalesItem[];
	total_lost: number;
	currency: string;
}

export interface TopProductItem {
	name: string;
	total_qty: number;
	revenue: number;
	currency: string;
}

export interface TopProductsData {
	items: TopProductItem[];
}

export interface CategorySalesItem {
	category: string;
	revenue: number;
	total_qty: number;
}

export interface CategorySalesData {
	items: CategorySalesItem[];
	currency: string;
}

export interface AnalyticsSectionSummaryData {
	top_products: TopProductsData;
	sales_by_category: CategorySalesData;
	fast_movers: FastMoversData;
	lost_sales: LostSalesData;
}
