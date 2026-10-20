/**
 * Verificación de humo del sistema desplegado.
 *
 * Comprueba, contra el nodo local, que los contratos responden y que el
 * camino completo del comprador y el portero funciona. No usa los tests:
 * los tests ya pasan; lo que se verifica acá es que el DEPLOY y el
 * EXPORT dejaron algo usable para el front.
 *
 *   npx hardhat run scripts/verificar.ts --network localhost
 */

import { network } from "hardhat";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Hardhat 3 no exporta `ethers` desde la raíz: se toma de la conexión.
const { ethers } = await network.create();

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(DIR, "..", "..");

/** Lee el archivo que genera `scripts/exportar.ts`. */
function direccionesExportadas(): Record<string, string> {
    const fuente = readFileSync(
        path.join(RAIZ, "2-front", "src", "lib", "direcciones.ts"),
        "utf8",
    );

    const entradas: Record<string, string> = {};
    for (const linea of fuente.split("\n")) {
        const match = /^\s*(\w+): "(0x[0-9a-fA-F]{40})"/.exec(linea);
        if (match?.[1] !== undefined && match[2] !== undefined) {
            entradas[match[1]] = match[2];
        }
    }
    return entradas;
}

async function main() {
    const [organizador, portero, , comprador] = await ethers.getSigners();
    const direcciones = direccionesExportadas();

    console.log("Direcciones que ve el front:");
    for (const [nombre, direccion] of Object.entries(direcciones)) {
        console.log(`  ${nombre.padEnd(9)} ${direccion}`);
    }

    const entrada = await ethers.getContractAt("Entrada", direcciones["Entrada"]);
    const puntos = await ethers.getContractAt("Puntos", direcciones["Puntos"]);
    const canje = await ethers.getContractAt("Canje", direcciones["Canje"]);
    const reventa = await ethers.getContractAt("Reventa", direcciones["Reventa"]);
    const sorteo = await ethers.getContractAt("Sorteo", direcciones["Sorteo"]);

    // --- Lecturas básicas -----------------------------------------------------
    console.log("\nLecturas:");
    console.log(`  precio()   = ${ethers.formatEther(await entrada.precio())} ETH`);
    console.log(`  owner()    = ${await entrada.owner()}`);
    console.log(`  portero()  = ${await entrada.portero()}`);
    console.log(`  puntos     = ${ethers.formatEther(await puntos.totalSupply())}`);
    console.log(`  emisor     = ${await puntos.emisor()}`);
    console.log(`  quemador   = ${await puntos.quemador()}`);
    console.log(`  reventa    = entrada ${await reventa.entrada()}`);
    console.log(`  sorteo     = deposito ${ethers.formatEther(await sorteo.deposito())} ETH`);

    // --- El owner tiene que ser la cuenta 0 ---------------------------------
    const owner = await entrada.owner();
    if (owner.toLowerCase() !== (await organizador.getAddress()).toLowerCase()) {
        throw new Error("El owner de Entrada no es la cuenta 0 del organizador.");
    }
    if ((await entrada.portero()).toLowerCase() !== (await portero.getAddress()).toLowerCase()) {
        throw new Error("El portero de Entrada no es la cuenta 1.");
    }

    // --- Camino del comprador ------------------------------------------------
    // El script tiene que poder correrse más de una vez sobre el mismo nodo,
// así que los asientos se nombran a partir de lo ya emitido. Si no, la
// segunda corrida revienta con "Asiento ya emitido".
    const base = await entrada.emitidas();
    const filas = [`V${base}`, `V${base + 1n}`, `V${base + 2n}`];
    const asientos = ["1", "2", "3"];

    console.log(`\nEmitiendo 3 entradas desde el organizador (filas ${filas.join(", ")})…`);
    await (await entrada.connect(organizador).emitir(filas, asientos, [1, 1, 1])).wait();
    console.log(`  emitidas()    = ${await entrada.emitidas()}`);
    console.log(`  disponibles() = ${await entrada.disponibles()}`);

    const precio = await entrada.precio();
    const receipt = await (await entrada.connect(comprador).comprar({ value: precio })).wait();

    // `Entrada` es ERC-721 plano, sin `Enumerable`: no hay
    // `tokenOfOwnerByIndex`. El tokenId se saca del propio evento de compra,
    // que además es lo que mira el front para actualizar la UI.
    const comprado = receipt.logs
        .map((log) => {
            try {
                return entrada.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .find((log) => log?.name === "EntradaComprada");

    const tokenId = comprado?.args[0] as bigint;
    const duenio = await entrada.balanceOf(await comprador.getAddress());
    console.log(`  comprador tiene ${duenio} entrada(s), tokenId ${tokenId}`);

    const sector = await entrada.datosAsiento(tokenId);
    console.log(`  datosAsiento(${tokenId}) = sector ${sector[0]}, fila ${sector[1]}, asiento ${sector[2]}`);
    console.log(`  estado(${tokenId}) = ${await entrada.estado(tokenId)} (2 = Vendida)`);

    // --- Camino del portero --------------------------------------------------
    console.log("\nMarcando la entrada como usada desde la billetera del portero…");
    await (await entrada.connect(portero).usar(tokenId)).wait();
    console.log(`  estado(${tokenId}) = ${await entrada.estado(tokenId)} (3 = Usada)`);

    // --- El portero NO puede retirar ----------------------------------------
    try {
        await entrada.connect(portero).retirar({ from: await portero.getAddress() });
        throw new Error("El portero pudo retirar fondos. El control de acceso falló.");
    } catch (error: unknown) {
        const mensaje = error instanceof Error ? error.message : String(error);
        if (!mensaje.includes("Solo el organizador")) throw error;
        console.log("\nControl de acceso: el portero NO pudo retirar fondos. Correcto.");
    }

    // --- Publicar en reventa -------------------------------------------------
    console.log("\nAprobando y listando la entrada usada (debe fallar: no se revende usada)…");
    await (await entrada.connect(comprador).approve(await reventa.getAddress(), tokenId)).wait();
    try {
        await (await reventa.connect(comprador).listar(tokenId, precio)).wait();
        console.log("  ⚠ La entrada usada se listó. Revisar la guarda de Reventa.");
    } catch (error: unknown) {
        const mensaje = error instanceof Error ? error.message : String(error);
        if (!mensaje.includes("EntradaUsada")) throw error;
        console.log("  EntradaUsada: no se listó una entrada ya usada. Correcto.");
    }

    console.log("\n✓ Verificación completa.");
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});