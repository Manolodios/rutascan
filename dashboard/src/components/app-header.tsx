import { useMemo } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DecorIcon } from "@/components/decor-icon";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { visibleNavLinks } from "@/components/app-shared";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { NavUser } from "@/components/nav-user";
import { useAuth } from "@/lib/auth";
import { useHash } from "@/lib/use-hash";

export function AppHeader() {
	const { user } = useAuth();
	const hash = useHash();
	const path = hash.split("?")[0];

	const activeItem = useMemo(
		() => visibleNavLinks(user?.role).find((item) => item.path === path) ?? null,
		[path, user?.role],
	);

	return (
		<header
			className={cn(
				"sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6",
				"bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50"
			)}
		>
			<DecorIcon className="hidden md:block" position="bottom-left" />
			<div className="flex items-center gap-3">
				<CustomSidebarTrigger />
				<Separator
					className="mr-2 h-4 data-[orientation=vertical]:self-center"
					orientation="vertical"
				/>
				<AppBreadcrumbs page={activeItem} />
			</div>
			<div className="flex items-center gap-3">
				<NavUser />
				<Button
					aria-label="Alternar modo oscuro"
					onClick={() => {
						const isDark = document.documentElement.classList.toggle("dark");
						try { localStorage.setItem("rutascan.theme", isDark ? "dark" : "light"); } catch { /* no-op */ }
					}}
					size="icon-sm"
					variant="outline"
				>
					<Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
					<Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
				</Button>
			</div>
		</header>
	);
}
