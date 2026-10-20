"use client";

import { useAccount, useReadContract } from "wagmi";
import { useState } from "react";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Separador } from "@/components/ui/Separador";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { AvisoRed } from "@/components/web3/AvisoRed";
import { EstadoTransaccion } from "@/components/web3/EstadoTransaccion";
import { ConectarBilletera } from "@/components/ConectarBilletera";
import { direccionCanje, direccionPuntos, PUNTOS_ABI } from "@/lib/contrato";
import { formatoDireccion, formatoPuntos } from "@/lib/formato";
import { useTransaccion } from "@/lib/estadoTx";

/**
 * Pantalla de Puntos (ERC-20).
 *
 * Lecturas: saldo y allowance de quien está conectado, más quién tiene el
 * permiso de emitir y de quemar.
 *
 * Acciones: `designarEmisor` y `designarQuemador`, solo del organizador.
 *
 * NO hay pantalla de `emitir` a propósito: `Puntos.emitir()` solo lo puede
 * llamar el emisor autorizado, y el despliegue designa a `Entrada`, que
 * todavía no llama a `Puntos.emitir` (ver el comentario en
 * `ignition/modules/SistemaPuerta7.ts`). Exponer el botón sería una
 * promesa falsa: siempre revertiría con `NoEsEmisor`.
 */
export default function PuntosPage() {
    const { address, isConnected, chainId } = useAccount();
    const direccion = direccionPuntos(chainId);
    // El canje es a quien hay que autorizar para que pueda quemar puntos.
    const canje = direccionCanje(chainId);

    const { data: saldo } = useReadContract({
        address: direccion,
        abi: PUNTOS_ABI,
        functionName: "balanceOf",
        args: address !== undefined ? [address] : undefined,
        query: { enabled: address !== undefined },
    });

    const { data: allowance } = useReadContract({
        address: direccion,
        abi: PUNTOS_ABI,
        functionName: "allowance",
        args: address !== undefined ? [address, canje] : undefined,
        query: { enabled: address !== undefined },
    });

    const { data: emisor } = useReadContract({
        address: direccion,
        abi: PUNTOS_ABI,
        functionName: "emisor",
    });

    const { data: quemador } = useReadContract({
        address: direccion,
        abi: PUNTOS_ABI,
        functionName: "quemador",
    });

    if (!isConnected) {
        return (
            <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                <Header />
                <Tarjeta className="flex flex-col items-start gap-6 p-10 md:p-12">
                    <Etiqueta>Conectá tu billetera</Etiqueta>
                    <p className="max-w-[55ch] text-base text-ink-300">
                        Los puntos se acreditan a una dirección, no a una cuenta.
                    </p>
                    <ConectarBilletera />
                </Tarjeta>
            </section>
        );
    }

    return (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <Header />
            <AvisoRed />

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60 md:grid-cols-2">
                <div className="space-y-8 bg-ink-900 p-10">
                    <div>
                        <p className="etiqueta">Tu saldo</p>
                        <p className="mt-3 font-mono text-4xl font-semibold tracking-tight text-ink-50">
                            {formatoPuntos(saldo)}
                        </p>
                        <p className="mt-2 text-xs text-ink-500">
                            {saldo !== undefined && saldo === 0n
                                ? "Todavía no acumulaste puntos: se acreditan al marcar una entrada como usada."
                                : "Los puntos se dividen en 18 decimales, como cualquier ERC-20."}
                        </p>
                    </div>

                    <Separador />

                    <div>
                        <p className="etiqueta">Autorizado al canje</p>
                        <p className="mt-2 font-mono text-sm text-ink-50">
                            {formatoPuntos(allowance)}
                        </p>
                        <p className="mt-2 text-xs text-ink-500">
                            El canje necesita este allowance para quemar tus puntos.
                            Se autoriza justo antes de canjear, no por el máximo.
                        </p>
                    </div>
                </div>

                <div className="space-y-8 bg-ink-950 p-10">
                    <Etiqueta>Permisos del token</Etiqueta>
                    <dl className="space-y-4">
                        <Dato titulo="Emisor autorizado" valor={formatoDireccion(emisor)} />
                        <Dato titulo="Quemador autorizado" valor={formatoDireccion(quemador)} />
                    </dl>
                    <p className="text-xs text-ink-500">
                        El emisor es quien puede crear puntos; el quemador, quien puede
                        destruirlos. Solo el organizador los cambia.
                    </p>

                    <Separador />

                    <PanelDesignar />
                </div>
            </div>
        </section>
    );
}

/** `designarEmisor` / `designarQuemador`. Solo el organizador. */
function PanelDesignar() {
    const { chainId } = useAccount();
    const puntos = direccionPuntos(chainId);

    const [emisor, setEmisor] = useState("");
    const [quemador, setQuemador] = useState("");

    const esAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

    const designarEmisor = useTransaccion(
        esAddress(emisor)
            ? {
                  address: puntos,
                  abi: PUNTOS_ABI,
                  functionName: "designarEmisor",
                  args: [emisor as `0x${string}`],
              }
            : undefined,
    );

    const designarQuemador = useTransaccion(
        esAddress(quemador)
            ? {
                  address: puntos,
                  abi: PUNTOS_ABI,
                  functionName: "designarQuemador",
                  args: [quemador as `0x${string}`],
              }
            : undefined,
    );

    return (
        <>
            <Etiqueta>Designar permisos</Etiqueta>

            <label className="block">
                <p className="etiqueta">Nuevo emisor</p>
                <input
                    value={emisor}
                    onChange={(e) => setEmisor(e.target.value.trim())}
                    placeholder="0x…"
                    className="tactil foco-anello mt-2 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-4 font-mono text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-accent"
                />
            </label>
            <Boton
                bloque
                variante="secundario"
                tamano="sm"
                disabled={!esAddress(emisor)}
                cargando={designarEmisor.ocupada}
                onClick={designarEmisor.ejecutar}
            >
                Designar emisor
            </Boton>
            <EstadoTransaccion transaccion={designarEmisor} />

            <label className="mt-4 block">
                <p className="etiqueta">Nuevo quemador</p>
                <input
                    value={quemador}
                    onChange={(e) => setQuemador(e.target.value.trim())}
                    placeholder="0x…"
                    className="tactil foco-anello mt-2 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-4 font-mono text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-accent"
                />
            </label>
            <Boton
                bloque
                variante="secundario"
                tamano="sm"
                disabled={!esAddress(quemador)}
                cargando={designarQuemador.ocupada}
                onClick={designarQuemador.ejecutar}
            >
                Designar quemador
            </Boton>
            <EstadoTransaccion transaccion={designarQuemador} />
        </>
    );
}

function Header() {
    return (
        <header className="mb-12 max-w-[55ch]">
            <Etiqueta>Puntos</Etiqueta>
            <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                Premiamos la asistencia, no la compra.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-300">
                Cada entrada validada en la puerta acredita puntos. Sirven para
                canjear una mejora en el evento siguiente.
            </p>
        </header>
    );
}

interface DatoProps {
    readonly titulo: string;
    readonly valor: string;
}

function Dato({ titulo, valor }: DatoProps) {
    return (
        <div>
            <dt className="etiqueta">{titulo}</dt>
            <dd className="mt-1 font-mono text-sm text-ink-50">{valor}</dd>
        </div>
    );
}