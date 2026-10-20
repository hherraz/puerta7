"use client";

import { useAccount, useSwitchChain } from "wagmi";

import { CHAIN_ID, sistemaDesplegado } from "@/lib/contrato";

/**
 * Estado de red del sistema.
 *
 * Dos condiciones bloquean toda acción de escritura:
 *
 *   1. `enRedCorrecta` — la wallet está en Hardhat local (31337). Sin esto,
 *      la wallet manda la tx a otra red y el usuario pierde gas sin ver por
 *      qué.
 *   2. `desplegado` — hay contratos deployados para ese chain. Sin esto,
 *      los hooks leerían contra la dirección cero.
 *
 * Ninguna de las dos se puedechequear en el botón solamente: el switch de
 * red es asíncrono y la dirección efectiva cambia en el mismo render que
 * dispara la acción.
 */
export interface EstadoRed {
    /** Chain ID de la wallet conectada, o `undefined` si no hay wallet. */
    readonly chainId: number | undefined;
    /** ¿Está la wallet en Hardhat local? */
    readonly enRedCorrecta: boolean;
    /** ¿Hay contratos deployados para el chain conectado? */
    readonly desplegado: boolean;
    /** Se puede pedir el cambio de red sin fallar. */
    readonly puedeCambiarRed: boolean;
    /** Ejecuta el cambio de red. Es una promesa: hay que awaitear. */
    readonly cambiarRed: () => Promise<void>;
    /** Cambiar de red falló (típicamente el usuario la rechazó). */
    readonly errorCambioRed: string | undefined;
    /** El usuario pidió el cambio y está esperando confirmación. */
    readonly cambiandoRed: boolean;
}

export function useRed(): EstadoRed {
    const { chainId, isConnected } = useAccount();
    const { switchChain, isPending, error } = useSwitchChain();

    const enRedCorrecta = chainId === CHAIN_ID;
    const desplegado = sistemaDesplegado(chainId);

    async function cambiarRed(): Promise<void> {
        await switchChain({ chainId: CHAIN_ID });
    }

    return {
        chainId,
        enRedCorrecta,
        desplegado,
        // Si la wallet ya está en 31337 no hay nada que cambiar.
        puedeCambiarRed: isConnected && !enRedCorrecta,
        cambiarRed,
        errorCambioRed: error ? mensajeDeError(error.message) : undefined,
        cambiandoRed: isPending,
    };
}

/**
 * Explica por qué no se puede actuar, en una frase. La UI la muestra arriba
 * de las acciones en vez de dejar los botones muertos sin explicación.
 */
export function motivoBloqueo(red: EstadoRed): string | null {
    if (!red.enRedCorrecta) {
        return "Conectá la billetera a Hardhat local (chain 31337) para operar.";
    }
    if (!red.desplegado) {
        return "No hay contratos desplegados en esta red. Corré `pnpm desplegar` y `pnpm exportar`.";
    }
    return null;
}

/**
 * Limpia el mensaje de error de wagmi para mostrarlo en pantalla.
 *
 * viem envuelve los errores de wallet en mensajes con URL de documentación
 * y documentación de argumentos que no le sirven a nadie. Si el usuario
 * rechazó la firma, lo decimos con nuestras palabras.
 */
export function mensajeDeError(mensaje: string): string {
    if (/user rejected|user denied|rejected the request/i.test(mensaje)) {
        return "Rechazaste la transacción en la billetera.";
    }
    if (/insufficient funds/i.test(mensaje)) {
        return "No tenés ETH suficiente para pagar el gas.";
    }
    if (/intrinsic gas too low|replacement transaction underpriced/i.test(mensaje)) {
        return "La comisión propuesta es muy baja. Reintentá en un rato.";
    }

    // Primera línea sola: el resto suele ser la documentación de viem.
    const primera = mensaje.split("\n")[0] ?? mensaje;
    return primera.length > 200 ? `${primera.slice(0, 200)}…` : primera;
}