import Link from "next/link";

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-[#15100f] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-lg font-medium">RutaScan</p>
            <p className="mt-2 max-w-md text-sm text-white/70">
              Control de rutas y entregas para distribuidoras en Venezuela. Escaneo QR sin señal, mapa en vivo y reportes.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-white/70">
            <Link href="#inicio" className="hover:text-white transition">
              Inicio
            </Link>
            <Link href="#panel" className="hover:text-white transition">
              Panel
            </Link>
            <Link href="#precios" className="hover:text-white transition">
              Precios
            </Link>
            <Link href="https://wa.me/584121640277?text=Hola%2C%20quiero%20probar%20RutaScan" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
              Pedir demo
            </Link>
            <Link href="/app" className="hover:text-white transition">
              Entrar al panel
            </Link>
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/50">
          <p>© {year} RutaScan. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
