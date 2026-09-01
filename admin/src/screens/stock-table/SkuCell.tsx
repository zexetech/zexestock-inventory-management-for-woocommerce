import * as React from 'react';
import { createPortal } from 'react-dom';
import { useSetSku } from '@/hooks/useSetSku';
import { toast } from '@/components/ui/toast';

interface SkuCellProps {
	productId: number;
	productName: string;
	sku: string;
}

export function SkuCell( { productId, productName, sku }: SkuCellProps ) {
	const [ open, setOpen ] = React.useState( false );
	const [ inputValue, setInputValue ] = React.useState( '' );
	const [ inlineError, setInlineError ] = React.useState< string | null >(
		null
	);
	const [ popoverStyle, setPopoverStyle ] =
		React.useState< React.CSSProperties >( {} );
	const inputRef = React.useRef< HTMLInputElement >( null );
	const triggerRef = React.useRef< HTMLButtonElement >( null );
	const popoverRef = React.useRef< HTMLDivElement >( null );
	const mutation = useSetSku( {
		onSkuSuccess: () => {
			toast.success( 'SKU updated' );
		},
	} );

	const displayValue = sku && sku !== '' ? sku : '—';

	function handleOpen() {
		setInputValue( sku );
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
		const trimmed = inputValue.trim();
		setInlineError( null );
		mutation.mutate(
			{ productId, productName, sku: trimmed, oldSku: sku },
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
				className="font-mono text-sm text-info-text hover:text-info-fg transition-colors cursor-pointer"
				aria-label={ `Edit SKU for ${ productName }` }
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
							borderStyle: 'solid',
							borderRadius: '8px',
							boxShadow: '4px 4px 0px rgba(0,0,0,0.25)',
							padding: '16px',
							display: 'flex',
							flexDirection: 'column',
							gap: '12px',
							width: '256px',
						} }
						role="dialog"
						aria-label={ `Edit SKU for ${ productName }` }
					>
						<p
							style={ {
								margin: 0,
								fontSize: '14px',
								fontWeight: 600,
								color: '#000000',
							} }
						>
							Set SKU
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
								value={ inputValue }
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
									fontFamily: 'monospace',
									outline: 'none',
									opacity: mutation.isPending ? 0.5 : 1,
								} }
								aria-label={ `New SKU for ${ productName }` }
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
					</div>,
					document.body
				) }
		</>
	);
}
