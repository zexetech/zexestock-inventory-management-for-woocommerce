import * as React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLowStockSummary } from '../hooks/useDashboard';
import { CHART_COLORS } from '../constants';

const stockTableUrl = ( status: string ) =>
	`/wp-admin/admin.php?page=zexst-stock-manager&zexst_preset=${ status }&zexst_stock_status=${ status }`;

export function LowStockDoughnut() {
	const { data, isLoading } = useLowStockSummary();

	const chartData = React.useMemo(
		() => ( {
			labels: [ 'Out of Stock', 'Critical', 'Warning', 'Healthy' ],
			datasets: [
				{
					data: [
						data?.out_of_stock ?? 0,
						data?.critical ?? 0,
						data?.warning ?? 0,
						data?.healthy ?? 0,
					],
					backgroundColor: [
						CHART_COLORS.red,
						CHART_COLORS.orange,
						CHART_COLORS.amber,
						CHART_COLORS.green,
					],
					borderWidth: 2,
					borderColor: 'transparent',
					hoverOffset: 6,
				},
			],
		} ),
		[ data ]
	);

	const options = React.useMemo(
		() => ( {
			responsive: true,
			maintainAspectRatio: true,
			cutout: '65%',
			plugins: {
				legend: {
					position: 'bottom' as const,
					labels: { boxWidth: 12, padding: 16, font: { size: 12 } },
				},
				tooltip: {
					callbacks: {
						label: ( ctx: { label: string; raw: unknown } ) =>
							` ${ ctx.label }: ${ ctx.raw } products`,
					},
				},
			},
			onClick: ( _: unknown, elements: Array< { index: number } > ) => {
				if ( elements.length === 0 ) {
					return;
				}
				const statuses = [
					'out_of_stock',
					'low_stock',
					'low_stock',
					'',
				];
				const status = statuses[ elements[ 0 ].index ];
				if ( status ) {
					window.location.href = stockTableUrl( status );
				}
			},
		} ),
		[]
	);

	return (
		<Card className="border-border shadow-md">
			<CardHeader>
				<CardTitle className="text-sm font-semibold">
					Low Stock Summary
				</CardTitle>
				<p className="text-xs text-muted-foreground mt-0.5">
					Stock status distribution — click segment to filter
				</p>
			</CardHeader>
			<CardContent>
				{ isLoading ? (
					<div className="flex justify-center">
						<Skeleton className="w-48 h-48 rounded-full" />
					</div>
				) : (
					<div className="max-w-xs mx-auto">
						<Doughnut data={ chartData } options={ options } />
					</div>
				) }
				<div className="mt-3 text-center">
					<a
						href={ stockTableUrl( 'low_stock' ) }
						className="text-xs text-primary hover:underline"
					>
						View Low Stock in Stock Table →
					</a>
				</div>
			</CardContent>
		</Card>
	);
}
