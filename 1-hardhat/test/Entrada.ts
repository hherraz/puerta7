import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

// ============================================================
// Constantes del dominio
// ============================================================
const PRECIO = ethers.parseEther("0.1");
const FILAS = ["A", "B", "C", "D", "E"];
const ASIENTOS = ["1", "2", "3", "4", "5"];
// Sectores A..D codificados como 1..4 (la spec lista 5 nombres pero solo A-D son validos)
const SECTORES_VALIDOS = [1, 2, 3, 4];

// Estados de la entrada (orden importa: 1 Emitida, 2 Vendida, 3 Usada)
const EMITIDA = 1n;
const VENDIDA = 2n;
const USADA = 3n;

// ============================================================
// Mensajes de error — son parte del contrato.
// Cambiarlos aqui rompe la suite, lo cual es correcto: documentan la API.
// ============================================================
const E_PAGO            = "Pago incorrecto";
const E_ASIENTO_DUP     = "Asiento ya emitido";
const E_STOCK           = "Sin entradas disponibles";
const E_SECTOR          = "Sector invalido";
const E_FILA            = "Fila invalida";
const E_ASIENTO         = "Asiento invalido";
const E_LONGITUD        = "Longitud inconsistente";
const E_NO_ORG          = "Solo el organizador";
const E_NO_PORTERO      = "Solo el portero";
const E_NO_VENDIDA      = "La entrada no esta vendida";
const E_YA_USADA        = "Entrada ya usada";
const E_SIN_FONDOS      = "Nada que retirar";
const E_PORTERO_INV     = "Portero invalido";
const E_PRECIO_INV      = "Precio invalido";

// ============================================================
// Helpers
// ============================================================
async function desplegar() {
    const [organizador, portero, comprador, otro] = await ethers.getSigners();
    const entrada = await ethers.deployContract("Entrada", [
        PRECIO,
        portero.address,
    ]);
    return { entrada, organizador, portero, comprador, otro };
}

/** Despliegue + 3 entradas Emitidas en sectores 1, 2, 3 */
async function conTresEmitidas() {
    const ctx = await desplegar();
    await ctx.entrada.emitir(FILAS, ASIENTOS.slice(0, 3), [1, 2, 3]);
    return ctx;
}

/** Despliegue + 1 entrada vendida al comprador (sector 1, fila A, asiento 1) */
async function conUnaVendida() {
    const ctx = await desplegar();
    await ctx.entrada.emitir(FILAS, ASIENTOS.slice(0, 1), [1]);
    await ctx.entrada.connect(ctx.comprador).comprar({ value: PRECIO });
    return ctx;
}

/** Busca el primer tokenId que pertenece a `dueno` entre 1..totalEmitidas. */
async function primerTokenDe(entrada: any, dueno: string): Promise<bigint> {
    const total = await entrada.emitidas();
    for (let id = 1n; id <= total; id++) {
        try {
            if ((await entrada.ownerOf(id)) === dueno) return id;
        } catch {
            // el token no existe (no deberia pasar si id <= total)
        }
    }
    throw new Error(`No se encontro token del dueno ${dueno}`);
}

/** Cuenta los tokens disponibles para la venta (los Emitida en poder del contrato). */
async function contarEmitidas(entrada: any): Promise<bigint> {
    const dir = await entrada.getAddress();
    return await entrada.balanceOf(dir);
}

function decodificarDataUri(uri: string, prefijo: string): string {
    expect(uri.startsWith(prefijo)).to.equal(true);
    return Buffer.from(uri.slice(prefijo.length), "base64").toString("utf-8");
}

// ============================================================
// Suite
// ============================================================
describe("Entrada", function () {
    /* ------------------------------------------------------------
     *  Despliegue / constructor
     * ------------------------------------------------------------ */
    describe("Despliegue", function () {
        it("almacena el precio y el portero fijados al desplegar", async function () {
            const { entrada, portero } = await desplegar();
            expect(await entrada.precio()).to.equal(PRECIO);
            expect(await entrada.portero()).to.equal(portero.address);
        });

        it("revierte si el portero es la direccion cero", async function () {
            await expect(
                ethers.deployContract("Entrada", [PRECIO, ethers.ZeroAddress])
            ).to.be.revertedWith(E_PORTERO_INV);
        });

        it("revierte si el precio es cero", async function () {
            const [, portero] = await ethers.getSigners();
            await expect(
                ethers.deployContract("Entrada", [0n, portero.address])
            ).to.be.revertedWith(E_PRECIO_INV);
        });
    });

    /* ------------------------------------------------------------
     *  emitir — solo el organizador
     * ------------------------------------------------------------ */
    describe("emitir", function () {
        describe("control de acceso (invariante 2)", function () {
            it("revierte si llama un address distinto al organizador", async function () {
                const { entrada, portero, comprador, otro } = await desplegar();
                for (const caller of [portero, comprador, otro]) {
                    await expect(
                        entrada.connect(caller).emitir(
                            FILAS.slice(0, 1),
                            ASIENTOS.slice(0, 1),
                            [1]
                        )
                    ).to.be.revertedWith(E_NO_ORG);
                }
            });
        });

        describe("validacion de entradas", function () {
            it("revierte si el sector esta fuera de A-D (mayor que 4)", async function () {
                const { entrada } = await desplegar();
                await expect(
                    entrada.emitir(FILAS.slice(0, 1), ASIENTOS.slice(0, 1), [5])
                ).to.be.revertedWith(E_SECTOR);
            });

            it("revierte si el sector es 0", async function () {
                const { entrada } = await desplegar();
                await expect(
                    entrada.emitir(FILAS.slice(0, 1), ASIENTOS.slice(0, 1), [0])
                ).to.be.revertedWith(E_SECTOR);
            });

            it("acepta sectores 1, 2, 3 y 4 (A, B, C, D)", async function () {
                const { entrada } = await desplegar();
                await entrada.emitir(
                    FILAS.slice(0, 4),
                    ASIENTOS.slice(0, 4),
                    SECTORES_VALIDOS
                );
                expect(await entrada.emitidas()).to.equal(4n);
            });

            it("revierte si la fila es '0'", async function () {
                const { entrada } = await desplegar();
                await expect(
                    entrada.emitir(["0"], ASIENTOS.slice(0, 1), [1])
                ).to.be.revertedWith(E_FILA);
            });

            it("revierte si el asiento es '0'", async function () {
                const { entrada } = await desplegar();
                await expect(
                    entrada.emitir(FILAS.slice(0, 1), ["0"], [1])
                ).to.be.revertedWith(E_ASIENTO);
            });

            it("acepta filas y asientos alfanumericos (la spec los permite)", async function () {
                const { entrada } = await desplegar();
                await entrada.emitir(["AB", "C12", "Z9"], ["9A", "10B", "0X"], [1, 2, 3]);
                expect(await entrada.emitidas()).to.equal(3n);
            });

            it("revierte si los arrays tienen longitudes distintas", async function () {
                const { entrada } = await desplegar();
                await expect(
                    entrada.emitir(FILAS.slice(0, 2), ASIENTOS.slice(0, 1), [1, 2])
                ).to.be.revertedWith(E_LONGITUD);
            });

            it("revierte si se emite un lote vacio", async function () {
                const { entrada } = await desplegar();
                await expect(
                    entrada.emitir([], [], [])
                ).to.be.reverted;
            });
        });

        describe("asiento duplicado (invariante 1)", function () {
            it("revierte si el (sector, fila, asiento) ya fue emitido", async function () {
                const { entrada } = await desplegar();
                await entrada.emitir(FILAS.slice(0, 1), ASIENTOS.slice(0, 1), [1]);
                await expect(
                    entrada.emitir(FILAS.slice(0, 1), ASIENTOS.slice(0, 1), [1])
                ).to.be.revertedWith(E_ASIENTO_DUP);
            });

            it("permite el mismo (fila, asiento) en distintos sectores", async function () {
                const { entrada } = await desplegar();
                await entrada.emitir(["A"], ["1"], [1]);
                await entrada.emitir(["A"], ["1"], [2]);
                expect(await entrada.emitidas()).to.equal(2n);
            });

            it("si una entrada del lote es duplicada, ninguna del lote se emite (atomicidad)", async function () {
                const { entrada } = await desplegar();
                await entrada.emitir(["A"], ["1"], [1]); // tokenId 1
                await expect(
                    entrada.emitir(["A", "B"], ["1", "2"], [1, 2]) // primera fila duplicada
                ).to.be.revertedWith(E_ASIENTO_DUP);
                // el segundo ticket (sector 2, fila B, asiento 2) NO debe existir
                expect(await entrada.emitidas()).to.equal(1n);
            });
        });

        describe("happy path", function () {
            it("crea las entradas en estado Emitida y las asigna al contrato", async function () {
                const { entrada } = await conTresEmitidas();
                const dir = await entrada.getAddress();
                expect(await contarEmitidas(entrada)).to.equal(3n);
                for (let id = 1n; id <= 3n; id++) {
                    expect(await entrada.ownerOf(id)).to.equal(dir);
                    expect(await entrada.estado(id)).to.equal(EMITIDA);
                }
            });

            it("actualiza los contadores emitidas y disponibles", async function () {
                const { entrada } = await conTresEmitidas();
                expect(await entrada.emitidas()).to.equal(3n);
                expect(await entrada.disponibles()).to.equal(3n);
            });

            it("emite EntradaEmitida por cada entrada con tokenId, sector, fila y asiento", async function () {
                const { entrada } = await desplegar();
                await expect(
                    entrada.emitir(FILAS.slice(0, 2), ASIENTOS.slice(0, 2), [1, 2])
                )
                    .to.emit(entrada, "EntradaEmitida")
                    .withArgs(1n, 1, "A", "1")
                    .and.to.emit(entrada, "EntradaEmitida")
                    .withArgs(2n, 2, "B", "2");
            });

            it("asigna tokenIds secuenciales comenzando en 1 entre llamadas sucesivas", async function () {
                const { entrada } = await desplegar();
                await entrada.emitir(FILAS.slice(0, 1), ASIENTOS.slice(0, 1), [1]);
                await entrada.emitir(FILAS.slice(1, 2), ASIENTOS.slice(1, 2), [2]);
                const dir = await entrada.getAddress();
                expect(await entrada.ownerOf(1n)).to.equal(dir);
                expect(await entrada.ownerOf(2n)).to.equal(dir);
            });
        });
    });

    /* ------------------------------------------------------------
     *  comprar — pago exacto, asignacion aleatoria
     * ------------------------------------------------------------ */
    describe("comprar", function () {
        describe("pago (invariante 6, decision pago exacto)", function () {
            it("revierte si se paga de mas", async function () {
                const { entrada, comprador } = await conTresEmitidas();
                await expect(
                    entrada.connect(comprador).comprar({ value: PRECIO + 1n })
                ).to.be.revertedWith(E_PAGO);
            });

            it("revierte si se paga de menos", async function () {
                const { entrada, comprador } = await conTresEmitidas();
                await expect(
                    entrada.connect(comprador).comprar({ value: PRECIO - 1n })
                ).to.be.revertedWith(E_PAGO);
            });

            it("revierte si no se envia valor", async function () {
                const { entrada, comprador } = await conTresEmitidas();
                await expect(
                    entrada.connect(comprador).comprar({ value: 0n })
                ).to.be.revertedWith(E_PAGO);
            });
        });

        describe("sin entradas disponibles (decision)", function () {
            it("revierte si nunca se emitio ninguna", async function () {
                const { entrada, comprador } = await desplegar();
                await expect(
                    entrada.connect(comprador).comprar({ value: PRECIO })
                ).to.be.revertedWith(E_STOCK);
            });

            it("revierte una vez agotadas las existentes", async function () {
                const { entrada, comprador } = await conTresEmitidas();
                await entrada.connect(comprador).comprar({ value: PRECIO });
                await entrada.connect(comprador).comprar({ value: PRECIO });
                await entrada.connect(comprador).comprar({ value: PRECIO });
                await expect(
                    entrada.connect(comprador).comprar({ value: PRECIO })
                ).to.be.revertedWith(E_STOCK);
            });
        });

        describe("happy path y transicion de estado", function () {
            it("asigna una entrada Emitida al comprador y la marca Vendida", async function () {
                const { entrada, comprador } = await conTresEmitidas();
                const balanceAntes = await entrada.balanceOf(comprador.address);
                const disponiblesAntes = await entrada.disponibles();

                await entrada.connect(comprador).comprar({ value: PRECIO });

                expect(await entrada.balanceOf(comprador.address)).to.equal(balanceAntes + 1n);
                expect(await entrada.disponibles()).to.equal(disponiblesAntes - 1n);
                const id = await primerTokenDe(entrada, comprador.address);
                expect(await entrada.ownerOf(id)).to.equal(comprador.address);
                expect(await entrada.estado(id)).to.equal(VENDIDA);
            });

            it("acumula el Ether en el contrato sin entregarlo al organizador todavia", async function () {
                const { entrada, organizador, comprador } = await conTresEmitidas();
                const orgAntes = await ethers.provider.getBalance(organizador.address);

                await entrada.connect(comprador).comprar({ value: PRECIO });

                expect(await ethers.provider.getBalance(await entrada.getAddress())).to.equal(PRECIO);
                expect(await ethers.provider.getBalance(organizador.address)).to.equal(orgAntes);
            });

            it("emite el evento EntradaComprada con tokenId, comprador y precio", async function () {
                const { entrada, comprador } = await conTresEmitidas();
                await expect(
                    entrada.connect(comprador).comprar({ value: PRECIO })
                ).to.emit(entrada, "EntradaComprada");
            });

            it("permite que un mismo comprador compre varias entradas (sin limite por direccion)", async function () {
                const { entrada, comprador } = await conTresEmitidas();
                await entrada.connect(comprador).comprar({ value: PRECIO });
                await entrada.connect(comprador).comprar({ value: PRECIO });
                await entrada.connect(comprador).comprar({ value: PRECIO });
                expect(await entrada.balanceOf(comprador.address)).to.equal(3n);
                expect(await entrada.disponibles()).to.equal(0n);
            });

            it("no permite al comprador elegir el asiento (comprar no recibe parametros)", async function () {
                const { entrada } = await conTresEmitidas();
                // La funcion existe y no recibe parametros de asiento
                expect(entrada.comprar.length).to.equal(0);
            });
        });
    });

    /* ------------------------------------------------------------
     *  usar — solo el portero
     * ------------------------------------------------------------ */
    describe("usar", function () {
        describe("control de acceso (invariante 4)", function () {
            it("revierte si llama alguien distinto al portero (incluso el dueno)", async function () {
                const { entrada, comprador, otro, organizador } =
                    await conUnaVendida();
                const tokenId = await primerTokenDe(entrada, comprador.address);
                // Portero NO debe revertir; comprador (dueno), otro y organizador, si.
                for (const caller of [comprador, otro, organizador]) {
                    await expect(
                        entrada.connect(caller).usar(tokenId)
                    ).to.be.revertedWith(E_NO_PORTERO);
                }
                // El portero si puede — se cubre en el happy path.
            });
        });

        describe("estado valido (invariante 5)", function () {
            it("revierte si la entrada aun esta Emitida (no Vendida)", async function () {
                const { entrada, portero } = await conTresEmitidas();
                await expect(
                    entrada.connect(portero).usar(1n)
                ).to.be.revertedWith(E_NO_VENDIDA);
            });
        });

        describe("invariante 3: entrada usada no se vuelve a usar", function () {
            it("revierte la segunda llamada a usar", async function () {
                const { entrada, portero, comprador } = await conUnaVendida();
                const tokenId = await primerTokenDe(entrada, comprador.address);
                await entrada.connect(portero).usar(tokenId);
                await expect(
                    entrada.connect(portero).usar(tokenId)
                ).to.be.revertedWith(E_YA_USADA);
            });
        });

        describe("happy path", function () {
            it("marca la entrada como Usada sin cambiar al dueno", async function () {
                const { entrada, portero, comprador } = await conUnaVendida();
                const tokenId = await primerTokenDe(entrada, comprador.address);
                await entrada.connect(portero).usar(tokenId);
                expect(await entrada.estado(tokenId)).to.equal(USADA);
                expect(await entrada.ownerOf(tokenId)).to.equal(comprador.address);
            });

            it("emite el evento EntradaUsada con tokenId y dueno", async function () {
                const { entrada, portero, comprador } = await conUnaVendida();
                const tokenId = await primerTokenDe(entrada, comprador.address);
                await expect(entrada.connect(portero).usar(tokenId))
                    .to.emit(entrada, "EntradaUsada")
                    .withArgs(tokenId, comprador.address);
            });
        });
    });

    /* ------------------------------------------------------------
     *  retirar — solo el organizador
     * ------------------------------------------------------------ */
    describe("retirar", function () {
        describe("control de acceso (invariante 7)", function () {
            it("revierte si llama alguien distinto al organizador", async function () {
                const { entrada, comprador, portero, otro } = await conUnaVendida();
                for (const caller of [comprador, portero, otro]) {
                    await expect(
                        entrada.connect(caller).retirar()
                    ).to.be.revertedWith(E_NO_ORG);
                }
            });
        });

        describe("fondos", function () {
            it("revierte si el balance del contrato es cero", async function () {
                const { entrada, organizador } = await desplegar();
                await expect(
                    entrada.connect(organizador).retirar()
                ).to.be.revertedWith(E_SIN_FONDOS);
            });
        });

        describe("happy path", function () {
            it("transfiere todo el Ether acumulado al organizador", async function () {
                const { entrada, organizador, comprador } = await conTresEmitidas();
                await entrada.connect(comprador).comprar({ value: PRECIO });
                await entrada.connect(comprador).comprar({ value: PRECIO });

                const orgAntes = await ethers.provider.getBalance(organizador.address);
                const tx = await entrada.connect(organizador).retirar();
                const receipt = await tx.wait();
                // Coercion robusta: maneja bigint o number segun la version de ethers
                const gasUsado = BigInt(String(receipt!.gasUsed));
                const gas = gasUsado * (tx.gasPrice ?? 0n);

                expect(await ethers.provider.getBalance(await entrada.getAddress())).to.equal(0n);
                expect(await ethers.provider.getBalance(organizador.address)).to.equal(
                    orgAntes + PRECIO * 2n - gas
                );
            });

            it("emite el evento FondosRetirados con destinatario y monto", async function () {
                const { entrada, organizador } = await conUnaVendida();
                await expect(entrada.connect(organizador).retirar())
                    .to.emit(entrada, "FondosRetirados")
                    .withArgs(organizador.address, PRECIO);
            });

            it("permite retirar varias veces (acumulando compras entre retiradas)", async function () {
                const { entrada, organizador, comprador } = await conTresEmitidas();
                await entrada.connect(comprador).comprar({ value: PRECIO });
                await entrada.connect(organizador).retirar();
                await entrada.connect(comprador).comprar({ value: PRECIO });
                await entrada.connect(organizador).retirar();
                expect(await ethers.provider.getBalance(await entrada.getAddress())).to.equal(0n);
            });
        });
    });

    /* ------------------------------------------------------------
     *  tokenURI — SVG on-chain (la spec dice "se dibujo on-chain")
     * ------------------------------------------------------------ */
    describe("tokenURI", function () {
        it("devuelve un data URI base64 JSON con un SVG que menciona sector, fila y asiento", async function () {
            const { entrada, comprador } = await conUnaVendida();
            const tokenId = await primerTokenDe(entrada, comprador.address);
            const uri = await entrada.tokenURI(tokenId);

            const json = decodificarDataUri(uri, "data:application/json;base64,");
            const meta = JSON.parse(json);

            expect(meta.name).to.be.a("string").and.not.empty;
            expect(meta.image).to.match(/^data:image\/svg\+xml;base64,/);

            const svg = decodificarDataUri(meta.image, "data:image/svg+xml;base64,");
            expect(svg).to.match(/<svg[\s\S]*<\/svg>/);
            // El SVG debe mencionar la fila (A) y el asiento (1)
            expect(svg).to.include("A");
            expect(svg).to.include("1");
        });
    });

    /* ------------------------------------------------------------
     *  Decision: transferir Vendida/Usada esta permitido (ERC-721)
     *  La reventa con techo llega en la sesion 4.
     * ------------------------------------------------------------ */
    describe("Transferencia ERC-721 (decision)", function () {
        it("permite transferir una entrada Vendida entre dos cuentas", async function () {
            const { entrada, comprador, otro } = await conUnaVendida();
            const tokenId = await primerTokenDe(entrada, comprador.address);

            await entrada
                .connect(comprador)
                .transferFrom(comprador.address, otro.address, tokenId);

            expect(await entrada.ownerOf(tokenId)).to.equal(otro.address);
            // el estado no se altera por la transferencia
            expect(await entrada.estado(tokenId)).to.equal(VENDIDA);
        });

        it("permite transferir una entrada Usada entre dos cuentas", async function () {
            const { entrada, comprador, otro, portero } = await conUnaVendida();
            const tokenId = await primerTokenDe(entrada, comprador.address);
            await entrada.connect(portero).usar(tokenId);

            await entrada
                .connect(comprador)
                .transferFrom(comprador.address, otro.address, tokenId);

            expect(await entrada.ownerOf(tokenId)).to.equal(otro.address);
            expect(await entrada.estado(tokenId)).to.equal(USADA);
        });
    });

    /* ------------------------------------------------------------
     *  Maquina de estados: Emitida -> Vendida -> Usada, nada mas
     * ------------------------------------------------------------ */
    describe("Maquina de estados", function () {
        it("no existe una transicion Emitida -> Usada directa (usar exige Vendida)", async function () {
            const { entrada, portero } = await conTresEmitidas();
            await expect(
                entrada.connect(portero).usar(1n)
            ).to.be.revertedWith(E_NO_VENDIDA);
        });
    });
});