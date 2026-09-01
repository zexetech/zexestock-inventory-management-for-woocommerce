import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn( ...inputs: ClassValue[] ): string {
	return twMerge( clsx( inputs ) );
}

export function decodeHtml( html: string ): string {
	const el = document.createElement( 'textarea' );
	el.innerHTML = html;
	return el.value;
}

export function formatCurrency( value: number, symbol: string ): string {
	const decoded = decodeHtml( symbol );
	return (
		new Intl.NumberFormat( 'de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		} ).format( value ) +
		' ' +
		decoded
	);
}

export function formatNumber( value: number ): string {
	return new Intl.NumberFormat().format( value );
}
