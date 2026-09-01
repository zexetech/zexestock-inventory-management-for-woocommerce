import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { useQueryClient } from '@tanstack/react-query';
import { FastMoversBar } from './charts/FastMoversBar';
import { TopSellingProductsBar } from './charts/TopSellingProductsBar';
import { SalesByCategoryPie } from './charts/SalesByCategoryPie';
import { LostSalesWidget } from './charts/LostSalesWidget';
import { flushAnalyticsCache } from './hooks/useDashboard';
import type { DatePeriod } from './types';
import { DEFAULT_PERIOD } from './constants';
import { cn } from '@/lib/utils';

const PERIODS: { label: string; value: DatePeriod }[] = [
	{ label: 'Last 7 days', value: '7d' },
	{ label: 'Last 30 days', value: '30d' },
	{ label: 'Last 60 days', value: '60d' },
	{ label: 'Last 90 days', value: '90d' },
	{ label: 'Custom', value: 'custom' },
];

interface Props {
	period: DatePeriod;
	dateFrom: string;
	dateTo: string;
	onPeriodChange: ( period: DatePeriod, from: string, to: string ) => void;
}

export function AnalyticsSection( {
	period,
	dateFrom,
	dateTo,
	onPeriodChange,
}: Props ) {
	const queryClient = useQueryClient();
	const [ customFrom, setCustomFrom ] = React.useState( '' );
	const [ customTo, setCustomTo ] = React.useState( '' );
	const [ refreshing, setRefreshing ] = React.useState( false );

	function handlePeriodClick( p: DatePeriod ) {
		if ( p !== 'custom' ) {
			onPeriodChange( p, '', '' );
		} else {
			onPeriodChange( 'custom', customFrom, customTo );
		}
	}

	function handleCustomApply() {
		if ( customFrom && customTo ) {
			onPeriodChange( 'custom', customFrom, customTo );
		}
	}

	async function handleRefresh() {
		setRefreshing( true );
		await flushAnalyticsCache();
		await queryClient.invalidateQueries();
		setRefreshing( false );
	}

	const chartProps = {
		period,
		dateFrom: dateFrom || undefined,
		dateTo: dateTo || undefined,
	};

	return (
		<section>
			<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
				<h2 className="text-base font-semibold">
					Product & Category Performance
				</h2>

				<div className="flex flex-wrap items-center gap-2">
					<div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5 gap-0.5">
						{ PERIODS.map( ( p ) => (
							<Button
								key={ p.value }
								type="button"
								variant="ghost"
								size="sm"
								onClick={ () => handlePeriodClick( p.value ) }
								className={ cn(
									'px-2.5 py-1 text-xs h-auto font-medium',
									period === p.value
										? 'bg-background text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground'
								) }
							>
								{ p.label }
							</Button>
						) ) }
					</div>

					{ period === 'custom' && (
						<div className="flex items-center gap-1.5 text-xs">
							<DatePicker
								id="analytics-date-from"
								value={ customFrom }
								onChange={ setCustomFrom }
								placeholder="Start date"
								className="h-7 w-32 text-xs px-2"
							/>
							<DatePicker
								id="analytics-date-to"
								value={ customTo }
								onChange={ setCustomTo }
								placeholder="End date"
								className="h-7 w-32 text-xs px-2"
							/>
							<Button
								size="sm"
								variant="outline"
								onClick={ handleCustomApply }
								className="h-7 text-xs px-2"
							>
								Apply
							</Button>
						</div>
					) }

					<Button
						size="sm"
						variant="outline"
						onClick={ handleRefresh }
						disabled={ refreshing }
						className="h-7 text-xs px-2.5 gap-1"
					>
						<RefreshCw
							className={ cn(
								'w-3 h-3',
								refreshing && 'animate-spin'
							) }
						/>
						{ refreshing ? 'Refreshing…' : 'Refresh' }
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<TopSellingProductsBar { ...chartProps } />
				<SalesByCategoryPie { ...chartProps } />
				<FastMoversBar { ...chartProps } />
				<LostSalesWidget { ...chartProps } />
			</div>
		</section>
	);
}

export { DEFAULT_PERIOD };
