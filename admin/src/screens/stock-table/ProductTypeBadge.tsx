import * as React from 'react';
import type { ProductType } from '@/types/api';

const TYPE_CONFIG: Record< ProductType, { label: string; className: string } > =
	{
		simple: {
			label: 'Simple',
			className: 'bg-type-simple-bg text-type-simple-fg',
		},
		variable: {
			label: 'Variable',
			className: 'bg-type-variable-bg text-type-variable-fg',
		},
		variation: {
			label: 'Variation',
			className: 'bg-type-variation-bg text-type-variation-fg',
		},
		grouped: {
			label: 'Grouped',
			className: 'bg-type-grouped-bg text-type-grouped-fg',
		},
		external: {
			label: 'External',
			className: 'bg-type-external-bg text-type-external-fg',
		},
		virtual: {
			label: 'Virtual',
			className: 'bg-type-virtual-bg text-type-virtual-fg',
		},
		downloadable: {
			label: 'Downloadable',
			className: 'bg-type-downloadable-bg text-type-downloadable-fg',
		},
	};

export function ProductTypeBadge( { type }: { type: string } ) {
	const { label, className } = TYPE_CONFIG[ type as ProductType ] ?? {
		label: type,
		className: 'bg-muted text-muted-foreground',
	};
	return (
		<span
			className={ `inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${ className }` }
		>
			{ label }
		</span>
	);
}
