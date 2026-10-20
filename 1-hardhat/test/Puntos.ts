import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

// ============================================================
// Suite Puntos — Sesión 3 (docs/spec/puntos.md)
//
// Valida `Puntos.sol` contra la spec.
//
// Interfaz mínima asumida (solo lo que nombra la spec):
//   constructor()  — ERC-20 de OpenZeppelin, 18 decimales
//   emitir(address titular, uint256 cantidad, uint256 tokenIdEntrada)
//   quemar(address titular, uint256 cantidad)
//   designarEmisor(address) / designarQuemador(address)
//
// NOTA sobre `emitir`: la spec lo lista como `emitir(direccion,
// cantidad)`, pero su evento es `PuntosEmitidos(titular, cantidad,
// tokenIdEntrada)` y el invariante 3 exige identificar la
// asistencia. Sin `tokenIdEntrada` dos asistencias del mismo monto
// son indistinguibles. Si al implementar se fijan 2 argumentos,
// el invariante 3 pasa a probarse en la integración con Entrada
// (que ya impide usar dos veces la misma entrada).
//
// Errores: custom errors de la spec, con `revertedWithCustomError`.
// Para el ERC-20 estándar se usa `revert(ethers)` genérico, porque OZ
// revierte con sus propios custom errors (ERC20InsufficientBalance…).
// ============================================================
const E_NO_EMISOR = "NoEsEmisor";
const E_NO_QUEMADOR = "NoEsQuemador";
const E_NO_ORGANIZADOR = "NoEsOrganizador";
const E_YA_PREMIADA = "AsistenciaYaPremiada";
const E_SALDO = "SaldoInsuficiente";

async function desplegar() {
    const [organizador, emisor, quemador, titular, otro] =
        await ethers.getSigners();
    const puntos: any = await ethers.deployContract("Puntos", []);
    return { puntos, organizador, emisor, quemador, titular, otro };
}

/** Puntos desplegados con emisor y quemador ya designados. */
async function conRoles() {
    const ctx = await desplegar();
    await ctx.puntos.designarEmisor(ctx.emisor.address);
    await ctx.puntos.designarQuemador(ctx.quemador.address);
    return ctx;
}

/** Titular con 100 puntos por la entrada 1. */
async function conSaldo() {
    const ctx = await conRoles();
    await ctx.puntos
        .connect(ctx.emisor)
        .emitir(ctx.titular.address, 100n, 1n);
    return ctx;
}

describe("Puntos", function () {
    describe("designarEmisor / designarQuemador", function () {
        it("solo el organizador puede designar (y emite los eventos)", async function () {
            const { puntos, emisor, quemador } = await desplegar();
            await expect(puntos.designarEmisor(emisor.address))
                .to.emit(puntos, "EmisorDesignado")
                .withArgs(emisor.address);
            await expect(puntos.designarQuemador(quemador.address))
                .to.emit(puntos, "QuemadorDesignado")
                .withArgs(quemador.address);
        });

        it("revierte si designa alguien distinto al organizador", async function () {
            const { puntos, emisor, otro } = await desplegar();
            await expect(
                puntos.connect(otro).designarEmisor(emisor.address)
            ).to.be.revertedWithCustomError(puntos, E_NO_ORGANIZADOR);
            await expect(
                puntos.connect(otro).designarQuemador(emisor.address)
            ).to.be.revertedWithCustomError(puntos, E_NO_ORGANIZADOR);
        });

        it("redesignar reemplaza al anterior: el viejo deja de poder emitir", async function () {
            const { puntos, emisor, titular, otro } = await conRoles();
            await puntos.designarEmisor(otro.address);
            await expect(
                puntos.connect(emisor).emitir(titular.address, 10n, 1n)
            ).to.be.revertedWithCustomError(puntos, E_NO_EMISOR);
        });
    });

    describe("emitir", function () {
        it("solo el emisor autorizado crea puntos (invariante 1)", async function () {
            const { puntos, organizador, titular, otro } = await conRoles();
            for (const caller of [organizador, titular, otro]) {
                await expect(
                    puntos.connect(caller).emitir(titular.address, 10n, 1n)
                ).to.be.revertedWithCustomError(puntos, E_NO_EMISOR);
            }
        });

        it("acredita el saldo, suma al total y emite PuntosEmitidos", async function () {
            const { puntos, emisor, titular } = await conRoles();
            await expect(
                puntos.connect(emisor).emitir(titular.address, 100n, 7n)
            )
                .to.emit(puntos, "PuntosEmitidos")
                .withArgs(titular.address, 100n, 7n);
            expect(await puntos.balanceOf(titular.address)).to.equal(100n);
            expect(await puntos.totalSupply()).to.equal(100n);
        });

        it("no emite dos veces por la misma asistencia (invariante 3)", async function () {
            const { puntos, emisor, titular } = await conSaldo();
            await expect(
                puntos.connect(emisor).emitir(titular.address, 100n, 1n)
            ).to.be.revertedWithCustomError(puntos, E_YA_PREMIADA);
        });

        it("sí emite por asistencias distintas del mismo titular", async function () {
            const { puntos, emisor, titular } = await conSaldo();
            await puntos.connect(emisor).emitir(titular.address, 50n, 2n);
            expect(await puntos.balanceOf(titular.address)).to.equal(150n);
        });
    });

    describe("quemar", function () {
        it("solo el quemador autorizado destruye puntos de otro (invariante 2)", async function () {
            const { puntos, emisor, titular, otro } = await conSaldo();
            for (const caller of [emisor, titular, otro]) {
                await expect(
                    puntos.connect(caller).quemar(titular.address, 10n)
                ).to.be.revertedWithCustomError(puntos, E_NO_QUEMADOR);
            }
        });

        it("descuenta el saldo, baja el total y emite PuntosQuemados", async function () {
            const { puntos, quemador, titular } = await conSaldo();
            await expect(
                puntos.connect(quemador).quemar(titular.address, 40n)
            )
                .to.emit(puntos, "PuntosQuemados")
                .withArgs(titular.address, 40n);
            expect(await puntos.balanceOf(titular.address)).to.equal(60n);
            expect(await puntos.totalSupply()).to.equal(60n);
        });

        it("revierte si se quema más que el saldo", async function () {
            const { puntos, quemador, titular } = await conSaldo();
            await expect(
                puntos.connect(quemador).quemar(titular.address, 101n)
            ).to.be.revertedWithCustomError(puntos, E_SALDO);
        });
    });

    describe("ERC-20 estándar", function () {
        it("usa 18 decimales (decisión de la spec)", async function () {
            const { puntos } = await desplegar();
            expect(await puntos.decimals()).to.equal(18n);
        });

        it("transfer mueve saldo entre cuentas y emite Transfer", async function () {
            const { puntos, titular, otro } = await conSaldo();
            await expect(puntos.connect(titular).transfer(otro.address, 30n))
                .to.emit(puntos, "Transfer")
                .withArgs(titular.address, otro.address, 30n);
            expect(await puntos.balanceOf(titular.address)).to.equal(70n);
            expect(await puntos.balanceOf(otro.address)).to.equal(30n);
        });

        it("transfer revierte si deja al remitente en negativo (invariante 5)", async function () {
            const { puntos, titular, otro } = await conSaldo();
            await expect(
                puntos.connect(titular).transfer(otro.address, 101n)
            ).to.be.revert(ethers);
            expect(await puntos.balanceOf(titular.address)).to.equal(100n);
        });

        it("transferFrom no mueve más de lo autorizado (invariante 6)", async function () {
            const { puntos, titular, otro } = await conSaldo();
            await puntos.connect(titular).approve(otro.address, 25n);
            await expect(
                puntos
                    .connect(otro)
                    .transferFrom(titular.address, otro.address, 26n)
            ).to.be.revert(ethers);
        });

        it("transferFrom descuenta lo autorizado al mover (invariante 6)", async function () {
            const { puntos, titular, otro } = await conSaldo();
            await puntos.connect(titular).approve(otro.address, 25n);
            await puntos
                .connect(otro)
                .transferFrom(titular.address, otro.address, 25n);
            expect(await puntos.allowance(titular.address, otro.address)).to.equal(0n);
            expect(await puntos.balanceOf(otro.address)).to.equal(25n);
        });

        it("totalSupply es la suma de saldos tras emitir, mover y quemar (invariante 4)", async function () {
            const { puntos, emisor, quemador, titular, otro } =
                await conSaldo();
            await puntos.connect(emisor).emitir(otro.address, 50n, 2n);
            await puntos.connect(titular).transfer(otro.address, 20n);
            await puntos.connect(quemador).quemar(titular.address, 10n);
            const suma =
                (await puntos.balanceOf(titular.address)) +
                (await puntos.balanceOf(otro.address));
            expect(await puntos.totalSupply()).to.equal(suma);
        });

        it("los puntos son transferibles libremente (decisión de la spec)", async function () {
            const { puntos, titular, otro } = await conSaldo();
            await puntos.connect(titular).transfer(otro.address, 100n);
            // Quien los recibió puede volver a moverlos: no hay bloqueo.
            await puntos.connect(otro).transfer(titular.address, 40n);
            expect(await puntos.balanceOf(titular.address)).to.equal(40n);
        });
    });

    describe("Máquina de estados", function () {
        it("sin emisor designado nadie emite; sin quemador nadie quema", async function () {
            const { puntos, titular } = await desplegar();
            await expect(
                puntos.emitir(titular.address, 10n, 1n)
            ).to.be.revertedWithCustomError(puntos, E_NO_EMISOR);
            await expect(
                puntos.quemar(titular.address, 10n)
            ).to.be.revertedWithCustomError(puntos, E_NO_QUEMADOR);
        });
    });

    describe("hueco deliberado", function () {
        it.skip("nadie puede afirmar una asistencia que no ocurrió", async function () {});

        it.skip("[INTEGRACIÓN] Entrada emite los puntos al marcar Usada", async function () {
            // Fuera de esta suite: exige que Entrada.sol designe a
            // Puntos como emisor (o que Puntos designe a Entrada, según
            // la dirección que fije la implementación) y que `usar`
            // dispare la emisión una sola vez por tokenId. Se prueba
            // cuando ambos contratos coexistan en la sesión 3; no se
            // inventa acá la función de designación de Entrada.
        });
    });
});
