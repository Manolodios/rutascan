import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { LoginForm } from "@/components/login-form";
import { RsDashboard } from "@/components/rs-dashboard";
import { LicenseView } from "@/components/views/license-view";
import { ProductsView } from "@/components/views/products-view";
import { ReportsView } from "@/components/views/reports-view";
import { RoutesView } from "@/components/views/routes-view";
import { SecurityView } from "@/components/views/security-view";
import { TrucksView } from "@/components/views/trucks-view";
import { UsersView } from "@/components/views/users-view";
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
	"#/rutas": { title: "Rutas", render: () => <RoutesView /> },
	"#/productos": { title: "Productos", render: () => <ProductsView /> },
	"#/camiones": { title: "Camiones", render: () => <TrucksView /> },
	"#/usuarios": { title: "Usuarios", adminOnly: true, render: () => <UsersView /> },
	"#/reportes": { title: "Reportes", render: () => <ReportsView /> },
	"#/seguridad": { title: "Seguridad", render: () => <SecurityView /> },
	"#/licencia": { title: "Licencia", adminOnly: true, render: () => <LicenseView /> },
};

function App() {
	const { logged } = useAuth();

	return (
		<>
			<TooltipProvider>
				{logged ? (
					<AppShell>
						<Router />
					</AppShell>
				) : (
					<LoginForm />
				)}
			</TooltipProvider>
			<Toaster position="top-right" richColors />
		</>
	);
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
