import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import {
	getSession,
	isLogged as readIsLogged,
	login as apiLogin,
	logout as apiLogout,
	type Session,
	type SessionUser,
} from "@/lib/api";

type AuthContextValue = {
	session: Session | null;
	user: SessionUser | null;
	logged: boolean;
	signIn: (cedula: string, pin: string) => Promise<void>;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(() =>
		readIsLogged() ? getSession() : null,
	);

	// A failed token refresh clears the session inside the API client.
	useEffect(() => {
		const sync = () => setSession(readIsLogged() ? getSession() : null);
		window.addEventListener("rutascan:session-lost", sync);
		return () => window.removeEventListener("rutascan:session-lost", sync);
	}, []);

	const signIn = useCallback(async (cedula: string, pin: string) => {
		const data = await apiLogin(cedula, pin);
		setSession(data);
	}, []);

	const signOut = useCallback(async () => {
		await apiLogout();
		setSession(null);
	}, []);

	const value = useMemo<AuthContextValue>(
		() => ({
			session,
			user: session?.user ?? null,
			logged: Boolean(session?.access_token && session?.user),
			signIn,
			signOut,
		}),
		[session, signIn, signOut],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
	return ctx;
}
