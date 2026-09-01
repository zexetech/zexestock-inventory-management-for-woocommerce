import * as React from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
	theme: Theme;
	resolvedTheme: 'light' | 'dark';
	setTheme: ( theme: Theme ) => void;
	toggleTheme: () => void;
}

const ThemeContext = React.createContext< ThemeContextValue | undefined >(
	undefined
);

const STORAGE_KEY = 'zexst-theme';

function getSystemTheme(): 'light' | 'dark' {
	if (
		typeof window !== 'undefined' &&
		window.matchMedia( '(prefers-color-scheme: dark)' ).matches
	) {
		return 'dark';
	}
	return 'light';
}

function resolveTheme( theme: Theme ): 'light' | 'dark' {
	return theme === 'system' ? getSystemTheme() : theme;
}

function readStoredTheme(): Theme {
	try {
		const stored = localStorage.getItem( STORAGE_KEY );
		if ( stored === 'light' || stored === 'dark' || stored === 'system' ) {
			return stored;
		}
	} catch {
	}
	return 'system';
}

function persistTheme( theme: Theme ): void {
	try {
		localStorage.setItem( STORAGE_KEY, theme );
	} catch {
	}

	const nonce = window.zexstData?.nonce;
	if ( nonce ) {
		void fetch( '/wp-json/zexestock/v1/user-prefs', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce,
			},
			body: JSON.stringify( { theme } ),
		} ).catch( () => {
			
		} );
	}
}

interface ThemeProviderProps {
	children: React.ReactNode;
	containerRef: React.RefObject< HTMLElement >;
	defaultTheme?: Theme;
}

function ThemeProvider( {
	children,
	containerRef,
	defaultTheme,
}: ThemeProviderProps ) {
	const [ theme, setThemeState ] = React.useState< Theme >(
		defaultTheme ?? readStoredTheme
	);

	const resolved = resolveTheme( theme );

	React.useEffect( () => {
		const el = containerRef.current;
		if ( ! el ) {
			return;
		}

		if ( resolved === 'dark' ) {
			el.classList.add( 'dark' );
		} else {
			el.classList.remove( 'dark' );
		}
	}, [ resolved, containerRef ] );

	React.useEffect( () => {
		if ( theme !== 'system' ) {
			return;
		}

		const mq = window.matchMedia( '(prefers-color-scheme: dark)' );
		const handler = () => {
			const el = containerRef.current;
			if ( ! el ) {
				return;
			}
			if ( mq.matches ) {
				el.classList.add( 'dark' );
			} else {
				el.classList.remove( 'dark' );
			}
		};
		mq.addEventListener( 'change', handler );
		return () => mq.removeEventListener( 'change', handler );
	}, [ theme, containerRef ] );

	const setTheme = React.useCallback( ( next: Theme ) => {
		setThemeState( next );
		persistTheme( next );
	}, [] );

	const toggleTheme = React.useCallback( () => {
		setTheme( resolved === 'dark' ? 'light' : 'dark' );
	}, [ resolved, setTheme ] );

	const value = React.useMemo< ThemeContextValue >(
		() => ( { theme, resolvedTheme: resolved, setTheme, toggleTheme } ),
		[ theme, resolved, setTheme, toggleTheme ]
	);

	return (
		<ThemeContext.Provider value={ value }>
			{ children }
		</ThemeContext.Provider>
	);
}

export { ThemeContext, ThemeProvider };
