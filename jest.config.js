const preset = require( '@wordpress/jest-preset-default/jest-preset' );

module.exports = {
	...preset,
	moduleNameMapper: {
		...preset.moduleNameMapper,
		'^@/(.*)$': '<rootDir>/admin/src/$1',
	},
	setupFilesAfterEnv: [
		...( preset.setupFilesAfterEnv ?? [] ),
		'<rootDir>/admin/src/test/setup.ts',
	],
	transform: {
		'\\.[jt]sx?$': require.resolve( '@wordpress/scripts/config/babel-transform' ),
		'\\.mjs$':     require.resolve( '@wordpress/scripts/config/babel-transform' ),
	},
	transformIgnorePatterns: [
		'/node_modules/(?!(msw|@mswjs|rettime|headers-polyfill|@open-draft\\/deferred-promise|until-async)/)',
	],
	testPathIgnorePatterns: [
		'/node_modules/',
		'<rootDir>/admin/src/test/setup\\.ts',
		'<rootDir>/admin/src/test/renderHook\\.tsx',
	],
	testEnvironmentOptions: {
		customExportConditions: [ 'node', 'require', 'default' ],
	},
	testEnvironment: 'jest-environment-jsdom',
};
