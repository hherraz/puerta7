/**
 * ABI del contrato `Entrada` y dirección por chain.
 *
 * El ABI refleja la API **deseada** (la que cubren los tests en
 * `1-hardhat/test/Entrada.ts`). El `Entrada.sol` actual está incompleto:
 * aún no implementa `comprar()`, `usar()`, `emitidas()` ni `disponibles()`.
 *
 * Mientras el contrato no esté terminado, las llamadas a esas funciones
 * devolverán "function not found" o revertirán. La UI lo trata con copy
 * claro (ver componentes de Comprador y Portero).
 */

import type { Address } from "viem";

/** ABI como `const` para que viem lo pueda inferir. */
export const ENTRADA_ABI = [
    // --- lectura -------------------------------------------------------------
    {
        type: "function",
        name: "precio",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "portero",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        type: "function",
        name: "estado",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "uint8" }],
    },
    {
        type: "function",
        name: "emitidas",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "disponibles",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "ownerOf",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "address" }],
    },
    {
        type: "function",
        name: "tokenURI",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "string" }],
    },
    {
        type: "function",
        name: "name",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
    {
        type: "function",
        name: "symbol",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
    // --- escritura (Organizador) --------------------------------------------
    {
        type: "function",
        name: "emitir",
        stateMutability: "nonpayable",
        // Firma esperada por los tests: (string[], string[], uint16[])
        inputs: [
            { name: "filas", type: "string[]" },
            { name: "asientos", type: "string[]" },
            { name: "sectores", type: "uint16[]" },
        ],
        outputs: [],
    },
    {
        type: "function",
        name: "retirar",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: [],
    },
    // --- escritura (Comprador) ---------------------------------------------
    {
        type: "function",
        name: "comprar",
        stateMutability: "payable",
        inputs: [],
        outputs: [],
    },
    // --- escritura (Portero) -----------------------------------------------
    {
        type: "function",
        name: "usar",
        stateMutability: "nonpayable",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [],
    },
    // --- eventos -------------------------------------------------------------
    { type: "event", name: "EntradaEmitida", inputs: [], anonymous: false },
    { type: "event", name: "EntradaComprada", inputs: [], anonymous: false },
    { type: "event", name: "EntradaUsada", inputs: [], anonymous: false },
    { type: "event", name: "FondosRetirados", inputs: [], anonymous: false },
    { type: "event", name: "Transfer", inputs: [], anonymous: false },
] as const;

/** Dirección del contrato leído desde `.env`. */
export function direccionEntrada(): Address {
    const raw = process.env.NEXT_PUBLIC_CONTRATO_ENTRADA;
    // Cast controlado: Address es `0x${string}`. Si está vacío, usamos
    // la dirección cero — wagmi devolverá 0 / revertirá al leer.
    return (raw && raw !== "") ? (raw as Address) : "0x0000000000000000000000000000000000000000";
}
