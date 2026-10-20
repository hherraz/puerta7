"use client";

import { useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Abi } from "viem";

import {
    direccionCanje,
    direccionEntrada,
    direccionPuntos,
    direccionReventa,
    direccionSorteo,
    sistemaDesplegado,
    ENTRADA_ABI,
    PUNTOS_ABI,
    CANJE_ABI,
    REVENTA_ABI,
    SORTEO_ABI,
} from "@/lib/contrato";

/**
 * Qué eventos hay que mirar para que la UI no pida F5.
 *
 * Es una lista explícita a propósito: si un contrato nuevo emite algo que
 * la UI muestra, hay que agregar la línea de acá. Un "invalidate todo en
 * cada bloque" sería más corto pero recargaría el nodo local sin motivo.
 */
interface Observable {
    readonly direccion: (chainId: number) => `0x${string}`;
    readonly abi: Abi;
    readonly eventName: string;
}

const OBSERVABLES: readonly Observable[] = [
    // Entrada: los eventos que mueven el estado de un token.
    { direccion: direccionEntrada, abi: ENTRADA_ABI, eventName: "EntradaEmitida" },
    { direccion: direccionEntrada, abi: ENTRADA_ABI, eventName: "EntradaComprada" },
    { direccion: direccionEntrada, abi: ENTRADA_ABI, eventName: "EntradaUsada" },
    { direccion: direccionEntrada, abi: ENTRADA_ABI, eventName: "EntradaQuemada" },
    { direccion: direccionEntrada, abi: ENTRADA_ABI, eventName: "Transfer" },
    { direccion: direccionEntrada, abi: ENTRADA_ABI, eventName: "FondosRetirados" },
    { direccion: direccionEntrada, abi: ENTRADA_ABI, eventName: "OperadorAutorizadoDesignado" },
    // Puntos: los saldos y las designaciones de emisor/quemador.
    { direccion: direccionPuntos, abi: PUNTOS_ABI, eventName: "PuntosEmitidos" },
    { direccion: direccionPuntos, abi: PUNTOS_ABI, eventName: "PuntosQuemados" },
    { direccion: direccionPuntos, abi: PUNTOS_ABI, eventName: "Transfer" },
    { direccion: direccionPuntos, abi: PUNTOS_ABI, eventName: "Approval" },
    { direccion: direccionPuntos, abi: PUNTOS_ABI, eventName: "EmisorDesignado" },
    { direccion: direccionPuntos, abi: PUNTOS_ABI, eventName: "QuemadorDesignado" },
    // Canje: la tabla de costos y los canjes concretados.
    { direccion: direccionCanje, abi: CANJE_ABI, eventName: "CostoDefinido" },
    { direccion: direccionCanje, abi: CANJE_ABI, eventName: "Canjeado" },
    // Reventa: el ciclo completo de un listado.
    { direccion: direccionReventa, abi: REVENTA_ABI, eventName: "Configurado" },
    { direccion: direccionReventa, abi: REVENTA_ABI, eventName: "Listado" },
    { direccion: direccionReventa, abi: REVENTA_ABI, eventName: "Comprado" },
    { direccion: direccionReventa, abi: REVENTA_ABI, eventName: "Cancelado" },
    { direccion: direccionReventa, abi: REVENTA_ABI, eventName: "Retirado" },
    // Sorteo: las tres fases y el reclamo.
    { direccion: direccionSorteo, abi: SORTEO_ABI, eventName: "SorteoAbierto" },
    { direccion: direccionSorteo, abi: SORTEO_ABI, eventName: "PostulacionComprometida" },
    { direccion: direccionSorteo, abi: SORTEO_ABI, eventName: "PostulacionRevelada" },
    { direccion: direccionSorteo, abi: SORTEO_ABI, eventName: "SorteoCerrado" },
    { direccion: direccionSorteo, abi: SORTEO_ABI, eventName: "EntradaReclamada" },
    { direccion: direccionSorteo, abi: SORTEO_ABI, eventName: "DepositoDevuelto" },
];

/**
 * Invalida la caché de lecturas cuando el sistema emite un evento.
 *
 * Montá esto una sola vez, arriba de la app (en `Providers`). Con esto, si
 * el portero marca una entrada como usada desde otra pestaña, la pantalla
 * del comprador se actualiza sola.
 */
export function useSincronizacion(): void {
    const { chainId } = useAccount();
    const queryClient = useQueryClient();
    const cliente = usePublicClient();

    useEffect(() => {
        if (!cliente || chainId === undefined || !sistemaDesplegado(chainId)) return;

        const desuscribir = OBSERVABLES.map((observable) =>
            cliente.watchContractEvent({
                address: observable.direccion(chainId),
                abi: observable.abi,
                eventName: observable.eventName,
                onLogs: () => {
                    void queryClient.invalidateQueries();
                },
            }),
        );

        return () => {
            for (const quitar of desuscribir) quitar();
        };
    }, [cliente, chainId, queryClient]);
}