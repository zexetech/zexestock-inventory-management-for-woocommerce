import * as React from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { SearchDropdown } from '@/components/SearchDropdown';
import { apiGet } from '@/lib/api';
import { decodeHtml } from '@/lib/utils';
import type { Product, ProductsResponse } from '@/types/api';

interface PickerRow {
	/** A variable product's parent row: a group header, never selectable. */
	isHeader: boolean;
	/** What onSelect receives; variations carry the "Parent - Variation" name. */
	product: Product;
}

function withSku( name: string, sku: string ): string {
	return sku ? `${ name } (${ sku })` : name;
}

function variationName( parent: Product, variation: Product ): string {
	const own = decodeHtml( variation.name ?? '' ).trim();
	const parentName = decodeHtml( parent.name );
	return own
		? `${ parentName } - ${ own }`
		: `${ parentName } #${ variation.id }`;
}

export function ProductPicker( {
	onSelect,
	excludeIds = [],
	placeholder = 'Add a product…',
}: {
	onSelect: ( product: Product ) => void;
	excludeIds?: number[];
	placeholder?: string;
} ) {
	const [ search, setSearch ] = React.useState( '' );

	const [ isOpen, setIsOpen ] = React.useState( false );

	const { data } = useQuery< ProductsResponse >( {
		queryKey: [ 'product-picker', search ],
		queryFn: () =>
			apiGet< ProductsResponse >( 'products', {
				page: 1,
				per_page: 20,
				search: search || undefined,
			} ),
		enabled: isOpen,
		staleTime: 30_000,
	} );

	const products = React.useMemo( () => data?.data ?? [], [ data ] );

	// GET /products embeds each variable product's variations, so this
	// normally fetches nothing; it only covers a response without them.
	// Shares useVariations' cache key.
	const missing = products.filter(
		( p ) => p.type === 'variable' && ! Array.isArray( p.variations )
	);
	const fetched = useQueries( {
		queries: missing.map( ( p ) => ( {
			queryKey: [ 'variations', p.id ],
			queryFn: () =>
				apiGet< Product[] >( `products/${ p.id }/variations` ),
			enabled: isOpen,
			staleTime: 5 * 60_000,
		} ) ),
	} );
	const fetchedByParent = new Map< number, Product[] | undefined >(
		missing.map( ( p, i ) => [ p.id, fetched[ i ]?.data ] )
	);

	const rows: PickerRow[] = [];
	for ( const p of products ) {
		if ( p.type !== 'variable' ) {
			if ( ! excludeIds.includes( p.id ) ) {
				rows.push( { isHeader: false, product: p } );
			}
			continue;
		}
		const variations = Array.isArray( p.variations )
			? p.variations
			: fetchedByParent.get( p.id );
		const available = ( variations ?? [] ).filter(
			( v ) => ! excludeIds.includes( v.id )
		);

		if ( variations && available.length === 0 ) {
			continue;
		}
		rows.push( { isHeader: true, product: p } );
		for ( const v of available ) {
			rows.push( {
				isHeader: false,
				product: { ...v, name: variationName( p, v ) },
			} );
		}
	}

	function select( id: number ) {
		const row = rows.find( ( r ) => ! r.isHeader && r.product.id === id );
		if ( row ) {
			onSelect( row.product );
		}
	}

	return (
		<SearchDropdown< PickerRow >
			items={ rows }
			getId={ ( r ) => r.product.id }
			getLabel={ ( r ) => withSku( r.product.name, r.product.sku ) }
			isItemDisabled={ ( r ) => r.isHeader }
			// Same palette as an expanded variable product in the stock table.
			getItemClassName={ ( r ) => {
				if ( r.isHeader ) {
					return 'bg-info-bg !text-info-fg';
				}
				return r.product.parent_id
					? 'bg-row-child-bg hover:!bg-row-child-bg-hover'
					: '';
			} }
			value={ null }
			onChange={ select }
			onSearchChange={ setSearch }
			onOpenChange={ setIsOpen }
			filterItems={ false }
			placeholder={ placeholder }
			emptyMessage="No products found."
			searchPlaceholder="Search products…"
			triggerClassName="justify-between w-64"
			panelClassName="w-[28rem] max-w-[90vw]"
			renderLabel={ ( r ) => (
				<span
					className={ `block text-left whitespace-normal break-words${
						r.product.parent_id
							? ' pl-3 border-l-2 border-primary/40'
							: ''
					}` }
				>
					{ decodeHtml( withSku( r.product.name, r.product.sku ) ) }
				</span>
			) }
		/>
	);
}
