import * as React from 'react';
import { createRoot } from '@wordpress/element';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/app.css';
import './chartSetup';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';
import { DashboardScreen } from './DashboardScreen';

const queryClient = new QueryClient( {
	defaultOptions: { queries: { retry: 1 } },
} );

function DashboardApp() {
	const containerRef = React.useRef< HTMLDivElement >( null );

	return (
		<div className="zexst-app" ref={ containerRef }>
			<ThemeProvider containerRef={ containerRef }>
				<QueryClientProvider client={ queryClient }>
					<DashboardScreen />
					<Toaster />
				</QueryClientProvider>
			</ThemeProvider>
		</div>
	);
}

const mountId = 'zexst-dashboard-root';
const container = document.getElementById( mountId );

if ( container ) {
	createRoot( container ).render( <DashboardApp /> );
}
