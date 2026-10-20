import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useAssignableUsers } from '@/hooks/useSuppliers';
import { SearchDropdown } from '@/components/SearchDropdown';
import {
	MAX_SUPPLIER_NAME_LENGTH,
	MAX_SUPPLIER_NOTES_LENGTH,
	MAX_DISCOUNT_PERCENT,
	MAX_TAX_RATE_PERCENT,
	MAX_SUPPLIER_CUSTOM_FIELDS,
	MAX_SUPPLIER_CUSTOM_FIELD_LENGTH,
} from '@/lib/validation';
import { getWcCountries, getWcCurrencies } from '@/lib/wc-locale-data';
import type { LocaleOption } from '@/lib/wc-locale-data';
import type {
	Supplier,
	SupplierFormInput,
	CustomField,
} from '@/types/supplier';

/**
 * Keeps a stored value selectable when it is missing from the WooCommerce
 * list (e.g. a country name saved before the list came from WooCommerce), so
 * opening and saving an existing supplier never silently changes it.
 * @param options
 * @param stored
 * @param matches
 * @param fallback
 */
function withStoredValue(
	options: LocaleOption[],
	stored: string,
	matches: ( option: LocaleOption ) => boolean,
	fallback: LocaleOption
): LocaleOption[] {
	if ( ! stored || options.some( matches ) ) {
		return options;
	}
	return [ fallback, ...options ];
}

const EMPTY_FORM: SupplierFormInput = {
	name: '',
	supplier_code: '',
	contact_name: '',
	email: '',
	phone: '',
	website: '',
	address_line_1: '',
	address_line_2: '',
	city: '',
	state: '',
	postal_code: '',
	country: '',
	currency: 'USD',
	payment_terms: '',
	status: 'active',
	notes: '',
	tax_number: '',
	fax: '',
	ordering_url: '',
	ordering_email: '',
	description: '',
	assigned_user_id: null,
	discount_percent: null,
	tax_rate_percent: null,
	days_to_cancel: null,
	cancelation_policy: '',
	custom_fields: [],
};

export function SupplierFormDialog( {
	open,
	onOpenChange,
	supplier,
	onSubmit,
	isSaving,
}: {
	open: boolean;
	onOpenChange: ( open: boolean ) => void;
	/** null when creating a new supplier. */
	supplier: Supplier | null;
	onSubmit: ( data: SupplierFormInput ) => void;
	isSaving: boolean;
} ) {
	const [ form, setForm ] = React.useState< SupplierFormInput >( EMPTY_FORM );
	const { data: assignableUsers } = useAssignableUsers();
	const wcCountries = React.useMemo( getWcCountries, [] );
	const wcCurrencies = React.useMemo( getWcCurrencies, [] );

	React.useEffect( () => {
		if ( ! open ) {
			return;
		}
		if ( supplier ) {
			setForm( {
				name: supplier.name,
				supplier_code: supplier.supplier_code ?? '',
				contact_name: supplier.contact_name ?? '',
				email: supplier.email ?? '',
				phone: supplier.phone ?? '',
				website: supplier.website ?? '',
				address_line_1: supplier.address_line_1 ?? '',
				address_line_2: supplier.address_line_2 ?? '',
				city: supplier.city ?? '',
				state: supplier.state ?? '',
				postal_code: supplier.postal_code ?? '',
				country: supplier.country ?? '',
				currency: supplier.currency || 'USD',
				payment_terms: supplier.payment_terms ?? '',
				status: supplier.status,
				notes: supplier.notes ?? '',
				tax_number: supplier.tax_number ?? EMPTY_FORM.tax_number,
				fax: supplier.fax ?? EMPTY_FORM.fax,
				ordering_url: supplier.ordering_url ?? EMPTY_FORM.ordering_url,
				ordering_email:
					supplier.ordering_email ?? EMPTY_FORM.ordering_email,
				description: supplier.description ?? EMPTY_FORM.description,
				assigned_user_id:
					supplier.assigned_user_id ?? EMPTY_FORM.assigned_user_id,
				discount_percent:
					supplier.discount_percent ?? EMPTY_FORM.discount_percent,
				tax_rate_percent:
					supplier.tax_rate_percent ?? EMPTY_FORM.tax_rate_percent,
				days_to_cancel:
					supplier.days_to_cancel ?? EMPTY_FORM.days_to_cancel,
				cancelation_policy:
					supplier.cancelation_policy ??
					EMPTY_FORM.cancelation_policy,
				custom_fields:
					supplier.custom_fields ?? EMPTY_FORM.custom_fields,
			} );
		} else {
			setForm( EMPTY_FORM );
		}
	}, [ open, supplier ] );

	const set =
		< K extends keyof SupplierFormInput >( key: K ) =>
		( value: SupplierFormInput[ K ] ) =>
			setForm( ( prev ) => ( { ...prev, [ key ]: value } ) );

	const storedCountry = form.country ?? '';
	const storedCurrency = form.currency ?? '';
	const countryOptions = withStoredValue(
		wcCountries,
		storedCountry,
		( c ) => c.name === storedCountry,
		{ code: '', name: storedCountry }
	);
	const currencyOptions = withStoredValue(
		wcCurrencies,
		storedCurrency,
		( c ) => c.code === storedCurrency,
		{ code: storedCurrency, name: storedCurrency }
	);

	const nameValid =
		form.name.trim().length > 0 &&
		form.name.length <= MAX_SUPPLIER_NAME_LENGTH;

	return (
		<Dialog open={ open } onOpenChange={ onOpenChange }>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>
						{ supplier ? 'Edit supplier' : 'Add supplier' }
					</DialogTitle>
					<DialogDescription>
						{ supplier
							? `Update details for ${ supplier.name }.`
							: 'Enter the details for the new supplier.' }
					</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
					<div className="col-span-2">
						<Input
							label="Name"
							id="supplier-name"
							value={ form.name }
							maxLength={ MAX_SUPPLIER_NAME_LENGTH }
							onChange={ ( e ) =>
								set( 'name' )( e.target.value )
							}
							error={
								! nameValid && form.name.length > 0
									? `Name must be 1-${ MAX_SUPPLIER_NAME_LENGTH } characters`
									: undefined
							}
						/>
					</div>
					<Input
						label="Supplier code"
						id="supplier-code"
						value={ form.supplier_code }
						maxLength={ 50 }
						onChange={ ( e ) =>
							set( 'supplier_code' )( e.target.value )
						}
					/>
					<Input
						label="Contact name"
						id="supplier-contact-name"
						value={ form.contact_name }
						onChange={ ( e ) =>
							set( 'contact_name' )( e.target.value )
						}
					/>
					<Input
						label="Email"
						id="supplier-email"
						type="email"
						value={ form.email }
						onChange={ ( e ) => set( 'email' )( e.target.value ) }
					/>
					<Input
						label="Phone"
						id="supplier-phone"
						value={ form.phone }
						onChange={ ( e ) => set( 'phone' )( e.target.value ) }
					/>
					<Input
						label="Website"
						id="supplier-website"
						type="url"
						placeholder="https://…"
						value={ form.website }
						maxLength={ 255 }
						onChange={ ( e ) => set( 'website' )( e.target.value ) }
					/>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="supplier-status"
							className="text-sm font-medium leading-none text-foreground"
						>
							Status
						</label>
						<Select
							value={ form.status }
							onValueChange={ ( v ) =>
								set( 'status' )( v as 'active' | 'inactive' )
							}
						>
							<SelectTrigger id="supplier-status">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">
									Inactive
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="col-span-2">
						<Input
							label="Address line 1"
							id="supplier-address-1"
							value={ form.address_line_1 }
							onChange={ ( e ) =>
								set( 'address_line_1' )( e.target.value )
							}
						/>
					</div>
					<div className="col-span-2">
						<Input
							label="Address line 2"
							id="supplier-address-2"
							value={ form.address_line_2 }
							onChange={ ( e ) =>
								set( 'address_line_2' )( e.target.value )
							}
						/>
					</div>
					<Input
						label="City"
						id="supplier-city"
						value={ form.city }
						onChange={ ( e ) => set( 'city' )( e.target.value ) }
					/>
					<Input
						label="State"
						id="supplier-state"
						value={ form.state }
						onChange={ ( e ) => set( 'state' )( e.target.value ) }
					/>
					<Input
						label="Postal code"
						id="supplier-postal-code"
						value={ form.postal_code }
						onChange={ ( e ) =>
							set( 'postal_code' )( e.target.value )
						}
					/>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="supplier-country"
							className="text-sm font-medium leading-none text-foreground"
						>
							Country
						</label>
						{ /* Stored by name, as before the list came from WooCommerce. */ }
						<SearchDropdown< LocaleOption, string >
							id="supplier-country"
							items={ countryOptions }
							getId={ ( c ) => c.name }
							getLabel={ ( c ) => c.name }
							value={ form.country || null }
							onChange={ ( name ) => set( 'country' )( name ) }
							clearOption={ {
								label: 'Unspecified',
								onClear: () => set( 'country' )( '' ),
							} }
							placeholder="Choose a country…"
							emptyMessage="No countries found."
							searchPlaceholder="Search countries…"
							triggerClassName="w-full justify-between"
							panelClassName="w-64"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="supplier-currency"
							className="text-sm font-medium leading-none text-foreground"
						>
							Currency
						</label>
						<SearchDropdown< LocaleOption, string >
							id="supplier-currency"
							items={ currencyOptions }
							getId={ ( c ) => c.code }
							getLabel={ ( c ) =>
								c.name === c.code
									? c.code
									: `${ c.code } — ${ c.name }`
							}
							value={ form.currency || null }
							onChange={ ( code ) => set( 'currency' )( code ) }
							placeholder="Choose a currency…"
							emptyMessage="No currencies found."
							searchPlaceholder="Search currencies…"
							triggerClassName="w-full justify-between"
							panelClassName="w-72"
						/>
					</div>
					<Input
						label="Payment terms"
						id="supplier-payment-terms"
						placeholder="e.g. Net 30"
						value={ form.payment_terms }
						maxLength={ 100 }
						onChange={ ( e ) =>
							set( 'payment_terms' )( e.target.value )
						}
					/>
					<Input
						label="Tax number"
						id="supplier-tax-number"
						value={ form.tax_number }
						maxLength={ 50 }
						onChange={ ( e ) =>
							set( 'tax_number' )( e.target.value )
						}
					/>
					<Input
						label="Fax"
						id="supplier-fax"
						value={ form.fax }
						maxLength={ 50 }
						onChange={ ( e ) => set( 'fax' )( e.target.value ) }
					/>
					<Input
						label="Ordering URL"
						id="supplier-ordering-url"
						type="url"
						placeholder="https://…"
						value={ form.ordering_url }
						maxLength={ 255 }
						onChange={ ( e ) =>
							set( 'ordering_url' )( e.target.value )
						}
					/>
					<Input
						label="Ordering email"
						id="supplier-ordering-email"
						type="email"
						value={ form.ordering_email }
						onChange={ ( e ) =>
							set( 'ordering_email' )( e.target.value )
						}
					/>
					<Input
						label="Discount %"
						id="supplier-discount-percent"
						type="number"
						min={ 0 }
						max={ MAX_DISCOUNT_PERCENT }
						step="0.01"
						value={ form.discount_percent ?? '' }
						onChange={ ( e ) =>
							set( 'discount_percent' )(
								e.target.value === ''
									? null
									: Number( e.target.value )
							)
						}
					/>
					<Input
						label="Tax rate %"
						id="supplier-tax-rate-percent"
						type="number"
						min={ 0 }
						max={ MAX_TAX_RATE_PERCENT }
						step="0.01"
						value={ form.tax_rate_percent ?? '' }
						onChange={ ( e ) =>
							set( 'tax_rate_percent' )(
								e.target.value === ''
									? null
									: Number( e.target.value )
							)
						}
					/>
					<Input
						label="Days to cancel"
						id="supplier-days-to-cancel"
						type="number"
						min={ 0 }
						value={ form.days_to_cancel ?? '' }
						onChange={ ( e ) =>
							set( 'days_to_cancel' )(
								e.target.value === ''
									? null
									: Number( e.target.value )
							)
						}
					/>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="supplier-assigned-user"
							className="text-sm font-medium leading-none text-foreground"
						>
							Assigned to
						</label>
						<SearchDropdown
							id="supplier-assigned-user"
							items={ assignableUsers ?? [] }
							getId={ ( u ) => u.id }
							getLabel={ ( u ) => u.name }
							value={ form.assigned_user_id ?? null }
							onChange={ ( id ) =>
								set( 'assigned_user_id' )( id )
							}
							clearOption={ {
								label: 'Unassigned',
								onClear: () =>
									set( 'assigned_user_id' )( null ),
							} }
							placeholder="Unassigned"
							emptyMessage="No eligible users found."
							searchPlaceholder="Search users…"
							triggerClassName="w-full justify-between"
						/>
					</div>
					<div className="col-span-2 flex flex-col gap-1">
						<label
							htmlFor="supplier-description"
							className="text-sm font-medium leading-none text-foreground"
						>
							Description
						</label>
						<textarea
							id="supplier-description"
							value={ form.description }
							onChange={ ( e ) =>
								set( 'description' )( e.target.value )
							}
							rows={ 2 }
							className="flex w-full rounded-md border border-solid border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						/>
					</div>
					<div className="col-span-2 flex flex-col gap-1">
						<label
							htmlFor="supplier-cancelation-policy"
							className="text-sm font-medium leading-none text-foreground"
						>
							Cancelation policy
						</label>
						<textarea
							id="supplier-cancelation-policy"
							value={ form.cancelation_policy }
							onChange={ ( e ) =>
								set( 'cancelation_policy' )( e.target.value )
							}
							rows={ 2 }
							className="flex w-full rounded-md border border-solid border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						/>
					</div>
					<div className="col-span-2 flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-foreground">
								Custom fields
							</span>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={
									( form.custom_fields ?? [] ).length >=
									MAX_SUPPLIER_CUSTOM_FIELDS
								}
								onClick={ () =>
									set( 'custom_fields' )( [
										...( form.custom_fields ?? [] ),
										{ label: '', value: '' },
									] )
								}
							>
								Add custom field
							</Button>
						</div>
						{ ( form.custom_fields ?? [] ).map(
							( field: CustomField, i: number ) => (
								<div key={ i } className="flex gap-2 items-end">
									<Input
										label={ `Name` }
										id={ `supplier-custom-field-${ i }-label` }
										value={ field.label }
										maxLength={
											MAX_SUPPLIER_CUSTOM_FIELD_LENGTH
										}
										onChange={ ( e ) => {
											const next = [
												...( form.custom_fields ?? [] ),
											];
											next[ i ] = {
												...next[ i ],
												label: e.target.value,
											};
											set( 'custom_fields' )( next );
										} }
									/>
									<Input
										label={ `Value` }
										id={ `supplier-custom-field-${ i }-value` }
										value={ field.value }
										maxLength={
											MAX_SUPPLIER_CUSTOM_FIELD_LENGTH
										}
										onChange={ ( e ) => {
											const next = [
												...( form.custom_fields ?? [] ),
											];
											next[ i ] = {
												...next[ i ],
												value: e.target.value,
											};
											set( 'custom_fields' )( next );
										} }
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label={ `Remove custom field ${
											i + 1
										}` }
										onClick={ () =>
											set( 'custom_fields' )(
												(
													form.custom_fields ?? []
												).filter(
													(
														_: CustomField,
														fi: number
													) => fi !== i
												)
											)
										}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							)
						) }
					</div>
					<div className="col-span-2 flex flex-col gap-1">
						<label
							htmlFor="supplier-notes"
							className="text-sm font-medium leading-none text-foreground"
						>
							Notes
						</label>
						<textarea
							id="supplier-notes"
							value={ form.notes }
							maxLength={ MAX_SUPPLIER_NOTES_LENGTH }
							onChange={ ( e ) =>
								set( 'notes' )( e.target.value )
							}
							rows={ 3 }
							className="flex w-full rounded-md border border-solid border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={ () => onOpenChange( false ) }
						disabled={ isSaving }
					>
						Cancel
					</Button>
					<Button
						onClick={ () => onSubmit( form ) }
						disabled={ ! nameValid || isSaving }
					>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
