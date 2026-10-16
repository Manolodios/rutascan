import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function PageHeader({
	title,
	description,
	children,
}: {
	title: string;
	description?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 className="font-heading font-semibold text-xl">{title}</h1>
				{description ? (
					<p className="text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			{children ? (
				<div className="flex flex-wrap items-center gap-2">{children}</div>
			) : null}
		</div>
	);
}

/** Card with an optional header row (title + actions). */
export function DataCard({
	title,
	actions,
	children,
}: {
	title?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
}) {
	return (
		<Card className="gap-0 overflow-hidden py-0">
			{title || actions ? (
				<div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
					<div className="font-heading font-medium text-sm">{title}</div>
					{actions}
				</div>
			) : null}
			{children}
		</Card>
	);
}
