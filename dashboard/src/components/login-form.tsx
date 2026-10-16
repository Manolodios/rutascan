import { useState, type FormEvent } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function LoginForm() {
	const { signIn } = useAuth();
	const [cedula, setCedula] = useState("");
	const [pin, setPin] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await signIn(cedula.trim(), pin.trim());
		} catch (err) {
			setError(
				err instanceof ApiError
					? err.message
					: "No se pudo iniciar sesión. Intente de nuevo.",
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
					<p className="text-muted-foreground text-sm">
						Panel de control de entregas
					</p>
				</div>

				<form className="space-y-4" onSubmit={onSubmit}>
					<div className="space-y-2">
						<label className="font-medium text-sm" htmlFor="cedula">
							Cédula
						</label>
						<Input
							autoComplete="username"
							autoFocus
							id="cedula"
							inputMode="numeric"
							onChange={(e) => setCedula(e.target.value)}
							placeholder="1000000001"
							value={cedula}
						/>
					</div>

					<div className="space-y-2">
						<label className="font-medium text-sm" htmlFor="pin">
							PIN
						</label>
						<Input
							autoComplete="current-password"
							id="pin"
							inputMode="numeric"
							maxLength={8}
							onChange={(e) => setPin(e.target.value)}
							placeholder="••••"
							type="password"
							value={pin}
						/>
					</div>

					{error ? (
						<p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
							{error}
						</p>
					) : null}

					<Button className="w-full" disabled={busy} size="lg" type="submit">
						{busy ? "Ingresando…" : "Ingresar"}
					</Button>
				</form>

				<div className="space-y-1 rounded-lg bg-muted px-4 py-3 text-muted-foreground text-xs">
					<p className="font-medium text-foreground">Acceso de demostración</p>
					<p>Administrador: 1000000001 · PIN 1234</p>
					<p>Bodega: 1000000002 · PIN 2345</p>
				</div>

				<a
					className="block text-center text-muted-foreground text-xs underline-offset-4 hover:underline"
					href="#/plataforma"
				>
					Soy el operador de RutaScan (panel de plataforma)
				</a>
			</div>
		</div>
	);
}
