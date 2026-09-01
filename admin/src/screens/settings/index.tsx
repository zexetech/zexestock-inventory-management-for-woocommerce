import * as React from 'react';
import { createRoot } from '@wordpress/element';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/app.css';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';
import { SettingsScreen } from './SettingsScreen';

const queryClient = new QueryClient( {
	defaultOptions: { queries: { retry: 1 } },
} );

function SettingsApp() {
	const containerRef = React.useRef< HTMLDivElement >( null );

	return (
		<div className="zexst-app" ref={ containerRef }>
			<ThemeProvider containerRef={ containerRef }>
				<QueryClientProvider client={ queryClient }>
					<SettingsScreen />
					<Toaster />
				</QueryClientProvider>
			</ThemeProvider>
		</div>
	);
}

const mountId = 'zexst-settings-root';
const container = document.getElementById( mountId );

if ( container ) {
	createRoot( container ).render( <SettingsApp /> );
}
