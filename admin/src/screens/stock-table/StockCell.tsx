import * as React from 'react';
import { createPortal } from 'react-dom';
import { StockBadge } from './StockBadge';
import { useAdjustStock } from '@/hooks/useAdjustStock';
import { toast } from '@/components/ui/toast';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
	DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types/api';
import { MAX_STOCK, MIN_STOCK } from '@/lib/validation';

interface StockCellProps {
	product: Product;
}

export function StockCell( { product }: StockCellProps ) {
	if ( product.type === 'variable' ) {
		return (
			<span className="text-muted-foreground text-sm">— (variable)</span>
		);
	}

	if ( product.type === 'grouped' ) {
		return (
			<span className="text-muted-foreground text-sm">— (grouped)</span>
		);
	}

	if ( ! product.manage_stock ) {
		return (
			<span
				title="Stock not managed for this product"
				className="text-muted-foreground text-xs cursor-not-allowed"
			>
				Not managed
			</span>
		);
	}

	return <StockCellPopover product={ product } />;
}

function StockCellPopover( { product }: { product: Product } ) {
	const allowNegativeStock =
		window.zexstData?.settings?.allowNegativeStock ?? true;
	const largeAdjWarning =
		window.zexstData?.settings?.largeAdjustmentWarning ?? 50;
	const [ open, setOpen ] = React.useState( false );
	const [ inputValue, setInputValue ] = React.useState( '' );
	const [ inlineError, setInlineError ] = React.useState< string | null >(
		null
	);
	const [ popoverStyle, setPopoverStyle ] =
		React.useState< React.CSSProperties >( {} );
	const [ confirmOpen, setConfirmOpen ] = React.useState( false );

	const triggerRef = React.useRef< HTMLButtonElement >( null );
	const popoverRef = React.useRef< HTMLDivElement >( null );
	const inputRef = React.useRef< HTMLInputElement >( null );

	const adjustMutation = useAdjustStock( {
		onAdjustSuccess: ( data, vars ) => {
			if ( data.previous_stock !== null ) {
				const sign = vars.adjustment >= 0 ? '+' : '';
				toast.success(
					`Stock updated · ${ sign }${ vars.adjustment }`,
					{ duration: 8000 }
				);
			}
		},
	} );
	const isSaving = adjustMutation.isPending;

	React.useEffect( () => {
		if ( open ) {
			setInputValue( String( product.stock_qty ?? 0 ) );
			setInlineError( null );
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

	function handleOpen() {
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

	const numericInput = parseFloat( inputValue );
	const hasValue = inputValue !== '' && ! isNaN( numericInput );

	function computeDelta(): number {
		return numericInput - ( product.stock_qty ?? 0 );
	}

	const showLargeWarning =
		hasValue &&
		Math.abs( numericInput - ( product.stock_qty ?? 0 ) ) > largeAdjWarning;

	const confirmDelta = computeDelta();
	const confirmProjected = ( product.stock_qty ?? 0 ) + confirmDelta;
	const confirmSign = confirmDelta >= 0 ? '+' : '';

	function submitAdjustment( delta: number ) {
		adjustMutation.mutate(
			{
				productId: product.id,
				parentId: product.parent_id > 0 ? product.parent_id : undefined,
				productName: product.name,
				adjustment: delta,
				currentStock: product.stock_qty,
				expectedStock:
					product.stock_qty !== null ? product.stock_qty : undefined,
			},
			{
				onSuccess: () => {
					setOpen( false );
					setInlineError( null );
				},
			}
		);
	}

	function handleApply() {
		setInlineError( null );
		if ( ! hasValue ) {
			setInlineError( 'Enter a value.' );
			return;
		}
		if ( numericInput > MAX_STOCK || numericInput < MIN_STOCK ) {
			setInlineError(
				`Value must be between ${ MIN_STOCK.toLocaleString() } and ${ MAX_STOCK.toLocaleString() }.`
			);
			return;
		}
		const delta = computeDelta();
		if ( delta === 0 ) {
			setInlineError( 'No change.' );
			return;
		}
		if ( ! allowNegativeStock ) {
			const projected = ( product.stock_qty ?? 0 ) + delta;
			if ( projected < 0 ) {
				setInlineError(
					`New stock (${ projected }) would be negative.`
				);
				return;
			}
		}

		if ( showLargeWarning ) {
			setConfirmOpen( true );
			return;
		}

		submitAdjustment( delta );
	}

	function handleKeyDown( e: React.KeyboardEvent< HTMLInputElement > ) {
		if ( e.key === 'Enter' ) {
			e.preventDefault();
			handleApply();
		} else if ( e.key === 'Escape' ) {
			e.preventDefault();
			setOpen( false );
		}
	}

	return (
		<>
			<div className="inline-flex items-center gap-1">
				<button
					ref={ triggerRef }
					type="button"
					onClick={ handleOpen }
					className="cursor-pointer hover:opacity-80 transition-opacity"
					aria-label={ `Adjust stock for ${ product.name }` }
				>
					<StockBadge
						qty={ product.stock_qty }
						status={ product.stock_status }
						thresholdOverride={
							product.low_stock_threshold_override
						}
					/>
				</button>
			</div>

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
						} }
						role="dialog"
						aria-label={ `Set stock for ${ product.name }` }
					>
						<p
							style={ {
								margin: 0,
								fontSize: '14px',
								fontWeight: 600,
								color: '#000000',
							} }
						>
							Set Stock
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
								step="1"
								min={ 0 }
								max={ MAX_STOCK }
								value={ inputValue }
								onChange={ ( e ) => {
									setInputValue( e.target.value );
									setInlineError( null );
								} }
								onKeyDown={ handleKeyDown }
								disabled={ isSaving }
								style={ {
									flex: 1,
									backgroundColor: '#ffffff',
									color: '#000000',
									border: '2px solid #6b7280',
									borderRadius: '4px',
									fontSize: '14px',
									outline: 'none',
									maxWidth: '130px',
									opacity: isSaving ? 0.5 : 1,
								} }
								aria-label={ `Stock adjustment for ${ product.name }` }
							/>
							<button
								type="button"
								onClick={ handleApply }
								disabled={ isSaving }
								style={ {
									backgroundColor: 'hsl(251, 67%, 55%)',
									color: '#ffffff',
									border: 'none',
									borderRadius: '4px',
									padding: '0 16px',
									fontSize: '14px',
									fontWeight: 600,
									cursor: isSaving
										? 'not-allowed'
										: 'pointer',
									opacity: isSaving ? 0.5 : 1,
									whiteSpace: 'nowrap',
									alignSelf: 'stretch',
								} }
							>
								{ isSaving ? '…' : 'Apply' }
							</button>
						</div>

						{ showLargeWarning && (
							<p
								style={ {
									margin: 0,
									fontSize: '12px',
									color: '#b45309',
								} }
							>
								Large change — double-check before applying.
							</p>
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
					</div>,
					document.body
				) }

			<Dialog open={ confirmOpen } onOpenChange={ setConfirmOpen }>
				<DialogContent
					className="z-[10000]"
					overlayClassName="z-[10000]"
				>
					<DialogHeader>
						<DialogTitle>Confirm large adjustment</DialogTitle>
						<DialogDescription>
							Adjust stock for { product.name } by { confirmSign }
							{ confirmDelta } (from { product.stock_qty ?? 0 } to{ ' ' }
							{ confirmProjected }). This exceeds the{ ' ' }
							{ largeAdjWarning }-unit warning threshold.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="ghost" size="sm">
								Cancel
							</Button>
						</DialogClose>
						<Button
							size="sm"
							onClick={ () => {
								submitAdjustment( confirmDelta );
								setConfirmOpen( false );
							} }
						>
							Confirm
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
