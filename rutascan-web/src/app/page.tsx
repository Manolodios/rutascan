import Link from "next/link";
import { Hero } from "@/components/hero";
import { Pricing } from "@/components/pricing";
import { FAQ } from "@/components/faq";
import { Footer } from "@/components/footer";
import MagnetLines from "@/components/magnet-lines";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const WA_URL = "https://wa.me/584121640277?text=Hola%2C%20quiero%20probar%20RutaScan";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* MagnetLines full-page background — visible behind everything */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <MagnetLines
          lineColor="#dc1928"
          spacing={56}
          lineWidth={2.5}
          lineHeight={20}
          radius={260}
          fade={0.3}
          stretch={0.25}
          bounce={0.55}
          ripple={0.25}
          style={{ height: "100vh", width: "100vw" }}
        />
      </div>
      {/* Dark overlay for readability — subtle so lines stay visible */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-black/20 via-black/40 to-black/60" />

      <div className="relative z-10">
        <Hero />

        <section className="relative py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.4em] text-white/50">Cómo funciona</p>
              <h2 className="mt-3 text-[clamp(2.5rem,6vw,5rem)] font-semibold tracking-tight leading-[0.95] text-white">
                Tres pasos, cero complicaciones
              </h2>
              <p className="mt-4 mx-auto max-w-2xl text-lg leading-relaxed text-white/80">
                Del manifiesto al escaneo en la calle. La oficina no pierde una entrega.
              </p>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {[
                { title: "1. Carga el manifiesto", desc: "Sube la lista de entregas del día. Se asigna por camión." },
                { title: "2. El camión sale", desc: "El conductor ve su ruta en el móvil. Escanea con QR al entregar." },
                { title: "3. Todo se registra", desc: "La oficina ve entregas, rechazos y reportes al instante." },
              ].map((step) => (
                <Card key={step.title} className="border-white/10 bg-black/20 backdrop-blur-md shadow-[0_40px_80px_-70px_rgba(0,0,0,0.8)] hover:bg-black/30 transition-colors">
                  <CardContent className="flex flex-col gap-3 p-8">
                    <p className="text-sm uppercase tracking-[0.3em] text-[#dc1928]">{step.title}</p>
                    <p className="text-lg leading-relaxed text-white/80">{step.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="relative py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-12 text-center">
              <p className="text-sm uppercase tracking-[0.4em] text-white/50">Características</p>
              <h2 className="mt-4 text-[clamp(2.5rem,6vw,5rem)] font-semibold tracking-tight leading-[0.95] text-white">
                Hecho para distribuir
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                { title: "Sin señal", desc: "Funciona offline y sincroniza después." },
                { title: "Mapa en vivo", desc: "Ubicación y estado de cada camión." },
                { title: "Reportes", desc: "Exporta a Excel en un clic." },
                { title: "Rápido", desc: "Listo para usar desde el primer día." },
              ].map((feature) => (
                <Card key={feature.title} className="border-white/10 bg-black/20 backdrop-blur-md shadow-[0_40px_80px_-70px_rgba(0,0,0,0.8)] hover:bg-black/30 transition-colors">
                  <CardContent className="flex flex-col gap-2 p-6">
                    <p className="text-lg font-medium text-white">{feature.title}</p>
                    <p className="text-sm leading-relaxed text-white/70">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="precios" className="relative py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <Pricing />
          </div>
        </section>

        <section className="relative py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h2 className="text-[clamp(2rem,5vw,4rem)] font-semibold tracking-tight leading-[0.95] text-white">
              Todo lo que necesitas saber
            </h2>
            <FAQ />
          </div>
        </section>

        <section className="relative bg-gradient-to-t from-black/50 to-transparent py-16 text-center sm:py-24">
          <div className="mx-auto max-w-3xl px-4">
            <p className="text-sm uppercase tracking-[0.4em] text-white/40">Listo para empezar</p>
            <h2 className="mt-4 text-[clamp(2.5rem,7vw,6rem)] font-semibold tracking-tight leading-[0.95] text-white">
              Más control, menos llamadas
            </h2>
            <p className="mt-4 text-lg text-white/70">
              Pruébalo 30 días sin contrato. Te ayudamos a ponerlo en marcha hoy.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="bg-[#dc1928] hover:bg-[#b91421] text-white shadow-[0_30px_80px_-40px_rgba(220,25,40,0.9)]">
                <Link href={WA_URL} target="_blank" rel="noopener noreferrer">
                  Hablar por WhatsApp
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}
