import { KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { DataCard, PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/views/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api, type LicenseInfo } from "@/lib/api";
import { formatDate, formatDateTime, formatInteger } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async";

const STATUS_LABEL: Record<string, string> = {
	ACTIVE: "Activa",
	TRIAL: "Prueba",
	EXPIRED: "Vencida",
	SUSPENDED: "Suspendida",
};

type Variant = "default" | "secondary" | "outline" | "destructive";

const STATUS_VARIANT: Record<string, Variant> = {
	ACTIVE: "default",
	TRIAL: "secondary",
	EXPIRED: "destructive",
	SUSPENDED: "destructive",
};

export function LicenseView() {
	const state = useAsyncData<LicenseInfo>(
		() => api<LicenseInfo>("/api/v1/admin/license"),
		[],
	);

	const license = state.data;

	if (state.loading && !license) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-48 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	if (state.error || !license) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm">
				{state.error ?? "No se pudo leer la licencia."}
			</div>
		);
	}

	const usedPct = Math.min(
		100,
		Math.round((license.active_devices / Math.max(1, license.max_trucks)) * 100),
	);
	const statusOk = license.subscription_status === "ACTIVE" && !license.expired;

	return (
		<div className="max-w-5xl space-y-4">
			<PageHeader
				description="Estado de la suscripción y control de dispositivos autorizados."
				title="Licencia"
			>
				<Button onClick={state.reload} variant="outline">
					Actualizar
				</Button>
			</PageHeader>

			{!statusOk ? (
				<div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-destructive text-sm">
					<strong>Suscripción no operativa.</strong>{" "}
					{license.expired
						? "La licencia está vencida: la app móvil rechazará toda operación (HTTP 402)."
						: "La suscripción está suspendida."}{" "}
					Contacte a su proveedor para renovar.
				</div>
			) : license.expiring_soon ? (
				<div className="rounded-xl border border-amber-300/60 bg-amber-50 px-5 py-4 text-amber-900 text-sm dark:bg-amber-950/30 dark:text-amber-200">
					<strong>Su licencia vence en {license.days_remaining} día(s).</strong>{" "}
					Renueve para evitar interrupciones del servicio.
				</div>
			) : null}

			<div className="grid gap-4 lg:grid-cols-3">
				<DataCard
					actions={
						<Badge
							variant={
								STATUS_VARIANT[license.subscription_status] ?? "outline"
							}
						>
							{STATUS_LABEL[license.subscription_status] ??
								license.subscription_status}
						</Badge>
					}
					title="Empresa"
				>
					<div className="grid gap-4 p-4 sm:grid-cols-2">
						<div className="sm:col-span-2">
							<div className="font-semibold text-lg">{license.company_name}</div>
							<div className="text-muted-foreground text-xs">
								RIF: {license.tax_id}
							</div>
						</div>
						<div>
							<div className="font-semibold text-muted-foreground text-xs uppercase">
								Clave de licencia
							</div>
							<div className="flex items-center gap-2 font-mono font-semibold text-sm">
								<KeyRoundIcon className="size-4 text-muted-foreground" />
								{license.license_key}
							</div>
						</div>
						<div>
							<div className="font-semibold text-muted-foreground text-xs uppercase">
								Vence
							</div>
							<div className="font-semibold">
								{formatDate(license.expiration_date)}
							</div>
							<div
								className={`text-xs ${
									license.expired ? "text-destructive" : "text-muted-foreground"
								}`}
							>
								{license.days_remaining} días restantes
							</div>
						</div>
					</div>
				</DataCard>

				<div className="lg:col-span-2">
					<DataCard title="Dispositivos activos">
						<div className="space-y-2 p-4">
							<div
								className={`font-semibold text-2xl ${
									usedPct >= 100 ? "text-destructive" : ""
								}`}
							>
								{license.active_devices}/{license.max_trucks}
							</div>
							<Progress
								className="h-2"
								value={usedPct}
							/>
							<p className="text-muted-foreground text-xs">
								Un dispositivo que no se conecta en {license.device_ttl_days}{" "}
								días libera su ranura automáticamente. Los camiones de la flota
								también limitan cuántos equipos pueden operar a la vez.
							</p>
						</div>
					</DataCard>
				</div>
			</div>

			<DataCard
				actions={
					<span className="text-muted-foreground text-xs">
						{formatInteger(license.devices.length)} en total (incluye inactivos)
					</span>
				}
				title="Dispositivos registrados"
			>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="ps-4">UUID</TableHead>
							<TableHead>Usuario</TableHead>
							<TableHead>Plataforma</TableHead>
							<TableHead>Versión</TableHead>
							<TableHead>Último latido</TableHead>
							<TableHead>Estado</TableHead>
							<TableHead className="pe-4 text-right">Acciones</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{license.devices.length === 0 ? (
							<TableRow>
								<TableCell
									className="py-10 text-center text-muted-foreground"
									colSpan={7}
								>
									Sin dispositivos registrados.
								</TableCell>
							</TableRow>
						) : (
							license.devices.map((device) => (
								<TableRow
									className={device.is_active ? undefined : "opacity-60"}
									key={device.id}
								>
									<TableCell className="ps-4 font-mono text-xs">
										{device.device_uuid.slice(0, 18)}…
									</TableCell>
									<TableCell>
										{device.user?.full_name ?? (
											<span className="text-muted-foreground">—</span>
										)}
									</TableCell>
									<TableCell>{device.platform ?? "—"}</TableCell>
									<TableCell>{device.app_version ?? "—"}</TableCell>
									<TableCell className="text-muted-foreground text-xs">
										{formatDateTime(device.last_seen_at)}
									</TableCell>
									<TableCell>
										<Badge variant={device.is_active ? "secondary" : "destructive"}>
											{device.is_active ? "Activo" : "Bloqueado"}
										</Badge>
									</TableCell>
									<TableCell className="pe-4 text-right">
										<div className="flex justify-end gap-1">
											<ConfirmDialog
												confirmText="Liberar"
												description="El dispositivo quedará desregistrado y podrá volver a activarse, o activar otro equipo. ¿Continuar?"
												onConfirm={async () => {
													await api(
														`/api/v1/admin/license/devices/${device.id}`,
														{ method: "DELETE" },
													);
													toast.success("Ranura liberada");
													state.reload();
												}}
												title="Liberar ranura"
												trigger={
													<Button size="sm" variant="ghost">
														Liberar
													</Button>
												}
											/>
											{device.is_active ? (
												<ConfirmDialog
													confirmText="Bloquear"
													danger
													description="El UUID quedará en lista negra permanente (equipo perdido o robado). No podrá volver a registrarse."
													onConfirm={async () => {
														await api(
															`/api/v1/admin/license/devices/${device.id}/block`,
															{ method: "POST" },
														);
														toast.success("Dispositivo bloqueado");
														state.reload();
													}}
													title="Bloquear dispositivo"
													trigger={
														<Button
															className="text-destructive"
															size="sm"
															variant="ghost"
														>
															Bloquear
														</Button>
													}
												/>
											) : null}
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</DataCard>
		</div>
	);
}
