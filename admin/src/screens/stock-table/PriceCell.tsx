import * as React from 'react';
import { createPortal } from 'react-dom';
import { MAX_PRICE } from '@/lib/validation';
import { formatCurrency } from '@/lib/utils';
import { useSetPrice } from '@/hooks/useSetPrice';
import { toast } from '@/components/ui/toast';
import { DatePicker } from '@/components/ui/date-picker';

export function sanitizePrice( raw: string ): string {
	let val = raw.replace( /[^\d.]/g, '' );
	const dotIdx = val.indexOf( '.' );
	if ( dotIdx !== -1 ) {
		val =
			val.slice( 0, dotIdx + 1 ) +
			val.slice( dotIdx + 1 ).replace( /\./g, '' );
		val = val.slice( 0, dotIdx + 3 );
	}
	return val;
}

export function normalizePrice( val: string ): string {
	if ( val === '' || val === '.' ) {
		return '';
	}
	val = val.replace( /^0+([1-9])/, '$1' );
	val = val.replace( /\.$/, '' );
	return val;
}

export function priceError( val: string ): string | null {
	if ( val === '' ) {
		return null;
	}
	const n = parseFloat( val );
	if ( isNaN( n ) ) {
		return 'Enter a valid price.';
	}
	if ( n < 0 ) {
		return 'Price cannot be negative.';
	}
	if ( n > MAX_PRICE ) {
		return `Price cannot exceed ${ MAX_PRICE.toLocaleString() }.`;
	}
	return null;
}

export type PriceField =
	| 'regular_price'
	| 'sale_price'
	| 'date_on_sale_from'
	| 'date_on_sale_to'
	| 'purchase_price';

interface PriceCellProps {
	productId: number;
	productName: string;
	field: 'regular_price' | 'sale_price' | 'purchase_price';
	value: string | null;
	dateFromValue?: string | null;
	dateToValue?: string | null;
}

export function PriceCell( {
	productId,
	productName,
	field,
	value,
	dateFromValue,
	dateToValue,
}: PriceCellProps ) {
	const [ open, setOpen ] = React.useState( false );
	const [ inputValue, setInputValue ] = React.useState( '' );
	const [ dateFrom, setDateFrom ] = React.useState( dateFromValue ?? '' );
	const [ dateTo, setDateTo ] = React.useState( dateToValue ?? '' );
	const [ inlineError, setInlineError ] = React.useState< string | null >(
		null
	);
	const [ popoverStyle, setPopoverStyle ] =
		React.useState< React.CSSProperties >( {} );
	const inputRef = React.useRef< HTMLInputElement >( null );
	const triggerRef = React.useRef< HTMLButtonElement >( null );
	const popoverRef = React.useRef< HTMLDivElement >( null );
	const mutation = useSetPrice( {
		onPriceSuccess: ( vars ) => {
			let fieldLabel: string;
			if ( vars.field === 'regular_price' ) {
				fieldLabel = 'Regular price';
			} else if ( vars.field === 'sale_price' ) {
				fieldLabel = 'Sale price';
			} else {
				fieldLabel = 'Purchase price';
			}
			toast.success( `${ fieldLabel } updated` );
		},
	} );

	let label: string;
	if ( field === 'regular_price' ) {
		label = 'Regular Price';
	} else if ( field === 'sale_price' ) {
		label = 'Sale Price';
	} else {
		label = 'Purchase Price';
	}
	const currencySymbol = window.zexstData?.currency ?? '$';
	const rawNum = value && value !== '' ? parseFloat( value ) : null;
	const displayValue =
		rawNum !== null && ! isNaN( rawNum )
			? formatCurrency( rawNum, currencySymbol )
			: '—';

	function handleOpen() {
		setInputValue( value ?? '' );
		setDateFrom( dateFromValue ?? '' );
		setDateTo( dateToValue ?? '' );
		setInlineError( null );
		if ( triggerRef.current ) {
			const rect = triggerRef.current.getBoundingClientRect();
			const popoverWidth = 256;
			setPopoverStyle( {
				position: 'fixed',
				top: rect.bottom + 4,
				left: rect.left + rect.width / 2 - popoverWidth / 2,
				zIndex: 9999,
			} );
		}
		setOpen( true );
	}

	React.useEffect( () => {
		if ( open ) {
			setTimeout( () => inputRef.current?.focus(), 0 );
		}
	}, [ open ] );

	React.useEffect( () => {
		if ( ! open ) {
			return;
		}
		function handlePointerDown( e: PointerEvent ) {
			const target = e.target as HTMLElement;
			if ( popoverRef.current?.contains( target ) ) {
				return;
			}
			if ( triggerRef.current?.contains( target ) ) {
				return;
			}
			if ( target.closest?.( '[data-radix-popper-content-wrapper]' ) ) {
				return;
			}
			setOpen( false );
		}
		document.addEventListener( 'pointerdown', handlePointerDown );
		return () =>
			document.removeEventListener( 'pointerdown', handlePointerDown );
	}, [ open ] );

	React.useEffect( () => {
		if ( ! open ) {
			return;
		}
		const popoverWidth = 256;
		function updatePosition() {
			if ( ! triggerRef.current || ! popoverRef.current ) {
				return;
			}
			const rect = triggerRef.current.getBoundingClientRect();
			popoverRef.current.style.top = `${ rect.bottom + 4 }px`;
			popoverRef.current.style.left = `${
				rect.left + rect.width / 2 - popoverWidth / 2
			}px`;
		}
		document.addEventListener( 'scroll', updatePosition, true );
		window.addEventListener( 'resize', updatePosition );
		return () => {
			document.removeEventListener( 'scroll', updatePosition, true );
			window.removeEventListener( 'resize', updatePosition );
		};
	}, [ open ] );

	function handleSet() {
		const normalized = normalizePrice( inputValue );
		setInputValue( normalized );
		const err = priceError( normalized );
		if ( err ) {
			setInlineError( err );
			return;
		}
		setInlineError( null );
		const oldValue = value ?? null;
		mutation.mutate(
			{
				productId,
				productName,
				field,
				value: normalized,
				oldValue,
				...( field === 'sale_price' ? { dateFrom, dateTo } : {} ),
			},
			{
				onSuccess: () => {
					setOpen( false );
				},
			}
		);
	}

	function handleKeyDown( e: React.KeyboardEvent< HTMLInputElement > ) {
		if ( e.key === 'Enter' ) {
			e.preventDefault();
			handleSet();
		} else if ( e.key === 'Escape' ) {
			e.preventDefault();
			setOpen( false );
		}
	}

	return (
		<>
			<button
				ref={ triggerRef }
				type="button"
				onClick={ handleOpen }
				className="text-sm text-info-text hover:text-info-fg transition-colors cursor-pointer tabular-nums"
				aria-label={ `Edit ${ label } for ${ productName }` }
			>
				{ displayValue }
			</button>

			{ open &&
				createPortal(
					<div ref={ popoverRef } style={ popoverStyle }>
						<div
							className="zexst-app"
							style={ {
								backgroundColor: '#f3f4f6',
								border: '2px solid #9ca3af',
								borderRadius: '8px',
								boxShadow: '4px 4px 0px rgba(0,0,0,0.25)',
								padding: '16px',
								display: 'flex',
								flexDirection: 'column',
								gap: '12px',
								width: '220px',
							} }
							role="dialog"
							aria-label={ `Set the ${ label } value` }
						>
							<p
								style={ {
									margin: 0,
									fontSize: '14px',
									fontWeight: 600,
									color: '#000000',
								} }
							>
								Set the { label } value
							</p>
							<div
								style={ {
									display: 'flex',
									alignItems: 'center',
									gap: '8px',
								} }
							>
								<input
									ref={ inputRef }
									type="text"
									inputMode="decimal"
									value={ inputValue }
									onChange={ ( e ) => {
										setInlineError( null );
										setInputValue(
											sanitizePrice( e.target.value )
										);
									} }
									onBlur={ () =>
										setInputValue( ( v ) =>
											normalizePrice( v )
										)
									}
									onKeyDown={ handleKeyDown }
									disabled={ mutation.isPending }
									style={ {
										flex: 1,
										backgroundColor: '#ffffff',
										color: '#000000',
										border: '2px solid #6b7280',
										borderRadius: '4px',
										fontSize: '14px',
										outline: 'none',
										maxWidth: '130px',
										opacity: mutation.isPending ? 0.5 : 1,
									} }
									aria-label={ `New ${ label }` }
								/>
								<button
									type="button"
									onClick={ handleSet }
									disabled={ mutation.isPending }
									style={ {
										backgroundColor: 'hsl(251, 67%, 55%)',
										color: '#ffffff',
										border: 'none',
										borderRadius: '4px',
										padding: '0 16px',
										fontSize: '14px',
										fontWeight: 600,
										cursor: mutation.isPending
											? 'not-allowed'
											: 'pointer',
										opacity: mutation.isPending ? 0.5 : 1,
										whiteSpace: 'nowrap',
										alignSelf: 'stretch',
									} }
								>
									{ mutation.isPending ? '…' : 'Set' }
								</button>
							</div>

							{ field === 'sale_price' && (
								<div
									style={ {
										display: 'flex',
										flexDirection: 'column',
										gap: '8px',
									} }
								>
									<label
										htmlFor={ `popover-sale-date-from-${ productId }` }
										style={ {
											display: 'flex',
											flexDirection: 'column',
											gap: '2px',
										} }
									>
										<span
											style={ {
												fontSize: '11px',
												color: '#6b7280',
												textTransform: 'uppercase',
												letterSpacing: '0.05em',
											} }
										>
											Start Date
										</span>
										<DatePicker
											id={ `popover-sale-date-from-${ productId }` }
											value={ dateFrom }
											onChange={ setDateFrom }
											placeholder="Start date"
											disabled={ mutation.isPending }
											className="w-full"
										/>
									</label>
									<label
										htmlFor={ `popover-sale-date-to-${ productId }` }
										style={ {
											display: 'flex',
											flexDirection: 'column',
											gap: '2px',
										} }
									>
										<span
											style={ {
												fontSize: '11px',
												color: '#6b7280',
												textTransform: 'uppercase',
												letterSpacing: '0.05em',
											} }
										>
											End Date
										</span>
										<DatePicker
											id={ `popover-sale-date-to-${ productId }` }
											value={ dateTo }
											onChange={ setDateTo }
											placeholder="End date"
											disabled={ mutation.isPending }
											className="w-full"
										/>
									</label>
								</div>
							) }

							{ inlineError && (
								<p
									style={ {
										margin: 0,
										fontSize: '12px',
										color: '#dc2626',
									} }
									role="alert"
								>
									{ inlineError }
								</p>
							) }
						</div>
					</div>,
					document.body
				) }
		</>
	);
}
