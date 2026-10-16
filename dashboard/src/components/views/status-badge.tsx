import { Badge } from "@/components/ui/badge";
import { DETAIL_STATUS_LABEL, ROUTE_STATUS_LABEL } from "@/lib/format";

type Variant = "default" | "secondary" | "outline" | "destructive";

const ROUTE_VARIANT: Record<string, Variant> = {
	PENDING: "outline",
	IN_PROGRESS: "default",
	COMPLETED: "secondary",
	CANCELLED: "destructive",
};

const DETAIL_VARIANT: Record<string, Variant> = {
	PENDING: "outline",
	LOADED: "secondary",
	IN_TRUCK: "default",
	DELIVERED: "secondary",
	REJECTED: "destructive",
};

export function RouteStatusBadge({ status }: { status: string | null | undefined }) {
	if (!status) return <span className="text-muted-foreground text-xs">—</span>;
	return (
		<Badge variant={ROUTE_VARIANT[status] ?? "outline"}>
			{ROUTE_STATUS_LABEL[status] ?? status}
		</Badge>
	);
}

export function DetailStatusBadge({ status }: { status: string }) {
	return (
		<Badge variant={DETAIL_VARIANT[status] ?? "outline"}>
			{DETAIL_STATUS_LABEL[status] ?? status}
		</Badge>
	);
}

export function ActiveBadge({ active }: { active: boolean }) {
	return (
		<Badge variant={active ? "secondary" : "outline"}>
			{active ? "Activo" : "Inactivo"}
		</Badge>
	);
}
