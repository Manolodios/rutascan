"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const WA_URL = "https://wa.me/584121640277?text=Hola%2C%20quiero%20probar%20RutaScan";

export function Hero() {
  return (
    <section className="relative h-screen min-h-[100svh] w-full overflow-hidden bg-transparent">

      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5 md:px-10">
        <Link href="/" className="text-white/90 hover:text-white transition font-medium tracking-tight">
          RutaScan
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/app" className="hidden sm:inline text-white/80 hover:text-white transition text-sm">
            Entrar al panel
          </Link>
          <Button asChild size="sm" className="bg-[#dc1928] hover:bg-[#b91421] text-white border-0">
            <Link href={WA_URL} target="_blank" rel="noopener noreferrer">
              Pedir demo
            </Link>
          </Button>
        </div>
      </nav>

      <div className="relative z-20 mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-center px-4 text-center">
        <h1 className="text-[clamp(4.5rem,11vw,12rem)] font-semibold tracking-tight leading-[0.9] text-white [text-shadow:0_0_80px_rgba(220,25,40,0.35),0_10px_60px_rgba(0,0,0,0.9)]">
          La ruta
          <br />
          sigue
        </h1>

        <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed text-white/90 [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
          Control de rutas y entregas para distribuidoras en Venezuela. Escaneo QR sin señal, mapa en vivo y reportes. Desde $15 por camión / mes.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm text-white/90">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#dc1928] shadow-[0_0_0_6px_rgba(220,25,40,0.18)]" />
            <span>30 días de prueba</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#dc1928] shadow-[0_0_0_6px_rgba(220,25,40,0.18)]" />
            <span>Sin contrato</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#dc1928] shadow-[0_0_0_6px_rgba(220,25,40,0.18)]" />
            <span>Pago por WhatsApp</span>
          </div>
        </div>

        <div className="mt-8">
          <Button asChild size="lg" className="bg-[#dc1928] hover:bg-[#b91421] text-white shadow-[0_30px_80px_-40px_rgba(220,25,40,0.9)]">
            <Link href={WA_URL} target="_blank" rel="noopener noreferrer">
              Pedir demo
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
