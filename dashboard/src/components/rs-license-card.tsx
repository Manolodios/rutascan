import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { DashboardCard } from "@/components/dashboard-card";
import type { LicenseInfo } from "@/lib/api";
import { AlertTriangleIcon, CircleCheckIcon } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
	ACTIVE: "Activa",
	EXPIRED: "Vencida",
	SUSPENDED: "Suspendida",
	TRIAL: "Prueba",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
	ACTIVE: "default",
	TRIAL: "secondary",
	EXPIRED: "destructive",
	SUSPENDED: "destructive",
};

export function RsLicenseCard({ license }: { license: LicenseInfo | null }) {
	if (!license) {
		return (
			<DashboardCard className="gap-0">
				<CardHeader className="border-b">
					<CardTitle className="text-base">Estado de licencia</CardTitle>
					<CardDescription>No fue posible leer la licencia.</CardDescription>
				</CardHeader>
			</DashboardCard>
		);
	}

	const healthy = license.subscription_status === "ACTIVE" && license.days_remaining > 7;

	return (
		<DashboardCard className="gap-0">
			<CardHeader className="border-b">
				<CardTitle className="text-base">Estado de licencia</CardTitle>
				<CardDescription>
					{healthy
						? "Todo en orden. No hay nada urgente."
						: "Revise la suscripción de la empresa."}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex h-full flex-col items-center justify-center gap-4 px-0 py-6">
				<div className="flex items-center gap-2">
					<Badge variant={STATUS_VARIANT[license.subscription_status] ?? "outline"}>
						{STATUS_LABEL[license.subscription_status] ?? license.subscription_status}
					</Badge>
					<Badge variant="secondary">{license.max_trucks} camiones</Badge>
				</div>
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							{healthy ? (
								<CircleCheckIcon aria-hidden="true" />
							) : (
								<AlertTriangleIcon aria-hidden="true" />
							)}
						</EmptyMedia>
						<EmptyTitle className="font-heading">
							{healthy ? "Licencia vigente" : "Requiere atención"}
						</EmptyTitle>
						<EmptyDescription className="text-xs">
							{license.days_remaining} días restantes · vence el{" "}
							{license.expiration_date}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</CardContent>
		</DashboardCard>
	);
}
