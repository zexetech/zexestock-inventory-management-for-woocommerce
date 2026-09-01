import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VIEW_PRESETS, type ViewPreset } from '@/types/filters';

interface ViewsDropdownProps {
	activePreset: string;
	onSelectPreset: ( preset: ViewPreset ) => void;
}

export function ViewsDropdown( {
	activePreset,
	onSelectPreset,
}: ViewsDropdownProps ) {
	const activeLabel =
		VIEW_PRESETS.find( ( p ) => p.id === activePreset )?.label ?? 'Views';

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="gap-1.5 font-medium"
				>
					{ activeLabel }
					<ChevronDownIcon className="h-3 w-3 opacity-60" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="start" className="w-52">
				<DropdownMenuLabel>Built-in Views</DropdownMenuLabel>

				{ VIEW_PRESETS.map( ( preset ) => (
					<DropdownMenuItem
						key={ preset.id }
						onSelect={ () => onSelectPreset( preset ) }
						className={
							activePreset === preset.id
								? 'bg-accent font-medium'
								: ''
						}
					>
						{ preset.label }
					</DropdownMenuItem>
				) ) }
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
