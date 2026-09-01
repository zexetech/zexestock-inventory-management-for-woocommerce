import '@testing-library/jest-dom';

class MockResizeObserver {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
}
(
	globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }
 ).ResizeObserver = MockResizeObserver;

Object.defineProperty( window, 'zexstData', {
	value: {
		restUrl: 'https://example.com/wp-json/zexestock/v1/',
		restNonce: 'test-nonce',
		ajaxUrl: 'https://example.com/wp-admin/admin-ajax.php',
		nonce: 'test-nonce',
		settings: {
			rowsPerPage: 25,
			lowStockThreshold: 10,
			allowNegativeStock: false,
			largeAdjustmentWarning: 500,
		},
		currentUser: { id: 1, name: 'Admin' },
	},
	writable: true,
} );
