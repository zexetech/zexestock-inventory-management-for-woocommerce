import * as React from 'react';
import { Bar } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsSectionSummary } from '../hooks/useDashboard';
import { CHART_COLORS, CHART_GRID_COLOR } from '../constants';
import type { DatePeriod } from '../types';

interface Props {
	period: DatePeriod;
	dateFrom?: string;
	dateTo?: string;
}

export function FastMoversBar( { period, dateFrom, dateTo }: Props ) {
	const { data: summary, isLoading } = useAnalyticsSectionSummary(
		period,
		dateFrom,
		dateTo
	);
	const data = summary?.fast_movers;

	const items = React.useMemo( () => data?.items ?? [], [ data?.items ] );

	const chartData = React.useMemo(
		() => ( {
			labels: items.map( ( i ) => {
				const name = i.name;
				return name.length > 30 ? name.slice( 0, 28 ) + '…' : name;
			} ),
			datasets: [
				{
					label: 'Units / day',
					data: items.map( ( i ) => i.units_per_day ),
					backgroundColor: CHART_COLORS.blueBg,
					borderColor: CHART_COLORS.blue,
					borderWidth: 1.5,
					borderRadius: 4,
				},
			],
		} ),
		[ items ]
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
							` ${ ctx.raw } units/day`,
					},
				},
			},
			scales: {
				x: {
					grid: { color: CHART_GRID_COLOR },
					ticks: { font: { size: 11 } },
				},
				y: {
					grid: { display: false },
					ticks: { font: { size: 11 } },
				},
			},
		} ),
		[]
	);

	const chartHeight = Math.max( 200, items.length * 32 );

	let body: React.ReactNode;
	if ( isLoading ) {
		body = (
			<div className="space-y-2">
				{ Array.from( { length: 6 } ).map( ( _, i ) => (
					<Skeleton key={ i } className="h-6 w-full" />
				) ) }
			</div>
		);
	} else if ( items.length === 0 ) {
		body = (
			<p className="text-sm text-muted-foreground text-center py-8">
				No sales data for this period.
			</p>
		);
	} else {
		body = (
			<div style={ { height: chartHeight } }>
				<Bar data={ chartData } options={ options } />
			</div>
		);
	}

	return (
		<Card className="border-border shadow-md">
			<CardHeader>
				<CardTitle className="text-sm font-semibold">
					Fast-Moving Products
				</CardTitle>
				<p className="text-xs text-muted-foreground mt-0.5">
					Top 10 by sales velocity
				</p>
			</CardHeader>
			<CardContent>{ body }</CardContent>
		</Card>
	);
}
