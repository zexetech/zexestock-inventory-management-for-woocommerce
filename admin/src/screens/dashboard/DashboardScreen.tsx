import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RevenueKpiCards } from './RevenueKpiCards';
import { KpiCards } from './KpiCards';
import { AnalyticsSection, DEFAULT_PERIOD } from './AnalyticsSection';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardBootstrap } from './hooks/useDashboard';
import { salesPeriodToDates } from './lib/salesPeriod';
import type { DatePeriod } from './types';

const stockManagerUrl = '/wp-admin/admin.php?page=zexst-stock-manager';

function DashboardBodySkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
				{ Array.from( { length: 4 } ).map( ( _, i ) => (
					<Card key={ i } className="border-border shadow-md">
						<CardHeader className="pb-2">
							<Skeleton className="h-4 w-20" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-7 w-28 mb-1" />
							<Skeleton className="h-3.5 w-20" />
						</CardContent>
					</Card>
				) ) }
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
				{ Array.from( { length: 3 } ).map( ( _, i ) => (
					<Card key={ i } className="border-border shadow-md">
						<CardHeader className="pb-2">
							<Skeleton className="h-4 w-24" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-16 mb-1" />
							<Skeleton className="h-4 w-24" />
						</CardContent>
					</Card>
				) ) }
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{ Array.from( { length: 2 } ).map( ( _, i ) => (
					<Card key={ i } className="border-border shadow-md">
						<CardHeader>
							<Skeleton className="h-4 w-40" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-48 w-full" />
						</CardContent>
					</Card>
				) ) }
			</div>
		</div>
	);
}

export function DashboardScreen() {
	const [ period, setPeriod ] =
		React.useState< DatePeriod >( DEFAULT_PERIOD );
	const [ dateFrom, setDateFrom ] = React.useState( '' );
	const [ dateTo, setDateTo ] = React.useState( '' );

	function handlePeriodChange( p: DatePeriod, from: string, to: string ) {
		setPeriod( p );
		setDateFrom( from );
		setDateTo( to );
	}

	const [ { dateFrom: dayFrom, dateTo: dayTo } ] = React.useState( () =>
		salesPeriodToDates( 'day' )
	);

	const queryClient = useQueryClient();
	const bootstrap = useDashboardBootstrap( DEFAULT_PERIOD, dayFrom, dayTo );
	const [ seeded, setSeeded ] = React.useState( false );

	React.useEffect( () => {
		if ( ! bootstrap.data ) {
			return;
		}

		queryClient.setQueryData(
			[ 'analytics-sales-summary', dayFrom, dayTo ],
			bootstrap.data.sales_summary_day
		);
		queryClient.setQueryData(
			[ 'analytics-lost-sales', 'custom', dayFrom, dayTo ],
			bootstrap.data.lost_sales_day
		);
		queryClient.setQueryData(
			[ 'analytics-low-stock' ],
			bootstrap.data.low_stock
		);
		queryClient.setQueryData(
			[ 'analytics-current-stock-value', 0, '' ],
			bootstrap.data.current_stock_value
		);
		queryClient.setQueryData(
			[
				'analytics-section-summary',
				DEFAULT_PERIOD,
				undefined,
				undefined,
			],
			bootstrap.data.section
		);

		setSeeded( true );
	}, [ bootstrap.data, queryClient, dayFrom, dayTo ] );

	const ready = seeded || bootstrap.isError;

	return (
		<div className="min-h-screen flex flex-col">
			<div className="flex-1 p-4 md:p-6 space-y-6 w-full">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold leading-tight">
							Warehouse Dashboard
						</h1>
					</div>
					<div className="flex items-center gap-2">
						<a
							href={ stockManagerUrl }
							className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors no-underline"
						>
							Stock Manager
						</a>
					</div>
				</div>

				{ ready ? (
					<>
						<RevenueKpiCards />

						<AnalyticsSection
							period={ period }
							dateFrom={ dateFrom }
							dateTo={ dateTo }
							onPeriodChange={ handlePeriodChange }
						/>

						<KpiCards
							period={ period }
							dateFrom={ dateFrom || undefined }
							dateTo={ dateTo || undefined }
						/>
					</>
				) : (
					<DashboardBodySkeleton />
				) }
			</div>
		</div>
	);
}
