"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangePinDialog } from "@/components/change-pin-dialog";
import { useAuth } from "@/lib/auth";
import { KeyRoundIcon, LogOutIcon } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
	ADMIN: "Administrador",
	WAREHOUSE: "Bodega",
	DRIVER: "Conductor",
};

export function NavUser() {
	const { user, signOut } = useAuth();
	const [pinOpen, setPinOpen] = useState(false);

	const name = user?.full_name ?? "Usuario";
	const initials = name
		.split(" ")
		.slice(0, 2)
		.map((part) => part.charAt(0))
		.join("")
		.toUpperCase();

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Avatar className="size-8 cursor-pointer">
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-60">
					<DropdownMenuGroup>
						<DropdownMenuLabel className="pointer-events-none flex items-center gap-2">
							<Avatar className="isolate size-8">
								<AvatarFallback>{initials}</AvatarFallback>
							</Avatar>
							<div className="min-w-0">
								<span className="font-medium text-foreground">{name}</span>
								<div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground text-xs">
									{ROLE_LABEL[user?.role ?? ""] ?? user?.role} · {user?.user_cedula}
								</div>
							</div>
						</DropdownMenuLabel>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem onClick={() => setPinOpen(true)}>
							<KeyRoundIcon />
							Cambiar PIN
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem onClick={() => void signOut()} variant="destructive">
							<LogOutIcon />
							Cerrar sesión
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			<ChangePinDialog onOpenChange={setPinOpen} open={pinOpen} />
		</>
	);
}
