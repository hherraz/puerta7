import Link from "next/link";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Separador } from "@/components/ui/Separador";
import { FondoHero } from "@/components/FondoHero";
import { MarqueeSectores } from "@/components/MarqueeSectores";

const nombreEvento = process.env.NEXT_PUBLIC_NOMBRE_EVENTO ?? "Puerta 7";

/**
 * Landing / Hero — UNA sola pantalla completa (8 secciones, en una página).
 *
 * Diseño (per DESIGN.md):
 *   1. Hero           — text centered low + seat-grid bg + outline CTA
 *   2. Marquee sect   — sectores del recinto
 *   3. Cómo funciona  — zig-zag, 3 bloques
 *   4. NFT showcase   — editorial offset, texto + ticket preview
 *   5. Confianza      — mini minimalist, números en mono
 *   6. Portero        — editorial side, texto izq + visual der
 *   7. Organizador    — bento asimétrico 70/30
 *   8. CTA final      — stacked center
 *
 * Tono: español rioplatense. Sin emojis. Sin "seamless"/"unleash".
 */
export default function Home() {
    return (
        <>
            {/* ============== 1. HERO ============== */}
            <section className="relative isolate flex min-h-[100dvh] items-end overflow-hidden">
                <FondoHero />
                <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 items-end gap-10 md:grid-cols-12">
                        <div className="md:col-span-8 md:col-start-2">
                            <Etiqueta className="mb-8">Edición única · {nombreEvento}</Etiqueta>
                            <h1 className="text-display-xl font-semibold tracking-tighter text-ink-50">
                                Una entrada,
                                <br />
                                un asiento,
                                <br />
                                <span className="text-accent">un bloque.</span>
                            </h1>
                            <p className="mt-8 max-w-[55ch] text-base leading-relaxed text-ink-300 md:text-lg">
                                El precio es fijo. La butaca es aleatoria. El boleto vive
                                on-chain — pagás en Ether, recibís un NFT, y el portero lo
                                valida en la puerta.
                            </p>
                            <div className="mt-10 flex flex-wrap items-center gap-4">
                                <Link href="/comprar" aria-label="Comprar entrada">
                                    <Boton variante="primario" tamano="lg">
                                        Comprar entrada
                                    </Boton>
                                </Link>
                                <Link href="/mis-entradas" aria-label="Ver mis entradas">
                                    <Boton variante="fantasma" tamano="lg">
                                        Ya tengo entrada —&nbsp;ver mi QR
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 14 14"
                                            fill="none"
                                            aria-hidden
                                            className="ml-1"
                                        >
                                            <path
                                                d="M3 7h8M8 4l3 3-3 3"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </Boton>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ============== 2. MARQUEE SECTORES ============== */}
            <MarqueeSectores />

            {/* ============== 3. CÓMO FUNCIONA (zig-zag) ============== */}
            <section className="border-t border-ink-800/60 bg-ink-950">
                <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                    <header className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-12">
                        <div className="md:col-span-4">
                            <Etiqueta>Cómo funciona</Etiqueta>
                        </div>
                        <div className="md:col-span-8">
                            <h2 className="text-display-lg font-semibold tracking-tighter text-ink-50">
                                Tres pasos, una blockchain.
                            </h2>
                            <p className="mt-4 max-w-[55ch] text-base text-ink-300">
                                El organizador emite, el comprador paga, el portero valida. Sin
                                backend, sin intermediarios — el Ether va del comprador al
                                contrato, y el organizador lo retira cuando quiere.
                            </p>
                        </div>
                    </header>

                    <div className="space-y-12 md:space-y-24">
                        {PASOS.map((paso, i) => (
                            <article
                                key={paso.rol}
                                className="grid grid-cols-1 items-start gap-8 md:grid-cols-12"
                            >
                                <div
                                    className={
                                        i % 2 === 0
                                            ? "md:col-span-5"
                                            : "md:col-span-5 md:col-start-8"
                                    }
                                >
                                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-500">
                                        {String(i + 1).padStart(2, "0")} · {paso.rol}
                                    </span>
                                    <h3 className="mt-4 text-display-md font-semibold tracking-tighter text-ink-50">
                                        {paso.titulo}
                                    </h3>
                                    <p className="mt-3 max-w-[50ch] text-sm leading-relaxed text-ink-400">
                                        {paso.cuerpo}
                                    </p>
                                </div>
                                <div
                                    className={
                                        i % 2 === 0
                                            ? "md:col-span-6 md:col-start-7"
                                            : "md:col-span-6 md:col-start-1 md:row-start-1"
                                    }
                                >
                                    <BloqueVisual paso={i} />
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ============== 4. NFT SHOWCASE (editorial offset) ============== */}
            <section className="border-t border-ink-800/60 bg-ink-900">
                <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
                        <div className="md:col-span-5 md:col-start-2">
                            <Etiqueta>El boleto</Etiqueta>
                            <h2 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                                Un NFT, no un PDF.
                            </h2>
                            <p className="mt-4 max-w-[45ch] text-base leading-relaxed text-ink-300">
                                Cada entrada es un token ERC-721 con un SVG renderizado
                                on-chain. Sector, fila y asiento viven en el contrato — no
                                en una base de datos nuestra.
                            </p>
                            <ul className="mt-8 space-y-2 text-sm text-ink-300">
                                <li className="flex gap-3">
                                    <span className="font-mono text-accent">·</span>
                                    Numeración secuencial y pública.
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-mono text-accent">·</span>
                                    Transferible entre wallets como cualquier NFT.
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-mono text-accent">·</span>
                                    Marca de uso una sola vez y para siempre.
                                </li>
                            </ul>
                        </div>

                        {/* Mockup del boleto — preview estático sin hidratar */}
                        <div className="md:col-span-6 md:col-start-7">
                            <BoletoPreview />
                        </div>
                    </div>
                </div>
            </section>

            {/* ============== 5. CONFIANZA (mini minimalist) ============== */}
            <section className="border-t border-ink-800/60 bg-ink-950">
                <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
                        <div className="md:col-span-4">
                            <Etiqueta>Transparencia on-chain</Etiqueta>
                            <h2 className="mt-6 text-display-md font-semibold tracking-tighter text-ink-50">
                                Los números son públicos.
                            </h2>
                        </div>
                        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-ink-800/60 md:col-span-8">
                            <Dato etiqueta="Contrato" valor="0x…7A3c" sub="Puerta 7" />
                            <Dato etiqueta="Precio" valor="0.1000 ETH" sub="fijo, inmutable" />
                            <Dato
                                etiqueta="Red"
                                valor="Hardhat local · 31337"
                                sub="o Sepolia / Base en producción"
                            />
                        </dl>
                    </div>
                </div>
            </section>

            {/* ============== 6. PORTERO (editorial side) ============== */}
            <section className="border-t border-ink-800/60 bg-ink-900">
                <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-16 md:grid-cols-12">
                        <div className="md:col-span-6">
                            <Etiqueta>Para el portero</Etiqueta>
                            <h2 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                                Validar la entrada es una sola línea.
                            </h2>
                            <p className="mt-4 max-w-[50ch] text-base leading-relaxed text-ink-300">
                                Pegás el token id, la billetera marca{" "}
                                <span className="text-ink-50">Utilizada</span>, y el estado
                                queda sellado. Si alguien intenta usar la misma entrada dos
                                veces, el contrato lo rechaza.
                            </p>
                            <Link href="/portero" className="mt-8 inline-block">
                                <Boton variante="fantasma">
                                    Ir al panel del portero&nbsp;
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 14 14"
                                        fill="none"
                                        aria-hidden
                                        className="ml-1"
                                    >
                                        <path
                                            d="M3 7h8M8 4l3 3-3 3"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </Boton>
                            </Link>
                        </div>
                        <div className="md:col-span-5 md:col-start-8">
                            <div className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-ink-800/60 bg-ink-950">
                                <div className="absolute inset-0 [background:radial-gradient(80%_60%_at_50%_30%,rgba(180,83,9,0.22)_0%,rgba(180,83,9,0)_60%)]" />
                                <div
                                    className="absolute inset-0 opacity-20"
                                    style={{
                                        backgroundImage:
                                            "linear-gradient(to right, rgba(231,229,228,0.3) 1px, transparent 1px)",
                                        backgroundSize: "32px 32px",
                                    }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-500">
                                        Scanner · placeholder
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ============== 7. ORGANIZADOR (bento asimétrico) ============== */}
            <section className="border-t border-ink-800/60 bg-ink-950">
                <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                    <header className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-12">
                        <div className="md:col-span-5">
                            <Etiqueta>Para el organizador</Etiqueta>
                            <h2 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                                Emisión y retiro, sin fila de email.
                            </h2>
                        </div>
                        <div className="md:col-span-6 md:col-start-7">
                            <p className="max-w-[55ch] text-base leading-relaxed text-ink-300">
                                Definís precio y portero al desplegar. Después: emitís
                                lotes por (sector, fila, asiento) y retirá la recaudación
                                cuando la recaudación esté en el contrato.
                            </p>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60 md:grid-cols-3">
                        <BentoBox titulo="Emitir entradas" copy="Subís un lote por (sector, fila, asiento). El contrato lo registra como Emitida." link="/organizador/emitir" cta="Emitir lote" grande />
                        <BentoBox titulo="Ver disponibles" copy="Cuántas emitidas, cuántas a la venta, cuántas ya adjudicadas." link="/organizador" cta="Panel" />
                        <BentoBox titulo="Retirar recaudación" copy="Transferí el Ether acumulado al organizador en una sola tx." link="/organizador" cta="Panel" />
                    </div>
                </div>
            </section>

            {/* ============== 8. CTA FINAL ============== */}
            <section className="border-t border-ink-800/60 bg-ink-950">
                <div className="mx-auto max-w-3xl px-4 py-32 text-center sm:px-6">
                    <Etiqueta>Listos</Etiqueta>
                    <h2 className="mt-6 text-display-xl font-semibold tracking-tighter text-ink-50">
                        Hoy abrimos la puerta.
                    </h2>
                    <p className="mt-6 text-base text-ink-300 sm:text-lg">
                        Si tenés billetera, entrás. Si no, te la instalás en dos minutos.
                    </p>
                    <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
                        <Link href="/comprar">
                            <Boton variante="primario" tamano="lg">
                                Comprar entrada
                            </Boton>
                        </Link>
                        <Link href="/organizador">
                            <Boton variante="fantasma" tamano="lg">
                                Soy el organizador
                            </Boton>
                        </Link>
                    </div>
                    <Separador className="mt-16" />
                    <p className="mt-6 font-mono text-xs text-ink-500">
                        Hardhat 3 · EDR simulado · OpenZeppelin 5.x · wagmi v2
                    </p>
                </div>
            </section>
        </>
    );
}

// ============================================================
// Sub-componentes locales. Viven en este archivo porque no se
// reusan en otras páginas; si mañana hace falta extraerlos,
// lo hacemos con un test cubriéndolos.
// ============================================================

const PASOS: Array<{ rol: string; titulo: string; cuerpo: string }> = [
    {
        rol: "Organizador",
        titulo: "Emitís los asientos",
        cuerpo:
            "Definís precio y portero al desplegar. Después emitís lotes por (sector, fila, asiento). El contrato los marca como Emitida y los deja en su propia billetera hasta la venta.",
    },
    {
        rol: "Comprador",
        titulo: "Pagás y recibís al instante",
        cuerpo:
            "Conectás tu billetera, mandás el Ether exacto al precio del contrato, y la entrada pasa a tu wallet. El asiento se asigna al azar — no se puede elegir.",
    },
    {
        rol: "Portero",
        titulo: "Marcás la entrada como Usada",
        cuerpo:
            "En la puerta, la billetera del portero llama a usar(tokenId). Si la entrada está Vendida, pasa a Usada para siempre. Si está Emitida, no se puede usar.",
    },
];

function BloqueVisual({ paso }: { paso: number }) {
    const ejemplos: Record<number, string[]> = {
        0: ["emitir([\"A\",\"B\"], [\"1\",\"2\"], [1, 2])", "// → 2 entradas Emitidas"],
        1: ["comprar()  // payable", "// → Entrada pasa a tu wallet"],
        2: ["usar(tokenId)", "// → Estado: Vendida → Usada"],
    };
    return (
        <pre className="overflow-x-auto rounded-2xl border border-ink-800/60 bg-ink-950 p-6 font-mono text-xs leading-relaxed text-ink-300">
            <code>{ejemplos[paso]?.join("\n") ?? ""}</code>
        </pre>
    );
}

function BoletoPreview() {
    return (
        <article className="relative grid grid-cols-1 overflow-hidden rounded-[2rem] border border-ink-800/60 bg-ink-950 shadow-diffusion md:grid-cols-2">
            <div className="border-b border-ink-800/60 p-8 md:border-b-0 md:border-r md:border-dashed md:border-ink-700/60">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                    Puerta 7 · NFT
                </p>
                <p className="mt-12 text-4xl font-semibold tracking-tighter text-ink-50">
                    Platea
                </p>
                <p className="mt-2 font-mono text-base text-ink-300">
                    Fila <span className="text-ink-50">A</span> · Asiento{" "}
                    <span className="text-ink-50">12</span>
                </p>
            </div>
            <div className="bg-ink-900 p-8">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    Vendida
                </p>
                <p className="mt-12 font-sans text-[8rem] font-bold leading-none tracking-tighter text-ink-700/60 md:text-[10rem]">
                    #042
                </p>
                <p className="mt-6 font-mono text-xs text-ink-500">
                    0x12…34ab
                </p>
            </div>
        </article>
    );
}

function Dato({
    etiqueta,
    valor,
    sub,
}: {
    etiqueta: string;
    valor: string;
    sub: string;
}) {
    return (
        <div className="flex items-center justify-between gap-6 bg-ink-900 p-6">
            <div>
                <dt className="font-mono text-xs uppercase tracking-[0.18em] text-ink-500">
                    {etiqueta}
                </dt>
                <dd className="mt-2 font-mono text-xl text-ink-50">{valor}</dd>
            </div>
            <p className="hidden max-w-[30ch] text-right text-xs text-ink-400 sm:block">
                {sub}
            </p>
        </div>
    );
}

function BentoBox({
    titulo,
    copy,
    link,
    cta,
    grande,
}: {
    titulo: string;
    copy: string;
    link: string;
    cta: string;
    grande?: boolean;
}) {
    return (
        <Link
            href={link}
            className={
                "group flex flex-col justify-between gap-6 bg-ink-900 p-8 transition-colors duration-300 ease-premium hover:bg-ink-800 " +
                (grande ? "md:col-span-2 md:row-span-1" : "")
            }
        >
            <div>
                <h3 className="font-sans text-2xl font-semibold tracking-tighter text-ink-50">
                    {titulo}
                </h3>
                <p className="mt-3 max-w-[40ch] text-sm text-ink-400">{copy}</p>
            </div>
            <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-accent">
                {cta}
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden
                    className="transition-transform duration-300 ease-premium group-hover:translate-x-1"
                >
                    <path
                        d="M3 7h8M8 4l3 3-3 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </span>
        </Link>
    );
}
