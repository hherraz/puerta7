"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useMemo } from "react";

import { direccionEntrada, sistemaDesplegado, ENTRADA_ABI } from "@/lib/contrato";
import { decodeEstado } from "@/lib/estados";
import { ESTADO, SECTOR, type Asiento, type EntradaVista } from "@/tipos/entrada";

/**
 * Entradas que la wallet conectada tiene en `Entrada`.
 *
 * El contrato no expone un `entradasDe(direccion)`: hay que barrer los
 * tokenIds. Por eso primero leemos `emitidas()` y después preguntamos, en
 * un solo `multicall`, tres cosas por token: quién es el dueño, en qué
 * estado está y qué asiento ocupa.
 *
 * No hay tope de recorrido a propósito. Un tope que trunca en silencio
 * mostraría que faltan entradas sin explicar por qué; si un evento llegara
 * a tener miles, el arreglo es un índiceador y este hook es el lugar donde
 * se cambia.
 */
export function useEntradasMias() {
    const { address, chainId } = useAccount();
    const direccion = direccionEntrada(chainId);
    const habilitado = sistemaDesplegado(chainId);

    // Paso 1: cuántas entradas existen. Define el largo del barrido.
    const { data: emitidas } = useReadContract({
        address: direccion,
        abi: ENTRADA_ABI,
        functionName: "emitidas",
        query: { enabled: habilitado },
    });

    const total = emitidas ?? 0n;

    // Paso 2: un lote de lecturas por token, aplanado en un solo array.
    const contratos = useMemo(() => {
        if (!habilitado || total === 0n) return [];

        return Array.from({ length: Number(total) }).flatMap((_, i) => {
            const tokenId = BigInt(i + 1);
            return [
                {
                    address: direccion,
                    abi: ENTRADA_ABI,
                    functionName: "ownerOf" as const,
                    args: [tokenId] as const,
                },
                {
                    address: direccion,
                    abi: ENTRADA_ABI,
                    functionName: "estado" as const,
                    args: [tokenId] as const,
                },
                {
                    address: direccion,
                    abi: ENTRADA_ABI,
                    functionName: "datosAsiento" as const,
                    args: [tokenId] as const,
                },
            ];
        });
    }, [habilitado, direccion, total]);

    const { data, isLoading, error, refetch } = useReadContracts({
        contracts: contratos,
        query: { enabled: habilitado && contratos.length > 0 },
        allowFailure: true,
    });

    const entradas = useMemo<EntradaVista[]>(() => {
        if (!data || !address) return [];

        const propio = address.toLowerCase();
        const resultado: EntradaVista[] = [];

        for (let i = 0; i < Number(total); i++) {
            const owner = data[i * 3]?.result;
            const codigo = data[i * 3 + 1]?.result;
            const datos = data[i * 3 + 2]?.result;

            // Si `ownerOf` revirtió el token no existe (quemado): nada que
            // mostrar. Esto solo pasa para entradas que el canje destruyó.
            if (typeof owner !== "string") continue;
            if (owner.toLowerCase() !== propio) continue;

            // El lote mezcla tipos de retorno, así que `codigo` y `datos`
            // llegan como unión. Hay que angostarlos por forma.
            const estado = typeof codigo === "number" ? decodeEstado(codigo) : ESTADO.Inexistente;

            resultado.push({
                tokenId: BigInt(i + 1),
                dueno: owner as `0x${string}`,
                estado,
                // `datosAsiento` devuelve el sector real. Antes esta línea
                // hardcodeaba sector 1 / fila A / asiento 1, así que todas
                // las entradas se veían idénticas.
                asiento: aAsiento(datos),
            });
        }

        return resultado;
    }, [data, address, total]);

    return { entradas, isLoading, error, refetch, totalEmitidas: total };
}

/** El retorno de `datosAsiento` es `[sector, fila, asiento]`. */
function aAsiento(datos: unknown): Asiento {
    if (!Array.isArray(datos) || datos.length < 3) {
        return { sector: SECTOR.Invalido, fila: "—", asiento: "—" };
    }

    return {
        sector: Number(datos[0]) as Asiento["sector"],
        fila: String(datos[1]),
        asiento: String(datos[2]),
    };
}