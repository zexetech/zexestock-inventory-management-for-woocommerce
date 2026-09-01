const path = require( 'path' );
const rawDefault = require( '@wordpress/scripts/config/webpack.config' );

const defaultConfig = Array.isArray( rawDefault ) ? rawDefault[ 0 ] : rawDefault;

const { entry: _defaultEntry, ...defaultConfigWithoutEntry } = defaultConfig;

module.exports = ( env, argv ) => ( {
	...defaultConfigWithoutEntry,

	entry: {
		'dashboard':   path.resolve( __dirname, 'admin/src/screens/dashboard/index.tsx' ),
		'stock-table': path.resolve( __dirname, 'admin/src/screens/stock-table/index.tsx' ),
		'settings':    path.resolve( __dirname, 'admin/src/screens/settings/index.tsx' ),
	},

	output: {
		...defaultConfig.output,
		path: path.resolve( __dirname, 'admin/build' ),
		filename: '[name].js',
	},

	resolve: {
		...defaultConfig.resolve,
		alias: {
			...( defaultConfig.resolve?.alias ?? {} ),
			'@': path.resolve( __dirname, 'admin/src' ),
		},
	},

	devtool: argv.mode === 'production' ? false : defaultConfig.devtool,
} );
