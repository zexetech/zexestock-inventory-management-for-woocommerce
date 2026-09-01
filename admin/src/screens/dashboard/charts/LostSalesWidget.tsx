import * as React from 'react';
import { Bar } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsSectionSummary } from '../hooks/useDashboard';
import { CHART_COLORS, CHART_GRID_COLOR } from '../constants';
import { formatCurrency, decodeHtml } from '@/lib/utils';
import type { DatePeriod } from '../types';

interface Props {
	period: DatePeriod;
	dateFrom?: string;
	dateTo?: string;
}

export function LostSalesWidget( { period, dateFrom, dateTo }: Props ) {
	const { data: summary, isLoading } = useAnalyticsSectionSummary(
		period,
		dateFrom,
		dateTo
	);
	const data = summary?.lost_sales;

	const top5 = ( data?.items ?? [] ).slice( 0, 5 );
	const total = data?.total_lost ?? 0;
	const currency = decodeHtml( data?.currency ?? '$' );

	const chartData = React.useMemo(
		() => ( {
			labels: top5.map( ( i ) => {
				const n = i.name;
				return n.length > 28 ? n.slice( 0, 26 ) + '…' : n;
			} ),
			datasets: [
				{
					label: 'Est. Lost Revenue',
					data: top5.map( ( i ) => i.estimated_lost ),
					backgroundColor: CHART_COLORS.redBg,
					borderColor: CHART_COLORS.red,
					borderWidth: 1.5,
					borderRadius: 4,
				},
			],
		} ),
		[ top5 ]
	);

	const options = React.useMemo(
		() => ( {
			indexAxis: 'y' as const,
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						label: ( ctx: { raw: unknown } ) =>
							` ${ Number( ctx.raw ).toLocaleString( 'de-DE', {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							} ) } ${ currency }`,
					},
				},
			},
			scales: {
				x: {
					grid: { color: CHART_GRID_COLOR },
					ticks: {
						font: { size: 11 },
						callback: ( v: unknown ) =>
							`${ Number( v ).toLocaleString( 'de-DE', {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							} ) } ${ currency }`,
					},
				},
				y: {
					grid: { display: false },
					ticks: { font: { size: 11 } },
				},
			},
		} ),
		[ currency ]
	);

	return (
		<Card className="border-border shadow-md">
			<CardHeader>
				<CardTitle className="text-sm font-semibold">
					Lost Sales (Estimated)
				</CardTitle>
				<p className="text-xs text-muted-foreground mt-0.5">
					Out-of-stock × avg daily sales × price
				</p>
			</CardHeader>
			<CardContent>
				{ isLoading ? (
					<>
						<Skeleton className="h-12 w-36 mb-4" />
						<Skeleton className="h-32 w-full" />
					</>
				) : (
					<>
						<div className="mb-4">
							<div className="text-3xl font-bold tabular-nums text-status-out-of-stock-text">
								{ formatCurrency( total, currency ) }
							</div>
							<p className="text-xs text-muted-foreground mt-0.5">
								total estimated lost revenue
							</p>
						</div>
						{ top5.length > 0 ? (
							<div
								style={ {
									height: Math.max( 120, top5.length * 36 ),
								} }
							>
								<Bar data={ chartData } options={ options } />
							</div>
						) : (
							<p className="text-sm text-muted-foreground text-center py-4">
								No out-of-stock products with sales history.
							</p>
						) }
					</>
				) }
			</CardContent>
		</Card>
	);
}
