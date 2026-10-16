import type { ReactNode } from "react";
import {
	FileSpreadsheetIcon,
	KeyRoundIcon,
	LayoutGridIcon,
	MapPinIcon,
	PackageIcon,
	RouteIcon,
	ServerIcon,
	ShieldAlertIcon,
	TruckIcon,
	UsersIcon,
} from "lucide-react";

export type SidebarNavItem = {
	title: string;
	path?: string;
	icon?: ReactNode;
	isActive?: boolean;
	/** Visible only for the ADMIN role. */
	adminOnly?: boolean;
	subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
	label?: string;
	items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
	{
		label: "Operación",
		items: [
			{ title: "Panel", path: "#/", icon: <LayoutGridIcon /> },
			{ title: "Mapa en vivo", path: "#/mapa", icon: <MapPinIcon /> },
			{ title: "Rutas", path: "#/rutas", icon: <RouteIcon /> },
			{ title: "Productos", path: "#/productos", icon: <PackageIcon /> },
			{ title: "Camiones", path: "#/camiones", icon: <TruckIcon /> },
		],
	},
	{
		label: "Administración",
		items: [
			{ title: "Usuarios", path: "#/usuarios", icon: <UsersIcon />, adminOnly: true },
			{ title: "Reportes", path: "#/reportes", icon: <FileSpreadsheetIcon /> },
			{ title: "Seguridad", path: "#/seguridad", icon: <ShieldAlertIcon /> },
			{ title: "Licencia", path: "#/licencia", icon: <KeyRoundIcon />, adminOnly: true },
		],
	},
];

export const footerNavLinks: SidebarNavItem[] = [
	{
		title: "Panel de plataforma",
		path: "#/plataforma",
		icon: <ServerIcon />,
	},
];

function flatten(groups: SidebarNavGroup[]): SidebarNavItem[] {
	return groups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item],
		),
	);
}

/** Removes ADMIN-only entries and empty groups for the given role. */
export function filterNavGroups(role: string | undefined): SidebarNavGroup[] {
	return navGroups
		.map((group) => ({
			...group,
			items: group.items.filter((item) => !item.adminOnly || role === "ADMIN"),
		}))
		.filter((group) => group.items.length > 0);
}

/** Flat list of the links the given role can see (used by the header). */
export function visibleNavLinks(role: string | undefined): SidebarNavItem[] {
	return [...flatten(filterNavGroups(role)), ...footerNavLinks];
}
