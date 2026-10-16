import { toast } from "sonner";

export function errorMessage(err: unknown): string {
	if (err instanceof Error && err.message) return err.message;
	return "Ocurrió un error inesperado";
}

/**
 * Runs an async action, showing a toast on failure (and optionally on success).
 * Returns true when the action completed without throwing.
 */
export async function run<T>(
	action: () => Promise<T>,
	successMessage?: string,
): Promise<boolean> {
	try {
		await action();
		if (successMessage) toast.success(successMessage);
		return true;
	} catch (err) {
		toast.error(errorMessage(err));
		return false;
	}
}
