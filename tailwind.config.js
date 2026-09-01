const { fontFamily } = require( 'tailwindcss/defaultTheme' );

module.exports = {
	content: [
		'./admin/src/**/*.{ts,tsx}',
	],

	important: '.zexst-app',

	corePlugins: {
		preflight: false,
	},

	theme: {
		container: {
			center: true,
			padding: '1rem',
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},

				'status-in-stock': {
					DEFAULT: 'hsl(var(--status-in-stock))',
					bg:      'hsl(var(--status-in-stock-bg))',
					fg:      'hsl(var(--status-in-stock-fg))',
					text:    'hsl(var(--status-in-stock-text))',
				},
				'status-low-stock': {
					DEFAULT: 'hsl(var(--status-low-stock))',
					bg:      'hsl(var(--status-low-stock-bg))',
					fg:      'hsl(var(--status-low-stock-fg))',
					text:    'hsl(var(--status-low-stock-text))',
				},
				'status-out-of-stock': {
					DEFAULT: 'hsl(var(--status-out-of-stock))',
					bg:      'hsl(var(--status-out-of-stock-bg))',
					fg:      'hsl(var(--status-out-of-stock-fg))',
					text:    'hsl(var(--status-out-of-stock-text))',
				},

				'type-simple':    { bg: 'hsl(var(--type-simple-bg))',    fg: 'hsl(var(--type-simple-fg))'    },
				'type-variable':  { bg: 'hsl(var(--type-variable-bg))',  fg: 'hsl(var(--type-variable-fg))'  },
				'type-variation': { bg: 'hsl(var(--type-variation-bg))', fg: 'hsl(var(--type-variation-fg))' },
				'type-grouped':   { bg: 'hsl(var(--type-grouped-bg))',   fg: 'hsl(var(--type-grouped-fg))'   },
				'type-external':     { bg: 'hsl(var(--type-external-bg))',     fg: 'hsl(var(--type-external-fg))'     },
				'type-virtual':      { bg: 'hsl(var(--type-virtual-bg))',      fg: 'hsl(var(--type-virtual-fg))'      },
				'type-downloadable': { bg: 'hsl(var(--type-downloadable-bg))', fg: 'hsl(var(--type-downloadable-fg))' },

				info: {
					DEFAULT: 'hsl(var(--info))',
					bg:      'hsl(var(--info-bg))',
					border:  'hsl(var(--info-border))',
					fg:      'hsl(var(--info-fg))',
					text:    'hsl(var(--info-text))',
				},

				warning: {
					DEFAULT: 'hsl(var(--warning))',
					bg:      'hsl(var(--warning-bg))',
					border:  'hsl(var(--warning-border))',
					fg:      'hsl(var(--warning-fg))',
				},

				'row-child': {
					bg:       'hsl(var(--row-child-bg))',
					'bg-hover': 'hsl(var(--row-child-bg-hover))',
				},
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			fontFamily: {
				sans: [ 'var(--font-sans)', ...fontFamily.sans ],
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' },
				},
				'fade-in': {
					from: { opacity: '0', transform: 'translateY(-4px)' },
					to: { opacity: '1', transform: 'translateY(0)' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.15s ease-out',
			},
		},
	},

	plugins: [],
};
