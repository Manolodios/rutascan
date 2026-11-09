import { useCallback, useState } from "react";
import {
	ArrowRightIcon,
	CheckIcon,
	PackageIcon,
	RouteIcon,
	TruckIcon,
	UsersIcon,
	XIcon,
	type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DashboardSummary } from "@/lib/api";
import { formatInteger } from "@/lib/format";

type Setup = DashboardSummary["setup"];
type SetupKey = Exclude<keyof Setup, "complete">;

type Step = {
	key: SetupKey;
	title: string;
	detail: string;
	href: string;
	icon: LucideIcon;
	doneLabel: string;
};

const STEPS: Step[] = [
	{
		key: "trucks",
		title: "Registra tu primer camión",
		detail: "La unidad que saldrá a repartir.",
		href: "#/camiones",
		icon: TruckIcon,
		doneLabel: "camión(es) activo(s)",
	},
	{
		key: "products",
		title: "Carga tu catálogo",
		detail: "Productos y códigos QR.",
		href: "#/productos",
		icon: PackageIcon,
		doneLabel: "producto(s) activo(s)",
	},
	{
		key: "team",
		title: "Suma a tu equipo",
		detail: "Bodega y conductores.",
		href: "#/usuarios",
		icon: UsersIcon,
		doneLabel: "persona(s) en el equipo",
	},
	{
		key: "routes",
		title: "Arma tu primera ruta",
		detail: "Asigna camión y manifiesto.",
		href: "#/rutas",
		icon: RouteIcon,
		doneLabel: "ruta(s) creada(s)",
	},
];

function hiddenKey(companyId: string | null): string | null {
	return companyId ? `rutascan.setup.hidden.${companyId}` : null;
}

function isHidden(companyId: string | null): boolean {
	const key = hiddenKey(companyId);
	if (!key) return false;
	try {
		return window.localStorage.getItem(key) === "1";
	} catch {
		return false;
	}
}

/**
 * First-run checklist. Only rendered for admins with an incomplete setup.
 * The "hide" choice is stored per company so it survives reloads and logins.
 */
export function OnboardingCard({
	setup,
	companyId,
}: {
	setup: Setup;
	companyId: string | null;
}) {
	const [hidden, setHidden] = useState(() => isHidden(companyId));

	const hide = useCallback(() => {
		const key = hiddenKey(companyId);
		if (key) {
			try {
				window.localStorage.setItem(key, "1");
			} catch {
				/* private mode: hide for this session only */
			}
		}
		setHidden(true);
	}, [companyId]);

	if (hidden || setup.complete) return null;

	const done = STEPS.filter((step) => setup[step.key] > 0).length;
	const progress = (done / STEPS.length) * 100;

	return (
		<Card className="gap-0 overflow-hidden border-0 bg-gradient-to-br from-primary/[0.08] via-card to-card py-0 ring-1 ring-primary/25">
			<div className="flex items-start justify-between gap-4 px-5 pt-4">
				<div>
					<p className="font-medium text-[11px] text-primary uppercase tracking-[0.18em]">
						Primeros pasos
					</p>
					<h2 className="mt-1 font-heading font-semibold text-lg">
						Deja la operación lista
					</h2>
					<p className="text-muted-foreground text-sm">
						Cuatro pasos para pasar de la configuración a tu primera ruta.
					</p>
				</div>
				<Button
					aria-label="Ocultar primeros pasos"
					onClick={hide}
					size="icon-sm"
					variant="ghost"
				>
					<XIcon />
				</Button>
			</div>

			<div className="px-5 py-4">
				<div className="flex items-center justify-between gap-2 text-xs">
					<span className="font-medium">
						{done} de {STEPS.length} completados
					</span>
					<span className="text-muted-foreground tabular-nums">
						{Math.round(progress)}%
					</span>
				</div>
				<Progress className="mt-2 h-1.5" value={progress} />

				<div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
					{STEPS.map((step) => {
						const complete = setup[step.key] > 0;
						const Icon = step.icon;
						return (
							<a
								className={cn(
									"group flex items-center gap-3 rounded-xl border bg-background/60 px-3 py-3 transition-colors",
									complete
										? "border-border/60 bg-muted/20"
										: "border-primary/20 hover:border-primary/50 hover:bg-primary/[0.04]",
								)}
								href={step.href}
								key={step.key}
							>
								<span
									className={cn(
										"flex size-9 shrink-0 items-center justify-center rounded-full",
										complete
											? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
											: "bg-primary/10 text-primary",
									)}
								>
									{complete ? (
										<CheckIcon className="size-4" />
									) : (
										<Icon className="size-4" />
									)}
								</span>
								<span className="min-w-0 flex-1">
									<span
										className={cn(
											"block truncate font-medium text-sm",
											complete && "text-muted-foreground",
										)}
									>
										{step.title}
									</span>
									<span className="block truncate text-muted-foreground text-xs">
										{complete
											? `${formatInteger(setup[step.key])} ${step.doneLabel}`
											: step.detail}
									</span>
								</span>
								{complete ? null : (
									<ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
								)}
							</a>
						);
					})}
				</div>
			</div>
		</Card>
	);
}
