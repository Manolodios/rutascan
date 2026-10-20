import { DetailStatusBadge } from "@/components/views/status-badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { DriverManifestItem } from "@/lib/api";
import { formatDateTime, REJECTION_LABEL } from "@/lib/format";

/** Read-only manifest shared by "Mi ruta" and the history dialog. */
export function DriverManifestTable({ items }: { items: DriverManifestItem[] }) {
	if (items.length === 0) {
		return (
			<p className="px-4 py-10 text-center text-muted-foreground text-sm">
				Este manifiesto no tiene productos.
			</p>
		);
	}

	return (
		<div className="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Producto</TableHead>
						<TableHead className="text-right">Asignado</TableHead>
						<TableHead className="text-right">Entregado</TableHead>
						<TableHead>Estado</TableHead>
						<TableHead className="text-right">Último escaneo</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{items.map((item) => (
						<TableRow key={item.route_detail_id}>
							<TableCell>
								<div className="font-medium">{item.product.description}</div>
								<div className="font-mono text-muted-foreground text-xs">
									{item.product.barcode_qr}
								</div>
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{item.assigned_quantity}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{item.delivered_quantity}
							</TableCell>
							<TableCell>
								<DetailStatusBadge status={item.status} />
								{item.rejection_reason ? (
									<div className="mt-1 text-muted-foreground text-xs">
										{REJECTION_LABEL[item.rejection_reason] ?? item.rejection_reason}
									</div>
								) : null}
							</TableCell>
							<TableCell className="text-right text-muted-foreground text-xs">
								{formatDateTime(item.last_scan_at)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
