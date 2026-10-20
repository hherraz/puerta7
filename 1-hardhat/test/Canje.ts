import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

// ============================================================
// Suite Canje — Sesión 3 (docs/spec/canje.md)
//
// Valida `Canje.sol` (con los permisos cruzados de
// Entrada/Puntos) contra la spec.
//
// El test de aforo es [AMBIGUO]: la spec no dice de dónde sale
// el aforo del destino.
//
// Interfaz mínima asumida (solo lo que nombra la spec):
//   constructor(address entrada, address puntos)
//   definirCosto(uint16 sectorOrigen, uint16 sectorDestino, uint256 costoPuntos)
//   consultarCosto(uint16 sectorOrigen, uint16 sectorDestino) view returns (uint256)
//   canjear(uint256 tokenId, uint16 sectorDestino)
//
// Permisos cruzados que el despliegue debe hacer (spec, flujo):
// Canje es quemador en Puntos (`designarQuemador`) y operador
// autorizado en Entrada (`designarOperadorAutorizado`, que
// habilita quema+emisión). Los hace el helper `desplegar`.
//
// Errores: custom errors de la spec, con `revertedWithCustomError`.
// ============================================================
const PRECIO = ethers.parseEther("0.1");
const COSTO = 100n;
const SALDO = 500n;

const E_NO_USADA = "EntradaNoUsada";
const E_NO_TITULAR = "NoEsTitular";
const E_NO_SUPERIOR = "SectorNoSuperior";
const E_SIN_COSTO = "CostoNoDefinido";
const E_SIN_PUNTOS = "PuntosInsuficientes";
const E_AFOTO = "AforoDestinoCompleto"; // se usa al definirse el aforo (ver [AMBIGUO])
const E_SIN_AUTORIZACION = "AutorizacionInsuficiente";

async function desplegar() {
    const [organizador, portero, titular, otro] = await ethers.getSigners();
    const entrada: any = await ethers.deployContract("Entrada", [
        PRECIO,
        portero.address,
    ]);
    const puntos: any = await ethers.deployContract("Puntos", []);
    const canje: any = await ethers.deployContract("Canje", [
        await entrada.getAddress(),
        await puntos.getAddress(),
    ]);
    // Permisos cruzados del despliegue: Canje quema puntos y
    // quema/emite entradas como operador autorizado de Entrada.
    await puntos.designarQuemador(await canje.getAddress());
    await entrada.designarOperadorAutorizado(
        await canje.getAddress(),
        true
    );
    await puntos.designarEmisor(organizador.address);
    return { entrada, puntos, canje, organizador, portero, titular, otro };
}

/**
 * Titular con una entrada sector 1 ya Usada y `saldoPuntos` puntos.
 * Devuelve el tokenId usado. Sector 1 -> 2 cuesta COSTO si se pide.
 */
async function conEntradaUsada(saldoPuntos = SALDO, conCosto = true) {
    const ctx = await desplegar();
    await ctx.entrada.emitir(["A"], ["1"], [1]);
    await ctx.entrada.connect(ctx.titular).comprar({ value: PRECIO });
    const tokenId = 1n;
    await ctx.entrada.connect(ctx.portero).usar(tokenId);
    if (saldoPuntos > 0n) {
        await ctx.puntos.emitir(ctx.titular.address, saldoPuntos, tokenId);
    }
    if (conCosto) {
        await ctx.canje.definirCosto(1, 2, COSTO);
    }
    return { ...ctx, tokenId };
}

/** Las dos autorizaciones previas del flujo (pasos 1 y 2 de la spec). */
async function autorizar(ctx: any, puntosAutorizados = COSTO) {
    await ctx.puntos
        .connect(ctx.titular)
        .approve(await ctx.canje.getAddress(), puntosAutorizados);
    await ctx.entrada
        .connect(ctx.titular)
        .approve(await ctx.canje.getAddress(), ctx.tokenId);
}

describe("Canje", function () {
    describe("definirCosto / consultarCosto", function () {
        it("solo el organizador define costos y emite CostoDefinido", async function () {
            const { canje, otro } = await desplegar();
            await expect(canje.definirCosto(1, 2, COSTO))
                .to.emit(canje, "CostoDefinido")
                .withArgs(1, 2, COSTO);
            await expect(
                canje.connect(otro).definirCosto(1, 2, COSTO)
            ).to.be.revert(ethers);
        });

        it("consultarCosto devuelve lo definido", async function () {
            const { canje } = await desplegar();
            await canje.definirCosto(1, 3, 250n);
            expect(await canje.consultarCosto(1, 3)).to.equal(250n);
        });
    });

    describe("canjear", function () {
        it("quema puntos y entrada usada, y entrega una de sector superior", async function () {
            const ctx = await conEntradaUsada();
            await autorizar(ctx);
            const tx = await ctx.canje
                .connect(ctx.titular)
                .canjear(ctx.tokenId, 2);
            await expect(tx).to.emit(ctx.canje, "Canjeado");
            // Puntos quemados según la tabla (invariante 4).
            expect(await ctx.puntos.balanceOf(ctx.titular.address)).to.equal(
                SALDO - COSTO
            );
            // La usada ya no existe (invariante 3: no se canjea dos veces).
            await expect(ctx.entrada.ownerOf(ctx.tokenId)).to.be.revert(ethers);
            // Hay una entrada nueva del titular (tokenId 2, sector 2).
            expect(await ctx.entrada.ownerOf(2n)).to.equal(
                ctx.titular.address
            );
            const uri = await ctx.entrada.tokenURI(2n);
            const meta = JSON.parse(
                Buffer.from(
                    uri.slice("data:application/json;base64,".length),
                    "base64"
                ).toString("utf-8")
            );
            expect(meta.name).to.include("2");
        });

        it("revierte si la entrada no está Usada (invariante 1)", async function () {
            const ctx = await desplegar();
            await ctx.entrada.emitir(["A"], ["1"], [1]);
            await ctx.entrada.connect(ctx.titular).comprar({ value: PRECIO });
            // Queda Vendida, nunca Usada.
            await ctx.canje.definirCosto(1, 2, COSTO);
            await expect(
                ctx.canje.connect(ctx.titular).canjear(1n, 2)
            ).to.be.revertedWithCustomError(ctx.canje, E_NO_USADA);
        });

        it("revierte si canjea quien no es el titular (invariante 2)", async function () {
            const ctx = await conEntradaUsada();
            await autorizar(ctx);
            await expect(
                ctx.canje.connect(ctx.otro).canjear(ctx.tokenId, 2)
            ).to.be.revertedWithCustomError(ctx.canje, E_NO_TITULAR);
        });

        it("revierte si el destino no es superior al actual (invariante 5)", async function () {
            const ctx = await conEntradaUsada();
            await autorizar(ctx);
            for (const destino of [1]) {
                await expect(
                    ctx.canje.connect(ctx.titular).canjear(ctx.tokenId, destino)
                ).to.be.revertedWithCustomError(ctx.canje, E_NO_SUPERIOR);
            }
        });

        it("revierte si no hay costo definido para ese salto", async function () {
            const ctx = await conEntradaUsada(SALDO, false);
            await autorizar(ctx);
            await expect(
                ctx.canje.connect(ctx.titular).canjear(ctx.tokenId, 2)
            ).to.be.revertedWithCustomError(ctx.canje, E_SIN_COSTO);
        });

        it("revierte si los puntos no alcanzan", async function () {
            const ctx = await conEntradaUsada(COSTO - 1n);
            await autorizar(ctx, COSTO - 1n);
            await expect(
                ctx.canje.connect(ctx.titular).canjear(ctx.tokenId, 2)
            ).to.be.revertedWithCustomError(ctx.canje, E_SIN_PUNTOS);
        });

        it("revierte sin autorización previa sobre los puntos", async function () {
            const ctx = await conEntradaUsada();
            // Solo autoriza la entrada, no los puntos.
            await ctx.entrada
                .connect(ctx.titular)
                .approve(await ctx.canje.getAddress(), ctx.tokenId);
            await expect(
                ctx.canje.connect(ctx.titular).canjear(ctx.tokenId, 2)
            ).to.be.revertedWithCustomError(ctx.canje, E_SIN_AUTORIZACION);
        });

        it("revierte sin autorización previa sobre la entrada", async function () {
            const ctx = await conEntradaUsada();
            // Solo autoriza los puntos, no la entrada.
            await ctx.puntos
                .connect(ctx.titular)
                .approve(await ctx.canje.getAddress(), COSTO);
            await expect(
                ctx.canje.connect(ctx.titular).canjear(ctx.tokenId, 2)
            ).to.be.revertedWithCustomError(ctx.canje, E_SIN_AUTORIZACION);
        });

        it("la misma entrada no se canjea dos veces (invariante 3)", async function () {
            const ctx = await conEntradaUsada();
            await autorizar(ctx);
            await ctx.canje.connect(ctx.titular).canjear(ctx.tokenId, 2);
            await expect(
                ctx.canje.connect(ctx.titular).canjear(ctx.tokenId, 2)
            ).to.be.revert(ethers);
        });
    });

    describe("Máquina de estados", function () {
        it("el flujo completo exige Usada + titular + costo + 2 autorizaciones", async function () {
            // Sin ningún paso previo, el canje de una Emitida sin vender
            // tampoco prospera: la cadena de guardias es la máquina.
            const { canje, entrada, titular } = await desplegar();
            await entrada.emitir(["A"], ["1"], [1]);
            await expect(
                canje.connect(titular).canjear(1n, 2)
            ).to.be.revert(ethers);
        });
    });

    describe("huecos y ambigüedades — no implementar todavía", function () {
        it.skip("[AMBIGUO] no se emite la mejora si el aforo del destino está completo (invariante 6)", async function () {
            // La spec enuncia el invariante pero no dice de dónde sale
            // el aforo por sector: Entrada.sol hoy no guarda capacidad
            // (emite lo que el organizador pasa) ni expone cupo. Antes
            // de escribir la aserción hay que fijar esa fuente (cupo al
            // emitir, tabla en Canje, etc.). No es el hueco pedagógico:
            // es una definición que falta.
        });

        it.skip("invariante 7: nunca quedan puntos quemados sin mejora entregada", async function () {});

        it.skip("las autorizaciones previas no deben ser infinitas", async function () {});

        it.skip("si el organizador olvida una designación, el canje falla en producción", async function () {});
    });
});
