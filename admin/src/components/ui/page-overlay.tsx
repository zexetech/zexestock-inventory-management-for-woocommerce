import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Spinner } from './spinner';
import { cn } from '@/lib/utils';

interface PageOverlayProps {
	open: boolean;
	message?: string;
	progress?: { current: number; total: number };
	className?: string;
}

function PageOverlay( {
	open,
	message,
	progress,
	className,
}: PageOverlayProps ) {
	if ( ! open ) {
		return null;
	}

	const portalContainer =
		typeof document !== 'undefined'
			? document.getElementById( 'zexst-portal' ) ?? document.body
			: null;

	if ( ! portalContainer ) {
		return null;
	}

	return ReactDOM.createPortal(
		<div
			className={ cn(
				'fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm',
				className
			) }
			aria-modal="true"
			aria-label={ message ?? 'Loading' }
		>
			<div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-600 bg-zinc-800 px-8 py-6 shadow-2xl">
				<Spinner size={ 28 } className="text-white" />
				{ message && (
					<p
						className="text-sm font-medium text-zinc-100"
						aria-live="assertive"
					>
						{ message }
					</p>
				) }
				{ progress && progress.total > 0 && (
					<p className="text-xs text-zinc-400">
						{ progress.current } / { progress.total }
					</p>
				) }
			</div>
		</div>,
		portalContainer
	);
}

export { PageOverlay };
