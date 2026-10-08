"use client";

import { useReadContracts, useAccount } from "wagmi";
import { useMemo } from "react";

import { direccionEntrada, ENTRADA_ABI } from "@/lib/contrato";
import { decodeEstado } from "@/lib/estados";
import type { EntradaVista } from "@/tipos/entrada";

/**
 * Hook: lee las entradas que el dueño `address` tiene en el contrato
 * `Entrada`. Estrategia:
 *   1. Iteramos tokenId 1..CAP preguntando `ownerOf` + `estado`
 *      en batch con `multicall` (un solo request).
 *   2. Filtramos las del `address` de la wallet conectada.
 *
 * CAP se fija en 64 porque sería el máximo razonable para una
 * primera edición. Cuando el contrato exponga `emitidas()` real,
 * reemplazamos el bucle por un `useReadContract({ emitidas })` + bucle
 * dinámico.
 *
 * Fuera del alcance de la v1: subgraph / Ponder. Si el evento crece
 * a >10k NFTs, mover a un indexer.
 */
const CAP = 64n;
const numeroACap = Number(CAP);

/** Construye los contratos batch para wagmi. */
function construirContratos() {
    const aBigInt = (idx: number) => BigInt(idx + 1);
    const ownerOfCalls = Array.from({ length: numeroACap }, (_, i) => ({
        address: direccionEntrada(),
        abi: ENTRADA_ABI,
        functionName: "ownerOf" as const,
        args: [aBigInt(i)] as const,
    }));
    const estadoCalls = Array.from({ length: numeroACap }, (_, i) => ({
        address: direccionEntrada(),
        abi: ENTRADA_ABI,
        functionName: "estado" as const,
        args: [aBigInt(i)] as const,
    }));
    return [...ownerOfCalls, ...estadoCalls];
}

/** Convierte un par (owner, code) en una entrada del dueño o null. */
function aEntrada(
    tokenId: number,
    owner: string | undefined,
    code: number | undefined,
    walletAddress: string,
): EntradaVista | null {
    if (!owner || code === undefined) return null;
    if (owner.toLowerCase() !== walletAddress.toLowerCase()) return null;
    return {
        tokenId: BigInt(tokenId),
        dueno: owner as `0x${string}`,
        estado: decodeEstado(code),
        // El ABI actual no expone `asiento(uint256)` todavía.
        // Placeholder hasta que se agregue al contrato.
        asiento: { sector: 1, fila: "A", asiento: "1" },
    };
}

export function useEntradasMias() {
    const { address } = useAccount();

    const contracts = useMemo(() => construirContratos(), []);
    const contratoDesplegado =
        direccionEntrada() !== "0x0000000000000000000000000000000000000";

    const { data, isLoading, error, refetch } = useReadContracts({
        contracts,
        query: { enabled: contratoDesplegado },
    });

    const entradas: EntradaVista[] = useMemo(() => {
        if (!data || !address) return [];
        return Array.from({ length: data.length / 2 }, (_, i) => {
            const owner = data[i * 2]?.result as string | undefined;
            const code = data[i * 2 + 1]?.result as number | undefined;
            return aEntrada(i, owner, code, address);
        }).filter((e): e is EntradaVista => e !== null);
    }, [data, address]);

    return { entradas, isLoading, error, refetch };
}
