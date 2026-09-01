export interface ViewPreset {
	id: string;
	label: string;
	stock_status: string;
}

export const VIEW_PRESETS: ViewPreset[] = [
	{ id: 'all', label: 'All Products', stock_status: '' },
	{ id: 'low_stock', label: 'Low Stock', stock_status: 'low_stock' },
	{ id: 'out_of_stock', label: 'Out of Stock', stock_status: 'out_of_stock' },
];
