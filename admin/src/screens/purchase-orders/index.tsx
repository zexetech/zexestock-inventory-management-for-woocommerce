/**
 * Purchase Orders screen entry point.
 */

import * as React from 'react';
import { createRoot } from '@wordpress/element';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/app.css';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';
import { PurchaseOrdersScreen } from './PurchaseOrdersScreen';

const queryClient = new QueryClient( {
	defaultOptions: { queries: { retry: 1 } },
} );

function PurchaseOrdersApp() {
	const containerRef = React.useRef< HTMLDivElement >( null );

	return (
		<div className="zexst-app" ref={ containerRef }>
			<ThemeProvider containerRef={ containerRef }>
				<QueryClientProvider client={ queryClient }>
					<PurchaseOrdersScreen />
					<Toaster />
				</QueryClientProvider>
			</ThemeProvider>
			<div id="zexst-portal" />
		</div>
	);
}

const mountId = 'zexst-purchase-orders-root';
const container = document.getElementById( mountId );

if ( container ) {
	createRoot( container ).render( <PurchaseOrdersApp /> );
}
