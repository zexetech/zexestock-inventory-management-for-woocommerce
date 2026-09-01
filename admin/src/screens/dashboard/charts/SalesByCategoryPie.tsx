import * as React from 'react';
import { Pie } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsSectionSummary } from '../hooks/useDashboard';
import { CHART_COLORS } from '../constants';
import type { DatePeriod } from '../types';

interface Props {
	period: DatePeriod;
	dateFrom?: string;
	dateTo?: string;
}

const PIE_COLORS = [
	CHART_COLORS.blue,
	CHART_COLORS.green,
	CHART_COLORS.amber,
	CHART_COLORS.purple,
	CHART_COLORS.teal,
	CHART_COLORS.orange,
	CHART_COLORS.red,
	CHART_COLORS.slate,
];

export function SalesByCategoryPie( { period, dateFrom, dateTo }: Props ) {
	const {
		data: summary,
		isLoading,
		isError,
	} = useAnalyticsSectionSummary( period, dateFrom, dateTo );
	const data = summary?.sales_by_category;

	const items = React.useMemo( () => data?.items ?? [], [ data?.items ] );
	const currency = data?.currency ?? '';

	const totalRevenue = items.reduce( ( sum, i ) => sum + i.revenue, 0 );

	const chartData = React.useMemo(
		() => ( {
			labels: items.map( ( i ) => i.category ),
			datasets: [
				{
					data: items.map( ( i ) => i.revenue ),
					backgroundColor: items.map(
						( _, idx ) => PIE_COLORS[ idx % PIE_COLORS.length ]
					),
					borderColor: 'transparent',
					borderWidth: 2,
					hoverOffset: 6,
				},
			],
		} ),
		[ items ]
	);

	const options = React.useMemo(
		() => ( {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				legend: {
					position: 'bottom' as const,
					labels: { boxWidth: 12, padding: 14, font: { size: 11 } },
				},
				tooltip: {
					callbacks: {
						label: ( ctx: { label: string; raw: unknown } ) => {
							const pct =
								totalRevenue > 0
									? (
											( ( ctx.raw as number ) /
												totalRevenue ) *
											100
									  ).toFixed( 1 )
									: '0.0';
							return ` ${ ctx.label }: ${ (
								ctx.raw as number
							 ).toLocaleString( 'de-DE', {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							} ) } ${ currency } (${ pct }%)`;
						},
					},
				},
			},
		} ),
		[ totalRevenue, currency ]
	);

	let body: React.ReactNode;
	if ( isLoading ) {
		body = (
			<div className="flex justify-center">
				<Skeleton className="w-48 h-48 rounded-full" />
			</div>
		);
	} else if ( isError ) {
		body = (
			<p className="text-sm text-destructive text-center py-8">
				Failed to load category data.
			</p>
		);
	} else if ( items.length === 0 ) {
		body = (
			<p className="text-sm text-muted-foreground text-center py-8">
				No sales data for this period.
			</p>
		);
	} else {
		body = (
			<div className="max-w-xs mx-auto">
				<Pie data={ chartData } options={ options } />
			</div>
		);
	}

	return (
		<Card className="border-border shadow-md">
			<CardHeader>
				<CardTitle className="text-sm font-semibold">
					Sales by Category
				</CardTitle>
				<p className="text-xs text-muted-foreground mt-0.5">
					Revenue distribution by product category
				</p>
			</CardHeader>
			<CardContent>{ body }</CardContent>
		</Card>
	);
}
