/**
 * Panel URLs.
 * - Dev (`npm run dev`): the React app runs on its own Vite server (5173) and the
 *   classic panel is served by the backend (8000).
 * - Deploy (`npm run build:web`): the backend serves this app at /app/ and the
 *   classic panel at /, so both live on the same origin.
 */
const DEPLOYED = import.meta.env.MODE === "deploy";

export const CLASSIC_PANEL_URL = DEPLOYED ? "/" : "http://127.0.0.1:8000/";
export const NEW_PANEL_URL = DEPLOYED ? "/app/" : "http://localhost:5173/";
