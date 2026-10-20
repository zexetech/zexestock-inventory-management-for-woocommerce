import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { decodeHtml } from '@/lib/utils';

export interface SearchDropdownProps< T, Id extends string | number = number > {
	items: T[];
	getId: ( item: T ) => Id;
	getLabel: ( item: T ) => string;
	value: Id | null;
	onChange: ( id: Id ) => void;
	placeholder?: string;
	emptyMessage?: string;
	searchPlaceholder?: string;
	triggerClassName?: string;
	panelClassName?: string;
	filterItems?: boolean;
	onSearchChange?: ( value: string ) => void;
	renderLabel?: ( item: T ) => React.ReactNode;
	onOpenChange?: ( open: boolean ) => void;
	/** Adds a leading entry that clears the value, e.g. "Unspecified". */
	clearOption?: { label: string; onClear: () => void };
	/** Disabled items render as non-selectable rows, e.g. group headers. */
	isItemDisabled?: ( item: T ) => boolean;
	/** Extra classes for an item's row, e.g. to highlight grouped rows. */
	getItemClassName?: ( item: T ) => string;
	/** Trigger id, so an external <label htmlFor> can name it. */
	id?: string;
}

export function SearchDropdown< T, Id extends string | number = number >( {
	items,
	getId,
	getLabel,
	value,
	onChange,
	placeholder = 'Select…',
	emptyMessage = 'No results found.',
	searchPlaceholder = 'Search…',
	triggerClassName = 'gap-1.5',
	panelClassName = 'w-56',
	filterItems = true,
	onSearchChange,
	renderLabel,
	onOpenChange,
	clearOption,
	isItemDisabled,
	getItemClassName,
	id: triggerId,
}: SearchDropdownProps< T, Id > ) {
	const [ open, setOpen ] = React.useState( false );
	const [ search, setSearch ] = React.useState( '' );

	const selected =
		value !== null ? items.find( ( i ) => getId( i ) === value ) : null;
	const filtered =
		filterItems && search.trim()
			? items.filter( ( i ) =>
					decodeHtml( getLabel( i ) )
						.toLowerCase()
						.includes( search.toLowerCase() )
			  )
			: items;

	function handleOpenChange( next: boolean ) {
		setOpen( next );
		if ( ! next ) {
			setSearch( '' );
			// Callers that drive a server-side query from the search text
			// would otherwise reopen showing results for an invisible term.
			onSearchChange?.( '' );
		}
		onOpenChange?.( next );
	}

	// Built on Radix Popover rather than a raw body portal so it layers
	// correctly inside modal Dialogs, which disable pointer events on <body>
	// and trap focus within their own content. `modal` gives the popover its
	// own scroll lock; without it a Dialog's scroll lock swallows wheel events
	// over this body-portaled list.
	return (
		<Popover modal open={ open } onOpenChange={ handleOpenChange }>
			<PopoverTrigger asChild>
				<Button
					id={ triggerId }
					variant="outline"
					size="sm"
					type="button"
					className={ triggerClassName }
				>
					<span className="line-clamp-1">
						{ selected
							? decodeHtml( getLabel( selected ) )
							: placeholder }
					</span>
					<ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className={ `${ panelClassName } p-0 overflow-hidden` }
				style={ { minWidth: 'var(--radix-popover-trigger-width)' } }
			>
				<div className="p-2 border-b border-border">
					<input
						type="search"
						placeholder={ searchPlaceholder }
						value={ search }
						onChange={ ( e ) => {
							setSearch( e.target.value );
							onSearchChange?.( e.target.value );
						} }
						className="w-full h-7 px-2 text-sm bg-transparent border border-input rounded focus:outline-none focus:border-ring placeholder:text-muted-foreground"
					/>
				</div>
				<div className="max-h-56 overflow-y-auto py-1">
					{ clearOption && (
						<button
							type="button"
							className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent cursor-pointer"
							onClick={ () => {
								clearOption.onClear();
								handleOpenChange( false );
							} }
						>
							<Check
								className={ `h-3.5 w-3.5 shrink-0 ${
									value === null ? 'opacity-100' : 'opacity-0'
								}` }
							/>
							{ clearOption.label }
						</button>
					) }
					{ filtered.map( ( item ) => {
						const id = getId( item );
						const itemClassName = getItemClassName?.( item ) ?? '';
						if ( isItemDisabled?.( item ) ) {
							return (
								<div
									key={ id }
									aria-disabled="true"
									className={ `flex w-full items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground cursor-default ${ itemClassName }` }
								>
									{ /* Stands in for the Check icon so headers line up with items. */ }
									<span
										aria-hidden="true"
										className="w-3.5 shrink-0"
									/>
									{ renderLabel
										? renderLabel( item )
										: decodeHtml( getLabel( item ) ) }
								</div>
							);
						}
						return (
							<button
								key={ id }
								type="button"
								className={ `flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer ${ itemClassName }` }
								onClick={ () => {
									onChange( id );
									handleOpenChange( false );
								} }
							>
								<Check
									className={ `h-3.5 w-3.5 shrink-0 ${
										value === id
											? 'opacity-100'
											: 'opacity-0'
									}` }
								/>
								{ renderLabel
									? renderLabel( item )
									: decodeHtml( getLabel( item ) ) }
							</button>
						);
					} ) }
					{ filtered.length === 0 && (
						<p className="px-3 py-2 text-sm text-muted-foreground">
							{ emptyMessage }
						</p>
					) }
				</div>
			</PopoverContent>
		</Popover>
	);
}
