import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LoginForm } from "@/components/login-form";
import { RsDashboard } from "@/components/rs-dashboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { CLASSIC_PANEL_URL } from "@/lib/links";

const IMPLEMENTED = new Set(["", "#", "#/", "#/dashboard"]);

function App() {
	const { logged } = useAuth();

	if (!logged) {
		return (
			<TooltipProvider>
				<LoginForm />
			</TooltipProvider>
		);
	}

	return (
		<TooltipProvider>
			<AppShell>
				<Router />
			</AppShell>
		</TooltipProvider>
	);
}

function Router() {
	const [hash, setHash] = useState(() => window.location.hash || "#/");

	useEffect(() => {
		const onChange = () => setHash(window.location.hash || "#/");
		window.addEventListener("hashchange", onChange);
		return () => window.removeEventListener("hashchange", onChange);
	}, []);

	if (IMPLEMENTED.has(hash)) {
		return <RsDashboard />;
	}

	return <ComingSoon hash={hash} />;
}

function ComingSoon({ hash }: { hash: string }) {
	const title = hash.replace(/^#\/?/, "").replace(/-/g, " ") || "Sección";

	return (
		<div className="flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-20 text-center">
			<h1 className="font-heading font-semibold text-xl capitalize">{title}</h1>
			<p className="mt-2 max-w-md text-muted-foreground text-sm">
				Esta sección todavía no está en el panel nuevo. Por ahora puede usarla en el
				panel clásico.
			</p>
			<a
				className="mt-6 text-primary text-sm underline underline-offset-4"
				href={CLASSIC_PANEL_URL}
			>
				Abrir el panel clásico
			</a>
		</div>
	);
}

export default App;
