import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

// ============================================================
// Tests complementarios: casos de la spec aun sin cubrir y
// hallazgos de la revision de seguridad de Entrada.sol.
//
// Los tests de la seccion "HALLAZGOS" documentan el comportamiento
// ACTUAL del contrato (que es el problematico). Si el contrato se
// corrige, esos tests deben invertirse (ver comentario de cada uno).
// ============================================================
const PRECIO = ethers.parseEther("0.1");
const VENDIDA = 2n;
const USADA = 3n;

const E_NO_ORG     = "Solo el organizador";
const E_NO_VENDIDA = "La entrada no esta vendida";
const E_YA_USADA   = "Entrada ya usada";
const E_FILA       = "Fila invalida";
const E_RENUNCIA   = "Renuncia deshabilitada";

/** Compra de Entrada en dos pasos: paga y reserva, deja pasar el bloque cuyo
 *  hash elige el asiento, y confirma. */
async function comprarEntrada(entrada: any, comprador: any) {
    await entrada.connect(comprador).comprar({ value: PRECIO });
    await ethers.provider.send("evm_mine", []);
    await entrada.connect(comprador).confirmarCompras(10);
}

async function desplegar() {
    const [organizador, portero, comprador, otro] = await ethers.getSigners();
    const entrada = await ethers.deployContract("Entrada", [PRECIO, portero.address]);
    return { entrada, organizador, portero, comprador, otro };
}

async function conEmitidas(n: number) {
    const ctx = await desplegar();
    const filas = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    const asientos = Array.from({ length: n }, (_, i) => String(i + 1));
    const sectores = Array.from({ length: n }, () => 1);
    await ctx.entrada.emitir(filas, asientos, sectores);
    return ctx;
}

async function conUnaVendida() {
    const ctx = await conEmitidas(1);
    await comprarEntrada(ctx.entrada, ctx.comprador);
    return { ...ctx, tokenId: 1n };
}

describe("Entrada - casos complementarios y seguridad", function () {
    /* ------------------------------------------------------------
     *  Casos de la spec que faltaban
     * ------------------------------------------------------------ */
    describe("casos de la spec", function () {
        it("usar revierte si el tokenId no existe", async function () {
            const { entrada, portero } = await desplegar();
            await expect(
                entrada.connect(portero).usar(999n)
            ).to.be.revertedWith(E_NO_VENDIDA);
        });

        it("una entrada Usada transferida a otro dueno sigue sin poder usarse (invariante 3)", async function () {
            const { entrada, comprador, otro, portero, tokenId } = await conUnaVendida();
            await entrada.connect(portero).usar(tokenId);
            await entrada
                .connect(comprador)
                .transferFrom(comprador.address, otro.address, tokenId);

            await expect(
                entrada.connect(portero).usar(tokenId)
            ).to.be.revertedWith(E_YA_USADA);
            expect(await entrada.estado(tokenId)).to.equal(USADA);
        });

        it("al agotar el stock cada tokenId se vende exactamente una vez", async function () {
            const { entrada, comprador } = await conEmitidas(5);
            for (let i = 0; i < 5; i++) {
                await comprarEntrada(entrada, comprador);
            }
            const duenos = new Set<string>();
            for (let id = 1n; id <= 5n; id++) {
                expect(await entrada.ownerOf(id)).to.equal(comprador.address);
                expect(await entrada.estado(id)).to.equal(VENDIDA);
                duenos.add(id.toString());
            }
            expect(duenos.size).to.equal(5);
            expect(await entrada.disponibles()).to.equal(0n);
            expect(await entrada.balanceOf(await entrada.getAddress())).to.equal(0n);
            expect(await entrada.balanceOf(comprador.address)).to.equal(5n);
        });

        it("nadie puede mover una entrada Emitida (sin vender) que tiene el contrato", async function () {
            const { entrada, organizador, comprador, otro } = await conEmitidas(2);
            const contrato = await entrada.getAddress();
            for (const caller of [organizador, comprador, otro]) {
                await expect(
                    entrada.connect(caller).transferFrom(contrato, caller.address, 1n)
                ).to.be.revert(ethers);
            }
            expect(await entrada.ownerOf(1n)).to.equal(contrato);
        });

        it("nadie puede aprobarse para una entrada Emitida", async function () {
            const { entrada, otro } = await conEmitidas(1);
            await expect(
                entrada.connect(otro).approve(otro.address, 1n)
            ).to.be.revert(ethers);
        });

        it("tokenURI revierte para un tokenId inexistente", async function () {
            const { entrada } = await conEmitidas(1);
            await expect(entrada.tokenURI(999n)).to.be.revert(ethers);
        });

        it("transferOwnership traspasa los permisos de organizador", async function () {
            const { entrada, organizador, otro, comprador } = await conEmitidas(1);
            await comprarEntrada(entrada, comprador);
            await entrada.connect(organizador).transferOwnership(otro.address);
            // Ownable2Step: el traspaso se completa cuando el nuevo acepta.
            await entrada.connect(otro).acceptOwnership();

            await expect(entrada.connect(organizador).retirar()).to.be.revertedWith(E_NO_ORG);
            await expect(entrada.connect(otro).retirar())
                .to.emit(entrada, "FondosRetirados");
        });
    });

    /* ------------------------------------------------------------
     *  HALLAZGOS (documentan el comportamiento actual)
     * ------------------------------------------------------------ */
    describe("HALLAZGOS de seguridad (comportamiento vigente)", function () {
        // H1 - CORREGIDO. renounceOwnership dejaba el contrato sin organizador:
        // se perdia para siempre el dinero recaudado y la capacidad de emitir.
        // Ahora el override revierte y el organizador conserva todo.
        it("H1: renounceOwnership revierte y el organizador conserva los fondos", async function () {
            const { entrada, organizador, comprador } = await conEmitidas(1);
            await comprarEntrada(entrada, comprador);
            await expect(
                entrada.connect(organizador).renounceOwnership()
            ).to.be.revertedWith(E_RENUNCIA);
            await expect(entrada.connect(organizador).retirar())
                .to.emit(entrada, "FondosRetirados")
                .withArgs(organizador.address, PRECIO);
        });

        // H2 - La validacion solo rechaza el texto exacto "0": "00" pasa, y
        // "01" y "1" cuentan como asientos distintos (duplicado logico).
        // Si se corrige (solo alfanumerico sin ceros a la izquierda), debe revertir.
        it("H2: fila/asiento '00' se aceptan y '01' no choca con '1'", async function () {
            const { entrada } = await desplegar();
            await entrada.emitir(["00"], ["1"], [1]);
            await entrada.emitir(["A"], ["1"], [1]);
            await entrada.emitir(["A"], ["01"], [1]);
            expect(await entrada.emitidas()).to.equal(3n);
        });

        // H3 - CORREGIDO. fila y asiento se insertaban sin escapar en el JSON
        // y el SVG de tokenURI (una comilla rompia el JSON; un '<', el SVG).
        // Ahora solo se aceptan [0-9A-Za-z], como dice la spec.
        it("H3: una comilla en la fila se rechaza al emitir", async function () {
            const { entrada } = await desplegar();
            await expect(
                entrada.emitir(['A"B'], ["1"], [1])
            ).to.be.revertedWith(E_FILA);
        });

        // H4 - emitir exige filas.length >= asientos.length (no ==), asi que
        // acepta filas sobrantes sin avisar. OJO: los helpers de Entrada.ts
        // dependen de esto (pasan 5 filas con 3 asientos); corregirlo a '!='
        // obliga a ajustar esos helpers.
        it("H4: emitir ignora en silencio las filas sobrantes", async function () {
            const { entrada } = await desplegar();
            await entrada.emitir(["A", "B", "C"], ["1"], [1]);
            expect(await entrada.emitidas()).to.equal(1n);
        });
    });
});
