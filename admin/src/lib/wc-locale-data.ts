/**
 * Country and currency lists supplied by WooCommerce itself
 * (WC()->countries->get_countries() / get_woocommerce_currencies()),
 * localized into window.zexstData by class-plugin.php, so the plugin offers
 * exactly the set the store's own settings use.
 */
import { decodeHtml } from '@/lib/utils';

export interface LocaleOption {
	code: string;
	name: string;
}

// PHP serializes an empty array as `[]` rather than `{}`, so both shapes
// are accepted.
function toOptions(
	raw: Record< string, string > | unknown[] | undefined
): LocaleOption[] {
	if ( ! raw || Array.isArray( raw ) ) {
		return [];
	}
	return Object.entries( raw ).map( ( [ code, name ] ) => ( {
		code,
		name: decodeHtml( String( name ) ),
	} ) );
}

export function getWcCountries(): LocaleOption[] {
	return toOptions( window.zexstData?.countries ).sort( ( a, b ) =>
		a.name.localeCompare( b.name )
	);
}

export function getWcCurrencies(): LocaleOption[] {
	return toOptions( window.zexstData?.currencies ).sort( ( a, b ) =>
		a.code.localeCompare( b.code )
	);
}
