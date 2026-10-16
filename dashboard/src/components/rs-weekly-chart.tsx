import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { DashboardCard } from "@/components/dashboard-card";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import type { DashboardSummary } from "@/lib/api";
import { formatDayMonth } from "@/lib/format";

const chartConfig = {
	DELIVER: { label: "Entregas", color: "#10b981" },
	REJECT: { label: "Rechazos", color: "#f43f5e" },
	LOAD: { label: "Cargas", color: "#94a3b8" },
} satisfies ChartConfig;

function weekTotal(row: { DELIVER: number; REJECT: number; LOAD: number }) {
	return row.DELIVER + row.REJECT + row.LOAD;
}

function growthPct(rows: DashboardSummary["weekly"]) {
	const first = rows[0];
	const last = rows.at(-1);
	if (!first || !last) return 0;
	const a = weekTotal(first);
	if (!a) return 0;
	return ((weekTotal(last) - a) / a) * 100;
}

export function RsWeeklyChart({ summary }: { summary: DashboardSummary }) {
	const data = summary.weekly.map((row) => ({ ...row }));
	const growth = growthPct(summary.weekly);

	return (
		<DashboardCard className="gap-0 md:col-span-2">
			<CardHeader>
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle>Actividad de escaneos</CardTitle>
					<Delta value={Number(growth.toFixed(1))} variant="badge">
						<DeltaIcon variant="trend" />
						<DeltaValue />
					</Delta>
				</div>
				<CardDescription>
					Entregas, rechazos y cargas por día en los últimos 7 días.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer className="aspect-auto h-60 w-full md:h-80" config={chartConfig}>
					<BarChart accessibilityLayer data={data}>
						<CartesianGrid className="stroke-border" vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="date"
							interval={0}
							tickFormatter={(value) => formatDayMonth(String(value))}
							tickLine={false}
							tickMargin={10}
						/>
						<ChartTooltip content={<ChartTooltipContent />} cursor={false} />
						<Bar dataKey="DELIVER" fill="var(--color-DELIVER)" radius={[3, 3, 0, 0]} stackId="a" />
						<Bar dataKey="REJECT" fill="var(--color-REJECT)" stackId="a" />
						<Bar dataKey="LOAD" fill="var(--color-LOAD)" radius={[3, 3, 0, 0]} stackId="a" />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</DashboardCard>
	);
}
