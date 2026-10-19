import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

/** WhatsApp del proveedor (el mismo número del botón de prueba del login). */
const WHATSAPP_NUMBER = "584121640277";
const WHATSAPP_MESSAGE = encodeURIComponent(
	"Hola, mi licencia de RutaScan aparece vencida o suspendida y necesito reactivarla.",
);

/**
 * Aviso cuando el backend responde 402 por licencia vencida o suspendida.
 * `toApiError` lo dispara con el evento "rutascan:license-blocked".
 */
export function LicenseBlockedNotice() {
	const [blocked, setBlocked] = useState(false);

	useEffect(() => {
		const show = () => setBlocked(true);
		window.addEventListener("rutascan:license-blocked", show);
		return () => window.removeEventListener("rutascan:license-blocked", show);
	}, []);

	if (!blocked) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Licencia vencida o suspendida</CardTitle>
					<CardDescription>
						El panel quedó en pausa. Los datos y las rutas siguen guardados: no se borró nada.
					</CardDescription>
				</CardHeader>
				<CardContent className="text-muted-foreground text-sm">
					Para reactivar el servicio, escribe al proveedor y te devolvemos el acceso en minutos.
				</CardContent>
				<CardFooter className="flex flex-wrap gap-2">
					<Button asChild>
						<a
							href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
							rel="noreferrer"
							target="_blank"
						>
							Escribir por WhatsApp
						</a>
					</Button>
					<Button
						onClick={() => {
							window.location.hash = "#/licencia";
							setBlocked(false);
						}}
						variant="outline"
					>
						Ver mi licencia
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
