import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRoundIcon, PlusIcon } from "lucide-react";
import { DataCard, PageHeader } from "@/components/page-header";
import { ActiveBadge } from "@/components/views/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { api, type Role, type UserOut } from "@/lib/api";
import { ROLE_LABEL, formatDateTime, formatInteger } from "@/lib/format";
import { errorMessage } from "@/lib/mutate";
import { useAsyncData } from "@/lib/use-async";

const ROLES: Role[] = ["ADMIN", "WAREHOUSE", "DRIVER"];

export function UsersView() {
	const [editing, setEditing] = useState<UserOut | null>(null);
	const [editorOpen, setEditorOpen] = useState(false);
	const [pinTarget, setPinTarget] = useState<UserOut | null>(null);

	const state = useAsyncData<UserOut[]>(() => api<UserOut[]>("/api/v1/admin/users"), []);
	const users = state.data ?? [];

	return (
		<div className="space-y-4">
			<PageHeader
				description={
					state.loading && !state.data
						? "Cargando usuarios…"
						: `${formatInteger(users.length)} usuario(s)`
				}
				title="Usuarios"
			>
				<Button
					onClick={() => {
						setEditing(null);
						setEditorOpen(true);
					}}
				>
					<PlusIcon /> Nuevo usuario
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
							<TableHead className="ps-4">Cédula</TableHead>
							<TableHead>Nombre</TableHead>
							<TableHead>Rol</TableHead>
							<TableHead>Estado</TableHead>
							<TableHead>Último acceso</TableHead>
							<TableHead className="pe-4 text-right">Acciones</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{state.loading && !state.data ? (
							Array.from({ length: 4 }).map((_, index) => (
								<TableRow key={`user-skeleton-${index}`}>
									<TableCell colSpan={6}>
										<Skeleton className="h-6 w-full" />
									</TableCell>
								</TableRow>
							))
						) : users.length === 0 ? (
							<TableRow>
								<TableCell
									className="py-10 text-center text-muted-foreground"
									colSpan={6}
								>
									Sin usuarios.
								</TableCell>
							</TableRow>
						) : (
							users.map((user) => (
								<TableRow
									className={user.is_active ? undefined : "opacity-60"}
									key={user.id}
								>
									<TableCell className="ps-4 font-mono text-xs">
										{user.user_cedula}
									</TableCell>
									<TableCell className="font-medium">
										{user.full_name}
									</TableCell>
									<TableCell>
										<Badge variant="secondary">
											{ROLE_LABEL[user.role] ?? user.role}
										</Badge>
									</TableCell>
									<TableCell>
										<ActiveBadge active={user.is_active} />
									</TableCell>
									<TableCell className="text-muted-foreground text-xs">
										{formatDateTime(user.last_login_at)}
									</TableCell>
									<TableCell className="pe-4 text-right">
										<div className="flex justify-end gap-1">
											<Button
												onClick={() => {
													setEditing(user);
													setEditorOpen(true);
												}}
												size="sm"
												variant="ghost"
											>
												Editar
											</Button>
											<Button
												onClick={() => setPinTarget(user)}
												size="sm"
												variant="ghost"
											>
												<KeyRoundIcon /> PIN
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</DataCard>

			<p className="text-muted-foreground text-xs">
				Los conductores inician sesión en la app móvil con su cédula y un PIN de 4
				dígitos.
			</p>

			<UserEditorDialog
				isNew={!editing}
				onOpenChange={setEditorOpen}
				onSaved={state.reload}
				open={editorOpen}
				user={editing}
			/>

			<ResetPinDialog
				onClose={() => setPinTarget(null)}
				onSaved={state.reload}
				user={pinTarget}
			/>
		</div>
	);
}

function UserEditorDialog({
	open,
	onOpenChange,
	user,
	onSaved,
	isNew,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	user: UserOut | null;
	onSaved: () => void;
	isNew: boolean;
}) {
	const [cedula, setCedula] = useState("");
	const [name, setName] = useState("");
	const [role, setRole] = useState<Role>("DRIVER");
	const [pin, setPin] = useState("");
	const [active, setActive] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		setCedula("");
		setName(user?.full_name ?? "");
		setRole(user?.role ?? "DRIVER");
		setPin("");
		setActive(user?.is_active ?? true);
	}, [open, user]);

	async function submit() {
		const fullName = name.trim();
		if (!fullName) {
			toast.error("El nombre es obligatorio");
			return;
		}
		setSaving(true);
		try {
			if (isNew) {
				if (!cedula.trim()) {
					toast.error("La cédula es obligatoria");
					setSaving(false);
					return;
				}
				if (!/^\d{4}$/.test(pin)) {
					toast.error("El PIN debe tener exactamente 4 dígitos");
					setSaving(false);
					return;
				}
				await api("/api/v1/admin/users", {
					method: "POST",
					body: {
						user_cedula: cedula.trim(),
						full_name: fullName,
						role,
						pin,
					},
				});
				toast.success("Usuario creado");
			} else if (user) {
				await api(`/api/v1/admin/users/${user.id}`, {
					method: "PATCH",
					body: { full_name: fullName, role, is_active: active },
				});
				toast.success("Usuario actualizado");
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
						{isNew ? "Nuevo usuario" : `Editar ${user?.full_name ?? ""}`}
					</DialogTitle>
					<DialogDescription>
						Administrador: acceso total. Bodega: manifiestos y despacho. Conductor:
						app móvil.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 sm:grid-cols-2">
					{isNew ? (
						<div className="grid gap-1.5">
							<Label htmlFor="us-cedula">Cédula *</Label>
							<Input
								id="us-cedula"
								inputMode="numeric"
								onChange={(event) => setCedula(event.target.value)}
								placeholder="1000000004"
								value={cedula}
							/>
						</div>
					) : null}

					<div className={isNew ? "grid gap-1.5" : "grid gap-1.5 sm:col-span-2"}>
						<Label htmlFor="us-name">Nombre completo *</Label>
						<Input
							id="us-name"
							onChange={(event) => setName(event.target.value)}
							value={name}
						/>
					</div>

					<div className="grid gap-1.5">
						<Label htmlFor="us-role">Rol *</Label>
						<Select onValueChange={(value) => setRole(value as Role)} value={role}>
							<SelectTrigger className="w-full" id="us-role">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ROLES.map((value) => (
									<SelectItem key={value} value={value}>
										{ROLE_LABEL[value]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{isNew ? (
						<div className="grid gap-1.5">
							<Label htmlFor="us-pin">PIN inicial (4 dígitos) *</Label>
							<Input
								className="font-bold text-center tracking-[0.5em]"
								id="us-pin"
								inputMode="numeric"
								maxLength={4}
								onChange={(event) => setPin(event.target.value)}
								placeholder="••••"
								value={pin}
							/>
						</div>
					) : (
						<div className="flex items-end">
							<label className="flex items-center gap-2 text-sm">
								<Checkbox
									checked={active}
									onCheckedChange={(checked) => setActive(checked === true)}
								/>
								Activo
							</label>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancelar
					</Button>
					<Button disabled={saving} onClick={() => void submit()}>
						{saving ? "Guardando…" : isNew ? "Crear usuario" : "Guardar cambios"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ResetPinDialog({
	user,
	onClose,
	onSaved,
}: {
	user: UserOut | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [pin, setPin] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setPin("");
	}, [user]);

	async function submit() {
		if (!user) return;
		if (!/^\d{4}$/.test(pin)) {
			toast.error("El PIN debe tener exactamente 4 dígitos");
			return;
		}
		setSaving(true);
		try {
			await api(`/api/v1/admin/users/${user.id}/reset-pin`, {
				method: "POST",
				body: { pin },
			});
			toast.success(`PIN de ${user.full_name} actualizado`);
			onClose();
			onSaved();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog onOpenChange={(next) => (next ? undefined : onClose())} open={user !== null}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Resetear PIN</DialogTitle>
					<DialogDescription>
						Nuevo PIN de 4 dígitos para {user?.full_name ?? ""}.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-1.5">
					<Label htmlFor="rp-pin">Nuevo PIN (4 dígitos)</Label>
					<Input
						className="font-bold text-center text-lg tracking-[0.6em]"
						id="rp-pin"
						inputMode="numeric"
						maxLength={4}
						onChange={(event) => setPin(event.target.value)}
						placeholder="••••"
						value={pin}
					/>
				</div>

				<DialogFooter>
					<Button onClick={onClose} variant="outline">
						Cancelar
					</Button>
					<Button disabled={saving} onClick={() => void submit()}>
						{saving ? "Guardando…" : "Restablecer PIN"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
