import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon } from "lucide-react";
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
import { todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/mutate";
import {
	addMonths,
	platformApi,
	type CompanyCreatedOut,
	type CompanyOut,
} from "@/lib/platform";

export function CopyField({ label, value }: { label: string; value: string }) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), 1800);
		return () => clearTimeout(timer);
	}, [copied]);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
		} catch {
			toast.error("No se pudo copiar. Seleccione el texto manualmente.");
		}
	}

	return (
		<div className="grid gap-1">
			<Label className="text-muted-foreground text-xs uppercase">{label}</Label>
			<div className="flex items-center gap-2">
				<code className="flex-1 truncate rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-sm">
					{value}
				</code>
				<Button onClick={() => void copy()} size="icon" type="button" variant="outline">
					{copied ? <CheckIcon /> : <CopyIcon />}
				</Button>
			</div>
		</div>
	);
}

export function NewCompanyDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: () => void;
}) {
	const [name, setName] = useState("");
	const [taxId, setTaxId] = useState("");
	const [maxTrucks, setMaxTrucks] = useState("5");
	const [expiration, setExpiration] = useState(() => addMonths(12));
	const [adminName, setAdminName] = useState("");
	const [adminCedula, setAdminCedula] = useState("");
	const [adminPin, setAdminPin] = useState("");
	const [saving, setSaving] = useState(false);
	const [created, setCreated] = useState<CompanyCreatedOut | null>(null);

	useEffect(() => {
		if (!open) return;
		setName("");
		setTaxId("");
		setMaxTrucks("5");
		setExpiration(addMonths(12));
		setAdminName("");
		setAdminCedula("");
		setAdminPin("");
		setCreated(null);
	}, [open]);

	async function submit() {
		const trucks = Number.parseInt(maxTrucks, 10);
		if (name.trim().length < 2) {
			toast.error("El nombre de la empresa es obligatorio");
			return;
		}
		if (taxId.trim().length < 3) {
			toast.error("El RIF es obligatorio");
			return;
		}
		if (!Number.isFinite(trucks) || trucks < 1) {
			toast.error("El tope de camiones debe ser 1 o más");
			return;
		}
		if (adminName.trim().length < 3) {
			toast.error("El nombre del administrador es obligatorio");
			return;
		}
		if (adminCedula.trim().length < 3) {
			toast.error("La cédula del administrador es obligatoria");
			return;
		}
		if (!/^\d{4}$/.test(adminPin)) {
			toast.error("El PIN del administrador debe tener 4 dígitos");
			return;
		}

		setSaving(true);
		try {
			const result = await platformApi<CompanyCreatedOut>("/api/v1/platform/companies", {
				method: "POST",
				body: {
					name: name.trim(),
					tax_id: taxId.trim(),
					max_trucks: trucks,
					expiration_date: expiration,
					admin_cedula: adminCedula.trim(),
					admin_full_name: adminName.trim(),
					admin_pin: adminPin,
				},
			});
			setCreated(result);
			onCreated();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	if (created) {
		return (
			<Dialog onOpenChange={onOpenChange} open={open}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Empresa creada</DialogTitle>
						<DialogDescription>
							Guarde esta clave de licencia: es la que se configura en el panel de
							la empresa y en la app del conductor.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-3">
						<CopyField label="Empresa" value={created.name} />
						<CopyField label="Clave de licencia" value={created.license_key} />
						<CopyField label="Vence" value={created.expiration_date} />
						<CopyField label="Tope de camiones" value={String(created.max_trucks)} />
					</div>

					<DialogFooter>
						<Button onClick={() => onOpenChange(false)}>Listo</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Nueva empresa (cuenta)</DialogTitle>
					<DialogDescription>
						Crea la empresa, su licencia y su primer usuario administrador.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-1.5">
						<Label htmlFor="nc-name">Empresa *</Label>
						<Input
							id="nc-name"
							onChange={(event) => setName(event.target.value)}
							placeholder="Transportes El Progreso S.A."
							value={name}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="nc-tax">RIF *</Label>
						<Input
							id="nc-tax"
							onChange={(event) => setTaxId(event.target.value)}
							placeholder="J-30845672-1"
							value={taxId}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="nc-trucks">Tope de camiones *</Label>
						<Input
							id="nc-trucks"
							min={1}
							onChange={(event) => setMaxTrucks(event.target.value)}
							type="number"
							value={maxTrucks}
						/>
						<span className="text-muted-foreground text-xs">
							Define también cuántos dispositivos móviles pueden operar.
						</span>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="nc-exp">Vence *</Label>
						<Input
							id="nc-exp"
							onChange={(event) => setExpiration(event.target.value)}
							type="date"
							value={expiration}
						/>
					</div>

					<div className="grid gap-1.5 sm:col-span-2">
						<Label htmlFor="nc-admin">Nombre del administrador *</Label>
						<Input
							id="nc-admin"
							onChange={(event) => setAdminName(event.target.value)}
							placeholder="Ana Admin"
							value={adminName}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="nc-cedula">Cédula del administrador *</Label>
						<Input
							id="nc-cedula"
							inputMode="numeric"
							onChange={(event) => setAdminCedula(event.target.value)}
							placeholder="13598742"
							value={adminCedula}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="nc-pin">PIN inicial (4 dígitos) *</Label>
						<Input
							className="text-center font-bold tracking-[0.5em]"
							id="nc-pin"
							inputMode="numeric"
							maxLength={4}
							onChange={(event) => setAdminPin(event.target.value)}
							placeholder="••••"
							value={adminPin}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancelar
					</Button>
					<Button disabled={saving} onClick={() => void submit()}>
						{saving ? "Creando…" : "Crear empresa"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function LicenseDialog({
	company,
	onClose,
	onSaved,
}: {
	company: CompanyOut | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [status, setStatus] = useState("ACTIVE");
	const [expiration, setExpiration] = useState(todayISO);
	const [maxTrucks, setMaxTrucks] = useState("5");
	const [active, setActive] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!company) return;
		setStatus(company.subscription_status);
		setExpiration(company.expiration_date);
		setMaxTrucks(String(company.max_trucks));
		setActive(company.is_active);
	}, [company]);

	async function save(override?: Record<string, unknown>) {
		if (!company) return;
		const trucks = Number.parseInt(maxTrucks, 10);
		if (!override && (!Number.isFinite(trucks) || trucks < 1)) {
			toast.error("El tope de camiones debe ser 1 o más");
			return;
		}
		setSaving(true);
		try {
			await platformApi(`/api/v1/platform/companies/${company.id}/license`, {
				method: "PATCH",
				body: override ?? {
					subscription_status: status,
					expiration_date: expiration,
					max_trucks: trucks,
					is_active: active,
				},
			});
			toast.success("Licencia actualizada");
			onClose();
			onSaved();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog onOpenChange={(next) => (next ? undefined : onClose())} open={company !== null}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Licencia de {company?.name ?? ""}</DialogTitle>
					<DialogDescription>
						Renueve, suspenda o cambie el tope de camiones de esta cuenta.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-3">
					<CopyField label="Clave de licencia" value={company?.license_key ?? ""} />
				</div>

				<div className="flex flex-wrap gap-2">
					<Button
						disabled={saving}
						onClick={() => void save({ expiration_date: addMonths(12, expiration) })}
						size="sm"
						variant="secondary"
					>
						Renovar 12 meses
					</Button>
					<Button
						disabled={saving}
						onClick={() => void save({ expiration_date: addMonths(3, expiration) })}
						size="sm"
						variant="secondary"
					>
						Renovar 3 meses
					</Button>
					<Button
						disabled={saving}
						onClick={() => void save({ expiration_date: addMonths(1, expiration) })}
						size="sm"
						variant="secondary"
					>
						+1 mes
					</Button>
				</div>

				<div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
					<div className="grid gap-1.5">
						<Label htmlFor="lc-status">Estado de la suscripción</Label>
						<Select onValueChange={setStatus} value={status}>
							<SelectTrigger className="w-full" id="lc-status">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ACTIVE">Activa</SelectItem>
								<SelectItem value="SUSPENDED">Suspendida</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="lc-exp">Vence</Label>
						<Input
							id="lc-exp"
							onChange={(event) => setExpiration(event.target.value)}
							type="date"
							value={expiration}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="lc-trucks">Tope de camiones</Label>
						<Input
							id="lc-trucks"
							min={1}
							onChange={(event) => setMaxTrucks(event.target.value)}
							type="number"
							value={maxTrucks}
						/>
						<span className="text-muted-foreground text-xs">
							En uso: {company?.trucks_count ?? 0} camiones ·{" "}
							{company?.active_devices ?? 0} dispositivos
						</span>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="lc-active">Cuenta</Label>
						<Select
							onValueChange={(value) => setActive(value === "true")}
							value={active ? "true" : "false"}
						>
							<SelectTrigger className="w-full" id="lc-active">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="true">Habilitada</SelectItem>
								<SelectItem value="false">Deshabilitada</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={onClose} variant="outline">
						Cancelar
					</Button>
					<Button disabled={saving} onClick={() => void save()}>
						{saving ? "Guardando…" : "Guardar cambios"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
