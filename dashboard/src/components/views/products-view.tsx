import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	DownloadIcon,
	PlusIcon,
	PrinterIcon,
	QrCodeIcon,
	UploadIcon,
} from "lucide-react";
import { DataCard, PageHeader } from "@/components/page-header";
import { PaginationFooter } from "@/components/pagination-footer";
import { ActiveBadge } from "@/components/views/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	api,
	downloadFile,
	openBlobInTab,
	type ImportResult,
	type ProductOut,
} from "@/lib/api";
import { formatDateTime, formatInteger } from "@/lib/format";
import { errorMessage } from "@/lib/mutate";
import { useAsyncData } from "@/lib/use-async";

const PAGE_SIZE = 50;

export function ProductsView() {
	const [query, setQuery] = useState("");
	const [term, setTerm] = useState("");
	const [page, setPage] = useState(0);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [copies, setCopies] = useState("1");
	const [editing, setEditing] = useState<ProductOut | null>(null);
	const [editorOpen, setEditorOpen] = useState(false);
	const [importing, setImporting] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const timer = setTimeout(() => {
			setTerm(query.trim());
			setPage(0);
		}, 280);
		return () => clearTimeout(timer);
	}, [query]);

	const state = useAsyncData<ProductOut[]>(
		() =>
			api<ProductOut[]>(
				`/api/v1/admin/products?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}${
					term ? `&q=${encodeURIComponent(term)}` : ""
				}`,
			),
		[term, page],
	);

	const products = state.data ?? [];
	const allSelected = products.length > 0 && products.every((p) => selected.has(p.id));

	function toggle(id: string, checked: boolean) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	}

	async function importFile(file: File) {
		setImporting(true);
		try {
			const form = new FormData();
			form.append("file", file);
			const result = await api<ImportResult>("/api/v1/admin/products/import", {
				method: "POST",
				form,
			});
			toast.success(
				`Importados: ${result.created} nuevos, ${result.updated} actualizados (${result.total_rows} filas).`,
			);
			state.reload();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setImporting(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	async function downloadTemplate() {
		try {
			const name = await downloadFile(
				"/api/v1/admin/products/template.csv",
				"rutascan_productos_plantilla.csv",
			);
			toast.success(`Descargado: ${name}`);
		} catch (err) {
			toast.error(errorMessage(err));
		}
	}

	async function downloadQrSheet() {
		const count = Math.max(1, Math.min(20, Number.parseInt(copies, 10) || 1));
		const params = new URLSearchParams({ copies: String(count) });
		const ids = Array.from(selected);
		if (ids.length) params.set("ids", ids.join(","));
		try {
			toast.info("Generando PDF de etiquetas…");
			const name = await downloadFile(
				`/api/v1/admin/products/qr-sheet.pdf?${params}`,
				"rutascan_etiquetas_qr.pdf",
			);
			toast.success(`Descargado: ${name}`);
		} catch (err) {
			toast.error(errorMessage(err));
		}
	}

	async function showQr(id: string) {
		try {
			await openBlobInTab(`/api/v1/admin/products/${id}/qr.png`);
		} catch (err) {
			toast.error(errorMessage(err));
		}
	}

	return (
		<div className="space-y-4">
			<PageHeader
				description={
					state.loading && !state.data
						? "Cargando catálogo…"
						: `Página ${page + 1} · ${formatInteger(products.length)} producto(s)${
								selected.size ? ` · ${selected.size} seleccionado(s)` : ""
							}`
				}
				title="Productos"
			>
				<Button
					onClick={() => {
						setEditing(null);
						setEditorOpen(true);
					}}
				>
					<PlusIcon /> Nuevo producto
				</Button>
			</PageHeader>

			<div className="flex flex-wrap items-end gap-2">
				<div className="grid min-w-[220px] flex-1 gap-1.5">
					<Label className="text-muted-foreground text-xs" htmlFor="p-search">
						Buscar
					</Label>
					<Input
						id="p-search"
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Código o descripción…"
						value={query}
					/>
				</div>

				<input
					accept=".csv,.xlsx,.xlsm"
					className="hidden"
					onChange={(event) => {
						const file = event.target.files?.[0];
						if (file) void importFile(file);
					}}
					ref={fileRef}
					type="file"
				/>
				<Button
					disabled={importing}
					onClick={() => fileRef.current?.click()}
					variant="outline"
				>
					<UploadIcon /> {importing ? "Importando…" : "Importar CSV/Excel"}
				</Button>
				<Button onClick={() => void downloadTemplate()} variant="outline">
					<DownloadIcon /> Plantilla CSV
				</Button>

				<div className="flex items-end gap-2 rounded-lg border px-3 py-2">
					<div className="grid w-24 gap-1.5">
						<Label className="text-muted-foreground text-xs" htmlFor="p-copies">
							Copias
						</Label>
						<Input
							id="p-copies"
							max={20}
							min={1}
							onChange={(event) => setCopies(event.target.value)}
							type="number"
							value={copies}
						/>
					</div>
					<Button onClick={() => void downloadQrSheet()} variant="secondary">
						<PrinterIcon /> PDF etiquetas QR
					</Button>
				</div>
			</div>

			{state.error ? (
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm">
					{state.error}
				</div>
			) : null}

			<DataCard>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-10 ps-4">
								<Checkbox
									aria-label="Seleccionar todos"
									checked={allSelected}
									onCheckedChange={(checked) => {
										setSelected((prev) => {
											const next = new Set(prev);
											for (const product of products) {
												if (checked === true) next.add(product.id);
												else next.delete(product.id);
											}
											return next;
										});
									}}
								/>
							</TableHead>
							<TableHead>Código</TableHead>
							<TableHead>Descripción</TableHead>
							<TableHead>Unidad</TableHead>
							<TableHead className="text-right">Peso</TableHead>
							<TableHead>Estado</TableHead>
							<TableHead>Creado</TableHead>
							<TableHead className="pe-4 text-right">Acciones</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{state.loading && !state.data ? (
							Array.from({ length: 5 }).map((_, index) => (
								<TableRow key={`product-skeleton-${index}`}>
									<TableCell colSpan={8}>
										<Skeleton className="h-6 w-full" />
									</TableCell>
								</TableRow>
							))
						) : products.length === 0 ? (
							<TableRow>
								<TableCell
									className="py-10 text-center text-muted-foreground"
									colSpan={8}
								>
									{page > 0
										? `No hay más productos en la página ${page + 1}. Vuelve a la página anterior.`
										: term
											? `Sin resultados para “${term}”.`
											: "Sin productos en el catálogo."}
								</TableCell>
							</TableRow>
						) : (
							products.map((product) => (
								<TableRow key={product.id}>
									<TableCell className="ps-4">
										<Checkbox
											aria-label={`Seleccionar ${product.description}`}
											checked={selected.has(product.id)}
											onCheckedChange={(checked) =>
												toggle(product.id, checked === true)
											}
										/>
									</TableCell>
									<TableCell className="font-mono text-xs">
										{product.barcode_qr}
									</TableCell>
									<TableCell className="font-medium">
										{product.description}
									</TableCell>
									<TableCell>{product.unit}</TableCell>
									<TableCell className="text-right tabular-nums">
										{product.weight} kg
									</TableCell>
									<TableCell>
										<ActiveBadge active={product.is_active} />
									</TableCell>
									<TableCell className="text-muted-foreground text-xs">
										{formatDateTime(product.created_at)}
									</TableCell>
									<TableCell className="pe-4 text-right">
										<div className="flex justify-end gap-1">
											<Button
												onClick={() => {
													setEditing(product);
													setEditorOpen(true);
												}}
												size="sm"
												variant="ghost"
											>
												Editar
											</Button>
											<Button
												aria-label="Ver código QR"
												onClick={() => void showQr(product.id)}
												size="icon-sm"
												variant="ghost"
											>
												<QrCodeIcon />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
				<PaginationFooter
					count={products.length}
					noun="producto(s)"
					onNext={() => setPage((value) => value + 1)}
					onPrevious={() => setPage((value) => Math.max(0, value - 1))}
					page={page}
					pageSize={PAGE_SIZE}
				/>
			</DataCard>

			<ProductEditorDialog
				onOpenChange={setEditorOpen}
				onSaved={state.reload}
				open={editorOpen}
				product={editing}
			/>
		</div>
	);
}

function ProductEditorDialog({
	open,
	onOpenChange,
	product,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	product: ProductOut | null;
	onSaved: () => void;
}) {
	const isNew = !product;
	const [barcode, setBarcode] = useState("");
	const [description, setDescription] = useState("");
	const [unit, setUnit] = useState("UNIT");
	const [weight, setWeight] = useState("0");
	const [active, setActive] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		setBarcode(product?.barcode_qr ?? "");
		setDescription(product?.description ?? "");
		setUnit(product?.unit ?? "UNIT");
		setWeight(String(product?.weight ?? 0));
		setActive(product?.is_active ?? true);
	}, [open, product]);

	async function submit() {
		const payload = {
			barcode_qr: barcode.trim(),
			description: description.trim(),
			unit: unit.trim() || "UNIT",
			weight: Number.parseFloat(weight || "0"),
		};
		if (!payload.barcode_qr || !payload.description) {
			toast.error("Código y descripción son obligatorios");
			return;
		}
		setSaving(true);
		try {
			if (isNew) {
				await api("/api/v1/admin/products", { method: "POST", body: payload });
				toast.success("Producto creado");
			} else {
				await api(`/api/v1/admin/products/${product.id}`, {
					method: "PATCH",
					body: { ...payload, is_active: active },
				});
				toast.success("Producto actualizado");
			}
			onOpenChange(false);
			onSaved();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>{isNew ? "Nuevo producto" : "Editar producto"}</DialogTitle>
					<DialogDescription>
						El código se usa para generar la etiqueta QR que escanea el conductor.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-1.5">
						<Label htmlFor="f-barcode">Código / QR *</Label>
						<Input
							className="font-mono"
							id="f-barcode"
							onChange={(event) => setBarcode(event.target.value)}
							placeholder="7592001000019"
							value={barcode}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="f-unit">Unidad</Label>
						<Input
							id="f-unit"
							onChange={(event) => setUnit(event.target.value)}
							placeholder="UNIT / BOX / PACK"
							value={unit}
						/>
					</div>
					<div className="grid gap-1.5 sm:col-span-2">
						<Label htmlFor="f-desc">Descripción *</Label>
						<Input
							id="f-desc"
							onChange={(event) => setDescription(event.target.value)}
							placeholder="Caja de leche 1L x12"
							value={description}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="f-weight">Peso (kg)</Label>
						<Input
							id="f-weight"
							min={0}
							onChange={(event) => setWeight(event.target.value)}
							step="0.001"
							type="number"
							value={weight}
						/>
					</div>
					{isNew ? null : (
						<div className="flex items-end">
							<label className="flex items-center gap-2 text-sm">
								<Checkbox
									checked={active}
									onCheckedChange={(checked) => setActive(checked === true)}
								/>
								Activo
							</label>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancelar
					</Button>
					<Button disabled={saving} onClick={() => void submit()}>
						{saving ? "Guardando…" : isNew ? "Crear producto" : "Guardar cambios"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
