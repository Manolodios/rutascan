import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { DataCard, PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/views/confirm-dialog";
import { ActiveBadge, RouteStatusBadge } from "@/components/views/status-badge";
import { Button } from "@/components/ui/button";
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
import { api, type TruckOut, type UserBrief } from "@/lib/api";
import { formatInteger } from "@/lib/format";
import { errorMessage } from "@/lib/mutate";
import { useAsyncData } from "@/lib/use-async";

const NONE = "__none__";

export function TrucksView() {
	const [editing, setEditing] = useState<TruckOut | null>(null);
	const [editorOpen, setEditorOpen] = useState(false);

	const state = useAsyncData<{ trucks: TruckOut[]; drivers: UserBrief[] }>(async () => {
		const [trucks, drivers] = await Promise.all([
			api<TruckOut[]>("/api/v1/admin/trucks"),
			api<UserBrief[]>("/api/v1/admin/users/drivers"),
		]);
		return { trucks, drivers };
	}, []);

	const trucks = state.data?.trucks ?? [];
	const drivers = state.data?.drivers ?? [];
	const activeCount = trucks.filter((truck) => truck.is_active).length;

	return (
		<div className="space-y-4">
			<PageHeader
				description={
					state.loading && !state.data
						? "Cargando flota…"
						: `${formatInteger(trucks.length)} camión(es) · ${activeCount} activo(s)`
				}
				title="Camiones"
			>
				<Button
					onClick={() => {
						setEditing(null);
						setEditorOpen(true);
					}}
				>
					<PlusIcon /> Nuevo camión
				</Button>
			</PageHeader>

			{state.error ? (
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm">
					{state.error}
				</div>
			) : null}

			<DataCard>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="ps-4">Placa</TableHead>
							<TableHead>Modelo</TableHead>
							<TableHead>Conductor asignado</TableHead>
							<TableHead>Estado</TableHead>
							<TableHead>Ruta de hoy</TableHead>
							<TableHead className="pe-4 text-right">Acciones</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{state.loading && !state.data ? (
							Array.from({ length: 4 }).map((_, index) => (
								<TableRow key={`truck-skeleton-${index}`}>
									<TableCell colSpan={6}>
										<Skeleton className="h-6 w-full" />
									</TableCell>
								</TableRow>
							))
						) : trucks.length === 0 ? (
							<TableRow>
								<TableCell
									className="py-10 text-center text-muted-foreground"
									colSpan={6}
								>
									No hay camiones registrados.
								</TableCell>
							</TableRow>
						) : (
							trucks.map((truck) => (
								<TableRow
									className={truck.is_active ? undefined : "opacity-60"}
									key={truck.id}
								>
									<TableCell className="ps-4 font-medium">
										{truck.license_plate}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{truck.model ?? "—"}
									</TableCell>
									<TableCell>
										{truck.assigned_driver ? (
											<>
												{truck.assigned_driver.full_name}
												<span className="text-muted-foreground text-xs">
													{" "}
													({truck.assigned_driver.user_cedula})
												</span>
											</>
										) : (
											<span className="text-amber-600 text-xs">
												Sin asignar
											</span>
										)}
									</TableCell>
									<TableCell>
										<ActiveBadge active={truck.is_active} />
									</TableCell>
									<TableCell>
										{truck.has_route_today ? (
											<RouteStatusBadge status={truck.route_status_today} />
										) : (
											<span className="text-muted-foreground text-xs">—</span>
										)}
									</TableCell>
									<TableCell className="pe-4 text-right">
										<div className="flex justify-end gap-1">
											<Button
												onClick={() => {
													setEditing(truck);
													setEditorOpen(true);
												}}
												size="sm"
												variant="ghost"
											>
												Editar
											</Button>
											{truck.is_active ? (
												<ConfirmDialog
													confirmText="Desactivar"
													danger
													description="El camión dejará de aparecer al crear rutas. Puede reactivarlo cuando quiera."
													onConfirm={async () => {
														await api(`/api/v1/admin/trucks/${truck.id}`, {
															method: "DELETE",
														});
														toast.success("Camión desactivado");
														state.reload();
													}}
													title={`Desactivar ${truck.license_plate}`}
													trigger={
														<Button
															className="text-destructive"
															size="sm"
															variant="ghost"
														>
															Desactivar
														</Button>
													}
												/>
											) : (
												<Button
													onClick={async () => {
														try {
															await api(
																`/api/v1/admin/trucks/${truck.id}`,
																{
																	method: "PATCH",
																	body: { is_active: true },
																},
															);
															toast.success("Camión reactivado");
															state.reload();
														} catch (err) {
															toast.error(errorMessage(err));
														}
													}}
													size="sm"
													variant="ghost"
												>
													Reactivar
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</DataCard>

			<TruckEditorDialog
				drivers={drivers}
				isNew={!editing}
				onOpenChange={setEditorOpen}
				onSaved={state.reload}
				open={editorOpen}
				truck={editing}
			/>
		</div>
	);
}

function TruckEditorDialog({
	open,
	onOpenChange,
	truck,
	drivers,
	onSaved,
	isNew,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	truck: TruckOut | null;
	drivers: UserBrief[];
	onSaved: () => void;
	isNew: boolean;
}) {
	const [plate, setPlate] = useState("");
	const [model, setModel] = useState("");
	const [driverId, setDriverId] = useState(NONE);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		setPlate(truck?.license_plate ?? "");
		setModel(truck?.model ?? "");
		setDriverId(truck?.assigned_driver?.id ?? NONE);
	}, [open, truck]);

	async function submit() {
		const payload = {
			license_plate: plate.trim().toUpperCase(),
			model: model.trim() || null,
			assigned_driver_id: driverId === NONE ? null : driverId,
		};
		if (!payload.license_plate) {
			toast.error("La placa es obligatoria");
			return;
		}
		setSaving(true);
		try {
			if (isNew) {
				await api("/api/v1/admin/trucks", { method: "POST", body: payload });
				toast.success("Camión creado");
			} else if (truck) {
				await api(`/api/v1/admin/trucks/${truck.id}`, {
					method: "PATCH",
					body: payload,
				});
				toast.success("Camión actualizado");
			}
			onOpenChange(false);
			onSaved();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>
						{isNew ? "Nuevo camión" : `Editar ${truck?.license_plate ?? ""}`}
					</DialogTitle>
					<DialogDescription>
						Puede asignar un conductor fijo; al crear una ruta podrá cambiarlo.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-1.5">
						<Label htmlFor="tr-plate">Placa *</Label>
						<Input
							className="uppercase"
							id="tr-plate"
							onChange={(event) => setPlate(event.target.value)}
							placeholder="WKL-482"
							value={plate}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="tr-model">Modelo</Label>
						<Input
							id="tr-model"
							onChange={(event) => setModel(event.target.value)}
							placeholder="Chevrolet NHR"
							value={model}
						/>
					</div>
					<div className="grid gap-1.5 sm:col-span-2">
						<Label htmlFor="tr-driver">Conductor asignado</Label>
						<Select onValueChange={setDriverId} value={driverId}>
							<SelectTrigger className="w-full" id="tr-driver">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>Sin conductor</SelectItem>
								{drivers.map((driver) => (
									<SelectItem key={driver.id} value={driver.id}>
										{driver.full_name} ({driver.user_cedula})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancelar
					</Button>
					<Button disabled={saving} onClick={() => void submit()}>
						{saving ? "Guardando…" : isNew ? "Crear camión" : "Guardar cambios"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
