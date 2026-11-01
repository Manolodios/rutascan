import { useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, SESSION_EXPIRED_FLAG } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Alta de clientes: el prospecto escribe por WhatsApp y se le crea su empresa. */
const WHATSAPP_NUMBER = "584121640277";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
	"Hola, vi RutaScan y quiero probar 30 días con mis camiones.",
)}`;

export function LoginForm() {
	const { signIn } = useAuth();
	const [cedula, setCedula] = useState("");
	const [pin, setPin] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		try {
			if (sessionStorage.getItem(SESSION_EXPIRED_FLAG)) {
				sessionStorage.removeItem(SESSION_EXPIRED_FLAG);
				setNotice("Su sesión expiró por seguridad. Vuelva a iniciar sesión.");
			}
		} catch {
			/* storage no disponible */
		}
	}, []);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await signIn(cedula.trim(), pin.trim());
			// Reset hash to dashboard on successful login
			window.location.hash = "#/";
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
							placeholder="Ej. 12345678"
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

					{notice ? (
						<p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-amber-900 text-sm dark:bg-amber-950/30 dark:text-amber-200">
							{notice}
						</p>
					) : null}

					{error ? (
						<p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
							{error}
						</p>
					) : null}

					<Button className="w-full" disabled={busy} size="lg" type="submit">
						{busy ? "Ingresando…" : "Ingresar"}
					</Button>
				</form>

				<div className="rounded-lg border border-dashed px-4 py-3 text-center text-xs">
					<p className="font-medium text-foreground">¿Todavía no tiene cuenta?</p>
					<p className="mt-1 text-muted-foreground">
						Cada empresa entra con su propia licencia. Escríbame y le activo{" "}
						<b className="text-foreground">30 días de prueba</b>.
					</p>
					<a
						className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
						href={WHATSAPP_URL}
						rel="noreferrer"
						target="_blank"
					>
						Pedir prueba por WhatsApp
					</a>
				</div>
			</div>
		</div>
	);
}
