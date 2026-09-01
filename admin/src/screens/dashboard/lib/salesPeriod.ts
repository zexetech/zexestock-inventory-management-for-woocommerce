import type { SalesPeriod } from '../types';

function pad( n: number ): string {
	return String( n ).padStart( 2, '0' );
}

function fmt( d: Date ): string {
	return `${ d.getFullYear() }-${ pad( d.getMonth() + 1 ) }-${ pad(
		d.getDate()
	) }`;
}

export function salesPeriodToDates( period: SalesPeriod ): {
	dateFrom: string;
	dateTo: string;
} {
	const now = new Date();
	const today = fmt( now );

	switch ( period ) {
		case 'day':
			return { dateFrom: today, dateTo: today };

		case 'month':
			return {
				dateFrom: `${ now.getFullYear() }-${ pad(
					now.getMonth() + 1
				) }-01`,
				dateTo: today,
			};

		case 'ytd':
			return {
				dateFrom: `${ now.getFullYear() }-01-01`,
				dateTo: today,
			};
	}
}

export const SALES_PERIOD_LABELS: Record< SalesPeriod, string > = {
	day: 'Today',
	month: 'This Month',
	ytd: 'Year to Date',
};
