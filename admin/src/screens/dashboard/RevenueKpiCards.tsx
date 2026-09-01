import * as React from 'react';
import { ShoppingCart, TrendingDown, Package, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useSalesSummary, useLostSales } from './hooks/useDashboard';
import { salesPeriodToDates, SALES_PERIOD_LABELS } from './lib/salesPeriod';
import { formatCurrency } from '@/lib/utils';
import type { SalesPeriod } from './types';

const PERIOD_OPTIONS: { value: SalesPeriod; label: string }[] = [
	{ value: 'day', label: SALES_PERIOD_LABELS.day },
	{ value: 'month', label: SALES_PERIOD_LABELS.month },
	{ value: 'ytd', label: SALES_PERIOD_LABELS.ytd },
];

interface PeriodFilterProps {
	value: SalesPeriod;
	onChange: ( p: SalesPeriod ) => void;
}

function PeriodFilter( { value, onChange }: PeriodFilterProps ) {
	return (
		<Select
			value={ value }
			onValueChange={ ( v ) => onChange( v as SalesPeriod ) }
		>
			<SelectTrigger className="h-6 w-[110px] text-xs border-0 shadow-none bg-muted/50 px-2 focus:ring-0">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{ PERIOD_OPTIONS.map( ( opt ) => (
					<SelectItem
						key={ opt.value }
						value={ opt.value }
						className="text-xs"
					>
						{ opt.label }
					</SelectItem>
				) ) }
			</SelectContent>
		</Select>
	);
}

function KpiSkeleton() {
	return (
		<>
			<Skeleton className="h-7 w-28 mb-1" />
			<Skeleton className="h-3.5 w-20" />
		</>
	);
}

function SalesCard() {
	const [ period, setPeriod ] = React.useState< SalesPeriod >( 'day' );
	const { dateFrom, dateTo } = salesPeriodToDates( period );
	const { data, isLoading } = useSalesSummary( dateFrom, dateTo );

	return (
		<Card className="border-border shadow-md">
			<CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					Sales
				</CardTitle>
				<div className="flex items-center gap-1.5">
					<PeriodFilter value={ period } onChange={ setPeriod } />
					<ShoppingCart className="w-4 h-4 text-muted-foreground/40 shrink-0" />
				</div>
			</CardHeader>
			<CardContent>
				{ isLoading ? (
					<KpiSkeleton />
				) : (
					<>
						<div className="text-2xl font-bold tabular-nums">
							{ data
								? formatCurrency( data.revenue, data.currency )
								: '—' }
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							{ SALES_PERIOD_LABELS[ period ] }
						</div>
					</>
				) }
			</CardContent>
		</Card>
	);
}

function LostSalesCard() {
	const [ period, setPeriod ] = React.useState< SalesPeriod >( 'day' );
	const { dateFrom, dateTo } = salesPeriodToDates( period );
	const { data, isLoading } = useLostSales( 'custom', dateFrom, dateTo );

	return (
		<Card className="border-border shadow-md">
			<CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					Lost Sales
				</CardTitle>
				<div className="flex items-center gap-1.5">
					<PeriodFilter value={ period } onChange={ setPeriod } />
					<TrendingDown className="w-4 h-4 text-status-out-of-stock shrink-0" />
				</div>
			</CardHeader>
			<CardContent>
				{ isLoading ? (
					<KpiSkeleton />
				) : (
					<>
						<div className="text-2xl font-bold tabular-nums text-status-out-of-stock-text">
							{ data
								? formatCurrency(
										data.total_lost,
										data.currency
								  )
								: '—' }
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							Estimated, { SALES_PERIOD_LABELS[ period ] }
						</div>
					</>
				) }
			</CardContent>
		</Card>
	);
}

function OrdersCard() {
	const [ period, setPeriod ] = React.useState< SalesPeriod >( 'day' );
	const { dateFrom, dateTo } = salesPeriodToDates( period );
	const { data, isLoading } = useSalesSummary( dateFrom, dateTo );

	return (
		<Card className="border-border shadow-md">
			<CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					Orders
				</CardTitle>
				<div className="flex items-center gap-1.5">
					<PeriodFilter value={ period } onChange={ setPeriod } />
					<Package className="w-4 h-4 text-muted-foreground/40 shrink-0" />
				</div>
			</CardHeader>
			<CardContent>
				{ isLoading ? (
					<KpiSkeleton />
				) : (
					<>
						<div className="text-2xl font-bold tabular-nums">
							{ data !== undefined
								? new Intl.NumberFormat().format( data.orders )
								: '—' }
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							{ SALES_PERIOD_LABELS[ period ] }
						</div>
					</>
				) }
			</CardContent>
		</Card>
	);
}

function AovCard() {
	const [ period, setPeriod ] = React.useState< SalesPeriod >( 'day' );
	const { dateFrom, dateTo } = salesPeriodToDates( period );
	const { data, isLoading } = useSalesSummary( dateFrom, dateTo );

	let displayValue: string;
	if ( data ) {
		if ( data.orders > 0 ) {
			displayValue = formatCurrency( data.aov, data.currency );
		} else {
			displayValue = '—';
		}
	} else {
		displayValue = '—';
	}

	return (
		<Card className="border-border shadow-md">
			<CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					Avg. Order Value
				</CardTitle>
				<div className="flex items-center gap-1.5">
					<PeriodFilter value={ period } onChange={ setPeriod } />
					<BarChart2 className="w-4 h-4 text-muted-foreground/40 shrink-0" />
				</div>
			</CardHeader>
			<CardContent>
				{ isLoading ? (
					<KpiSkeleton />
				) : (
					<>
						<div className="text-2xl font-bold tabular-nums">
							{ displayValue }
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							{ data?.orders === 0
								? 'No orders in period'
								: SALES_PERIOD_LABELS[ period ] }
						</div>
					</>
				) }
			</CardContent>
		</Card>
	);
}

export function RevenueKpiCards() {
	return (
		<section>
			<h2 className="text-base font-semibold mb-3">Revenue & Sales</h2>
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
				<SalesCard />
				<LostSalesCard />
				<OrdersCard />
				<AovCard />
			</div>
		</section>
	);
}
