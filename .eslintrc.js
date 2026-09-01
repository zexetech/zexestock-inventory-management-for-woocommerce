const eslintConfig = {
	extends: [ require.resolve( '@wordpress/scripts/config/.eslintrc.js' ) ],
	rules: {
		camelcase: [
			'error',
			{
				properties: 'never',
				allow: [
					'^reserved_qty$',
					'^sold_today$',
					'^sold_last_14_days$',
					'^manage_stock$',
					'^purchase_price$',
					'^log_id$',
					'^previous_stock$',
					'^new_stock$',
					'^product_id$',
					'^product_name$',
					'^parent_id$',
				],
			},
		],
	},
};

module.exports = eslintConfig;
