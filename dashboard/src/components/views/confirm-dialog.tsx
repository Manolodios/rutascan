import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { errorMessage } from "@/lib/mutate";

export function ConfirmDialog({
	trigger,
	title,
	description,
	confirmText = "Confirmar",
	cancelText = "Cancelar",
	danger = false,
	onConfirm,
}: {
	trigger: ReactNode;
	title: string;
	description: ReactNode;
	confirmText?: string;
	cancelText?: string;
	danger?: boolean;
	onConfirm: () => Promise<void> | void;
}) {
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);

	return (
		<AlertDialog onOpenChange={setOpen} open={open}>
			<AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
			<AlertDialogContent className="sm:max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription className="text-start">
						{description}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>{cancelText}</AlertDialogCancel>
					<AlertDialogAction
						disabled={busy}
						onClick={async (event) => {
							// Keep the dialog open while the request runs.
							event.preventDefault();
							setBusy(true);
							try {
								await onConfirm();
								setOpen(false);
							} catch (err) {
								toast.error(errorMessage(err));
							} finally {
								setBusy(false);
							}
						}}
						variant={danger ? "destructive" : "default"}
					>
						{busy ? "Procesando…" : confirmText}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
