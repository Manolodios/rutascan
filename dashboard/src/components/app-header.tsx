import { useMemo } from "react";
import { Bell, Sun, Moon } from "lucide-react";
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
import { useDashboardData } from "@/lib/use-dashboard";
import { formatSecurityDetail, formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async";
import { api, type SecurityEventOut } from "@/lib/api";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


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
				<NotificationBell />
			</div>
		</header>
	);
}

function NotificationBell() {
  const { summary, reload: reloadDashboard } = useDashboardData();
  const eventsState = useAsyncData(
    () => api<SecurityEventOut[]>("/api/v1/admin/security-events?limit=5"),
    [],
  );
  const count = summary?.alerts?.security_events_24h ?? 0;
  const events = eventsState.data ?? [];
  const reload = () => { void reloadDashboard(); eventsState.reload(); };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Notificaciones" size="icon-sm" variant="outline" className="relative">
          <Bell className="size-4" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
              {count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Alertas recientes (24 h)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 && events.length === 0 ? (
          <DropdownMenuItem disabled>Sin alertas recientes.</DropdownMenuItem>
        ) : (
          events.map((event: SecurityEventOut, i: number) => (
            <DropdownMenuItem key={`${event.event_type}-${i}`} className="flex flex-col items-start gap-0.5 text-xs">
              <span className="font-medium">{event.event_type}</span>
              <span className="text-muted-foreground">{formatSecurityDetail(event.event_type, event.detail)}</span>
              <span className="text-[10px] text-muted-foreground">{formatDateTime(event.created_at)}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void reload()} className="text-muted-foreground text-xs">
          Actualizar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


