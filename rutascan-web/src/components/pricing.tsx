"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function Pricing() {
  return (
    <section className="relative bg-black py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-neutral-400">Precios</p>
        <h2 className="mt-4 text-[clamp(3rem,9vw,9rem)] font-semibold tracking-[-0.08em] leading-[0.9] text-white">
          $15 por camión / mes
        </h2>
        <p className="mt-6 mx-auto max-w-2xl text-lg leading-relaxed text-neutral-300">
          Mínimo $30/mes. Desde 10 camiones: $12 c/u. 30 días de prueba, sin contrato, pago por WhatsApp.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#dc1928]/40 px-4 py-2 text-sm text-[#dc1928]">
            Mapa en vivo
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#dc1928]/40 px-4 py-2 text-sm text-[#dc1928]">
            Escaneo QR sin señal
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#dc1928]/40 px-4 py-2 text-sm text-[#dc1928]">
            Reportes en Excel
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#dc1928]/40 px-4 py-2 text-sm text-[#dc1928]">
            Validación de entregas
          </span>
        </div>

        <Card className="mt-12 mx-auto max-w-xl border-[#dc1928]/20 bg-white/[0.03] shadow-[0_60px_120px_-80px_rgba(149,38,37,0.9)] backdrop-blur">
          <CardContent className="flex flex-col items-center gap-6 py-10">
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">Empieza hoy</p>
              <p className="mt-3 text-lg text-neutral-300">Listo para hablar con nosotros por WhatsApp</p>
            </div>
            <Button asChild size="lg" className="bg-[#dc1928] hover:bg-[#b91421] text-white">
              <Link href="https://wa.me/584121640277?text=Hola%2C%20quiero%20probar%20RutaScan" target="_blank" rel="noopener noreferrer">
                Pedir demo por WhatsApp
              </Link>
            </Button>
            <p className="text-xs text-neutral-500">Respuesta en minutos · Sin compromiso</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
