import * as React from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLowStockSummary } from './hooks/useDashboard';
import { LowStockDoughnut } from './charts/LowStockDoughnut';
import { CurrentStockValue } from './charts/CurrentStockValue';
import { formatNumber } from '@/lib/utils';

interface Props {
	period?: string;
	dateFrom?: string;
	dateTo?: string;
}

const stockManagerUrl = '/wp-admin/admin.php?page=zexst-stock-manager';

function InStockCard() {
	const { data, isLoading } = useLowStockSummary();

	const total = data
		? data.out_of_stock + data.critical + data.warning + data.healthy
		: 0;
	const pct =
		total > 0 ? Math.round( ( ( data?.healthy ?? 0 ) / total ) * 100 ) : 0;

	return (
		<Card className="border-border shadow-md border-l-4 border-l-status-in-stock">
			<CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					In Stock
				</CardTitle>
				<CheckCircle className="w-4 h-4 text-status-in-stock" />
			</CardHeader>
			<CardContent>
				{ isLoading ? (
					<>
						<Skeleton className="h-8 w-16 mb-1" />
						<Skeleton className="h-4 w-24" />
					</>
				) : (
					<>
						<div className="text-2xl font-bold tabular-nums text-status-in-stock-text">
							{ formatNumber( data?.healthy ?? 0 ) }
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							{ pct }% of { formatNumber( total ) } managed
							products
						</div>
						<a
							href={ `${ stockManagerUrl }&zexst_stock_status=in_stock` }
							className="text-xs text-primary hover:underline mt-1.5 inline-block"
						>
							View in Stock Manager →
						</a>
					</>
				) }
			</CardContent>
		</Card>
	);
}

function LowStockCard() {
	const { data, isLoading } = useLowStockSummary();

	const total = data ? data.critical + data.warning : 0;

	return (
		<Card className="border-border shadow-md border-l-4 border-l-status-low-stock">
			<CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					Low Stock
				</CardTitle>
				<AlertTriangle className="w-4 h-4 text-status-low-stock" />
			</CardHeader>
			<CardContent>
				{ isLoading ? (
					<>
						<Skeleton className="h-8 w-16 mb-1" />
						<Skeleton className="h-4 w-28" />
					</>
				) : (
					<>
						<div className="text-2xl font-bold tabular-nums">
							{ formatNumber( total ) }
						</div>
						<div className="flex flex-wrap items-center gap-1.5 mt-1">
							<Badge className="bg-status-out-of-stock-bg text-status-out-of-stock-fg text-xs py-0 px-1.5 rounded-full">
								Critical { data?.critical ?? 0 }
							</Badge>
							<Badge className="bg-status-low-stock-bg text-status-low-stock-fg text-xs py-0 px-1.5 rounded-full">
								Warning { data?.warning ?? 0 }
							</Badge>
						</div>
						<a
							href={ `${ stockManagerUrl }&zexst_preset=low_stock&zexst_stock_status=low_stock` }
							className="text-xs text-primary hover:underline mt-1.5 inline-block"
						>
							View in Stock Manager →
						</a>
					</>
				) }
			</CardContent>
		</Card>
	);
}

function OutOfStockCard() {
	const { data, isLoading } = useLowStockSummary();

	const total = data
		? data.out_of_stock + data.critical + data.warning + data.healthy
		: 0;
	const pct =
		total > 0
			? Math.round( ( ( data?.out_of_stock ?? 0 ) / total ) * 100 )
			: 0;

	return (
		<Card className="border-border shadow-md border-l-4 border-l-status-out-of-stock">
			<CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					Out of Stock
				</CardTitle>
				<XCircle className="w-4 h-4 text-status-out-of-stock" />
			</CardHeader>
			<CardContent>
				{ isLoading ? (
					<>
						<Skeleton className="h-8 w-16 mb-1" />
						<Skeleton className="h-4 w-24" />
					</>
				) : (
					<>
						<div className="text-2xl font-bold tabular-nums text-status-out-of-stock-text">
							{ formatNumber( data?.out_of_stock ?? 0 ) }
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							{ pct }% of { formatNumber( total ) } managed
							products
						</div>
						<a
							href={ `${ stockManagerUrl }&zexst_preset=out_of_stock&zexst_stock_status=out_of_stock` }
							className="text-xs text-primary hover:underline mt-1.5 inline-block"
						>
							View in Stock Manager →
						</a>
					</>
				) }
			</CardContent>
		</Card>
	);
}

export function KpiCards( _props: Props ) {
	return (
		<section>
			<h2 className="text-base font-semibold mb-3">
				Inventory Management
			</h2>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
				<InStockCard />
				<LowStockCard />
				<OutOfStockCard />
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
				<LowStockDoughnut />
				<CurrentStockValue />
			</div>
		</section>
	);
}
