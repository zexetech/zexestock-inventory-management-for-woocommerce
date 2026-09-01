import * as React from 'react';
import { Tag, Wallet, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { CategoryDropdown } from '@/components/CategoryDropdown';
import { useCurrentStockValue } from '../hooks/useDashboard';
import { formatCurrency, formatNumber } from '@/lib/utils';

function ValueCard( {
	label,
	value,
	icon,
	isLoading,
}: {
	label: string;
	value: string;
	icon: React.ReactNode;
	isLoading: boolean;
} ) {
	return (
		<Card className="border-border shadow-sm border-l-4 border-l-primary">
			<CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					{ label }
				</CardTitle>
				{ icon }
			</CardHeader>
			<CardContent>
				{ isLoading ? (
					<Skeleton className="h-9 w-32" />
				) : (
					<div className="text-3xl font-bold tabular-nums">
						{ value }
					</div>
				) }
			</CardContent>
		</Card>
	);
}

export function CurrentStockValue() {
	const categories = window.zexstData?.categories ?? [];
	const [ categoryId, setCategoryId ] = React.useState( 0 );
	const [ productType, setProductType ] = React.useState( '' );

	const { data, isLoading } = useCurrentStockValue( categoryId, productType );

	return (
		<Card className="border-border shadow-md">
			<CardHeader>
				<CardTitle className="text-sm font-semibold">
					Current Stock Value
				</CardTitle>
				<div className="flex flex-wrap items-center gap-2 mt-2">
					<CategoryDropdown
						categories={ categories }
						value={ categoryId }
						onChange={ setCategoryId }
						triggerClassName="h-8 text-xs"
					/>
					<Select
						value={ productType || '__all__' }
						onValueChange={ ( v ) =>
							setProductType( v === '__all__' ? '' : v )
						}
					>
						<SelectTrigger className="h-8 w-40 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__all__">
								All Product Types
							</SelectItem>
							<SelectItem value="simple">Simple</SelectItem>
							<SelectItem value="variable">Variable</SelectItem>
							<SelectItem value="external">External</SelectItem>
							<SelectItem value="virtual">Virtual</SelectItem>
							<SelectItem value="downloadable">
								Downloadable
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<ValueCard
					label="Retail Stock Value"
					value={ formatCurrency(
						data?.retail_value ?? 0,
						data?.currency ?? ''
					) }
					icon={ <Tag className="w-4 h-4 text-muted-foreground" /> }
					isLoading={ isLoading }
				/>
				<ValueCard
					label="Stock Cost Value"
					value={ formatCurrency(
						data?.cost_value ?? 0,
						data?.currency ?? ''
					) }
					icon={
						<Wallet className="w-4 h-4 text-muted-foreground" />
					}
					isLoading={ isLoading }
				/>
				<ValueCard
					label="Units in Stock"
					value={ formatNumber( data?.total_units ?? 0 ) }
					icon={
						<Package className="w-4 h-4 text-muted-foreground" />
					}
					isLoading={ isLoading }
				/>
			</CardContent>
		</Card>
	);
}
