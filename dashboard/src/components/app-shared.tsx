import type { ReactNode } from "react";
import {
	FileSpreadsheetIcon,
	KeyRoundIcon,
	LayoutGridIcon,
	PackageIcon,
	RouteIcon,
	ShieldAlertIcon,
	TruckIcon,
	UsersIcon,
} from "lucide-react";
import { CLASSIC_PANEL_URL } from "@/lib/links";

export type SidebarNavItem = {
	title: string;
	path?: string;
	icon?: ReactNode;
	isActive?: boolean;
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
			{ title: "Panel", path: "#/", icon: <LayoutGridIcon />, isActive: true },
			{ title: "Rutas", path: "#/rutas", icon: <RouteIcon /> },
			{ title: "Productos", path: "#/productos", icon: <PackageIcon /> },
			{ title: "Camiones", path: "#/camiones", icon: <TruckIcon /> },
		],
	},
	{
		label: "Administración",
		items: [
			{ title: "Usuarios", path: "#/usuarios", icon: <UsersIcon /> },
			{ title: "Reportes", path: "#/reportes", icon: <FileSpreadsheetIcon /> },
			{ title: "Seguridad", path: "#/seguridad", icon: <ShieldAlertIcon /> },
			{ title: "Licencia", path: "#/licencia", icon: <KeyRoundIcon /> },
		],
	},
];

export const footerNavLinks: SidebarNavItem[] = [
	{
		title: "Panel clásico",
		path: CLASSIC_PANEL_URL,
		icon: <LayoutGridIcon />,
	},
];

export const navLinks: SidebarNavItem[] = [
	...navGroups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item],
		),
	),
	...footerNavLinks,
];
