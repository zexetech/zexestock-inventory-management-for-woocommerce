import * as React from 'react';
import { Settings2, Wrench } from 'lucide-react';
import { MAX_THRESHOLD, MAX_LARGE_ADJ_WARNING } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';
import { apiGet, apiPost } from '@/lib/api';

type Section = 'general' | 'advanced';

export interface PluginSettings {
	allow_negative_stock: boolean;
	low_stock_threshold: number;
	large_adjustment_warning: number;
	delete_data_on_uninstall: boolean;
}

const NAV_ITEMS: {
	id: Section;
	label: string;
	Icon: React.FC< { className?: string } >;
}[] = [
	{ id: 'general', label: 'General', Icon: Settings2 },
	{ id: 'advanced', label: 'Advanced', Icon: Wrench },
];

function SettingRow( {
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: React.ReactNode;
} ) {
	return (
		<div className="flex items-center justify-between gap-6 py-3 border-b border-border last:border-b-0">
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-foreground leading-snug">
					{ label }
				</p>
				{ description && (
					<p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
						{ description }
					</p>
				) }
			</div>
			<div className="flex-shrink-0 flex items-center">{ children }</div>
		</div>
	);
}

function SectionCard( {
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
} ) {
	return (
		<div className="rounded-xl border border-border bg-card shadow-md overflow-hidden">
			<div className="px-5 pt-4 pb-3 border-b border-border">
				<h2 className="text-sm font-semibold text-foreground">
					{ title }
				</h2>
				<p className="text-xs text-muted-foreground mt-0.5">
					{ description }
				</p>
			</div>
			<div className="px-5 pb-1">{ children }</div>
		</div>
	);
}

function GeneralSection( { s, set }: { s: PluginSettings; set: Setter } ) {
	return (
		<SectionCard
			title="General"
			description="Core stock behaviour and adjustment settings."
		>
			<SettingRow
				label="Allow Negative Stock"
				description="Let stock levels fall below zero when an adjustment would otherwise be blocked."
			>
				<Switch
					checked={ s.allow_negative_stock }
					onCheckedChange={ ( v ) =>
						set( 'allow_negative_stock', v )
					}
				/>
			</SettingRow>

			<SettingRow
				label="Low Stock Threshold"
				description="Products at or below this quantity are flagged as low stock across the dashboard and table. Can be overridden per product in the Stock Table."
			>
				<Input
					type="number"
					min={ 0 }
					max={ MAX_THRESHOLD }
					value={ s.low_stock_threshold }
					onChange={ ( e ) =>
						set(
							'low_stock_threshold',
							Math.min(
								MAX_THRESHOLD,
								Math.max(
									0,
									parseInt( e.target.value, 10 ) || 0
								)
							)
						)
					}
					className="h-8 w-20"
				/>
			</SettingRow>

			<SettingRow
				label="Large Adjustment Warning"
				description="Show a confirmation prompt when a single adjustment exceeds this amount."
			>
				<Input
					type="number"
					min={ 1 }
					max={ MAX_LARGE_ADJ_WARNING }
					value={ s.large_adjustment_warning }
					onChange={ ( e ) =>
						set(
							'large_adjustment_warning',
							Math.min(
								MAX_LARGE_ADJ_WARNING,
								Math.max(
									1,
									parseInt( e.target.value, 10 ) || 100
								)
							)
						)
					}
					className="h-8 w-20"
				/>
			</SettingRow>
		</SectionCard>
	);
}

function AdvancedSection( { s, set }: { s: PluginSettings; set: Setter } ) {
	return (
		<SectionCard
			title="Danger Zone"
			description="Irreversible actions — proceed with caution."
		>
			<SettingRow
				label="Delete All Data on Uninstall"
				description="Remove all plugin tables and options when the plugin is deleted. This cannot be undone."
			>
				<Switch
					checked={ s.delete_data_on_uninstall }
					onCheckedChange={ ( v ) =>
						set( 'delete_data_on_uninstall', v )
					}
				/>
			</SettingRow>
		</SectionCard>
	);
}

type Setter = < K extends keyof PluginSettings >(
	key: K,
	value: PluginSettings[ K ]
) => void;

export function SettingsScreen() {
	const [ activeSection, setActiveSection ] =
		React.useState< Section >( 'general' );
	const [ settings, setSettings ] = React.useState< PluginSettings | null >(
		null
	);
	const [ loading, setLoading ] = React.useState( true );
	const [ saving, setSaving ] = React.useState( false );

	React.useEffect( () => {
		apiGet< PluginSettings >( 'settings' )
			.then( ( data ) => {
				setSettings( data );
				setLoading( false );
			} )
			.catch( () => {
				toast.error( 'Failed to load settings.' );
				setLoading( false );
			} );
	}, [] );

	const set: Setter = React.useCallback( ( key, value ) => {
		setSettings( ( prev ) =>
			prev ? { ...prev, [ key ]: value } : prev
		);
	}, [] );

	async function handleSave() {
		if ( ! settings ) {
			return;
		}
		setSaving( true );
		try {
			await apiPost< PluginSettings >( 'settings', settings );
			toast.success( 'Settings saved.' );
		} catch {
			toast.error( 'Failed to save settings.' );
		} finally {
			setSaving( false );
		}
	}

	return (
		<div className="min-h-screen flex flex-col">
			<div className="flex-1 p-4 md:p-6 w-full max-w-[1100px]">
				<div className="mb-6">
					<h1 className="text-xl font-bold leading-tight">
						Settings
					</h1>
				</div>

				{ loading ? (
					<div className="flex items-center justify-center py-24">
						<Spinner className="h-6 w-6 text-muted-foreground" />
					</div>
				) : (
					<div className="flex gap-6 items-start">
						<nav
							className="hidden md:flex flex-col w-48 flex-shrink-0 rounded-xl border border-border bg-card shadow-md overflow-hidden sticky top-4"
							aria-label="Settings navigation"
						>
							{ NAV_ITEMS.map( ( { id, label, Icon } ) => (
								<button
									key={ id }
									onClick={ () => setActiveSection( id ) }
									className={
										'flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left ' +
										( activeSection === id
											? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
											: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground border-l-2 border-transparent' )
									}
								>
									<Icon className="h-4 w-4 flex-shrink-0" />
									{ label }
								</button>
							) ) }
						</nav>

						<div className="md:hidden flex gap-1 flex-wrap mb-4 w-full">
							{ NAV_ITEMS.map( ( { id, label } ) => (
								<button
									key={ id }
									onClick={ () => setActiveSection( id ) }
									className={
										'px-3 py-1.5 rounded-full text-xs font-medium transition-colors ' +
										( activeSection === id
											? 'bg-primary text-primary-foreground'
											: 'bg-muted text-muted-foreground hover:bg-muted/80' )
									}
								>
									{ label }
								</button>
							) ) }
						</div>

						<div className="flex-1 min-w-0">
							{ settings && activeSection === 'general' && (
								<GeneralSection s={ settings } set={ set } />
							) }
							{ settings && activeSection === 'advanced' && (
								<AdvancedSection s={ settings } set={ set } />
							) }

							<div className="flex justify-end mt-4">
								<Button
									size="sm"
									onClick={ handleSave }
									disabled={ saving || loading }
								>
									{ saving ? 'Saving…' : 'Save Changes' }
								</Button>
							</div>
						</div>
					</div>
				) }
			</div>
		</div>
	);
}
