import * as React from 'react';
import { Input, type InputProps } from '@/components/ui/input';

type NumericInputProps = Omit<
	InputProps,
	'type' | 'value' | 'onChange' | 'min' | 'max'
> & {
	value: number | undefined;
	onValueChange: ( value: number ) => void;
	min: number;
	max: number;
	integer?: boolean;
};

// Keeps the raw text locally so the field can be cleared and retyped; only
// valid numbers reach onValueChange, and blur restores the last valid value.
export function NumericInput( {
	value,
	onValueChange,
	min,
	max,
	integer = false,
	onBlur,
	...props
}: NumericInputProps ) {
	const format = ( v: number | undefined ) =>
		v === undefined ? '' : String( v );
	const [ text, setText ] = React.useState( format( value ) );

	React.useEffect( () => {
		// Leave in-progress text like "5." alone when it already means value.
		setText( ( prev ) =>
			prev.trim() !== '' && Number( prev ) === value
				? prev
				: format( value )
		);
	}, [ value ] );

	return (
		<Input
			{ ...props }
			type="number"
			min={ min }
			max={ max }
			value={ text }
			onChange={ ( e ) => {
				const raw = e.target.value;
				setText( raw );
				const next = Number( raw );
				if (
					raw.trim() !== '' &&
					Number.isFinite( next ) &&
					next >= min &&
					next <= max &&
					( ! integer || Number.isInteger( next ) )
				) {
					onValueChange( next );
				}
			} }
			onBlur={ ( e ) => {
				setText( format( value ) );
				onBlur?.( e );
			} }
		/>
	);
}
