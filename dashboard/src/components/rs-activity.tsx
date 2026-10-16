import type { ReactNode } from "react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCard } from "@/components/dashboard-card";
import type { ActivityRow } from "@/lib/api";
import { ACTION_LABEL, REJECTION_LABEL, formatFlags, formatRelative } from "@/lib/format";
import {
	CircleCheckIcon,
	PackageIcon,
	TruckIcon,
	XCircleIcon,
} from "lucide-react";

const ICONS: Record<string, ReactNode> = {
	DELIVER: <CircleCheckIcon />,
	REJECT: <XCircleIcon />,
	LOAD: <PackageIcon />,
};

export function RsActivity({ activity }: { activity: ActivityRow[] }) {
	const items = activity.slice(0, 6);

	return (
		<DashboardCard className="gap-0">
			<CardHeader className="border-b">
				<CardTitle>Actividad reciente</CardTitle>
				<CardDescription>Últimos escaneos registrados.</CardDescription>
			</CardHeader>
			<CardContent className="px-0">
				<ul className="flex flex-col divide-y divide-border">
					{items.map((row) => {
						const flags = formatFlags(row.flags);
						return (
							<li className="flex min-h-16 items-center gap-3 px-6 py-2" key={row.id}>
								<span
									aria-hidden="true"
									className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted [&_svg]:size-4"
								>
									{ICONS[row.action] ?? <TruckIcon />}
								</span>
								<div className="min-w-0 flex-1 space-y-0.5">
									<p className="line-clamp-1 text-sm leading-snug">
										<span className="font-medium">{ACTION_LABEL[row.action] ?? row.action}</span>{" "}
										<span className="text-muted-foreground">· {row.product}</span>
									</p>
									<p className="text-muted-foreground text-xs">
										{row.driver} · {formatRelative(row.at)}
										{row.offline ? " · offline" : ""}
										{row.rejection_reason
											? ` · ${REJECTION_LABEL[row.rejection_reason] ?? row.rejection_reason}`
											: ""}
									</p>
									{flags.length ? (
										<p className="font-medium text-amber-600 text-xs dark:text-amber-400">
											{flags.join(" · ")}
										</p>
									) : null}
								</div>
							</li>
						);
					})}
					{items.length === 0 ? (
						<li className="px-6 py-10 text-center text-muted-foreground text-sm">
							Sin actividad todavía.
						</li>
					) : null}
				</ul>
			</CardContent>
		</DashboardCard>
	);
}
