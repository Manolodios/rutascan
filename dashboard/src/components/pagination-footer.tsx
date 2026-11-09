import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatInteger } from "@/lib/format";

/**
 * Footer for offset-paginated tables. The API returns no total, so a full
 * page is the only signal that another page may exist.
 */
export function PaginationFooter({
	page,
	pageSize,
	count,
	noun,
	onPrevious,
	onNext,
}: {
	page: number;
	pageSize: number;
	count: number;
	noun: string;
	onPrevious: () => void;
	onNext: () => void;
}) {
	const hasNext = count >= pageSize;

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5">
			<p className="text-muted-foreground text-xs">
				Página{" "}
				<span className="font-medium text-foreground">{formatInteger(page + 1)}</span> ·{" "}
				{formatInteger(count)} {noun}
			</p>
			<div className="flex items-center gap-2">
				<Button
					disabled={page === 0}
					onClick={onPrevious}
					size="sm"
					variant="outline"
				>
					<ChevronLeftIcon /> Anterior
				</Button>
				<Button
					disabled={!hasNext}
					onClick={onNext}
					size="sm"
					variant="outline"
				>
					Siguiente <ChevronRightIcon />
				</Button>
			</div>
		</div>
	);
}
