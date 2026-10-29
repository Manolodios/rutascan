import { useMemo, useState, type FormEvent } from "react";
import {
	BuildingIcon,
	CalendarClockIcon,
	CircleCheckIcon,
	CircleSlashIcon,
	DownloadIcon,
	EyeIcon,
	LockIcon,
	LogInIcon,
	PencilIcon,
	PlusIcon,
	SmartphoneIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { DataCard } from "@/components/page-header";
import {
	LicenseDialog,
	NewCompanyDialog,
} from "@/components/platform/company-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDate, formatInteger } from "@/lib/format";
import { errorMessage } from "@/lib/mutate";
import {
	addMonths,
	clearPlatformKey,
	companyHealth,
	daysUntil,
	EXPIRING_DAYS,
	getPlatformKey,
	HEALTH_LABEL,
	platformApi,
	PlatformError,
	setPlatformKey,
	type CompanyHealth,
	type CompanyOut,
} from "@/lib/platform";
import { useAsyncData } from "@/lib/use-async";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { TruckIcon } from "lucide-react";

/* ------------------------------- gate ----------------------------------- */

function PlatformGate({ onUnlock }: { onUnlock: (key: string) => void }) {
	const [value, setValue] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const candidate = value.trim();
		if (!candidate || busy) return;

		setBusy(true);
		setError(null);
		setPlatformKey(candidate);
		try {
			await platformApi<CompanyOut[]>("/api/v1/platform/companies");
			onUnlock(candidate);
		} catch (err) {
			clearPlatformKey();
			setError(
				err instanceof PlatformError && err.status === 403
					? "Clave de plataforma inválida. Revísela e intente de nuevo."
					: errorMessage(err),
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
			<div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
				<div className="space-y-2 text-center">
					<div className="flex justify-center">
						<Logo className="text-2xl text-foreground" />
					</div>
					<div className="flex items-center justify-center gap-1.5 text-muted-foreground text-sm">
						<LockIcon className="size-3.5" />
						Panel de plataforma
					</div>
					<p className="text-muted-foreground text-xs">
						Solo para el operador de RutaScan: vea todas las cuentas, su estado y
						los días de licencia que les quedan.
					</p>
				</div>

				<form className="space-y-4" onSubmit={submit}>
					<div className="space-y-2">
						<label className="font-medium text-sm" htmlFor="platform-key">
							Clave de plataforma
						</label>
						<Input
							autoFocus
							id="platform-key"
							onChange={(event) => setValue(event.target.value)}
							placeholder="platform-…"
							type="password"
							value={value}
						/>
						<p className="text-muted-foreground text-xs">
							La clave vive en la configuración del servidor
							(<code className="font-mono">PLATFORM_API_KEY</code>).
						</p>
					</div>

					{error ? (
						<p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
							{error}
						</p>
					) : null}

					<Button className="w-full" disabled={busy} size="lg" type="submit">
						{busy ? "Verificando…" : "Entrar al panel de plataforma"}
					</Button>
				</form>

				<a
					className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs underline-offset-4 hover:underline"
					href="#/"
				>
					<LogInIcon className="size-3.5" />
					Volver al panel de la empresa
				</a>
			</div>
		</div>
	);
}

/* ---------------------------- small pieces ------------------------------ */

const HEALTH_CLASS: Record<CompanyHealth, string> = {
	OPERATIVA:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
	POR_VENCER:
		"bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
	VENCIDA: "bg-destructive/10 text-destructive",
	SUSPENDIDA:
		"bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-300",
	INACTIVA: "bg-muted text-muted-foreground",
};

function HealthBadge({ company }: { company: CompanyOut }) {
	const health = companyHealth(company);
	return (
		<Badge className={`border-transparent ${HEALTH_CLASS[health]}`}>
			{HEALTH_LABEL[health]}
		</Badge>
	);
}

function DaysCell({ company }: { company: CompanyOut }) {
	const health = companyHealth(company);
	const days = daysUntil(company.expiration_date);

	if (health === "SUSPENDIDA" || health === "INACTIVA") {
		return <span className="text-muted-foreground">{days} días</span>;
	}
	if (days < 0) {
		return (
			<span className="font-semibold text-destructive">
				Vencida hace {formatInteger(Math.abs(days))} días
			</span>
		);
	}
	if (days === 0) {
		return <span className="font-semibold text-amber-600">Vence hoy</span>;
	}
	if (days <= EXPIRING_DAYS) {
		return (
			<span className="font-semibold text-amber-600">
				{formatInteger(days)} días
			</span>
		);
	}
	return <span>{formatInteger(days)} días</span>;
}

const TONE_CLASS: Record<"plain" | "ok" | "warn" | "bad", string> = {
	plain: "text-foreground",
	ok: "text-emerald-600 dark:text-emerald-400",
	warn: "text-amber-600 dark:text-amber-400",
	bad: "text-destructive",
};

function KpiCard({
	label,
	value,
	hint,
	tone = "plain",
	icon,
}: {
	label: string;
	value: number | string;
	hint?: string;
	tone?: "plain" | "ok" | "warn" | "bad";
	icon: React.ReactNode;
}) {
	return (
		<div className="rounded-xl border bg-card p-3.5">
			<div className="flex items-center justify-between gap-2 text-muted-foreground">
				<span className="text-xs uppercase tracking-wide">{label}</span>
				<span className="[&>svg]:size-4">{icon}</span>
			</div>
			<div className={`mt-1 font-heading font-semibold text-2xl ${TONE_CLASS[tone]}`}>
				{value}
			</div>
			{hint ? (
				<div className="text-muted-foreground text-xs">{hint}</div>
			) : null}
		</div>
	);
}

/* ------------------------------ dashboard ------------------------------- */

const HEALTH_ORDER: Record<CompanyHealth, number> = {
	VENCIDA: 0,
	POR_VENCER: 1,
	SUSPENDIDA: 2,
	INACTIVA: 3,
	OPERATIVA: 4,
};

function PlatformDashboard({ onExit }: { onExit: () => void }) {
	const state = useAsyncData<CompanyOut[]>(
		() => platformApi<CompanyOut[]>("/api/v1/platform/companies"),
		[],
	);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<"ALL" | CompanyHealth>("ALL");
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<CompanyOut | null>(null);
	const [viewing, setViewing] = useState<CompanyOut | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	function exportCsv() {
		const headers = [
			"Empresa",
			"RIF",
			"Licencia",
			"Estado",
			"Vence",
			"Días restantes",
			"Camiones",
			"Max camiones",
			"Dispositivos",
			"Usuarios",
			"Creada",
		];
		const rows = companies.map((c) => [
			c.name,
			c.tax_id,
			c.license_key,
			HEALTH_LABEL[companyHealth(c)],
			c.expiration_date,
			String(daysUntil(c.expiration_date)),
			String(c.trucks_count),
			String(c.max_trucks),
			String(c.active_devices),
			String(c.users_count),
			c.created_at,
		]);
		const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `rutascan-empresas-${new Date().toISOString().slice(0, 10)}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	const companies = state.data ?? [];

	const stats = useMemo(() => {
		let operative = 0;
		let expiring = 0;
		let expired = 0;
		let suspended = 0;
		let inactive = 0;
		let devices = 0;
		let trucks = 0;
		let users = 0;

		for (const company of companies) {
			const health = companyHealth(company);
			if (health === "OPERATIVA") operative += 1;
			else if (health === "POR_VENCER") expiring += 1;
			else if (health === "VENCIDA") expired += 1;
			else if (health === "SUSPENDIDA") suspended += 1;
			else inactive += 1;

			devices += company.active_devices;
			trucks += company.trucks_count;
			users += company.users_count;
		}

		return {
			total: companies.length,
			operative,
			expiring,
			expired,
			suspended,
			inactive,
			devices,
			trucks,
			users,
		};
	}, [companies]);

	const visible = useMemo(() => {
		const term = search.trim().toLowerCase();
		return companies
			.filter((company) => {
				if (filter !== "ALL" && companyHealth(company) !== filter) return false;
				if (!term) return true;
				return (
					company.name.toLowerCase().includes(term) ||
					company.tax_id.toLowerCase().includes(term) ||
					company.license_key.toLowerCase().includes(term)
				);
			})
			.sort(
				(a, b) =>
					HEALTH_ORDER[companyHealth(a)] - HEALTH_ORDER[companyHealth(b)] ||
					daysUntil(a.expiration_date) - daysUntil(b.expiration_date),
			);
	}, [companies, filter, search]);

	async function renew(company: CompanyOut) {
		setBusyId(company.id);
		try {
			await platformApi(`/api/v1/platform/companies/${company.id}/license`, {
				method: "PATCH",
				body: { expiration_date: addMonths(12, company.expiration_date) },
			});
			toast.success(`Licencia de ${company.name} renovada 12 meses`);
			state.reload();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setBusyId(null);
		}
	}

	const attention = stats.expired + stats.suspended + stats.inactive;

	return (
		<div className="min-h-svh bg-muted/30">
			<header className="border-b bg-card">
				<div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
					<div className="flex items-center gap-3">
						<Logo className="text-lg text-foreground" />
						<div>
							<div className="font-heading font-semibold text-sm">
								Panel de plataforma
							</div>
							<div className="text-muted-foreground text-xs">
								Operador RutaScan · todas las cuentas
							</div>
						</div>
						<Badge variant="secondary">Super admin</Badge>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Button onClick={state.reload} size="sm" variant="outline">
							Actualizar
						</Button>
						<Button onClick={exportCsv} size="sm" variant="outline">
							<DownloadIcon />
							Exportar CSV
						</Button>
						<Button onClick={() => setCreating(true)} size="sm">
							<PlusIcon />
							Nueva empresa
						</Button>
						<Button onClick={onExit} size="sm" variant="ghost">
							Salir
						</Button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl space-y-4 p-4">
				{state.loading && !state.data ? (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
						{Array.from({ length: 6 }, (_, index) => (
							<Skeleton className="h-24 rounded-xl" key={index} />
						))}
					</div>
				) : state.error ? (
					<div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm">
						{state.error}{" "}
						<button
							className="underline underline-offset-4"
							onClick={onExit}
							type="button"
						>
							Cambiar la clave de plataforma
						</button>
					</div>
				) : (
					<>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
							<KpiCard
								hint={`${formatInteger(stats.users)} usuarios en total`}
								icon={<BuildingIcon />}
								label="Empresas"
								value={formatInteger(stats.total)}
							/>
							<KpiCard
								hint="vigentes y al día"
								icon={<CircleCheckIcon />}
								label="Operativas"
								tone="ok"
								value={formatInteger(stats.operative)}
							/>
							<KpiCard
								hint={`vence en ${EXPIRING_DAYS} días o menos`}
								icon={<CalendarClockIcon />}
								label="Por vencer"
								tone="warn"
								value={formatInteger(stats.expiring)}
							/>
							<KpiCard
								hint="licencia caducada"
								icon={<TriangleAlertIcon />}
								label="Vencidas"
								tone="bad"
								value={formatInteger(stats.expired)}
							/>
							<KpiCard
								hint={`${formatInteger(stats.suspended)} suspendidas · ${formatInteger(
									stats.inactive,
								)} deshabilitadas`}
								icon={<CircleSlashIcon />}
								label="No operativas"
								tone={attention > 0 ? "bad" : "plain"}
								value={formatInteger(stats.suspended + stats.inactive)}
							/>
							<KpiCard
								hint={`${formatInteger(stats.trucks)} camiones registrados`}
								icon={<SmartphoneIcon />}
								label="Dispositivos activos"
								value={formatInteger(stats.devices)}
							/>
						</div>

						{stats.expiring > 0 ? (
							<div className="rounded-xl border border-amber-300/60 bg-amber-50 px-5 py-3 text-amber-900 text-sm dark:bg-amber-950/30 dark:text-amber-200">
								<strong>
									{formatInteger(stats.expiring)}{" "}
									{stats.expiring === 1 ? "cuenta vence" : "cuentas vencen"} en los
									próximos {EXPIRING_DAYS} días.
								</strong>{" "}
								Conviene contactarlas para renovar.
							</div>
						) : null}

						<DataCard
							actions={
								<div className="flex flex-wrap items-center gap-2">
									<div className="relative">
										<Input
											className="h-8 w-56 ps-8"
											onChange={(event) => setSearch(event.target.value)}
											placeholder="Buscar empresa, RIF o licencia"
											value={search}
										/>
										<BuildingIcon className="absolute start-2.5 top-2 size-3.5 text-muted-foreground" />
									</div>
									<Select
										onValueChange={(value) =>
											setFilter(value as "ALL" | CompanyHealth)
										}
										value={filter}
									>
										<SelectTrigger className="w-44">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="ALL">Todos los estados</SelectItem>
											<SelectItem value="OPERATIVA">Operativas</SelectItem>
											<SelectItem value="POR_VENCER">Por vencer</SelectItem>
											<SelectItem value="VENCIDA">Vencidas</SelectItem>
											<SelectItem value="SUSPENDIDA">Suspendidas</SelectItem>
											<SelectItem value="INACTIVA">Deshabilitadas</SelectItem>
										</SelectContent>
									</Select>
									<span className="text-muted-foreground text-xs">
										{formatInteger(visible.length)} de{" "}
										{formatInteger(stats.total)}
									</span>
								</div>
							}
							title="Cuentas"
						>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="ps-4">Empresa</TableHead>
										<TableHead>Licencia</TableHead>
										<TableHead>Estado</TableHead>
										<TableHead>Vence</TableHead>
										<TableHead>Días restantes</TableHead>
										<TableHead>Flota</TableHead>
										<TableHead>Usuarios</TableHead>
										<TableHead className="pe-4 text-right">Acciones</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{visible.length === 0 ? (
										<TableRow>
											<TableCell
												className="py-10 text-center text-muted-foreground"
												colSpan={8}
											>
												{stats.total === 0
													? "Todavía no hay empresas registradas. Use “Nueva empresa” para crear la primera."
													: "Ninguna empresa coincide con el filtro."}
											</TableCell>
										</TableRow>
									) : (
										visible.map((company) => (
											<TableRow key={company.id}>
												<TableCell className="ps-4">
													<div className="font-medium">{company.name}</div>
													<div className="text-muted-foreground text-xs">
														RIF {company.tax_id}
													</div>
												</TableCell>
												<TableCell className="font-mono text-xs">
													{company.license_key}
												</TableCell>
												<TableCell>
													<HealthBadge company={company} />
												</TableCell>
												<TableCell className="whitespace-nowrap">
													{formatDate(company.expiration_date)}
												</TableCell>
												<TableCell className="whitespace-nowrap">
													<DaysCell company={company} />
												</TableCell>
												<TableCell className="whitespace-nowrap text-xs">
													{formatInteger(company.trucks_count)}/
													{formatInteger(company.max_trucks)} camiones
													<div className="text-muted-foreground">
														{formatInteger(company.active_devices)} dispositivos
													</div>
												</TableCell>
												<TableCell>{formatInteger(company.users_count)}</TableCell>
												<TableCell className="pe-4 text-right">
													<div className="flex justify-end gap-1">
														<Button
															onClick={() => setViewing(company)}
															size="sm"
															variant="ghost"
														>
															<EyeIcon />
															Ver
														</Button>
														<Button
															disabled={busyId === company.id}
															onClick={() => void renew(company)}
															size="sm"
															variant="ghost"
														>
															Renovar 12 m
														</Button>
														<Button
															onClick={() => setEditing(company)}
															size="sm"
															variant="outline"
														>
															<PencilIcon />
															Editar
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</DataCard>
					</>
				)}
			</main>

			<NewCompanyDialog
				onCreated={state.reload}
				onOpenChange={setCreating}
				open={creating}
			/>
			<LicenseDialog
				company={editing}
				onClose={() => setEditing(null)}
				onSaved={state.reload}
			/>
			<CompanyDetailDialog
				company={viewing}
				onClose={() => setViewing(null)}
			/>
		</div>
	);
}

/* --------------------------- company detail dialog ------------------------ */

function CompanyDetailDialog({
	company,
	onClose,
}: {
	company: CompanyOut | null;
	onClose: () => void;
}) {
	if (!company) return null;

	const health = companyHealth(company);

	return (
		<Dialog onOpenChange={(next) => (next ? undefined : onClose())} open={company !== null}>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{company.name}</DialogTitle>
					<DialogDescription>
						RIF {company.tax_id} · {HEALTH_LABEL[health]} · {formatDate(company.expiration_date)}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4">
					<div className="grid gap-3 sm:grid-cols-2">
						<div className="rounded-lg border p-3">
							<div className="text-muted-foreground text-xs">Clave de licencia</div>
							<div className="font-mono text-sm break-all">{company.license_key}</div>
						</div>
						<div className="rounded-lg border p-3">
							<div className="text-muted-foreground text-xs">Estado suscripción</div>
							<div className="font-medium capitalize">{company.subscription_status.toLowerCase()}</div>
						</div>
						<div className="rounded-lg border p-3">
							<div className="text-muted-foreground text-xs">Vence</div>
							<div className="font-medium">{formatDate(company.expiration_date)}</div>
						</div>
						<div className="rounded-lg border p-3">
							<div className="text-muted-foreground text-xs">Tope de camiones</div>
							<div className="font-medium">{formatInteger(company.max_trucks)}</div>
						</div>
						<div className="rounded-lg border p-3">
							<div className="text-muted-foreground text-xs">Camiones registrados</div>
							<div className="font-medium">{formatInteger(company.trucks_count)}</div>
						</div>
						<div className="rounded-lg border p-3">
							<div className="text-muted-foreground text-xs">Dispositivos activos</div>
							<div className="font-medium">{formatInteger(company.active_devices)}</div>
						</div>
						<div className="rounded-lg border p-3">
							<div className="text-muted-foreground text-xs">Usuarios</div>
							<div className="font-medium">{formatInteger(company.users_count)}</div>
						</div>
						<div className="rounded-lg border p-3">
							<div className="text-muted-foreground text-xs">Cuenta</div>
							<div className="font-medium">{company.is_active ? "Habilitada" : "Deshabilitada"}</div>
						</div>
						<div className="rounded-lg border p-3">
							<div className="text-muted-foreground text-xs">Creada</div>
							<div className="font-medium">{formatDate(company.created_at)}</div>
						</div>
					</div>

					<div className="border-t pt-4">
						<h4 className="font-medium mb-3 flex items-center gap-2">
							<TruckIcon className="size-4" />
							Flota y usuarios
						</h4>
						<p className="text-muted-foreground text-sm">
							Para ver camiones, conductores y dispositivos en detalle, entre al panel de la empresa
							con su license_key.
						</p>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={onClose}>Cerrar</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/* -------------------------------- entry --------------------------------- */

export function PlatformApp() {
	const [key, setKey] = useState<string | null>(() => getPlatformKey());

	if (!key) return <PlatformGate onUnlock={setKey} />;

	return (
		<PlatformDashboard
			onExit={() => {
				clearPlatformKey();
				setKey(null);
			}}
		/>
	);
}
