import * as React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { format as formatWpDate, getSettings } from '@wordpress/date';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';

interface DatePickerProps {
	value: string;
	onChange: ( value: string ) => void;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	pending?: boolean;
	variant?: 'default' | 'dark';
	id?: string;
}

export function DatePicker( {
	value,
	onChange,
	placeholder = 'Pick a date',
	className,
	disabled,
	pending,
	variant = 'default',
	id,
}: DatePickerProps ) {
	const [ open, setOpen ] = React.useState( false );

	const selected: Date | undefined = React.useMemo( () => {
		if ( ! value ) {
			return undefined;
		}
		const d = parseISO( value );
		return isValid( d ) ? d : undefined;
	}, [ value ] );

	function handleSelect( day: Date | undefined ) {
		if ( day ) {
			onChange( format( day, 'yyyy-MM-dd' ) );
		}
		setOpen( false );
	}

	const isDark = variant === 'dark';

	return (
		<Popover open={ open } onOpenChange={ setOpen }>
			<PopoverTrigger asChild>
				<Button
					id={ id }
					variant="outline"
					disabled={ disabled }
					data-empty={ ! selected }
					className={ cn(
						'h-9 w-36 justify-between text-left font-normal text-sm',
						isDark
							? 'bg-zinc-700 text-zinc-100 border-zinc-500 hover:bg-zinc-600 hover:text-zinc-100 data-[empty=true]:text-zinc-400'
							: 'bg-white data-[empty=true]:text-muted-foreground',
						pending && 'border-info ring-1 ring-info',
						className
					) }
				>
					{ selected
						? formatWpDate( getSettings().formats.date, selected )
						: placeholder }
					<ChevronDownIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className={ cn( 'w-auto p-0', isDark && 'dark' ) }
				align="start"
			>
				<Calendar
					mode="single"
					selected={ selected }
					onSelect={ handleSelect }
					defaultMonth={ selected }
				/>
			</PopoverContent>
		</Popover>
	);
}
