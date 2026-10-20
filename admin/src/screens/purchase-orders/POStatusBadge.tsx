import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { POStatus } from '@/types/purchase-order';

const LABELS: Record< POStatus, string > = {
	draft: 'Draft',
	sent: 'Sent',
	partially_received: 'Partially received',
	received: 'Received',
	cancelled: 'Cancelled',
};

const VARIANTS: Record<
	POStatus,
	'secondary' | 'default' | 'outline' | 'destructive'
> = {
	draft: 'secondary',
	sent: 'default',
	partially_received: 'outline',
	received: 'default',
	cancelled: 'destructive',
};

export function POStatusBadge( { status }: { status: POStatus } ) {
	return (
		<Badge
			variant={ VARIANTS[ status ] }
			className={
				status === 'received' ? 'bg-green-600 text-white' : undefined
			}
		>
			{ LABELS[ status ] }
		</Badge>
	);
}
