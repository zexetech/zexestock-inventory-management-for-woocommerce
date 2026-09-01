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
	}

	interface Window {
		zexstData: ZexstData;
	}
}

export {};
