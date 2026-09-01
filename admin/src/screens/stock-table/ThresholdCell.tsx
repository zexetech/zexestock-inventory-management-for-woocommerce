import * as React from 'react';
import { createPortal } from 'react-dom';
import { useSetThreshold } from '@/hooks/useSetThreshold';
import type { Product } from '@/types/api';
import { MAX_THRESHOLD } from '@/lib/validation';

interface ThresholdCellProps {
	product: Product;
}

export function ThresholdCell( { product }: ThresholdCellProps ) {
	const globalThreshold = window.zexstData?.settings?.lowStockThreshold ?? 10;
	const [ open, setOpen ] = React.useState( false );
	const [ inputValue, setInputValue ] = React.useState( '' );
	const [ inlineError, setInlineError ] = React.useState< string | null >(
		null
	);
	const [ popoverStyle, setPopoverStyle ] =
		React.useState< React.CSSProperties >( {} );
	const triggerRef = React.useRef< HTMLButtonElement >( null );
	const popoverRef = React.useRef< HTMLDivElement >( null );
	const inputRef = React.useRef< HTMLInputElement >( null );
	const oldValueRef = React.useRef< number | null >( null );
	const mutation = useSetThreshold();

	const isNonEditable =
		product.type === 'variable' || product.type === 'grouped';

	const override = product.low_stock_threshold_override;
	const displayValue = override !== null ? String( override ) : '—';

	function handleOpen() {
		oldValueRef.current = override;
		setInputValue( override !== null ? String( override ) : '' );
		setInlineError( null );
		if ( triggerRef.current ) {
			const rect = triggerRef.current.getBoundingClientRect();
			const popoverWidth = 220;
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
			if (
				popoverRef.current &&
				! popoverRef.current.contains( e.target as Node ) &&
				triggerRef.current &&
				! triggerRef.current.contains( e.target as Node )
			) {
				setOpen( false );
			}
		}
		document.addEventListener( 'pointerdown', handlePointerDown );
		return () =>
			document.removeEventListener( 'pointerdown', handlePointerDown );
	}, [ open ] );

	React.useEffect( () => {
		if ( ! open ) {
			return;
		}
		const popoverWidth = 220;
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
		const trimmed = inputValue.trim();
		const parsed = trimmed === '' ? null : parseInt( trimmed, 10 );

		if ( parsed !== null && ( isNaN( parsed ) || parsed < 0 ) ) {
			setInlineError( 'Enter a valid whole number ≥ 0.' );
			return;
		}

		if ( parsed !== null && parsed > MAX_THRESHOLD ) {
			setInlineError(
				`Threshold cannot exceed ${ MAX_THRESHOLD.toLocaleString() }.`
			);
			return;
		}

		if ( parsed === override ) {
			setOpen( false );
			return;
		}

		mutation.mutate(
			{
				productId: product.id,
				productName: product.name,
				threshold: parsed,
			},
			{ onSuccess: () => setOpen( false ) }
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

	if ( isNonEditable ) {
		return <span className="text-muted-foreground text-sm">—</span>;
	}

	return (
		<>
			<button
				ref={ triggerRef }
				type="button"
				onClick={ handleOpen }
				disabled={ mutation.isPending }
				className="text-sm text-info-text hover:text-info-fg transition-colors cursor-pointer tabular-nums"
				title={
					override === null
						? `Using global threshold (${ globalThreshold }). Click to override.`
						: `Per-product override. Click to edit. Global: ${ globalThreshold }.`
				}
				aria-label={ `Edit low stock threshold for ${ product.name }` }
			>
				{ displayValue }
			</button>

			{ open &&
				createPortal(
					<div
						ref={ popoverRef }
						style={ {
							...popoverStyle,
							backgroundColor: '#f3f4f6',
							border: '2px solid #9ca3af',
							borderRadius: '8px',
							boxShadow: '4px 4px 0px rgba(0,0,0,0.25)',
							padding: '16px',
							display: 'flex',
							flexDirection: 'column',
							gap: '12px',
						} }
						role="dialog"
						aria-label={ `Set low stock threshold for ${ product.name }` }
					>
						<p
							style={ {
								margin: 0,
								fontSize: '14px',
								fontWeight: 600,
								color: '#000000',
							} }
						>
							Set Low Stock Threshold
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
								type="number"
								min={ 0 }
								max={ MAX_THRESHOLD }
								step={ 1 }
								value={ inputValue }
								placeholder={ String( globalThreshold ) }
								onChange={ ( e ) => {
									setInlineError( null );
									setInputValue( e.target.value );
								} }
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
								aria-label={ `New threshold for ${ product.name }` }
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

						{ override !== null && (
							<p
								style={ {
									margin: 0,
									fontSize: '11px',
									color: '#6b7280',
								} }
							>
								Clear the input and click Set to revert to
								global ({ globalThreshold }).
							</p>
						) }
					</div>,
					document.body
				) }
		</>
	);
}
