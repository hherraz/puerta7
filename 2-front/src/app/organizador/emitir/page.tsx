"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Separador } from "@/components/ui/Separador";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { ConectarBilletera } from "@/components/ConectarBilletera";
import { SECTOR } from "@/tipos/entrada";
import { SECTORES_ORDENADOS, NOMBRE_SECTOR } from "@/lib/sectores";
import { direccionEntrada, ENTRADA_ABI } from "@/lib/contrato";
import { estadoTx } from "@/lib/estadoTx";

/**
 * Emisión de entradas.
 *
 * UI simple: elegís sector, cargás filas y asientos como CSV
 * (ej. "A,B,C" + "1,2,3" → emite 3 entradas), y mandás la tx.
 *
 * El ABI esperado es `emitir(string[] filas, string[] asientos, uint16[] sectores)`.
 * La firma exacta está documentada en `docs/spec/entrada.md` y en los
 * tests `1-hardhat/test/Entrada.ts`.
 */
export default function EmitirPage() {
    const { isConnected } = useAccount();
    const [filasTxt, setFilasTxt] = useState("A,B,C");
    const [asientosTxt, setAsientosTxt] = useState("1,2,3");
    const [sector, setSector] = useState<number>(SECTOR.A);

    const { writeContract, data: hash, isPending, error } = useWriteContract();
    const { isLoading: esperando, isSuccess: confirmado } = useWaitForTransactionReceipt({
        hash,
    });

    const filas = csvALista(filasTxt);
    const asientos = csvALista(asientosTxt);
    const sectores = filas.map(() => Number(sector));

    const largoOk = filas.length === asientos.length && filas.length > 0;
    const formValido =
        largoOk &&
        filas.every((f) => f !== "0") &&
        asientos.every((a) => a !== "0");

    if (!isConnected) {
        return (
            <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                <Header />
                <Tarjeta className="flex flex-col items-start gap-6 p-10 md:p-12">
                    <Etiqueta>Conectá la billetera del organizador</Etiqueta>
                    <ConectarBilletera />
                </Tarjeta>
            </section>
        );
    }

    return (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <Header />

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60 md:grid-cols-12">
                <div className="space-y-8 bg-ink-900 p-10 md:col-span-7">
                    <SelectorSector value={sector} onChange={setSector} />

                    <InputCsv
                        label="Filas (CSV)"
                        placeholder="A,B,C"
                        value={filasTxt}
                        onChange={setFilasTxt}
                    />

                    <InputCsv
                        label="Asientos (CSV)"
                        placeholder="1,2,3"
                        value={asientosTxt}
                        onChange={setAsientosTxt}
                    />

                    <Separador />

                    <Boton
                        bloque
                        tamano="lg"
                        variante="primario"
                        cargando={isPending || esperando}
                        disabled={!formValido}
                        onClick={() => {
                            if (!largoOk) return;
                            writeContract({
                                address: direccionEntrada(),
                                abi: ENTRADA_ABI,
                                functionName: "emitir",
                                args: [filas, asientos, sectores],
                            });
                        }}
                    >
                        Emitir {filas.length} entradas
                    </Boton>

                    {!largoOk && (
                        <p className="text-xs text-red-400">
                            Filas y asientos tienen que tener el mismo largo y no ser vacíos.
                        </p>
                    )}
                    {error && (
                        <p className="text-xs text-red-400">{error.message.split("\n")[0]}</p>
                    )}
                    {hash && (
                        <p className="font-mono text-xs text-ink-400">
                            Tx: {hash.slice(0, 10)}…{hash.slice(-4)} ·{" "}
                            {estadoTx(esperando, confirmado)}
                        </p>
                    )}
                </div>

                <PreviewLote filas={filas} asientos={asientos} sector={sector} />
            </div>
        </section>
    );
}

// ============================================================
// Subcomponentes locales
// ============================================================

function Header() {
    return (
        <header className="mb-12 max-w-[60ch]">
            <Etiqueta>Organizador · Emitir</Etiqueta>
            <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                Cargar un lote de asientos.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-300">
                Filas y asientos se ingresan como CSV. El contrato emite cada
                combinación como un NFT individual en estado{" "}
                <span className="text-ink-50">Emitida</span>.
            </p>
        </header>
    );
}

interface SelectorSectorProps {
    readonly value: number;
    readonly onChange: (next: number) => void;
}

function SelectorSector({ value, onChange }: SelectorSectorProps) {
    return (
        <div>
            <p className="etiqueta">Sector</p>
            <div className="mt-3 flex flex-wrap gap-2">
                {SECTORES_ORDENADOS.map((s) => {
                    const activo = value === s;
                    const clasesBoton = activo
                        ? "border-accent bg-accent-soft/40 text-accent-fg"
                        : "border-ink-800/60 bg-ink-950 text-ink-300 hover:border-ink-700 hover:text-ink-50";
                    return (
                        <button
                            key={s}
                            type="button"
                            onClick={() => onChange(s)}
                            className={`tactil foco-anello rounded-xl border px-3 py-2 text-sm transition-colors duration-300 ease-premium ${clasesBoton}`}
                        >
                            <span className="font-mono text-[10px] text-ink-500">{s}</span>
                            &nbsp;{NOMBRE_SECTOR[s]}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

interface InputCsvProps {
    readonly label: string;
    readonly placeholder: string;
    readonly value: string;
    readonly onChange: (next: string) => void;
}

function InputCsv({ label, placeholder, value, onChange }: InputCsvProps) {
    return (
        <div>
            <p className="etiqueta">{label}</p>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="tactil foco-anello mt-3 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-5 font-mono text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-accent"
                placeholder={placeholder}
            />
        </div>
    );
}

interface PreviewLoteProps {
    readonly filas: readonly string[];
    readonly asientos: readonly string[];
    readonly sector: number;
}

function PreviewLote({ filas, asientos, sector }: PreviewLoteProps) {
    const nombre = NOMBRE_SECTOR[sector as keyof typeof NOMBRE_SECTOR] ?? `Sector ${sector}`;
    return (
        <div className="bg-ink-950 p-10 md:col-span-5">
            <p className="etiqueta">Preview del lote</p>
            <ul className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-2 text-sm">
                {filas.map((f, i) => (
                    <li
                        key={`${f}-${i}`}
                        className="flex items-center justify-between rounded-xl border border-ink-800/60 bg-ink-900 px-4 py-3"
                    >
                        <span className="font-mono text-xs text-ink-500">{sector}</span>
                        <span className="text-ink-50">{nombre}</span>
                        <span className="font-mono text-xs text-ink-300">
                            Fila {f} · Asiento {asientos[i] ?? "—"}
                        </span>
                    </li>
                ))}
                {filas.length === 0 && (
                    <li className="rounded-xl border border-dashed border-ink-800/60 p-6 text-center text-xs text-ink-500">
                        Sin filas cargadas
                    </li>
                )}
            </ul>
        </div>
    );
}

// ============================================================
// Helpers
// ============================================================

function csvALista(input: string): string[] {
    return input
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}
