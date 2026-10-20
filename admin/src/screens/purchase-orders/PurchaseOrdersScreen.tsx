import * as React from 'react';
import { PurchaseOrdersListScreen } from './PurchaseOrdersListScreen';
import { PurchaseOrderDetail } from './PurchaseOrderDetail';

export function PurchaseOrdersScreen() {
	const [ selectedId, setSelectedId ] = React.useState< number | null >(
		null
	);

	if ( selectedId !== null ) {
		return (
			<PurchaseOrderDetail
				id={ selectedId }
				onBack={ () => setSelectedId( null ) }
			/>
		);
	}

	return <PurchaseOrdersListScreen onSelectPO={ setSelectedId } />;
}
