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
const E_RENUNCIA        = "Renuncia deshabilitada";
const E_FUERA_HORARIO   = "Fuera del horario de ingreso";
const E_VENTANA_INV     = "Ventana invalida";

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

/** Compra completa en dos pasos: paga y reserva, deja pasar el bloque cuyo
 *  hash va a elegir el asiento, y confirma. */
async function comprarEntrada(entrada: any, comprador: any) {
    await entrada.connect(comprador).comprar({ value: PRECIO });
    await ethers.provider.send("evm_mine", []);
    await entrada.connect(comprador).confirmarCompras(10);
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
    await comprarEntrada(ctx.entrada, ctx.comprador);
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

            it("revierte si la fila o el asiento traen caracteres no alfanumericos (inyeccion en tokenURI)", async function () {
                const { entrada } = await desplegar();
                // Una comilla cierra el string del JSON y permite inyectar
                // campos ("image" propio); un "<" inyecta marcado en el SVG.
                await expect(
                    entrada.emitir(['A","image":"https://x'], ["1"], [1])
                ).to.be.revertedWith(E_FILA);
                await expect(
                    entrada.emitir(["A"], ["1</text><script>"], [1])
                ).to.be.revertedWith(E_ASIENTO);
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
                ).to.be.revertedWith("Lote vacio");
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
                await comprarEntrada(entrada, comprador);
                await comprarEntrada(entrada, comprador);
                await comprarEntrada(entrada, comprador);
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

                await comprarEntrada(entrada, comprador);

                expect(await entrada.balanceOf(comprador.address)).to.equal(balanceAntes + 1n);
                expect(await entrada.disponibles()).to.equal(disponiblesAntes - 1n);
                const id = await primerTokenDe(entrada, comprador.address);
                expect(await entrada.ownerOf(id)).to.equal(comprador.address);
                expect(await entrada.estado(id)).to.equal(VENDIDA);
            });

            it("acumula el Ether en el contrato sin entregarlo al organizador todavia", async function () {
                const { entrada, organizador, comprador } = await conTresEmitidas();
                const orgAntes = await ethers.provider.getBalance(organizador.address);

                await comprarEntrada(entrada, comprador);

                expect(await ethers.provider.getBalance(await entrada.getAddress())).to.equal(PRECIO);
                expect(await ethers.provider.getBalance(organizador.address)).to.equal(orgAntes);
            });

            it("emite CompraReservada al pagar y EntradaComprada al confirmar", async function () {
                const { entrada, comprador } = await conTresEmitidas();
                await expect(
                    entrada.connect(comprador).comprar({ value: PRECIO })
                )
                    .to.emit(entrada, "CompraReservada")
                    .withArgs(1n, comprador.address);
                await ethers.provider.send("evm_mine", []);
                await expect(
                    entrada.connect(comprador).confirmarCompras(10)
                ).to.emit(entrada, "EntradaComprada");
            });

            it("permite que un mismo comprador compre varias entradas (sin limite por direccion)", async function () {
                const { entrada, comprador } = await conTresEmitidas();
                await comprarEntrada(entrada, comprador);
                await comprarEntrada(entrada, comprador);
                await comprarEntrada(entrada, comprador);
                expect(await entrada.balanceOf(comprador.address)).to.equal(3n);
                expect(await entrada.disponibles()).to.equal(0n);
            });

            it("no permite al comprador elegir el asiento (comprar no recibe parametros)", async function () {
                const { entrada } = await conTresEmitidas();
                // La funcion existe y no recibe parametros de asiento
                expect(entrada.comprar.length).to.equal(0);
            });
        });

        describe("azar de un bloque futuro (N1: simular y revertir)", function () {
            it("pagar solo reserva: el asiento se asigna recien cuando existe el hash del bloque siguiente", async function () {
                const { entrada, comprador } = await conTresEmitidas();
                await entrada.connect(comprador).comprar({ value: PRECIO });
                // Pago y stock reservados, pero todavia sin entrada.
                expect(await entrada.balanceOf(comprador.address)).to.equal(0n);
                expect(await entrada.disponibles()).to.equal(2n);
                // En el bloque siguiente su hash todavia no existe: no hay nada que confirmar.
                await entrada.connect(comprador).confirmarCompras(10);
                expect(await entrada.balanceOf(comprador.address)).to.equal(0n);
                // Un bloque mas tarde ya se puede asignar.
                await entrada.connect(comprador).confirmarCompras(10);
                expect(await entrada.balanceOf(comprador.address)).to.equal(1n);
            });

            it("un contrato atacante no puede comprar y revertir hasta conseguir el asiento que quiere", async function () {
                const { entrada } = await conTresEmitidas();
                const atacante: any = await ethers.deployContract("AtacanteCompra", [
                    await entrada.getAddress(),
                ]);
                // Diez intentos, en bloques distintos, de quedarse con la entrada 3.
                let consiguio = false;
                for (let intento = 0; intento < 10 && !consiguio; intento++) {
                    try {
                        await atacante.atacar(3n, { value: PRECIO });
                        consiguio = true;
                    } catch {
                        await ethers.provider.send("evm_mine", []);
                    }
                }
                expect(consiguio).to.equal(false);
                expect(await entrada.ownerOf(3n)).to.equal(await entrada.getAddress());
            });

            it("el asiento sale del hash del bloque siguiente a la reserva: no depende de quien ni cuando confirma", async function () {
                const { entrada, comprador, otro } = await conTresEmitidas();
                const tx = await entrada.connect(comprador).comprar({ value: PRECIO });
                const bloque = (await tx.wait())!.blockNumber;
                // Confirma otra cuenta, varios bloques despues.
                for (let i = 0; i < 5; i++) await ethers.provider.send("evm_mine", []);
                await entrada.connect(otro).confirmarCompras(10);
                const semilla = (await ethers.provider.getBlock(bloque + 1))!.hash!;
                const indice =
                    BigInt(ethers.solidityPackedKeccak256(["bytes32", "uint256"], [semilla, 1n])) % 3n;
                const esperado = [1n, 2n, 3n][Number(indice)];
                expect(await entrada.ownerOf(esperado)).to.equal(comprador.address);
            });
        });
    });

    /* ------------------------------------------------------------
     *  confirmarCompras — cualquiera, en orden de llegada
     * ------------------------------------------------------------ */
    describe("confirmarCompras", function () {
        it("cualquiera puede confirmar y las reservas se procesan en orden de llegada", async function () {
            const { entrada, comprador, otro } = await conTresEmitidas();
            await entrada.connect(comprador).comprar({ value: PRECIO });
            await expect(entrada.connect(otro).comprar({ value: PRECIO }))
                .to.emit(entrada, "CompraReservada")
                .withArgs(2n, otro.address);
            await ethers.provider.send("evm_mine", []);
            // Maximo 1: solo la primera reserva, aunque confirme el segundo.
            await entrada.connect(otro).confirmarCompras(1);
            expect(await entrada.balanceOf(comprador.address)).to.equal(1n);
            expect(await entrada.balanceOf(otro.address)).to.equal(0n);
            await entrada.connect(otro).confirmarCompras(1);
            expect(await entrada.balanceOf(otro.address)).to.equal(1n);
        });

        it("si nadie confirma en 256 bloques, la reserva se reprograma con un bloque nuevo", async function () {
            // El EVM solo recuerda el hash de los ultimos 256 bloques.
            const { entrada, comprador } = await conTresEmitidas();
            await entrada.connect(comprador).comprar({ value: PRECIO });
            await ethers.provider.send("hardhat_mine", ["0x104"]); // 260 bloques
            await expect(entrada.confirmarCompras(10))
                .to.emit(entrada, "CompraReprogramada")
                .withArgs(1n);
            expect(await entrada.balanceOf(comprador.address)).to.equal(0n);
            await ethers.provider.send("evm_mine", []);
            await entrada.confirmarCompras(10);
            expect(await entrada.balanceOf(comprador.address)).to.equal(1n);
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

        describe("ventana de ingreso (N3: el portero como oraculo)", function () {
            it("con ventana definida, el portero solo marca durante el horario del evento", async function () {
                const { entrada, portero, comprador } = await conTresEmitidas();
                await comprarEntrada(entrada, comprador);
                await comprarEntrada(entrada, comprador);
                const suyas: bigint[] = [];
                for (let id = 1n; id <= 3n; id++) {
                    if ((await entrada.ownerOf(id)) === comprador.address) suyas.push(id);
                }
                const ahora = (await ethers.provider.getBlock("latest"))!.timestamp;
                await entrada.definirVentanaIngreso(ahora + 3600, ahora + 7200);
                // El dia antes, "desde su casa": no pasa.
                await expect(entrada.connect(portero).usar(suyas[0])).to.be.revertedWith(E_FUERA_HORARIO);
                // Durante el evento: si.
                await ethers.provider.send("evm_increaseTime", [3600]);
                await ethers.provider.send("evm_mine", []);
                await entrada.connect(portero).usar(suyas[0]);
                expect(await entrada.estado(suyas[0])).to.equal(USADA);
                // Terminado el evento: tampoco.
                await ethers.provider.send("evm_increaseTime", [3601]);
                await ethers.provider.send("evm_mine", []);
                await expect(entrada.connect(portero).usar(suyas[1])).to.be.revertedWith(E_FUERA_HORARIO);
            });
        });
    });

    /* ------------------------------------------------------------
     *  definirVentanaIngreso — solo el organizador
     * ------------------------------------------------------------ */
    describe("definirVentanaIngreso", function () {
        it("solo el organizador la define, rechaza inicio >= fin y emite VentanaIngresoDefinida", async function () {
            const { entrada, portero } = await desplegar();
            await expect(
                entrada.connect(portero).definirVentanaIngreso(1n, 2n)
            ).to.be.revertedWith(E_NO_ORG);
            await expect(entrada.definirVentanaIngreso(2n, 2n)).to.be.revertedWith(E_VENTANA_INV);
            await expect(entrada.definirVentanaIngreso(1n, 2n))
                .to.emit(entrada, "VentanaIngresoDefinida")
                .withArgs(1n, 2n);
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
                await comprarEntrada(entrada, comprador);
                await comprarEntrada(entrada, comprador);

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
                await comprarEntrada(entrada, comprador);
                await entrada.connect(organizador).retirar();
                await comprarEntrada(entrada, comprador);
                await entrada.connect(organizador).retirar();
                expect(await ethers.provider.getBalance(await entrada.getAddress())).to.equal(0n);
            });
        });
    });

    /* ------------------------------------------------------------
     *  renounceOwnership — heredada de Ownable, deshabilitada
     * ------------------------------------------------------------ */
    describe("renounceOwnership", function () {
        it("revierte: sin organizador lo recaudado quedaria atrapado para siempre", async function () {
            const { entrada, organizador } = await conUnaVendida();
            await expect(entrada.renounceOwnership()).to.be.revertedWith(E_RENUNCIA);
            // el organizador sigue pudiendo retirar
            expect(await entrada.owner()).to.equal(organizador.address);
            await entrada.retirar();
        });
    });

    /* ------------------------------------------------------------
     *  transferOwnership — en dos pasos (Ownable2Step)
     * ------------------------------------------------------------ */
    describe("transferOwnership", function () {
        it("el traspaso necesita que el nuevo organizador lo acepte (un error de tipeo no pierde el control)", async function () {
            const { entrada, organizador, otro } = await desplegar();
            await entrada.transferOwnership(otro.address);
            // Hasta que acepte, sigue mandando el organizador actual.
            expect(await entrada.owner()).to.equal(organizador.address);
            expect(await entrada.pendingOwner()).to.equal(otro.address);
            await entrada.connect(otro).acceptOwnership();
            expect(await entrada.owner()).to.equal(otro.address);
        });
    });

    /* ------------------------------------------------------------
     *  quemar — operador autorizado, con permiso del dueño
     * ------------------------------------------------------------ */
    describe("quemar", function () {
        it("un operador no puede quemar una entrada sin permiso de su dueño", async function () {
            const { entrada, comprador, otro } = await conUnaVendida();
            const tokenId = await primerTokenDe(entrada, comprador.address);
            await entrada.designarOperadorAutorizado(otro.address, true);
            await expect(
                entrada.connect(otro).quemar(tokenId)
            ).to.be.revertedWithCustomError(entrada, "ERC721InsufficientApproval");
            await entrada.connect(comprador).approve(otro.address, tokenId);
            await expect(entrada.connect(otro).quemar(tokenId))
                .to.emit(entrada, "EntradaQuemada")
                .withArgs(tokenId);
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

        it("cuenta los cambios de dueño entre personas (Reventa lo usa para invalidar listados viejos)", async function () {
            const { entrada, comprador, otro } = await conUnaVendida();
            const tokenId = await primerTokenDe(entrada, comprador.address);
            // La primera venta (del contrato al comprador) no cuenta.
            expect(await entrada.transferencias(tokenId)).to.equal(0n);
            await entrada.connect(comprador).transferFrom(comprador.address, otro.address, tokenId);
            await entrada.connect(otro).transferFrom(otro.address, comprador.address, tokenId);
            expect(await entrada.transferencias(tokenId)).to.equal(2n);
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