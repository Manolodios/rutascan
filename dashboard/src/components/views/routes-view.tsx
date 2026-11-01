import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PlusIcon, RocketIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { DataCard, PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/views/confirm-dialog";
import { DetailStatusBadge, RouteStatusBadge } from "@/components/views/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import {
	api,
	type ImportResult,
	type ProductOut,
	type RouteFullOut,
	type RouteOut,
	type TruckOut,
	type UserBrief,
} from "@/lib/api";
import { formatDateTime, formatInteger, formatLongDate, formatPercent, todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/mutate";
import { useAsyncData } from "@/lib/use-async";

/** Empty-string option value is not allowed by Radix Select. */
const NONE = "__none__";

export function RoutesView() {
	const [day, setDay] = useState(todayISO());
	const [manifestId, setManifestId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	const state = useAsyncData<RouteOut[]>(
		() => api<RouteOut[]>(`/api/v1/admin/routes?day=${day}`),
		[day],
	);

	const routes = state.data ?? [];
	const totalUnits = routes.reduce((acc, route) => acc + route.counts.assigned_units, 0);

	function handleCreated(created: RouteOut) {
		if (created.route_date !== day) setDay(created.route_date);
		else state.reload();
		setManifestId(created.id);
	}

	return (
		<div className="space-y-4">
			<PageHeader
				description={
					state.loading && !state.data
						? "Cargando rutas…"
						: `${routes.length} ruta(s) · ${formatInteger(totalUnits)} unidades asignadas`
				}
				title="Rutas"
			>
				<div className="flex items-center gap-2">
					<Label className="text-muted-foreground text-xs" htmlFor="routes-day">
						Fecha
					</Label>
					<Input
						className="w-40"
						id="routes-day"
						onChange={(event) => setDay(event.target.value)}
						type="date"
						value={day}
					/>
				</div>
				<Button onClick={() => setCreating(true)}>
					<PlusIcon /> Nueva ruta
				</Button>
			</PageHeader>

			{state.error ? (
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm">
					{state.error}
				</div>
			) : null}

			{state.loading && !state.data ? (
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton className="h-44 w-full" key={`route-skeleton-${index}`} />
					))}
				</div>
			) : !state.error && routes.length === 0 ? (
				<Card className="p-10 text-center text-muted-foreground text-sm">
					No hay rutas creadas para el {formatLongDate(day)}.
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{routes.map((route) => (
						<RouteCard
							key={route.id}
							onChanged={state.reload}
							onOpenManifest={() => setManifestId(route.id)}
							route={route}
						/>
					))}
				</div>
			)}

			<NewRouteDialog
				day={day}
				onCreated={handleCreated}
				onOpenChange={setCreating}
				open={creating}
			/>

			<ManifestDialog
				onChanged={state.reload}
				onClose={() => setManifestId(null)}
				routeId={manifestId}
			/>
		</div>
	);
}

function RouteCard({
	route,
	onOpenManifest,
	onChanged,
}: {
	route: RouteOut;
	onOpenManifest: () => void;
	onChanged: () => void;
}) {
	const counts = route.counts;
	const pending = route.status === "PENDING";

	return (
		<Card className="justify-between gap-3 p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="font-medium">
						{route.truck?.license_plate ?? "—"}{" "}
						<span className="font-normal text-muted-foreground text-xs">
							{route.truck?.model ?? ""}
						</span>
					</div>
					<div className="text-muted-foreground text-xs">
						{route.driver?.full_name ?? "Sin conductor asignado"}
					</div>
				</div>
				<RouteStatusBadge status={route.status} />
			</div>

			<div>
				<Progress className="h-1.5" value={Math.min(100, counts.completion_pct)} />
				<div className="mt-1.5 flex justify-between text-muted-foreground text-xs">
					<span>
						{counts.lines} líneas · {formatInteger(counts.assigned_units)} unidades
					</span>
					<span>
						{counts.delivered_units} entregadas (
						{formatPercent(counts.completion_pct, 0)})
					</span>
				</div>
			</div>

			<div className="flex items-center justify-between text-muted-foreground text-xs">
				<span>
					{counts.rejected_lines} rechazos · {counts.in_truck_lines} por entregar
				</span>
				<span>
					{route.completed_at
						? `Completada ${formatDateTime(route.completed_at)}`
						: route.started_at
							? `Iniciada ${formatDateTime(route.started_at)}`
							: ""}
				</span>
			</div>

			<div className="flex gap-2">
				<Button className="flex-1" onClick={onOpenManifest} variant="outline">
					Manifiesto
				</Button>
				{pending ? (
					<ConfirmDialog
						confirmText="Eliminar"
						danger
						description="Se eliminará la ruta y todo su manifiesto. Solo es posible mientras esté pendiente."
						onConfirm={async () => {
							await api(`/api/v1/admin/routes/${route.id}`, { method: "DELETE" });
							toast.success("Ruta eliminada");
							onChanged();
						}}
						title="Eliminar ruta"
						trigger={
							<Button aria-label="Eliminar ruta" size="icon" variant="outline">
								<Trash2Icon />
							</Button>
						}
					/>
				) : null}
			</div>
		</Card>
	);
}

function NewRouteDialog({
	open,
	onOpenChange,
	day,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	day: string;
	onCreated: (route: RouteOut) => void;
}) {
	const [trucks, setTrucks] = useState<TruckOut[]>([]);
	const [drivers, setDrivers] = useState<UserBrief[]>([]);
	const [truckId, setTruckId] = useState("");
	const [driverId, setDriverId] = useState(NONE);
	const [routeDate, setRouteDate] = useState(day);
	const [notes, setNotes] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		setRouteDate(day);
		setNotes("");
		setDriverId(NONE);
		void Promise.all([
			api<TruckOut[]>("/api/v1/admin/trucks"),
			api<UserBrief[]>("/api/v1/admin/users/drivers"),
		])
			.then(([allTrucks, allDrivers]) => {
				const active = allTrucks.filter((truck) => truck.is_active);
				setTrucks(active);
				setDrivers(allDrivers);
				setTruckId(active.find((truck) => !truck.has_route_today)?.id ?? "");
			})
			.catch((err: unknown) => toast.error(errorMessage(err)));
	}, [open, day]);

	async function submit() {
		if (!truckId) {
			toast.error("Seleccione un camión");
			return;
		}
		setSaving(true);
		try {
			const created = await api<RouteOut>("/api/v1/admin/routes", {
				method: "POST",
				body: {
					truck_id: truckId,
					driver_id: driverId === NONE ? null : driverId,
					route_date: routeDate,
					notes: notes.trim() || null,
				},
			});
			toast.success(`Ruta ${created.truck?.license_plate ?? ""} creada`);
			onOpenChange(false);
			onCreated(created);
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Nueva ruta</DialogTitle>
					<DialogDescription>
						Asigne un camión y una fecha. Luego cargue el manifiesto de productos.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-1.5">
						<Label htmlFor="nr-truck">Camión *</Label>
						<Select onValueChange={setTruckId} value={truckId || undefined}>
							<SelectTrigger className="w-full" id="nr-truck">
								<SelectValue placeholder="Seleccione un camión" />
							</SelectTrigger>
							<SelectContent>
								{trucks.length === 0 ? (
									<SelectItem disabled value={NONE}>
										No hay camiones activos
									</SelectItem>
								) : null}
								{trucks.map((truck) => (
									<SelectItem
										disabled={truck.has_route_today}
										key={truck.id}
										value={truck.id}
									>
										{truck.license_plate}
										{truck.model ? ` · ${truck.model}` : ""}
										{truck.has_route_today ? " (ya tiene ruta)" : ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="grid gap-1.5">
						<Label htmlFor="nr-driver">Conductor</Label>
						<Select onValueChange={setDriverId} value={driverId}>
							<SelectTrigger className="w-full" id="nr-driver">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>Usar el asignado del camión</SelectItem>
								{drivers.map((driver) => (
									<SelectItem key={driver.id} value={driver.id}>
										{driver.full_name} ({driver.user_cedula})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="grid gap-1.5">
						<Label htmlFor="nr-date">Fecha *</Label>
						<Input
							id="nr-date"
							onChange={(event) => setRouteDate(event.target.value)}
							type="date"
							value={routeDate}
						/>
					</div>

					<div className="grid gap-1.5">
						<Label htmlFor="nr-notes">Notas</Label>
						<Input
							id="nr-notes"
							onChange={(event) => setNotes(event.target.value)}
							placeholder="Opcional"
							value={notes}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancelar
					</Button>
					<Button disabled={saving || !truckId} onClick={() => void submit()}>
						{saving ? "Creando…" : "Crear ruta"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ManifestDialog({
	routeId,
	onClose,
	onChanged,
}: {
	routeId: string | null;
	onClose: () => void;
	onChanged: () => void;
}) {
	const open = routeId !== null;
	const [route, setRoute] = useState<RouteFullOut | null>(null);
	const [products, setProducts] = useState<ProductOut[]>([]);
	const [loading, setLoading] = useState(false);
	const [productId, setProductId] = useState("");
	const [quantity, setQuantity] = useState("1");
	const [busy, setBusy] = useState(false);
	const [importing, setImporting] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	const load = useCallback(async () => {
		if (!routeId) return;
		setLoading(true);
		try {
			const [full, catalog] = await Promise.all([
				api<RouteFullOut>(`/api/v1/admin/routes/${routeId}`),
				api<ProductOut[]>("/api/v1/admin/products?limit=2000"),
			]);
			setRoute(full);
			setProducts(catalog);
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setLoading(false);
		}
	}, [routeId]);

	useEffect(() => {
		if (!open) {
			setRoute(null);
			return;
		}
		setProductId("");
		setQuantity("1");
		void load();
	}, [open, load]);

	async function refresh() {
		await load();
		onChanged();
	}

	async function addLine() {
		if (!routeId || !productId) {
			toast.error("Seleccione un producto");
			return;
		}
		const qty = Number.parseInt(quantity, 10);
		if (!Number.isFinite(qty) || qty < 1) {
			toast.error("La cantidad debe ser mayor o igual a 1");
			return;
		}
		setBusy(true);
		try {
			await api(`/api/v1/admin/routes/${routeId}/details`, {
				method: "POST",
				body: { items: [{ product_id: productId, assigned_quantity: qty }] },
			});
			toast.success("Producto agregado al manifiesto");
			setProductId("");
			setQuantity("1");
			await refresh();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	async function removeLine(detailId: string) {
		if (!routeId) return;
		try {
			await api(`/api/v1/admin/routes/${routeId}/details/${detailId}`, {
				method: "DELETE",
			});
			toast.success("Ítem removido");
			await refresh();
		} catch (err) {
			toast.error(errorMessage(err));
		}
	}

	async function importCsv(file: File) {
		if (!routeId) return;
		setImporting(true);
		try {
			const form = new FormData();
			form.append("file", file);
			const result = await api<ImportResult>(
				`/api/v1/admin/routes/${routeId}/details/import`,
				{ method: "POST", form },
			);
			const message = `Importado: ${result.created} nuevos, ${result.updated} actualizados${
				result.errors.length ? `, ${result.errors.length} errores` : ""
			}`;
			if (result.errors.length) {
				toast.warning(message);
				console.warn("Errores de importación", result.errors);
			} else {
				toast.success(message);
			}
			await refresh();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setImporting(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	async function dispatch() {
		if (!routeId) return;
		await api(`/api/v1/admin/routes/${routeId}/dispatch`, { method: "POST" });
		toast.success("Ruta despachada: el conductor ya puede operar.");
		await refresh();
	}

	const pending = route?.status === "PENDING";

	return (
		<Dialog onOpenChange={(next) => (next ? undefined : onClose())} open={open}>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
				<DialogHeader>
					<DialogTitle>
						Manifiesto · {route?.truck?.license_plate ?? "…"}
					</DialogTitle>
					<DialogDescription>
						{route
							? `${route.driver?.full_name ?? "Sin conductor"} · ${route.route_date} · ${
									route.counts.lines
								} líneas · ${formatInteger(route.counts.assigned_units)} unidades asignadas`
							: "Cargando…"}
					</DialogDescription>
				</DialogHeader>

				{loading && !route ? (
					<div className="space-y-2">
						<Skeleton className="h-9 w-full" />
						<Skeleton className="h-48 w-full" />
					</div>
				) : null}

				{route ? (
					<div className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<RouteStatusBadge status={route.status} />
							{pending ? (
								<div className="flex flex-wrap items-center gap-2">
									<input
										accept=".csv"
										className="hidden"
										onChange={(event) => {
											const file = event.target.files?.[0];
											if (file) void importCsv(file);
										}}
										ref={fileRef}
										type="file"
									/>
									<Button
										disabled={importing}
										onClick={() => fileRef.current?.click()}
										variant="outline"
									>
										<UploadIcon /> {importing ? "Importando…" : "Importar CSV"}
									</Button>
									<ConfirmDialog
										confirmText="Despachar"
										description="El conductor podrá empezar a escanear. El manifiesto queda bloqueado."
										onConfirm={dispatch}
										title="Despachar ruta"
										trigger={
											<Button>
												<RocketIcon /> Despachar
											</Button>
										}
									/>
								</div>
							) : null}
						</div>

						{pending ? (
							<DataCard title="Cargar productos (bodega)">
								<div className="flex flex-wrap items-end gap-2 p-3">
									<div className="grid min-w-[240px] flex-1 gap-1.5">
										<Label className="text-muted-foreground text-xs" htmlFor="add-product">
											Producto
										</Label>
										<Select onValueChange={setProductId} value={productId || undefined}>
											<SelectTrigger className="w-full" id="add-product">
												<SelectValue placeholder="Seleccione un producto" />
											</SelectTrigger>
											<SelectContent>
												{products.map((product) => (
													<SelectItem key={product.id} value={product.id}>
														{product.barcode_qr} · {product.description}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="grid w-28 gap-1.5">
										<Label className="text-muted-foreground text-xs" htmlFor="add-qty">
											Cantidad
										</Label>
										<Input
											id="add-qty"
											min={1}
											onChange={(event) => setQuantity(event.target.value)}
											type="number"
											value={quantity}
										/>
									</div>
									<Button disabled={busy || !productId} onClick={() => void addLine()}>
										<PlusIcon /> Agregar
									</Button>
								</div>
								<p className="px-3 pb-3 text-muted-foreground text-xs">
									CSV de importación: columnas <code>barcode_qr, quantity</code>.
								</p>
							</DataCard>
						) : null}

						<DataCard>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="ps-4">Producto</TableHead>
										<TableHead>Código</TableHead>
										<TableHead className="text-right">Asignado</TableHead>
										<TableHead className="text-right">Entregado</TableHead>
										<TableHead>Estado</TableHead>
										<TableHead>Último escaneo</TableHead>
										{pending ? <TableHead className="pe-4" /> : null}
									</TableRow>
								</TableHeader>
								<TableBody>
									{route.details.map((detail) => (
										<TableRow key={detail.id}>
											<TableCell className="ps-4 font-medium">
												{detail.product.description}
												{detail.return_required ? (
													<Badge
														className="ms-2 border-amber-300 text-amber-700 dark:text-amber-300"
														variant="outline"
													>
														Reingreso
													</Badge>
												) : null}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{detail.product.barcode_qr}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{detail.assigned_quantity}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{detail.delivered_quantity}
											</TableCell>
											<TableCell>
												<DetailStatusBadge status={detail.status} />
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{formatDateTime(detail.last_scan_at)}
											</TableCell>
											{pending ? (
												<TableCell className="pe-4 text-right">
													<Button
														aria-label="Quitar del manifiesto"
														onClick={() => void removeLine(detail.id)}
														size="icon-sm"
														variant="ghost"
													>
														<Trash2Icon />
													</Button>
												</TableCell>
											) : null}
										</TableRow>
									))}
									{route.details.length === 0 ? (
										<TableRow>
											<TableCell
												className="py-10 text-center text-muted-foreground"
												colSpan={pending ? 7 : 6}
											>
												Manifiesto vacío: agregue productos o importe un CSV.
											</TableCell>
										</TableRow>
									) : null}
								</TableBody>
							</Table>
						</DataCard>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
