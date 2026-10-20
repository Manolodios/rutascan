import { RouteIcon, TruckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DriverTruck } from "@/lib/api";

/** Friendly empty state when the driver has no route for the day. */
export function NoRouteToday({
	truck,
	message,
}: {
	truck: DriverTruck | null;
	message?: string | null;
}) {
	return (
		<Card className="mt-6 flex flex-col items-center gap-3 px-6 py-14 text-center">
			<div className="rounded-full bg-muted p-3 text-muted-foreground">
				<RouteIcon className="size-6" />
			</div>
			<h2 className="font-heading font-semibold text-lg">Hoy no tienes ruta asignada</h2>
			<p className="max-w-md text-muted-foreground text-sm">
				{message ?? "Cuando tu central te asigne una ruta, aparecerá aquí automáticamente."}
			</p>
			{truck ? (
				<p className="flex items-center gap-1.5 text-muted-foreground text-xs">
					<TruckIcon className="size-3.5" />
					Camión asignado: {truck.license_plate}
					{truck.model ? ` · ${truck.model}` : ""}
				</p>
			) : null}
			<Button asChild className="mt-2" variant="outline">
				<a href="#/mi-historial">Ver mi historial</a>
			</Button>
		</Card>
	);
}
