import { useState } from "react";
import { toast } from "sonner";
import { KeyRoundIcon } from "lucide-react";
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
import { changePin } from "@/lib/api";
import { errorMessage } from "@/lib/mutate";

const PIN_RE = /^\d{4}$/;

export function ChangePinDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [currentPin, setCurrentPin] = useState("");
	const [newPin, setNewPin] = useState("");
	const [confirmPin, setConfirmPin] = useState("");
	const [saving, setSaving] = useState(false);

	function handleOpenChange(next: boolean) {
		if (!next) {
			setCurrentPin("");
			setNewPin("");
			setConfirmPin("");
			setSaving(false);
		}
		onOpenChange(next);
	}

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		if (!PIN_RE.test(currentPin)) {
			toast.error("Ingrese su PIN actual de 4 dígitos.");
			return;
		}
		if (!PIN_RE.test(newPin)) {
			toast.error("El PIN nuevo debe tener 4 dígitos.");
			return;
		}
		if (newPin !== confirmPin) {
			toast.error("La confirmación no coincide con el PIN nuevo.");
			return;
		}
		if (newPin === currentPin) {
			toast.error("El PIN nuevo debe ser distinto al actual.");
			return;
		}

		setSaving(true);
		try {
			await changePin(currentPin, newPin);
			toast.success("PIN actualizado. Úselo en su próximo inicio de sesión.");
			handleOpenChange(false);
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<KeyRoundIcon className="size-5 text-primary" />
						Cambiar PIN
					</DialogTitle>
					<DialogDescription>
						Su PIN protege el acceso al panel y a la aplicación móvil.
					</DialogDescription>
				</DialogHeader>

				<form className="grid gap-4" onSubmit={(event) => void submit(event)}>
					<div className="grid gap-1.5">
						<Label htmlFor="pin-current">PIN actual</Label>
						<Input
							autoComplete="current-password"
							autoFocus
							id="pin-current"
							inputMode="numeric"
							maxLength={4}
							onChange={(event) =>
								setCurrentPin(event.target.value.replace(/\D/g, ""))
							}
							placeholder="••••"
							type="password"
							value={currentPin}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="pin-new">PIN nuevo</Label>
						<Input
							autoComplete="new-password"
							id="pin-new"
							inputMode="numeric"
							maxLength={4}
							onChange={(event) =>
								setNewPin(event.target.value.replace(/\D/g, ""))
							}
							placeholder="••••"
							type="password"
							value={newPin}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="pin-confirm">Confirmar PIN nuevo</Label>
						<Input
							autoComplete="new-password"
							id="pin-confirm"
							inputMode="numeric"
							maxLength={4}
							onChange={(event) =>
								setConfirmPin(event.target.value.replace(/\D/g, ""))
							}
							placeholder="••••"
							type="password"
							value={confirmPin}
						/>
					</div>

					<DialogFooter>
						<Button
							onClick={() => handleOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancelar
						</Button>
						<Button disabled={saving} type="submit">
							{saving ? "Guardando…" : "Cambiar PIN"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
