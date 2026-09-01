import { useQuery } from '@tanstack/react-query';
import type {
	CurrentStockSummaryData,
	LowStockSummaryData,
	LostSalesData,
	SalesSummaryData,
	AnalyticsSectionSummaryData,
} from '../types';

async function ajaxGet< T >(
	action: string,
	params: Record< string, string | number > = {}
): Promise< T > {
	const ajaxUrl = window.zexstData?.ajaxUrl ?? '';
	const nonce = window.zexstData?.nonce ?? '';

	const body = new URLSearchParams( { action, _wpnonce: nonce } );
	for ( const [ k, v ] of Object.entries( params ) ) {
		body.set( k, String( v ) );
	}

	const res = await fetch( ajaxUrl, {
		method: 'POST',
		body,
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
	} );

	if ( ! res.ok ) {
		throw new Error( `HTTP ${ res.status }` );
	}

	const json = ( await res.json() ) as { success: boolean; data: T };
	if ( ! json.success ) {
		throw new Error( 'AJAX request failed' );
	}

	return json.data;
}

export function useSalesSummary( dateFrom: string, dateTo: string ) {
	return useQuery< SalesSummaryData >( {
		queryKey: [ 'analytics-sales-summary', dateFrom, dateTo ],
		queryFn: () =>
			ajaxGet< SalesSummaryData >( 'zexst_analytics_sales_summary', {
				period: 'custom',
				date_from: dateFrom,
				date_to: dateTo,
			} ),
		enabled: !! dateFrom && !! dateTo,
		staleTime: 5 * 60_000,
	} );
}

export function useCurrentStockValue(
	categoryId: number,
	productType: string
) {
	return useQuery< CurrentStockSummaryData >( {
		queryKey: [ 'analytics-current-stock-value', categoryId, productType ],
		queryFn: () =>
			ajaxGet< CurrentStockSummaryData >(
				'zexst_analytics_current_stock_value',
				{
					category: categoryId,
					product_type: productType,
				}
			),
		staleTime: 5 * 60_000,
	} );
}

export function useLowStockSummary() {
	return useQuery< LowStockSummaryData >( {
		queryKey: [ 'analytics-low-stock' ],
		queryFn: () =>
			ajaxGet< LowStockSummaryData >( 'zexst_analytics_low_stock' ),
		staleTime: 5 * 60_000,
	} );
}

export function useLostSales(
	period: string,
	dateFrom?: string,
	dateTo?: string
) {
	return useQuery< LostSalesData >( {
		queryKey: [ 'analytics-lost-sales', period, dateFrom, dateTo ],
		queryFn: () =>
			ajaxGet< LostSalesData >( 'zexst_analytics_lost_sales', {
				period,
				...( dateFrom ? { date_from: dateFrom } : {} ),
				...( dateTo ? { date_to: dateTo } : {} ),
			} ),
		staleTime: 5 * 60_000,
	} );
}

export function useAnalyticsSectionSummary(
	period: string,
	dateFrom?: string,
	dateTo?: string
) {
	return useQuery< AnalyticsSectionSummaryData >( {
		queryKey: [ 'analytics-section-summary', period, dateFrom, dateTo ],
		queryFn: () =>
			ajaxGet< AnalyticsSectionSummaryData >(
				'zexst_analytics_section_summary',
				{
					period,
					...( dateFrom ? { date_from: dateFrom } : {} ),
					...( dateTo ? { date_to: dateTo } : {} ),
				}
			),
		staleTime: 5 * 60_000,
	} );
}

export interface DashboardBootstrapData {
	sales_summary_day: SalesSummaryData;
	lost_sales_day: LostSalesData;
	low_stock: LowStockSummaryData;
	current_stock_value: CurrentStockSummaryData;
	section: AnalyticsSectionSummaryData;
}

export function useDashboardBootstrap(
	period: string,
	dayFrom: string,
	dayTo: string,
	sectionDateFrom?: string,
	sectionDateTo?: string
) {
	return useQuery< DashboardBootstrapData >( {
		queryKey: [
			'dashboard-bootstrap',
			period,
			sectionDateFrom,
			sectionDateTo,
			dayFrom,
			dayTo,
		],
		queryFn: () =>
			ajaxGet< DashboardBootstrapData >(
				'zexst_analytics_dashboard_bootstrap',
				{
					period,
					...( sectionDateFrom
						? { date_from: sectionDateFrom }
						: {} ),
					...( sectionDateTo ? { date_to: sectionDateTo } : {} ),
					day_from: dayFrom,
					day_to: dayTo,
				}
			),
		enabled: !! dayFrom && !! dayTo,
		staleTime: 5 * 60_000,
	} );
}

export function flushAnalyticsCache(): Promise< void > {
	const ajaxUrl = window.zexstData?.ajaxUrl ?? '';
	const nonce = window.zexstData?.nonce ?? '';

	return fetch( ajaxUrl, {
		method: 'POST',
		body: new URLSearchParams( {
			action: 'zexst_analytics_flush_cache',
			_wpnonce: nonce,
		} ),
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
	} ).then( () => undefined );
}
