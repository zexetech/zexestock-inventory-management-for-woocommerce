import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { decodeHtml } from '@/lib/utils';

export type ZexstCategory = { id: number; slug: string; name: string };

export interface CategoryDropdownProps {
	categories: ZexstCategory[];
	value: number;
	onChange: ( val: number ) => void;
	placeholder?: string;
	includeAllOption?: boolean;
	triggerClassName?: string;
}

export function CategoryDropdown( {
	categories,
	value,
	onChange,
	placeholder = 'All categories',
	includeAllOption = true,
	triggerClassName = 'gap-1.5',
}: CategoryDropdownProps ) {
	const [ open, setOpen ] = React.useState( false );
	const [ search, setSearch ] = React.useState( '' );
	const [ style, setStyle ] = React.useState< React.CSSProperties >( {} );
	const triggerRef = React.useRef< HTMLButtonElement >( null );
	const dropdownRef = React.useRef< HTMLDivElement >( null );

	const selectedCat =
		value > 0 ? categories.find( ( c ) => c.id === value ) : null;
	const filteredCats = search.trim()
		? categories.filter( ( c ) =>
				decodeHtml( c.name )
					.toLowerCase()
					.includes( search.toLowerCase() )
		  )
		: categories;

	function openDropdown() {
		if ( triggerRef.current ) {
			const rect = triggerRef.current.getBoundingClientRect();
			setStyle( {
				position: 'fixed',
				top: rect.bottom + 4,
				left: rect.left,
				zIndex: 9999,
				minWidth: rect.width,
			} );
		}
		setOpen( true );
	}

	function close() {
		setOpen( false );
		setSearch( '' );
	}

	React.useEffect( () => {
		if ( ! open ) {
			return;
		}
		function onPointerDown( e: PointerEvent ) {
			if (
				dropdownRef.current &&
				! dropdownRef.current.contains( e.target as Node ) &&
				triggerRef.current &&
				! triggerRef.current.contains( e.target as Node )
			) {
				close();
			}
		}
		document.addEventListener( 'pointerdown', onPointerDown );
		return () =>
			document.removeEventListener( 'pointerdown', onPointerDown );
	}, [ open ] );

	return (
		<>
			<Button
				ref={ triggerRef }
				variant="outline"
				size="sm"
				type="button"
				onClick={ open ? close : openDropdown }
				aria-haspopup="listbox"
				aria-expanded={ open }
				className={ triggerClassName }
			>
				<span className="line-clamp-1">
					{ selectedCat
						? decodeHtml( selectedCat.name )
						: placeholder }
				</span>
				<ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
			</Button>

			{ open &&
				createPortal(
					<div
						ref={ dropdownRef }
						style={ style }
						className="zexst-app w-56 rounded-md border border-border bg-popover text-popover-foreground shadow-md overflow-hidden"
					>
						<div className="p-2 border-b border-border">
							<input
								autoFocus
								type="search"
								placeholder="Search categories…"
								value={ search }
								onChange={ ( e ) =>
									setSearch( e.target.value )
								}
								className="w-full h-7 px-2 text-sm bg-transparent border border-input rounded focus:outline-none focus:border-ring placeholder:text-muted-foreground"
							/>
						</div>
						<div className="max-h-56 overflow-y-auto py-1">
							{ includeAllOption && search.trim() === '' && (
								<button
									type="button"
									className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
									onClick={ () => {
										onChange( 0 );
										close();
									} }
								>
									<Check
										className={ `h-3.5 w-3.5 shrink-0 ${
											value === 0
												? 'opacity-100'
												: 'opacity-0'
										}` }
									/>
									All categories
								</button>
							) }
							{ filteredCats.map( ( cat ) => (
								<button
									key={ cat.id }
									type="button"
									className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
									onClick={ () => {
										onChange( cat.id );
										close();
									} }
								>
									<Check
										className={ `h-3.5 w-3.5 shrink-0 ${
											value === cat.id
												? 'opacity-100'
												: 'opacity-0'
										}` }
									/>
									{ decodeHtml( cat.name ) }
								</button>
							) ) }
							{ filteredCats.length === 0 && (
								<p className="px-3 py-2 text-sm text-muted-foreground">
									No categories found.
								</p>
							) }
						</div>
					</div>,
					document.body
				) }
		</>
	);
}
