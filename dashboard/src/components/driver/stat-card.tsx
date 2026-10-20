import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Compact KPI used on the driver pages. */
export function DriverStat({
	icon,
	label,
	value,
	hint,
	className,
}: {
	icon: ReactNode;
	label: string;
	value: ReactNode;
	hint?: string;
	className?: string;
}) {
	return (
		<Card className={cn("flex flex-row items-center justify-between gap-3 py-3.5", className)}>
			<div className="min-w-0 pl-4">
				<div className="text-muted-foreground text-xs">{label}</div>
				<div className="font-heading font-semibold text-2xl tabular-nums">{value}</div>
				{hint ? (
					<div className="truncate text-muted-foreground text-[11px]">{hint}</div>
				) : null}
			</div>
			<div className="mr-4 rounded-md bg-muted p-2 text-muted-foreground">{icon}</div>
		</Card>
	);
}
