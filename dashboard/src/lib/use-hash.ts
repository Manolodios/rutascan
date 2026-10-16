import { useEffect, useState } from "react";

/** Current location hash, normalized so an empty hash means the dashboard. */
export function useHash(): string {
	const read = () => {
		const raw = window.location.hash;
		return raw === "" || raw === "#" ? "#/" : raw;
	};

	const [hash, setHash] = useState(read);

	useEffect(() => {
		const onChange = () => setHash(read());
		window.addEventListener("hashchange", onChange);
		return () => window.removeEventListener("hashchange", onChange);
	}, []);

	return hash;
}
