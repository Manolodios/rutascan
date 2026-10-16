import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> = {
	data: T | null;
	error: string | null;
	loading: boolean;
	/** Re-runs the loader (e.g. after a mutation). */
	reload: () => void;
};

/**
 * Loads data on mount and whenever `deps` change.
 * Keep `deps` the same length across renders (like a useEffect dep list).
 */
export function useAsyncData<T>(
	loader: () => Promise<T>,
	deps: unknown[] = [],
): AsyncState<T> {
	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [nonce, setNonce] = useState(0);

	const reload = useCallback(() => setNonce((value) => value + 1), []);

	useEffect(() => {
		let alive = true;
		setLoading(true);
		loader()
			.then((value) => {
				if (!alive) return;
				setData(value);
				setError(null);
			})
			.catch((err: unknown) => {
				if (!alive) return;
				setError(err instanceof Error ? err.message : "Error al cargar los datos");
			})
			.finally(() => {
				if (alive) setLoading(false);
			});
		return () => {
			alive = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [...deps, nonce]);

	return { data, error, loading, reload };
}
