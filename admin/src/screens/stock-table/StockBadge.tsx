import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { StockStatus } from '@/types/api';

interface StockBadgeProps {
	qty: number | null;
	status: StockStatus | null;
	thresholdOverride?: number | null;
	className?: string;
}

function resolveStatus(
	qty: number | null,
	status: StockStatus | null,
	threshold: number,
	thresholdOverride: number | null = null
): StockStatus {
	const effectiveThreshold =
		thresholdOverride !== null ? thresholdOverride : threshold;

	if ( thresholdOverride === null && status ) {
		return status;
	}

	if ( qty === null ) {
		return '';
	}
	if ( qty <= 0 ) {
		return 'out_of_stock';
	}
	if ( qty <= effectiveThreshold ) {
		return 'low_stock';
	}
	return 'in_stock';
}

const BADGE_CLASSES: Record< StockStatus, string > = {
	in_stock: 'bg-status-in-stock-bg text-status-in-stock-fg',
	low_stock: 'bg-status-low-stock-bg text-status-low-stock-fg',
	out_of_stock: 'bg-status-out-of-stock-bg text-status-out-of-stock-fg',
	'': 'bg-muted text-muted-foreground',
};

export function StockBadge( {
	qty,
	status,
	thresholdOverride,
	className,
}: StockBadgeProps ) {
	const threshold = window.zexstData?.settings?.lowStockThreshold ?? 10;
	const override = thresholdOverride !== undefined ? thresholdOverride : null;
	const resolved = resolveStatus( qty, status, threshold, override );

	const display = qty === null ? '—' : String( qty );

	return (
		<Badge
			className={ cn(
				'tabular-nums rounded-full font-medium',
				BADGE_CLASSES[ resolved ],
				className
			) }
		>
			{ display }
		</Badge>
	);
}
