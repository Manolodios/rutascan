import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RutaScan — La ruta sigue, con o sin señal",
  description: "Control de rutas y entregas para distribuidoras en Venezuela. Escaneo QR sin señal, mapa en vivo y reportes. Desde $15 por camión / mes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
