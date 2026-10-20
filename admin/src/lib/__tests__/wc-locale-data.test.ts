import { getWcCountries, getWcCurrencies } from '../wc-locale-data';

describe( 'wc-locale-data', () => {
	const original = window.zexstData;

	afterEach( () => {
		window.zexstData = original;
	} );

	function setData( extra: Partial< Window[ 'zexstData' ] > ) {
		window.zexstData = { ...original, ...extra } as Window[ 'zexstData' ];
	}

	it( 'returns WooCommerce countries sorted by name with entities decoded', () => {
		setData( {
			countries: {
				US: 'United States (US)',
				AX: '&#197;land Islands',
				DE: 'Germany',
			},
		} );

		expect( getWcCountries() ).toEqual( [
			{ code: 'AX', name: 'Åland Islands' },
			{ code: 'DE', name: 'Germany' },
			{ code: 'US', name: 'United States (US)' },
		] );
	} );

	it( 'returns WooCommerce currencies sorted by code', () => {
		setData( {
			currencies: { USD: 'United States (US) dollar', EUR: 'Euro' },
		} );

		expect( getWcCurrencies() ).toEqual( [
			{ code: 'EUR', name: 'Euro' },
			{ code: 'USD', name: 'United States (US) dollar' },
		] );
	} );

	it( 'returns empty lists when the data is missing or an empty PHP array', () => {
		setData( { countries: undefined, currencies: [] as never } );

		expect( getWcCountries() ).toEqual( [] );
		expect( getWcCurrencies() ).toEqual( [] );
	} );
} );
