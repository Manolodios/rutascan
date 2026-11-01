import type React from "react";

/** Brand red: matches the landing MagnetLines and editorial dark style. */
export const BRAND_BLUE = "#dc2626";

/**
 * RutaScan symbol: a cargo truck outline in `currentColor`.
 * Used where the wordmark does not fit (collapsed sidebar) and as a mark
 * next to the brand name.
 */
export const LogoIcon = (props: React.ComponentProps<"svg">) => (
	<svg
		aria-hidden="true"
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth={2}
		viewBox="0 0 24 24"
		{...props}
	>
		<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
		<path d="M15 18H9" />
		<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
		<circle cx="17" cy="18" r="2" />
		<circle cx="7" cy="18" r="2" />
	</svg>
);

/**
 * RutaScan wordmark: the truck mark plus "Ruta" in the current text colour and
 * "Scan" in brand blue. Size it with font-size utilities (e.g. `text-2xl`).
 */
export function Logo({ className }: { className?: string }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 font-heading font-extrabold tracking-tight ${className ?? ""}`}
		>
			<LogoIcon className="shrink-0" style={{ width: "1.05em", height: "1.05em" }} />
			<span>
				Ruta<span style={{ color: BRAND_BLUE }}>Scan</span>
			</span>
		</span>
	);
}
