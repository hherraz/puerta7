import Link from "next/link";

import { Separador } from "./ui/Separador";

/**
 * Footer editorial: tres líneas y un rip de copyright.
 * Sin filas de links repetidas — la nav vive en el header y se repite
 * acá como una línea única para no inflar la página.
 */
export function PieDePagina() {
    return (
        <footer className="border-t border-ink-800/60 bg-ink-950">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-[60ch]">
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-500">
                            Puerta 7
                        </p>
                        <p className="mt-4 text-2xl font-semibold tracking-tighter text-ink-50 sm:text-3xl">
                            Una entrada, un asiento, un bloque.
                        </p>
                        <p className="mt-3 max-w-[55ch] text-sm leading-relaxed text-ink-400">
                            NFT ticket diseñado para un único evento. La entrada vive on-chain,
                            el pago viaja en Ether y nadie elige su butaca — la asignación es
                            aleatoria para evitar que los revendedores se queden con Platea.
                        </p>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-ink-400">
                        <Link href="/comprar" className="tactil hover:text-ink-50">
                            Comprar
                        </Link>
                        <Link href="/mis-entradas" className="tactil hover:text-ink-50">
                            Mis entradas
                        </Link>
                        <Link href="/organizador" className="tactil hover:text-ink-50">
                            Organizador
                        </Link>
                    </div>
                </div>

                <Separador className="mt-12" />

                <div className="mt-6 flex flex-col gap-2 text-xs text-ink-500 sm:flex-row sm:justify-between">
                    <p>
                        Construido sobre el contrato{" "}
                        <a
                            href="https://github.com"
                            target="_blank"
                            rel="noreferrer"
                            className="text-ink-300 underline-offset-4 hover:text-ink-50 hover:underline"
                        >
                            Entrada.sol
                        </a>{" "}
                        (OpenZeppelin 5.x, Hardhat 3, EDR simulado).
                    </p>
                    <p className="font-mono">
                        © {new Date().getFullYear()} Puerta 7. Hecho en Buenos Aires.
                    </p>
                </div>
            </div>
        </footer>
    );
}
