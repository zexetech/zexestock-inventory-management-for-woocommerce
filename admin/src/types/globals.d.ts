interface ZexstCategory {
	id: number;
	slug: string;
	name: string;
}

interface ZexstSettings {
	rowsPerPage: number;
	lowStockThreshold: number;
	allowNegativeStock: boolean;
	largeAdjustmentWarning: number;
}

interface ZexstCurrentUser {
	id: number;
	name: string;
}

declare global {
	interface ZexstData {
		nonce: string;
		restNonce?: string;
		restUrl: string;
		settings: ZexstSettings;
		currentUser: ZexstCurrentUser;
		categories?: ZexstCategory[];
		currency?: string;
		ajaxUrl?: string;
		pdfObjectUrl?: string;
		/** WooCommerce country code => name (suppliers screen only). */
		countries?: Record< string, string >;
		/** WooCommerce currency code => name (suppliers screen only). */
		currencies?: Record< string, string >;
	}

	interface Window {
		zexstData: ZexstData;
	}
}

export {};
