"use client";

import Link from "next/link";

import { useAccount } from "wagmi";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { ConectarBilletera } from "@/components/ConectarBilletera";
import { TarjetaEntrada } from "@/components/TarjetaEntrada";
import { useEntradasMias } from "@/hooks/useEntradasMias";

/**
 * Mis entradas — galería de NFTs en poder del usuario.
 *
 * - Sin wallet: prompt a conectar.
 * - Conectada, sin entradas: CTA de compra.
 * - Conectada, con entradas: grid de TarjetaEntrada.
 *
 * Loading: dos skeletons que imitan la forma de TarjetaEntrada para
 * evitar layout shift (sin spinner genérico — principio 5 del taste-skill).
 */
export default function MisEntradasPage() {
    const { isConnected } = useAccount();
    const { entradas, isLoading } = useEntradasMias();

    if (!isConnected) {
        return (
            <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                <header className="mb-12 max-w-[55ch]">
                    <Etiqueta>Mis entradas</Etiqueta>
                    <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                        Lo que llevás a la puerta.
                    </h1>
                    <p className="mt-4 text-base leading-relaxed text-ink-300">
                        Conectá tu billetera y mirá los NFTs que tenés del evento. En la
                        puerta, el portero los valida uno por uno.
                    </p>
                </header>

                <Tarjeta className="flex flex-col items-start gap-6 p-10 md:p-12">
                    <Etiqueta>Conectá tu billetera</Etiqueta>
                    <p className="max-w-[55ch] text-base text-ink-300">
                        Para ver tus entradas necesitamos que conectes la wallet donde
                        están depositados los NFTs.
                    </p>
                    <ConectarBilletera />
                </Tarjeta>
            </section>
        );
    }

    if (isLoading) {
        return (
            <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                <header className="mb-12 max-w-[55ch]">
                    <Etiqueta>Mis entradas</Etiqueta>
                    <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                        Lo que llevás a la puerta.
                    </h1>
                </header>
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <Tarjeta key={i} tamano="lg" className="h-[280px] animate-pulse" />
                    ))}
                </div>
            </section>
        );
    }

    if (entradas.length === 0) {
        return (
            <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                <header className="mb-12 max-w-[55ch]">
                    <Etiqueta>Mis entradas</Etiqueta>
                    <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                        Lo que llevás a la puerta.
                    </h1>
                </header>
                <Tarjeta className="flex flex-col items-start gap-6 p-10 md:p-12">
                    <Etiqueta>Sin entradas todavía</Etiqueta>
                    <p className="max-w-[55ch] text-base text-ink-300">
                        Esta wallet no tiene NFTs de Puerta 7. Comprá una entrada y va a
                        aparecer acá apenas se confirme la tx.
                    </p>
                    <Link href="/comprar">
                        <Boton variante="primario" tamano="md">
                            Comprar entrada
                        </Boton>
                    </Link>
                </Tarjeta>
            </section>
        );
    }

    return (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <header className="mb-12 max-w-[55ch]">
                <Etiqueta>Mis entradas</Etiqueta>
                <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                    Lo que llevás a la puerta.
                </h1>
            </header>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                {entradas.map((e) => (
                    <TarjetaEntrada
                        key={e.tokenId.toString()}
                        tokenId={e.tokenId}
                        estado={e.estado}
                        dueno={e.dueno}
                        asiento={e.asiento}
                    />
                ))}
            </div>
        </section>
    );
}
