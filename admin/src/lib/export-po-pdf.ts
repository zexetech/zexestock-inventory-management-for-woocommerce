import { computePOTotals } from '@/lib/poTotals';
import type { PurchaseOrder } from '@/types/purchase-order';

const TEXT_DARK = '#1E293B';
const TEXT_MUTED = '#64748B';
const HEAD_FILL = '#F1F5F9';
const COL_BORDER = '#E2E8F0';

const MARGIN = 40;

function money( amount: number ): string {
	return amount.toFixed( 2 );
}

function percent( value: number ): string {
	return String( Number( value.toFixed( 2 ) ) );
}

/**
 * Same breakdown as the PO detail screen; zero-value adjustments are left out
 * so a plain PO doesn't print a column of 0.00 lines.
 * @param po
 */
export function buildPOTotalLines( po: PurchaseOrder ): [ string, string ][] {
	const subtotal = po.items.reduce(
		( sum, item ) => sum + item.quantity_ordered * item.unit_cost,
		0
	);
	const totals = computePOTotals(
		subtotal,
		po.discount_percent,
		po.tax_rate_percent,
		po.supplier_fee,
		po.shipping_cost
	);

	const lines: [ string, string ][] = [
		[ 'Subtotal', money( totals.subtotal ) ],
	];
	if ( totals.discountAmt > 0 ) {
		lines.push( [
			`Discount (${ percent( po.discount_percent ) }%)`,
			`-${ money( totals.discountAmt ) }`,
		] );
	}
	if ( totals.taxAmt > 0 ) {
		lines.push( [
			`Tax (${ percent( po.tax_rate_percent ) }%)`,
			money( totals.taxAmt ),
		] );
	}
	if ( po.supplier_fee > 0 ) {
		lines.push( [ 'Supplier Fee', money( po.supplier_fee ) ] );
	}
	if ( po.shipping_cost > 0 ) {
		lines.push( [ 'Shipping', money( po.shipping_cost ) ] );
	}
	lines.push( [
		'Total',
		`${ po.currency } ${ money( totals.totalCost ) }`,
	] );

	return lines;
}

function supplierLines( po: PurchaseOrder ): string[] {
	const cityLine = [
		[ po.supplier_city, po.supplier_state ].filter( Boolean ).join( ', ' ),
		po.supplier_postal_code,
	]
		.filter( Boolean )
		.join( ' ' );

	return [
		po.supplier_name,
		po.supplier_contact_name,
		po.supplier_address_line_1,
		po.supplier_address_line_2,
		cityLine,
		po.supplier_country,
		po.supplier_email,
		po.supplier_phone,
	].filter( ( line ): line is string => !! line );
}

export async function generatePOPdf( po: PurchaseOrder ): Promise< void > {
	const [ { jsPDF }, { default: autoTable } ] = await Promise.all( [
		import( 'jspdf' ),
		import( 'jspdf-autotable' ),
	] );

	const doc = new jsPDF( {
		orientation: 'portrait',
		unit: 'pt',
		format: 'a4',
	} );
	const W = doc.internal.pageSize.getWidth();
	const H = doc.internal.pageSize.getHeight();

	const poDate = po.po_date || po.created_at.slice( 0, 10 );

	doc.setTextColor( TEXT_DARK );
	doc.setFont( 'helvetica', 'bold' );
	doc.setFontSize( 18 );
	doc.text( `Purchase Order ${ po.po_number }`, MARGIN, 56 );

	doc.setFont( 'helvetica', 'normal' );
	doc.setFontSize( 10 );
	doc.setTextColor( TEXT_MUTED );
	doc.text( window.location.hostname || '', MARGIN, 74 );
	doc.text( `Date: ${ poDate }`, MARGIN, 88 );

	doc.setFont( 'helvetica', 'bold' );
	doc.setFontSize( 11 );
	doc.setTextColor( TEXT_DARK );
	doc.text( 'Supplier', MARGIN, 116 );

	doc.setFont( 'helvetica', 'normal' );
	doc.setFontSize( 10 );
	const supplier = supplierLines( po );
	doc.text( supplier, MARGIN, 132, { lineHeightFactor: 1.35 } );

	const tableStartY = 132 + supplier.length * 13.5 + 12;

	autoTable( doc, {
		head: [
			[
				'Product',
				'SKU',
				'Supplier SKU',
				'Qty',
				'Unit Cost',
				'Line Total',
			],
		],
		body: po.items.map( ( item ) => [
			item.product_name,
			item.sku ?? '',
			item.supplier_sku ?? '',
			String( item.quantity_ordered ),
			money( item.unit_cost ),
			money( item.quantity_ordered * item.unit_cost ),
		] ),
		startY: tableStartY,
		margin: { left: MARGIN, right: MARGIN, bottom: 40 },
		rowPageBreak: 'avoid',
		columnStyles: {
			3: { halign: 'right' },
			4: { halign: 'right' },
			5: { halign: 'right' },
		},
		styles: {
			fontSize: 9,
			textColor: TEXT_DARK,
			lineColor: COL_BORDER,
			lineWidth: 0.5,
			overflow: 'linebreak',
		},
		headStyles: {
			fillColor: HEAD_FILL,
			textColor: TEXT_DARK,
			fontStyle: 'bold',
		},
	} );

	// lastAutoTable is set by jspdf-autotable but missing from jsPDF's types.
	let y =
		( doc as unknown as { lastAutoTable: { finalY: number } } )
			.lastAutoTable.finalY + 20;

	const totalLines = buildPOTotalLines( po );
	const notes = po.supplier_notes
		? doc.splitTextToSize( po.supplier_notes, W - MARGIN * 2 )
		: [];
	if (
		y +
			totalLines.length * 16 +
			( notes.length ? 40 + notes.length * 13 : 0 ) >
		H - 40
	) {
		doc.addPage();
		y = 56;
	}

	const labelX = W - MARGIN - 200;
	const valueX = W - MARGIN;
	totalLines.forEach( ( [ label, value ], i ) => {
		const isTotal = i === totalLines.length - 1;
		if ( isTotal ) {
			doc.setDrawColor( TEXT_DARK );
			doc.line( labelX, y - 11, valueX, y - 11 );
		}
		doc.setFont( 'helvetica', isTotal ? 'bold' : 'normal' );
		doc.setTextColor( isTotal ? TEXT_DARK : TEXT_MUTED );
		doc.text( label, labelX, y );
		doc.text( value, valueX, y, { align: 'right' } );
		y += 16;
	} );

	if ( notes.length ) {
		y += 16;
		doc.setFont( 'helvetica', 'bold' );
		doc.setTextColor( TEXT_DARK );
		doc.text( 'Notes', MARGIN, y );
		doc.setFont( 'helvetica', 'normal' );
		doc.text( notes, MARGIN, y + 16, { lineHeightFactor: 1.35 } );
	}

	const totalPages = doc.getNumberOfPages();
	for ( let i = 1; i <= totalPages; i++ ) {
		doc.setPage( i );
		doc.setFontSize( 8 );
		doc.setTextColor( TEXT_MUTED );
		doc.text( `${ po.po_number }`, MARGIN, H - 20 );
		doc.text( `Page ${ i } of ${ totalPages }`, W - MARGIN, H - 20, {
			align: 'right',
		} );
	}

	doc.save( `${ po.po_number }.pdf` );
}
