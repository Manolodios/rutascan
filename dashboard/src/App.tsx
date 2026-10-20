import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { LoginForm } from "@/components/login-form";
import { PlatformApp } from "@/components/platform/platform-app";
import { RsDashboard } from "@/components/rs-dashboard";
import { LicenseView } from "@/components/views/license-view";
import { LicenseBlockedNotice } from "@/components/license-blocked-notice";
import { MapView } from "@/components/views/map-view";
import { ProductsView } from "@/components/views/products-view";
import { ReportsView } from "@/components/views/reports-view";
import { RoutesView } from "@/components/views/routes-view";
import { SecurityView } from "@/components/views/security-view";
import { TrucksView } from "@/components/views/trucks-view";
import { UsersView } from "@/components/views/users-view";
import { DriverHistoryView } from "@/components/driver/driver-history-view";
import { DriverRouteView } from "@/components/driver/driver-route-view";
import { DriverTodayView } from "@/components/driver/driver-today-view";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useHash } from "@/lib/use-hash";

type Route = {
	title: string;
	adminOnly?: boolean;
	render: () => React.ReactNode;
};

const ROUTES: Record<string, Route> = {
	"#/": { title: "Panel", render: () => <RsDashboard /> },
	"#/mapa": { title: "Mapa en vivo", render: () => <MapView /> },
	"#/rutas": { title: "Rutas", render: () => <RoutesView /> },
	"#/productos": { title: "Productos", render: () => <ProductsView /> },
	"#/camiones": { title: "Camiones", render: () => <TrucksView /> },
	"#/usuarios": { title: "Usuarios", adminOnly: true, render: () => <UsersView /> },
	"#/reportes": { title: "Reportes", render: () => <ReportsView /> },
	"#/seguridad": { title: "Seguridad", render: () => <SecurityView /> },
	"#/licencia": { title: "Licencia", adminOnly: true, render: () => <LicenseView /> },
};

/** Hash of the SaaS-operator panel, which uses its own key (not a company login). */
const PLATFORM_HASH = "#/plataforma";

/** Drivers get their own workspace: their day, their route and their history. */
const DRIVER_ROUTES: Record<string, Route> = {
	"#/": { title: "Mi jornada", render: () => <DriverTodayView /> },
	"#/mi-ruta": { title: "Mi ruta", render: () => <DriverRouteView /> },
	"#/mi-historial": { title: "Mi historial", render: () => <DriverHistoryView /> },
};

function App() {
	const { logged, user } = useAuth();
	const hash = useHash();
	// The SaaS-operator panel is not part of the driver's workspace.
	const platformMode = hash === PLATFORM_HASH && user?.role !== "DRIVER";

	return (
		<>
			<TooltipProvider>
				{platformMode ? (
					<PlatformApp />
				) : logged ? (
					<AppShell>
						{user?.role === "DRIVER" ? <DriverRouter /> : <Router />}
					</AppShell>
				) : (
					<LoginForm />
				)}
			</TooltipProvider>
			<LicenseBlockedNotice />
			<Toaster position="top-right" richColors />
		</>
	);
}

function DriverRouter() {
	const hash = useHash();
	const path = hash.split("?")[0];
	const route = DRIVER_ROUTES[path];

	useEffect(() => {
		if (!route) window.location.hash = "#/";
	}, [route]);

	return (route ?? DRIVER_ROUTES["#/"]).render();
}

function Router() {
	const hash = useHash();
	const { user } = useAuth();
	const route = ROUTES[hash];
	const blocked = Boolean(route?.adminOnly) && user?.role !== "ADMIN";

	useEffect(() => {
		if (blocked) {
			toast.error("No tiene permisos para ese módulo.");
			window.location.hash = "#/";
		}
	}, [blocked]);

	if (blocked) return <RsDashboard />;
	if (!route) return <NotFound hash={hash} />;
	return route.render();
}

function NotFound({ hash }: { hash: string }) {
	return (
		<div className="flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-20 text-center">
			<h1 className="font-heading font-semibold text-xl">Sección no encontrada</h1>
			<p className="mt-2 max-w-md text-muted-foreground text-sm">
				La dirección <code className="font-mono">{hash}</code> no existe en el panel.
			</p>
			<a
				className="mt-6 text-primary text-sm underline underline-offset-4"
				href="#/"
			>
				Volver al panel
			</a>
		</div>
	);
}

export default App;
