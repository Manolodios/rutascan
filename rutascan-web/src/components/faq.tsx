"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "¿Funciona sin señal?",
    a: "Sí. El escaneo QR guarda el registro offline y se sincroniza cuando vuelve la conexión. Ideal para zonas rurales o con cobertura inestable.",
  },
  {
    q: "¿Necesito internet para usarlo?",
    a: "El panel web sí requiere conexión. Los conductores pueden escanear sin señal y sincronizar después.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "$15 por camión / mes. Mínimo $30/mes. Desde 10 camiones: $12 c/u. 30 días de prueba, sin contrato, pago por WhatsApp.",
  },
  {
    q: "¿Puedo pagar por WhatsApp?",
    a: "Sí. Al pedir demo te guiamos por WhatsApp para activar tu cuenta y coordinar el pago.",
  },
  {
    q: "¿Qué necesito para empezar?",
    a: "Solo subir tu lista de clientes/manifiesto y dar de alta tus camiones. En menos de un día puedes tenerlo funcionando.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="bg-black py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-12 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-neutral-400">Preguntas frecuentes</p>
          <h2 className="mt-4 text-[clamp(2.5rem,6vw,5rem)] font-semibold tracking-[-0.07em] leading-[0.95] text-white">
            Todo lo que necesitas saber
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((item, index) => {
            const isOpen = open === index;
            return (
              <button
                key={item.q}
                onClick={() => setOpen(isOpen ? null : index)}
                className={cn(
                  "w-full rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 text-left transition-all backdrop-blur",
                  isOpen && "border-[#dc1928]/40"
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-lg font-medium text-white">{item.q}</span>
                  <ChevronDown className={cn("h-5 w-5 text-neutral-400 transition-transform", isOpen && "rotate-180 text-[#dc1928]")} />
                </div>
                <div
                  className={cn(
                    "grid transition-all duration-300",
                    isOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-neutral-300 leading-relaxed">{item.a}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
