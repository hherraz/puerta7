/**
 * Exporta los artefactos de Hardhat al front.
 *
 * Lee:
 *   - Los ABIs reales desde `artifacts/contracts/<Contrato>.sol/<Contrato>.json`
 *   - Las direcciones desde `ignition/deployments/<chainId>/SistemaPuerta7.json`
 *
 * Escribe en `2-front/src/lib/`:
 *   - `abis/<Contrato>.ts`   → el ABI como `as const` para que viem lo infiera
 *   - `direcciones.ts`       → dirección de cada contrato, por chain
 *
 * Por qué generarlo y no escribirlo a mano: un ABI transcrito a mano
 * deriva. El día que `Entrada.sol` sume una función, este archivo se
 * regenera y el front la ve. Corré `compilar` antes que `exportar`.
 *
 *   pnpm --filter @puerta7/hardhat exportar
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { network } from "hardhat";

/** Este paquete es ESM (`"type": "module"`), así que no hay `__dirname`. */
const DIR_SCRIPT = path.dirname(fileURLToPath(import.meta.url));

/** Contratos que el front consume, en el orden en que se muestran. */
const CONTRATOS = ["Entrada", "Puntos", "Canje", "Reventa", "Sorteo"] as const;

/** Nombre del módulo de Ignition: prefijo de las claves en el JSON de deploy. */
const MODULO = "SistemaPuerta7";

/** Raíz del repo, dos niveles arriba de `1-hardhat/`. */
const RAIZ = path.resolve(DIR_SCRIPT, "..", "..");
const DESTINO = path.join(RAIZ, "2-front", "src", "lib");

/** Una entrada del ABI, tal como la escribe solc. */
type EntradaAbi = {
    readonly type: string;
    readonly name?: string;
    readonly inputs?: readonly EntradaAbi[];
    readonly outputs?: readonly EntradaAbi[];
    readonly anonymous?: boolean;
};

/** Lee el ABI compilado de un contrato desde `artifacts/`. */
async function leerAbi(contrato: string): Promise<readonly EntradaAbi[]> {
    const ruta = path.join(
        DIR_SCRIPT,
        "..",
        "artifacts",
        "contracts",
        `${contrato}.sol`,
        `${contrato}.json`,
    );

    if (!existsSync(ruta)) {
        throw new Error(
            `No existe el artefacto de ${contrato} en ${ruta}. ` +
                `Corré \`pnpm compilar\` primero.`,
        );
    }

    const artefacto = JSON.parse(await readFile(ruta, "utf8")) as {
        abi: readonly EntradaAbi[];
    };
    return artefacto.abi;
}

/**
 * Lee las direcciones desplegadas para la red actual. Devuelve `null` si
 * todavía no se desplegó en esta red — no es un error, solo significa que
 * el front queda con las direcciones en cero.
 */
async function leerDirecciones(chainId: number) {
    const ruta = path.join(
        DIR_SCRIPT,
        "..",
        "ignition",
        "deployments",
        `chain-${chainId}`,
        "deployed_addresses.json",
    );

    if (!existsSync(ruta)) {
        console.warn(
            `  ⚠ No hay despliegue en la red ${chainId}. ` +
                `Las direcciones quedan en 0x0. Corré \`pnpm desplegar\` primero.`,
        );
        return null;
    }

    // Ignition 3 escribe un mapa plano `"<Modulo>#<Contrato>": "<address>"`.
    const despliegue = JSON.parse(await readFile(ruta, "utf8")) as Record<string, string>;

    const direcciones: Record<string, string> = {};
    for (const contrato of CONTRATOS) {
        const direccion = despliegue[`${MODULO}#${contrato}`];
        if (!direccion) {
            throw new Error(
                `El despliegue de la red ${chainId} no incluye ${MODULO}#${contrato}.`,
            );
        }
        direcciones[contrato] = direccion;
    }
    return direcciones;
}

async function main() {
    const { networkName, networkConfig } = await network.create();

    // Explícito en `hardhat.config.ts` para todas las redes que usemos.
    const chainId = networkConfig.chainId;
    if (chainId === undefined) {
        throw new TypeError(
            `La red "${networkName}" no declara chainId. ` +
                `Agregalo en networks.${networkName}.chainId en hardhat.config.ts.`,
        );
    }

    console.log(`Exportando artefactos de la red ${chainId} (${networkName})…`);

    await mkdir(path.join(DESTINO, "abis"), { recursive: true });

    // --- ABIs -----------------------------------------------------------------
    await Promise.all(
        CONTRATOS.map(async (contrato) => {
            const abi = await leerAbi(contrato);
            const cuerpo = `/**
 * ABI de \`${contrato}\` — GENERADO AUTOMÁTICAMENTE.
 *
 * No editar a mano: lo regenera \`pnpm --filter @puerta7/hardhat exportar\`
 * leyendo \`artifacts/contracts/${contrato}.sol/${contrato}.json\`.
 *
 * El \`as const\` es lo que permite a viem inferir los tipos de los args y
 * del retorno en vez de devolverlos como \`unknown\`.
 */

export const ${contrato.toUpperCase()}_ABI = ${JSON.stringify(abi, null, 4)} as const;
`;

            await writeFile(path.join(DESTINO, "abis", `${contrato}.ts`), cuerpo, "utf8");
            console.log(`  ✓ abis/${contrato}.ts (${abi.length} entradas)`);
        }),
    );

    // --- Direcciones ----------------------------------------------------------
    const direcciones = await leerDirecciones(chainId);

    const cuerpo = `/**
 * Direcciones de los contratos de Puerta 7 — GENERADO AUTOMÁTICAMENTE.
 *
 * No editar a mano: lo regenera \`pnpm --filter @puerta7/hardhat exportar\`
 * leyendo \`ignition/deployments/chain-${chainId}/deployed_addresses.json\`.
 */

import type { Address } from "viem";

/** Direcciones por chain ID (${chainId} = Hardhat local). */
export const DIRECCIONES = {
    ${chainId}: {
${CONTRATOS.map((c) => `        ${c}: "${direcciones?.[c] ?? "0x" + "0".repeat(40)}" as Address,`).join("\n")}
    },
} as const satisfies Record<number, Record<string, Address>>;

/** Chain ID para el que este archivo tiene direcciones. */
export const CHAIN_ID = ${chainId};

/**
 * Dirección de un contrato en la red dada. Devuelve la dirección cero si
 * el contrato no está desplegado ahí — los hooks la usan para no disparar
 * lecturas contra una dirección inexistente.
 */
export function direccion(
    contrato: keyof (typeof DIRECCIONES)[${chainId}],
    chainIdActual: number | undefined,
): Address {
    if (chainIdActual !== undefined && chainIdActual !== ${chainId}) {
        return "0x0000000000000000000000000000000000000000";
    }
    return DIRECCIONES[${chainId}][contrato];
}

/** ¿Está el sistema desplegado en la red conectada? */
export function sistemaDesplegado(chainIdActual: number | undefined): boolean {
    if (chainIdActual !== ${chainId}) return false;
    return DIRECCIONES[${chainId}].Entrada !== "0x0000000000000000000000000000000000000000";
}
`;

    await writeFile(path.join(DESTINO, "direcciones.ts"), cuerpo, "utf8");
    console.log(`  ✓ direcciones.ts (chain ${chainId})`);

    console.log("\nListo. Para que el front lo tome, reiniciá `next dev`.");
}

try {
    await main();
} catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}