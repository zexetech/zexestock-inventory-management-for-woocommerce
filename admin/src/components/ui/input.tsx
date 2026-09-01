import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
	extends React.InputHTMLAttributes< HTMLInputElement > {
	label?: string;
	helperText?: string;
	error?: string;
	id?: string;
}

const Input = React.forwardRef< HTMLInputElement, InputProps >(
	(
		{ className, type, label, helperText, error, id, name, ...props },
		ref
	) => {
		const inputId = id ?? name;
		const helperId = inputId ? `${ inputId }-helper` : undefined;
		const errorId = inputId ? `${ inputId }-error` : undefined;
		const hasError = Boolean( error );

		let describedBy: string | undefined;
		if ( hasError ) {
			describedBy = errorId;
		} else if ( helperText ) {
			describedBy = helperId;
		} else {
			describedBy = undefined;
		}

		return (
			<div className="flex flex-col gap-1">
				{ label && (
					<label
						htmlFor={ inputId }
						className="text-sm font-medium leading-none text-foreground"
					>
						{ label }
					</label>
				) }
				<input
					type={ type }
					id={ inputId }
					name={ name }
					ref={ ref }
					aria-describedby={ describedBy }
					aria-invalid={ hasError || undefined }
					className={ cn(
						'flex h-9 w-full rounded-md border border-solid border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors',
						'placeholder:text-muted-foreground',
						'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
						'disabled:cursor-not-allowed disabled:opacity-50',
						hasError &&
							'border-destructive focus-visible:ring-destructive',
						className
					) }
					{ ...props }
				/>
				{ hasError && (
					<p
						id={ errorId }
						className="text-xs text-destructive"
						role="alert"
					>
						{ error }
					</p>
				) }
				{ ! hasError && helperText && (
					<p
						id={ helperId }
						className="text-xs text-muted-foreground"
					>
						{ helperText }
					</p>
				) }
			</div>
		);
	}
);
Input.displayName = 'Input';

export { Input };
