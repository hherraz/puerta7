"use client";

import { useAccount, useReadContract } from "wagmi";
import { useEffect, useState } from "react";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Separador } from "@/components/ui/Separador";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { AvisoRed } from "@/components/web3/AvisoRed";
import { EstadoTransaccion } from "@/components/web3/EstadoTransaccion";
import { ConectarBilletera } from "@/components/ConectarBilletera";
import { useEntradasMias } from "@/hooks/useEntradasMias";
import {
    direccionCanje,
    direccionEntrada,
    direccionPuntos,
    CANJE_ABI,
    ENTRADA_ABI,
    PUNTOS_ABI,
} from "@/lib/contrato";
import { formatoPuntos, formatoTokenId } from "@/lib/formato";
import { useTransaccion } from "@/lib/estadoTx";
import { SECTORES_ORDENADOS, NOMBRE_SECTOR } from "@/lib/sectores";
import { ESTADO } from "@/tipos/entrada";

/**
 * Pantalla del Canje.
 *
 * El canje es el flujo más pesado del sistema porque exige DOS
 * autorizaciones previas antes de la llamada: el titular tiene que aprobar
 * al `Canje` a gastar sus puntos (`approve` en `Puntos`) y a mover su
 * entrada (`approve` en `Entrada`). Son tres transacciones en total.
 *
 * Los dos `approve` son justos —el monto exacto del canje y el tokenId
 * puntual—, nunca `approve` infinito. El approve infinito es una decisión
 * del usuario, no un atajo de la app.
 */
export default function CanjePage() {
    const { isConnected, chainId } = useAccount();

    const [tokenId, setTokenId] = useState("");
    const [sectorDestino, setSectorDestino] = useState(2);

    const { entradas } = useEntradasMias();

    const usable = entradas.find((e) => e.estado === ESTADO.Utilizada);
    const entradaElegida = entradas.find((e) => e.tokenId === BigInt(tokenId || "0"));

    if (!isConnected) {
        return (
            <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                <Header />
                <Tarjeta className="flex flex-col items-start gap-6 p-10 md:p-12">
                    <Etiqueta>Conectá tu billetera</Etiqueta>
                    <p className="max-w-[55ch] text-base text-ink-300">
                        El canje burna tu entrada usada y te entrega una mejor.
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
                    <PanelDefinirCosto />
                    <Separador />
                    <Etiqueta>Tus entradas usadas</Etiqueta>
                    {entradas.length === 0 ? (
                        <p className="text-sm text-ink-500">
                            No tenés entradas. Comprá una y pedí que la validen en la
                            puerta para poder canjear.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {entradas.map((e) => (
                                <li key={e.tokenId.toString()}>
                                    <button
                                        type="button"
                                        onClick={() => setTokenId(e.tokenId.toString())}
                                        className="tactil foco-anello flex w-full items-center justify-between rounded-xl border border-ink-800/60 bg-ink-950 px-4 py-3 text-left transition-colors duration-300 ease-premium hover:border-ink-700"
                                    >
                                        <span className="font-mono text-sm text-ink-50">
                                            {formatoTokenId(e.tokenId)}
                                        </span>
                                        <span className="text-xs text-ink-400">
                                            {e.asiento.fila}-{e.asiento.asiento} ·{" "}
                                            {NOMBRE_SECTOR[e.asiento.sector as keyof typeof NOMBRE_SECTOR] ??
                                                "?"}
                                        </span>
                                        <span className="text-xs text-ink-500">
                                            {e.estado === ESTADO.Utilizada ? "usada" : "sin usar"}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="space-y-8 bg-ink-950 p-10">
                    <Etiqueta>Canjear</Etiqueta>

                    {usable === undefined && (
                        <p className="text-sm text-ink-500">
                            Necesitás al menos una entrada en estado Usada para canjear.
                        </p>
                    )}

                    <SelectorSector
                        valor={sectorDestino}
                        onChange={setSectorDestino}
                        minimo={entradaElegida ? entradaElegida.asiento.sector + 1 : 1}
                    />

                    <Separador />

                    {tokenId !== "" && entradaElegida !== undefined && (
                        <CostoDelCanje
                            tokenId={entradaElegida.tokenId}
                            sectorOrigen={entradaElegida.asiento.sector}
                            sectorDestino={sectorDestino}
                        />
                    )}

                    <FlujoCanjear
                        tokenId={entradaElegida?.tokenId}
                        sectorOrigen={entradaElegida?.asiento.sector}
                        sectorDestino={sectorDestino}
                    />
                </div>
            </div>
        </section>
    );
}

/**
 * El canje completo: approve de puntos, approve de la entrada y recién
 * después `canjear`. Son tres transacciones encadenadas; el paso avanza solo
 * cuando el anterior confirmó, así que nunca se pide firmar algo que
 * depende de algo que todavía no pasó.
 */
function FlujoCanjear({
    tokenId,
    sectorOrigen,
    sectorDestino,
}: {
    readonly tokenId: bigint | undefined;
    readonly sectorOrigen: number | undefined;
    readonly sectorDestino: number;
}) {
    const { chainId, address } = useAccount();
    const canje = direccionCanje(chainId);
    const entrada = direccionEntrada(chainId);
    const [paso, setPaso] = useState(0);

    const costo = useReadCosto(sectorOrigen, sectorDestino);

    const aprobarPuntos = useTransaccion(
        paso === 0 && address !== undefined && costo !== undefined
            ? {
                  address: direccionPuntos(chainId),
                  abi: PUNTOS_ABI,
                  functionName: "approve",
                  args: [canje, costo],
              }
            : undefined,
    );

    const aprobarEntrada = useTransaccion(
        paso === 1 && tokenId !== undefined
            ? {
                  address: entrada,
                  abi: ENTRADA_ABI,
                  functionName: "approve",
                  args: [canje, tokenId],
              }
            : undefined,
    );

    const canjear = useTransaccion(
        paso === 2 && tokenId !== undefined
            ? {
                  address: canje,
                  abi: CANJE_ABI,
                  functionName: "canjear",
                  args: [tokenId, sectorDestino],
              }
            : undefined,
    );

    const pasos = [aprobarPuntos, aprobarEntrada, canjear];
    const activa = pasos[paso] ?? canjear;

    // Avanza solo cuando el paso actual confirmó. `paso` queda en el
    // último índice, así que no hay reintento infinito.
    useEffect(() => {
        if (activa.fase !== "confirmada") return;
        if (paso >= PASOS.length - 1) return;
        const t = setTimeout(() => setPaso((p) => Math.min(p + 1, PASOS.length - 1)), 1500);
        return () => clearTimeout(t);
    }, [activa.fase, paso]);

    if (tokenId === undefined) return null;

    return (
        <>
            <ol className="space-y-1">
                {PASOS.map((texto, i) => (
                    <li
                        key={texto}
                        className={`text-xs ${
                            i === paso
                                ? "text-ink-50"
                                : i < paso
                                  ? "text-emerald-400"
                                  : "text-ink-600"
                        }`}
                    >
                        {i === paso ? "▶" : i < paso ? "✓" : "·"} {texto}
                    </li>
                ))}
            </ol>

            <Boton
                bloque
                tamano="lg"
                variante="primario"
                cargando={activa.ocupada}
                onClick={activa.ejecutar}
            >
                {PASOS[paso]}
            </Boton>

            <EstadoTransaccion transaccion={activa} />
        </>
    );
}

/** `consultarCosto(origen, destino)`: 0 significa que nadie lo definió. */
function useReadCosto(
    sectorOrigen: number | undefined,
    sectorDestino: number,
): bigint | undefined {
    const { chainId } = useAccount();

    const { data } = useReadContract({
        address: direccionCanje(chainId),
        abi: CANJE_ABI,
        functionName: "consultarCosto",
        args:
            sectorOrigen !== undefined && sectorOrigen > 0
                ? [sectorOrigen, sectorDestino]
                : undefined,
        query: { enabled: sectorOrigen !== undefined && sectorOrigen > 0 },
    });

    // El contrato devuelve 0 si la combinación no está en la tabla, y 0
    // también sería un costo válido. La UI lo trata como "no definido"
    // porque es el caso que se quiere señalar.
    return data === undefined ? undefined : data;
}

function CostoDelCanje({
    tokenId,
    sectorOrigen,
    sectorDestino,
}: {
    readonly tokenId: bigint;
    readonly sectorOrigen: number;
    readonly sectorDestino: number;
}) {
    const costo = useReadCosto(sectorOrigen, sectorDestino);

    return (
        <div className="space-y-1">
            <p className="etiqueta">Costo del canje</p>
            <p className="font-mono text-2xl font-semibold text-ink-50">
                {formatoPuntos(costo)}
            </p>
            <p className="text-xs text-ink-500">
                {formatoTokenId(tokenId)} · sector {sectorOrigen} → {sectorDestino}.
                {costo === 0n
                    ? " Si dice 0, el organizador todavía no definió este canje."
                    : " Se descuentan de tu saldo y se queman."}
            </p>
        </div>
    );
}

function SelectorSector({
    valor,
    onChange,
    minimo,
}: {
    readonly valor: number;
    readonly onChange: (next: number) => void;
    readonly minimo: number;
}) {
    return (
        <div>
            <p className="etiqueta">Sector destino</p>
            <div className="mt-3 flex flex-wrap gap-2">
                {SECTORES_ORDENADOS.map((s) => {
                    const activo = valor === s;
                    // El destino tiene que ser estrictamente mejor.
                    const habilitado = s >= minimo;
                    return (
                        <button
                            key={s}
                            type="button"
                            disabled={!habilitado}
                            onClick={() => onChange(s)}
                            className={`tactil foco-anello rounded-xl border px-3 py-2 text-sm transition-colors duration-300 ease-premium disabled:cursor-not-allowed disabled:opacity-40 ${
                                activo
                                    ? "border-accent bg-accent-soft/40 text-accent-fg"
                                    : "border-ink-800/60 bg-ink-950 text-ink-300 hover:border-ink-700 hover:text-ink-50"
                            }`}
                        >
                            <span className="font-mono text-[10px] text-ink-500">{s}</span>
                            &nbsp;{NOMBRE_SECTOR[s]}
                        </button>
                    );
                })}
            </div>
            <p className="mt-2 text-xs text-ink-500">
                Solo los sectores mejores que el actual están habilitados.
            </p>
        </div>
    );
}

function Header() {
    return (
        <header className="mb-12 max-w-[55ch]">
            <Etiqueta>Canje</Etiqueta>
            <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                Gastá los puntos en una butaca mejor.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-300">
                El canje quema tus puntos y tu entrada usada, y te emite una en el
                sector destino para el evento siguiente. Todo en una sola
                transacción: o pasa todo, o no pasa nada.
            </p>
        </header>
    );
}

/**
 * `definirCosto(origen, destino, costoPuntos)`. Solo el organizador.
 *
 * Sin esto la tabla de costos está vacía y `consultarCosto` devuelve 0
 * para todo: nadie puede canjear. El 0 es ambiguo en el contrato (también
 * sería un costo válido), así que la UI muestra el precio en puntos tal
 * como lo entiende la persona que lo carga.
 */
function PanelDefinirCosto() {
    const { chainId } = useAccount();
    const canje = direccionCanje(chainId);

    const [origen, setOrigen] = useState("1");
    const [destino, setDestino] = useState("2");
    const [puntos, setPuntos] = useState("");

    const habilitado = /^\d+$/.test(origen) && /^\d+$/.test(destino) && puntos !== "";

    const definir = useTransaccion(
        habilitado
            ? {
                  address: canje,
                  abi: CANJE_ABI,
                  functionName: "definirCosto",
                  args: [Number(origen), Number(destino), aPuntos(puntos)],
              }
            : undefined,
    );

    return (
        <>
            <Etiqueta>Tabla de costos</Etiqueta>
            <p className="text-xs text-ink-500">
                Solo el organizador. Define cuántos puntos cuesta subir de un sector
                al siguiente. Sin esto no hay canjes disponibles.
            </p>

            <div className="grid grid-cols-3 gap-3">
                <label className="block">
                    <p className="etiqueta">Origen</p>
                    <input
                        value={origen}
                        onChange={(e) => setOrigen(e.target.value.trim())}
                        inputMode="numeric"
                        className="tactil foco-anello mt-2 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-4 font-mono text-sm text-ink-50 outline-none focus:border-accent"
                    />
                </label>
                <label className="block">
                    <p className="etiqueta">Destino</p>
                    <input
                        value={destino}
                        onChange={(e) => setDestino(e.target.value.trim())}
                        inputMode="numeric"
                        className="tactil foco-anello mt-2 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-4 font-mono text-sm text-ink-50 outline-none focus:border-accent"
                    />
                </label>
                <label className="block">
                    <p className="etiqueta">Puntos</p>
                    <input
                        value={puntos}
                        onChange={(e) => setPuntos(e.target.value.trim())}
                        placeholder="50"
                        inputMode="numeric"
                        className="tactil foco-anello mt-2 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-4 font-mono text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-accent"
                    />
                </label>
            </div>

            <Boton
                bloque
                variante="secundario"
                tamano="md"
                disabled={!habilitado}
                cargando={definir.ocupada}
                onClick={definir.ejecutar}
            >
                Definir costo
            </Boton>

            <EstadoTransaccion transaccion={definir} />
        </>
    );
}

/** Puntos → unidades del ERC-20 (18 decimales). */
function aPuntos(entero: string): bigint {
    return BigInt(entero) * 10n ** 18n;
}

/** Copia de los tres pasos, en orden. */
const PASOS = [
    "Autorizar el canje a gastar puntos",
    "Autorizar al canje a mover la entrada",
    "Canjear",
];