import {
	ApiRequestError,
	apiGet,
	apiPost,
	apiDelete,
	adjustStock,
	setPrice,
	setThreshold,
} from '../api';

const BASE = 'https://example.com/wp-json/zexestock/v1/';

function makeResponse( body: unknown, status = 200 ): Response {
	const json = JSON.stringify( body );
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText: String( status ),
		json: async () => JSON.parse( json ),
		text: async () => ( typeof body === 'string' ? body : json ),
	} as unknown as Response;
}

let fetchMock: jest.Mock;

beforeEach( () => {
	fetchMock = jest.fn();
	global.fetch = fetchMock;
} );

afterEach( () => {
	jest.restoreAllMocks();
} );

describe( 'ApiRequestError', () => {
	it( 'constructs with status and body', () => {
		const err = new ApiRequestError( 422, { code: 'err', message: 'bad' } );
		expect( err.status ).toBe( 422 );
		expect( err.body.code ).toBe( 'err' );
	} );

	it( 'message reflects the body message', () => {
		const err = new ApiRequestError( 422, {
			code: 'err',
			message: 'bad input',
		} );
		expect( err.message ).toBe( 'bad input' );
	} );
} );

describe( 'X-WP-Nonce injection', () => {
	it( 'injects X-WP-Nonce header on GET', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( [] ) );
		await apiGet( 'products' );
		const [ , init ] = fetchMock.mock.calls[ 0 ] as [ string, RequestInit ];
		const headers = init.headers as Headers;
		expect(
			( headers as unknown as Record< string, string > )[
				'X-WP-Nonce'
			] ??
				(
					headers as unknown as { get: ( k: string ) => string }
				 ).get?.( 'X-WP-Nonce' ) ??
				new Headers( headers ).get( 'X-WP-Nonce' )
		).toBe( 'test-nonce' );
	} );

	it( 'injects X-WP-Nonce header on POST', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( {} ) );
		await apiPost( 'products/1/adjust', {} );
		const [ , init ] = fetchMock.mock.calls[ 0 ] as [ string, RequestInit ];
		const h = new Headers( init.headers );
		expect( h.get( 'X-WP-Nonce' ) ).toBe( 'test-nonce' );
	} );

	it( 'injects X-WP-Nonce header on DELETE', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( {} ) );
		await apiDelete( 'views/1' );
		const [ , init ] = fetchMock.mock.calls[ 0 ] as [ string, RequestInit ];
		const h = new Headers( init.headers );
		expect( h.get( 'X-WP-Nonce' ) ).toBe( 'test-nonce' );
	} );
} );

describe( 'apiGet', () => {
	it( 'sends request to the correct URL', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( [] ) );
		await apiGet( 'products' );
		expect( fetchMock.mock.calls[ 0 ][ 0 ] ).toBe( BASE + 'products' );
	} );

	it( 'appends defined query params', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( [] ) );
		await apiGet( 'products', { page: 1, search: 'foo' } );
		const url: string = fetchMock.mock.calls[ 0 ][ 0 ];
		expect( url ).toContain( 'page=1' );
		expect( url ).toContain( 'search=foo' );
	} );

	it( 'excludes undefined params from the URL', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( [] ) );
		await apiGet( 'products', { page: 1, search: undefined } );
		const url: string = fetchMock.mock.calls[ 0 ][ 0 ];
		expect( url ).toContain( 'page=1' );
		expect( url ).not.toContain( 'search' );
	} );

	it( 'excludes empty-string params from the URL', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( [] ) );
		await apiGet( 'products', { search: '' } );
		const url: string = fetchMock.mock.calls[ 0 ][ 0 ];
		expect( url ).not.toContain( 'search' );
	} );

	it( 'returns parsed JSON on 200', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( { id: 1 } ) );
		const result = await apiGet< { id: number } >( 'products' );
		expect( result.id ).toBe( 1 );
	} );

	it( 'throws ApiRequestError on 422', async () => {
		fetchMock.mockResolvedValueOnce(
			makeResponse( { code: 'invalid', message: 'bad input' }, 422 )
		);
		await expect( apiGet( 'products' ) ).rejects.toBeInstanceOf(
			ApiRequestError
		);
	} );

	it( 'thrown ApiRequestError carries the correct status', async () => {
		fetchMock.mockResolvedValueOnce(
			makeResponse( { code: 'invalid', message: 'bad' }, 422 )
		);
		const err = await apiGet( 'products' ).catch( ( e ) => e );
		expect( err.status ).toBe( 422 );
	} );

	it( 'throws ApiRequestError when the error body is not JSON', async () => {
		fetchMock.mockResolvedValueOnce( {
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			json: async () => {
				throw new Error( 'not json' );
			},
			text: async () => 'Internal Server Error',
		} as unknown as Response );
		const err = await apiGet( 'products' ).catch( ( e ) => e );
		expect( err ).toBeInstanceOf( ApiRequestError );
		expect( err.status ).toBe( 500 );
		expect( err.body.code ).toBe( 'unknown' );
	} );

	it( 'throws ApiRequestError on 403', async () => {
		fetchMock.mockResolvedValueOnce(
			makeResponse( { code: 'forbidden', message: 'No access' }, 403 )
		);
		const err = await apiGet( 'products' ).catch( ( e ) => e );
		expect( err ).toBeInstanceOf( ApiRequestError );
		expect( err.status ).toBe( 403 );
	} );
} );

describe( 'apiPost', () => {
	it( 'sends a POST with JSON-serialised body', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( { new_stock: 10 } ) );
		await apiPost( 'products/1/adjust', { adjustment: 5 } );
		const [ , init ] = fetchMock.mock.calls[ 0 ] as [ string, RequestInit ];
		expect( init.method ).toBe( 'POST' );
		expect( init.body ).toBe( JSON.stringify( { adjustment: 5 } ) );
	} );

	it( 'sets Content-Type: application/json', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( {} ) );
		await apiPost( 'test', {} );
		const [ , init ] = fetchMock.mock.calls[ 0 ] as [ string, RequestInit ];
		const h = new Headers( init.headers );
		expect( h.get( 'Content-Type' ) ).toContain( 'application/json' );
	} );

	it( 'returns parsed JSON on 201', async () => {
		fetchMock.mockResolvedValueOnce(
			makeResponse( { created: true }, 201 )
		);
		const result = await apiPost< { created: boolean } >( 'test', {} );
		expect( result.created ).toBe( true );
	} );

	it( 'throws ApiRequestError on non-2xx', async () => {
		fetchMock.mockResolvedValueOnce(
			makeResponse( { code: 'conflict', message: 'mismatch' }, 409 )
		);
		const err = await apiPost( 'products/1/adjust', {} ).catch(
			( e ) => e
		);
		expect( err ).toBeInstanceOf( ApiRequestError );
		expect( err.status ).toBe( 409 );
	} );
} );

describe( 'apiDelete', () => {
	it( 'sends a DELETE request', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( {} ) );
		await apiDelete( 'views/123' );
		const [ , init ] = fetchMock.mock.calls[ 0 ] as [ string, RequestInit ];
		expect( init.method ).toBe( 'DELETE' );
	} );

	it( 'throws ApiRequestError on 404', async () => {
		fetchMock.mockResolvedValueOnce(
			makeResponse( { code: 'not_found', message: 'Not found' }, 404 )
		);
		const err = await apiDelete( 'views/999' ).catch( ( e ) => e );
		expect( err ).toBeInstanceOf( ApiRequestError );
		expect( err.status ).toBe( 404 );
	} );
} );

describe( 'adjustStock', () => {
	it( 'posts the correct body', async () => {
		fetchMock.mockResolvedValueOnce( makeResponse( { new_stock: 15 } ) );
		await adjustStock( 42, { adjustment: 5 } );
		const [ , init ] = fetchMock.mock.calls[ 0 ] as [ string, RequestInit ];
		expect( JSON.parse( init.body as string ) ).toEqual( {
			adjustment: 5,
		} );
	} );
} );

describe( 'setPrice', () => {
	it( 'includes all supplied price fields in the body', async () => {
		fetchMock.mockResolvedValueOnce(
			makeResponse( {
				id: 1,
				regular_price: '9.99',
				sale_price: '',
				date_on_sale_from: null,
				date_on_sale_to: null,
			} )
		);
		await setPrice( 1, { regular_price: '9.99', sale_price: '' } );
		const [ , init ] = fetchMock.mock.calls[ 0 ] as [ string, RequestInit ];
		expect( JSON.parse( init.body as string ) ).toMatchObject( {
			regular_price: '9.99',
			sale_price: '',
		} );
	} );
} );

describe( 'setThreshold', () => {
	it( 'posts null to clear the threshold', async () => {
		fetchMock.mockResolvedValueOnce(
			makeResponse( { id: 1, threshold: null } )
		);
		await setThreshold( 1, null );
		const [ , init ] = fetchMock.mock.calls[ 0 ] as [ string, RequestInit ];
		expect( JSON.parse( init.body as string ) ).toEqual( {
			threshold: null,
		} );
	} );
} );
