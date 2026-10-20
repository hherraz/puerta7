import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

// ============================================================
// Suite Reventa — Sesión 4 (docs/spec/reventa.md)
//
// Valida `Reventa.sol` contra la spec.
//
// Interfaz mínima asumida (solo lo que nombra la spec):
//   constructor(address entrada)
//   configurar(uint256 techoPorcentaje, uint256 comisionPorcentaje)
//   listar(uint256 tokenId, uint256 precio)  — ids desde 1
//   comprar(uint256 idListado) payable
//   cancelar(uint256 idListado)
//   retirar()  — patrón pull: cada uno retira lo suyo
//
// El precio original sale de `Entrada.precio()` y el techo es un
// porcentaje sobre ese precio (110 = hasta +10%).
//
// Errores: custom errors de la spec, con `revertedWithCustomError`.
// ============================================================
const PRECIO = ethers.parseEther("0.1"); // precio original en Entrada
const TECHO = 110n; // hasta +10% sobre el original
const COMISION_PCT = 10n; // 10% para el organizador
const PRECIO_LISTA = PRECIO; // listar al precio original
const COMISION = (PRECIO_LISTA * COMISION_PCT) / 100n;
const PARA_VENDEDOR = PRECIO_LISTA - COMISION;

const E_USADA = "EntradaUsada";
const E_NO_TITULAR = "NoEsTitular";
const E_SOBRE_TECHO = "PrecioSobreTecho";
const E_INACTIVO = "ListadoInactivo";
const E_NO_VENDEDOR = "NoEsVendedor";
const E_PAGO = "PagoIncorrecto";
const E_SIN_FONDOS = "SinFondosParaRetirar";
const E_SIN_AUTORIZACION = "AutorizacionInsuficiente";

async function desplegar() {
    const [organizador, portero, vendedor, comprador, otro] =
        await ethers.getSigners();
    const entrada: any = await ethers.deployContract("Entrada", [
        PRECIO,
        portero.address,
    ]);
    const reventa: any = await ethers.deployContract("Reventa", [
        await entrada.getAddress(),
    ]);
    await reventa.configurar(TECHO, COMISION_PCT);
    return { entrada, reventa, organizador, portero, vendedor, comprador, otro };
}

/** Vendedor dueño de la entrada 1 (sector 1, Vendida, sin usar). */
async function conEntradaDelVendedor() {
    const ctx = await desplegar();
    await ctx.entrada.emitir(["A"], ["1"], [1]);
    await ctx.entrada.connect(ctx.vendedor).comprar({ value: PRECIO });
    return { ...ctx, tokenId: 1n };
}

/** Entrada 1 listada a PRECIO_LISTA (id de listado 1), con approve previo. */
async function conListado() {
    const ctx = await conEntradaDelVendedor();
    await ctx.entrada
        .connect(ctx.vendedor)
        .approve(await ctx.reventa.getAddress(), ctx.tokenId);
    await ctx.reventa
        .connect(ctx.vendedor)
        .listar(ctx.tokenId, PRECIO_LISTA);
    return { ...ctx, idListado: 1n };
}

/** Balance de ETH de una cuenta, para retiros pull sin ruido de gas. */
async function balance(direccion: string) {
    return ethers.provider.getBalance(direccion);
}

describe("Reventa", function () {
    describe("configurar", function () {
        it("solo el organizador configura y emite Configurado", async function () {
            const { reventa, otro } = await desplegar();
            await expect(reventa.configurar(120n, 5n))
                .to.emit(reventa, "Configurado")
                .withArgs(120n, 5n);
            await expect(
                reventa.connect(otro).configurar(120n, 5n)
            ).to.be.revert(ethers);
        });
    });

    describe("listar", function () {
        it("el titular lista con approve previo y emite Listado", async function () {
            const { entrada, reventa, vendedor, tokenId } =
                await conEntradaDelVendedor();
            await entrada
                .connect(vendedor)
                .approve(await reventa.getAddress(), tokenId);
            await expect(reventa.connect(vendedor).listar(tokenId, PRECIO_LISTA))
                .to.emit(reventa, "Listado")
                .withArgs(1n, tokenId, vendedor.address, PRECIO_LISTA);
            // Listar no escrowa el NFT: sigue del vendedor hasta la venta.
            expect(await entrada.ownerOf(tokenId)).to.equal(vendedor.address);
        });

        it("revierte si la entrada ya fue usada (invariante 1)", async function () {
            const { entrada, reventa, portero, vendedor, tokenId } =
                await conEntradaDelVendedor();
            await entrada.connect(portero).usar(tokenId);
            await entrada
                .connect(vendedor)
                .approve(await reventa.getAddress(), tokenId);
            await expect(
                reventa.connect(vendedor).listar(tokenId, PRECIO_LISTA)
            ).to.be.revertedWithCustomError(reventa, E_USADA);
        });

        it("revierte si lista quien no posee la entrada (invariante 2)", async function () {
            const { reventa, otro, tokenId } = await conEntradaDelVendedor();
            await expect(
                reventa.connect(otro).listar(tokenId, PRECIO_LISTA)
            ).to.be.revertedWithCustomError(reventa, E_NO_TITULAR);
        });

        it("revierte sobre el techo y acepta justo en el techo (invariante 3)", async function () {
            const { entrada, reventa, vendedor, tokenId } =
                await conEntradaDelVendedor();
            await entrada
                .connect(vendedor)
                .approve(await reventa.getAddress(), tokenId);
            const enElTecho = (PRECIO * TECHO) / 100n;
            await expect(
                reventa.connect(vendedor).listar(tokenId, enElTecho + 1n)
            ).to.be.revertedWithCustomError(reventa, E_SOBRE_TECHO);
            await expect(
                reventa.connect(vendedor).listar(tokenId, enElTecho)
            ).to.emit(reventa, "Listado");
        });

        it("revierte sin autorización previa sobre el token", async function () {
            const { reventa, vendedor, tokenId } =
                await conEntradaDelVendedor();
            await expect(
                reventa.connect(vendedor).listar(tokenId, PRECIO_LISTA)
            ).to.be.revertedWithCustomError(reventa, E_SIN_AUTORIZACION);
        });
    });

    describe("comprar", function () {
        it("paga el precio exacto y recibe la entrada en la misma tx (invariante 5)", async function () {
            const { entrada, reventa, comprador, idListado, tokenId } =
                await conListado();
            await expect(
                reventa
                    .connect(comprador)
                    .comprar(idListado, { value: PRECIO_LISTA })
            )
                .to.emit(reventa, "Comprado")
                .withArgs(idListado, comprador.address, PRECIO_LISTA, COMISION);
            expect(await entrada.ownerOf(tokenId)).to.equal(comprador.address);
        });

        it("revierte si el pago no es exacto", async function () {
            const { reventa, comprador, idListado } = await conListado();
            for (const valor of [PRECIO_LISTA - 1n, PRECIO_LISTA + 1n, 0n]) {
                await expect(
                    reventa.connect(comprador).comprar(idListado, { value: valor })
                ).to.be.revertedWithCustomError(reventa, E_PAGO);
            }
        });

        it("un listado vendido no se puede volver a comprar (invariante 4)", async function () {
            const { reventa, comprador, otro, idListado } = await conListado();
            await reventa
                .connect(comprador)
                .comprar(idListado, { value: PRECIO_LISTA });
            await expect(
                reventa.connect(otro).comprar(idListado, { value: PRECIO_LISTA })
            ).to.be.revertedWithCustomError(reventa, E_INACTIVO);
        });

        it("un listado cancelado no se puede comprar (invariante 4)", async function () {
            const { reventa, vendedor, comprador, idListado } =
                await conListado();
            await reventa.connect(vendedor).cancelar(idListado);
            await expect(
                reventa
                    .connect(comprador)
                    .comprar(idListado, { value: PRECIO_LISTA })
            ).to.be.revertedWithCustomError(reventa, E_INACTIVO);
        });

        it("si la entrada se usa mientras está listada, la compra revierte", async function () {
            const { entrada, reventa, portero, comprador, idListado, tokenId } =
                await conListado();
            await entrada.connect(portero).usar(tokenId);
            await expect(
                reventa
                    .connect(comprador)
                    .comprar(idListado, { value: PRECIO_LISTA })
            ).to.be.revertedWithCustomError(reventa, E_INACTIVO);
        });

        it("el vendedor cobra sin la comisión y el organizador la suya (invariante 6, pull)", async function () {
            const ctx = await conListado();
            await ctx.reventa
                .connect(ctx.comprador)
                .comprar(ctx.idListado, { value: PRECIO_LISTA });
            // Nada se transfirió en la compra: queda para retirar.
            expect(await balance(await ctx.reventa.getAddress())).to.equal(
                PRECIO_LISTA
            );
            await ctx.reventa.connect(ctx.vendedor).retirar();
            await ctx.reventa.connect(ctx.organizador).retirar();
            // Sin fondos atrapados (invariante 8).
            expect(await balance(await ctx.reventa.getAddress())).to.equal(0n);
        });
    });

    describe("cancelar", function () {
        it("solo el vendedor cancela, emite Cancelado y conserva su entrada", async function () {
            const { entrada, reventa, vendedor, idListado, tokenId } =
                await conListado();
            await expect(reventa.connect(vendedor).cancelar(idListado))
                .to.emit(reventa, "Cancelado")
                .withArgs(idListado);
            expect(await entrada.ownerOf(tokenId)).to.equal(vendedor.address);
        });

        it("revierte si cancela alguien distinto al vendedor", async function () {
            const { reventa, comprador, idListado } = await conListado();
            await expect(
                reventa.connect(comprador).cancelar(idListado)
            ).to.be.revertedWithCustomError(reventa, E_NO_VENDEDOR);
        });

        it("un listado ya vendido no se puede cancelar", async function () {
            const { reventa, vendedor, comprador, idListado } =
                await conListado();
            await reventa
                .connect(comprador)
                .comprar(idListado, { value: PRECIO_LISTA });
            await expect(
                reventa.connect(vendedor).cancelar(idListado)
            ).to.be.revertedWithCustomError(reventa, E_INACTIVO);
        });
    });

    describe("retirar", function () {
        /** Vende el listado 1 y devuelve el contexto con la venta hecha. */
        async function conVenta() {
            const ctx = await conListado();
            await ctx.reventa
                .connect(ctx.comprador)
                .comprar(ctx.idListado, { value: PRECIO_LISTA });
            return ctx;
        }

        it("el vendedor retira precio menos comisión y emite Retirado", async function () {
            const ctx = await conVenta();
            const antes = await balance(ctx.vendedor.address);
            const tx = await ctx.reventa.connect(ctx.vendedor).retirar();
            const receipt = await tx.wait();
            const gas =
                BigInt(String(receipt!.gasUsed)) * (tx.gasPrice ?? 0n);
            await expect(tx)
                .to.emit(ctx.reventa, "Retirado")
                .withArgs(ctx.vendedor.address, PARA_VENDEDOR);
            expect(await balance(ctx.vendedor.address)).to.equal(
                antes + PARA_VENDEDOR - gas
            );
        });

        it("el organizador retira la comisión acumulada", async function () {
            const ctx = await conVenta();
            const antes = await balance(ctx.organizador.address);
            const tx = await ctx.reventa.connect(ctx.organizador).retirar();
            const receipt = await tx.wait();
            const gas =
                BigInt(String(receipt!.gasUsed)) * (tx.gasPrice ?? 0n);
            expect(await balance(ctx.organizador.address)).to.equal(
                antes + COMISION - gas
            );
        });

        it("revierte si no hay fondos para retirar y al segundo retiro (invariante 8)", async function () {
            const ctx = await conVenta();
            await expect(
                ctx.reventa.connect(ctx.otro).retirar()
            ).to.be.revertedWithCustomError(ctx.reventa, E_SIN_FONDOS);
            await ctx.reventa.connect(ctx.vendedor).retirar();
            await expect(
                ctx.reventa.connect(ctx.vendedor).retirar()
            ).to.be.revertedWithCustomError(ctx.reventa, E_SIN_FONDOS);
        });
    });

    describe("Máquina de estados", function () {
        it("Activo -> Vendido y Activo -> Cancelado son terminales", async function () {
            const { reventa, vendedor, idListado } = await conListado();
            await reventa.connect(vendedor).cancelar(idListado);
            await expect(
                reventa.connect(vendedor).cancelar(idListado)
            ).to.be.revertedWithCustomError(reventa, E_INACTIVO);
        });
    });

    describe("huecos deliberados", function () {
        it.skip("invariante 7: una reentrada en comprar no compra dos veces ni retira de más", async function () {});

        it.skip("listar no debe exigir aprobación infinita sobre toda la colección", async function () {});

        it.skip("nadie puede pagar por fuera para burlar el techo de precio", async function () {});

        it.skip("una compra vista en el mempool no debe poder ser adelantada (front-running)", async function () {});
    });
});
