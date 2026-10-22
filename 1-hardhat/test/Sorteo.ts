import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

// ============================================================
// Suite Sorteo — Sesión 2 (docs/spec/sorteo.md)
//
// Valida `Sorteo.sol` contra la spec (esta suite es la spec
// ejecutable, TDD).
//
// Interfaz mínima asumida (solo lo que nombra la spec):
//   constructor(address entrada, uint256 deposito)
//   abrirSorteo(uint256 cantidadEntradas, uint256 duracionCompromiso, uint256 duracionRevelacion)
//   comprometer(bytes32 compromiso) payable
//   revelar(uint256 valor, bytes32 salt)
//   cerrar()
//   reclamar()
//
// Permiso cruzado: Sorteo necesita permiso en Entrada para
// entregar entradas a los ganadores (y nada más, dice la spec).
// Es `Entrada.designarOperadorAutorizado(sorteo, true)`, que el
// despliegue (helper `desplegar`) invoca tras desplegar Sorteo.
//
// Errores: la spec los nombra como custom errors, así que se
// verifican con `revertedWithCustomError`. Si la implementación
// usa `revert("...")` como Entrada.sol hoy, cambiar cada chequeo
// por `revertedWith(E_...)` con el mismo texto.
// ============================================================
const PRECIO = ethers.parseEther("0.1");
const DEPOSITO = ethers.parseEther("0.01");
const DURACION = 3600; // 1 hora por fase

const E_NO_ABIERTO = "SorteoNoAbierto";
const E_FUERA_COMPROMISO = "FueraDePlazoCompromiso";
const E_FUERA_REVELACION = "FueraDePlazoRevelacion";
const E_NO_COINCIDE = "CompromisoNoCoincide";
const E_YA_COMPROMETIO = "YaComprometio";
const E_YA_REVELO = "YaRevelo";
const E_YA_RECLAMO = "YaReclamo";
const E_DEPOSITO = "DepositoInsuficiente";
const E_NO_CERRADO = "SorteoNoCerrado";
const E_YA_ABIERTO = "SorteoYaAbierto";
const E_DEPOSITO_EXCEDIDO = "DepositoExcedido";
const E_DEMASIADAS = "DemasiadasEntradas";
const E_SIN_FONDOS = "SinFondosParaRetirar";
const E_RENUNCIA = "RenunciaDeshabilitada";

const SAL_A = ethers.id("sal-a");
const SAL_B = ethers.id("sal-b");
const SAL_C = ethers.id("sal-c");

async function desplegar() {
    const [organizador, portero, alice, bob, caro, otro] =
        await ethers.getSigners();
    const entrada: any = await ethers.deployContract("Entrada", [
        PRECIO,
        portero.address,
    ]);
    const sorteo: any = await ethers.deployContract("Sorteo", [
        await entrada.getAddress(),
        DEPOSITO,
    ]);
    // Permiso cruzado: Sorteo emite la entrada de cada ganador.
    await entrada.designarOperadorAutorizado(
        await sorteo.getAddress(),
        true
    );
    return { entrada, sorteo, organizador, portero, alice, bob, caro, otro };
}

/** Compromiso según la spec: keccak256(abi.encodePacked(valor, salt, msg.sender)) */
function compromisoDe(valor: bigint, salt: string, direccion: string) {
    return ethers.solidityPackedKeccak256(
        ["uint256", "bytes32", "address"],
        [valor, salt, direccion]
    );
}

async function avanzarTiempo(segundos: number) {
    await ethers.provider.send("evm_increaseTime", [segundos]);
    await ethers.provider.send("evm_mine", []);
}

/** Cierre en dos pasos: el primero fija un bloque futuro, el segundo (ya
 *  minado ese bloque) sortea con su hash. */
async function cerrarSorteo(sorteo: any) {
    await sorteo.cerrar();
    await ethers.provider.send("evm_mine", []);
    return sorteo.cerrar();
}

/** Sorteo abierto con `cantidad` entradas y fases de 1 hora. */
async function conSorteoAbierto(cantidad = 2) {
    const ctx = await desplegar();
    await ctx.sorteo.abrirSorteo(cantidad, DURACION, DURACION);
    return ctx;
}

async function comprometer(
    sorteo: any,
    postulante: any,
    valor: bigint,
    salt: string
) {
    const compromiso = compromisoDe(valor, salt, postulante.address);
    await sorteo
        .connect(postulante)
        .comprometer(compromiso, { value: DEPOSITO });
    return compromiso;
}

/** `n` postulantes (signers 2..n+1) comprometidos y revelados, con la
 *  revelación ya vencida: listo para `cerrar`. */
async function conRevelados(n: number, cantidad: number) {
    const ctx = await conSorteoAbierto(cantidad);
    const postulantes = (await ethers.getSigners()).slice(2, 2 + n);
    for (const [i, p] of postulantes.entries()) {
        await comprometer(ctx.sorteo, p, BigInt(i + 1), SAL_A);
    }
    await avanzarTiempo(DURACION + 1);
    for (const [i, p] of postulantes.entries()) {
        await ctx.sorteo.connect(p).revelar(BigInt(i + 1), SAL_A);
    }
    await avanzarTiempo(DURACION + 1);
    return { ...ctx, postulantes };
}

/** Dos postulantes comprometidos y revelados (valores 11 y 22). */
async function conDosRevelados(cantidad = 2) {
    const ctx = await conSorteoAbierto(cantidad);
    await comprometer(ctx.sorteo, ctx.alice, 11n, SAL_A);
    await comprometer(ctx.sorteo, ctx.bob, 22n, SAL_B);
    await avanzarTiempo(DURACION + 1);
    await ctx.sorteo.connect(ctx.alice).revelar(11n, SAL_A);
    await ctx.sorteo.connect(ctx.bob).revelar(22n, SAL_B);
    return ctx;
}

describe("Sorteo", function () {
    describe("abrirSorteo", function () {
        it("revierte si llama alguien distinto al organizador", async function () {
            const { sorteo, alice } = await desplegar();
            await expect(
                sorteo.connect(alice).abrirSorteo(2, DURACION, DURACION)
            ).to.be.revert(ethers);
        });

        it("emite SorteoAbierto con la cantidad de entradas anunciada", async function () {
            const { sorteo } = await desplegar();
            await expect(sorteo.abrirSorteo(2, DURACION, DURACION)).to.emit(
                sorteo,
                "SorteoAbierto"
            );
        });

        it("no se puede reabrir: ni con el sorteo en curso ni después del cierre", async function () {
            // Reabrir movería los plazos (invariantes 2 y 3) y, tras el
            // cierre, recalcularía ganadores sobre los que ya reclamaron
            // (más entradas que las anunciadas, invariante 5).
            const { sorteo } = await conDosRevelados(1);
            await expect(
                sorteo.abrirSorteo(1, DURACION, DURACION)
            ).to.be.revertedWithCustomError(sorteo, E_YA_ABIERTO);
            await avanzarTiempo(DURACION + 1);
            await cerrarSorteo(sorteo);
            await expect(
                sorteo.abrirSorteo(1, DURACION, DURACION)
            ).to.be.revertedWithCustomError(sorteo, E_YA_ABIERTO);
        });

        it("revierte si se anuncian más entradas de las que entran en un cierre (tope por gas)", async function () {
            // Cada entrada sorteada cuesta ~30.000 gas al cerrar; con un tope
            // de 500 el cierre usa la mitad de un bloque y nunca se traba.
            const { sorteo } = await desplegar();
            await expect(
                sorteo.abrirSorteo(501, DURACION, DURACION)
            ).to.be.revertedWithCustomError(sorteo, E_DEMASIADAS);
            await expect(sorteo.abrirSorteo(500, DURACION, DURACION)).to.emit(
                sorteo,
                "SorteoAbierto"
            );
        });
    });

    describe("comprometer", function () {
        it("acepta el compromiso con depósito y emite PostulacionComprometida", async function () {
            const { sorteo, alice } = await conSorteoAbierto();
            const compromiso = compromisoDe(11n, SAL_A, alice.address);
            await expect(
                sorteo
                    .connect(alice)
                    .comprometer(compromiso, { value: DEPOSITO })
            )
                .to.emit(sorteo, "PostulacionComprometida")
                .withArgs(alice.address, compromiso);
            expect(
                await ethers.provider.getBalance(await sorteo.getAddress())
            ).to.equal(DEPOSITO);
        });

        it("revierte si el depósito es insuficiente (invariante: depósito requerido)", async function () {
            const { sorteo, alice } = await conSorteoAbierto();
            const compromiso = compromisoDe(11n, SAL_A, alice.address);
            await expect(
                sorteo
                    .connect(alice)
                    .comprometer(compromiso, { value: DEPOSITO - 1n })
            ).to.be.revertedWithCustomError(sorteo, E_DEPOSITO);
        });

        it("revierte si el depósito excede lo requerido (el excedente quedaría atrapado)", async function () {
            // `reclamar` devuelve exactamente `deposito`: lo que sobre no
            // tendría forma de salir del contrato.
            const { sorteo, alice } = await conSorteoAbierto();
            const compromiso = compromisoDe(11n, SAL_A, alice.address);
            await expect(
                sorteo
                    .connect(alice)
                    .comprometer(compromiso, { value: DEPOSITO + 1n })
            ).to.be.revertedWithCustomError(sorteo, E_DEPOSITO_EXCEDIDO);
        });

        it("revierte si el mismo postulante compromete dos veces", async function () {
            const { sorteo, alice } = await conSorteoAbierto();
            await comprometer(sorteo, alice, 11n, SAL_A);
            await expect(
                comprometer(sorteo, alice, 99n, SAL_C)
            ).to.be.revertedWithCustomError(sorteo, E_YA_COMPROMETIO);
        });

        it("revierte si no hay sorteo abierto", async function () {
            const { sorteo, alice } = await desplegar();
            const compromiso = compromisoDe(11n, SAL_A, alice.address);
            await expect(
                sorteo
                    .connect(alice)
                    .comprometer(compromiso, { value: DEPOSITO })
            ).to.be.revertedWithCustomError(sorteo, E_NO_ABIERTO);
        });

        it("revierte una vez vencido el plazo de compromiso (invariante 2)", async function () {
            const { sorteo, alice } = await conSorteoAbierto();
            await avanzarTiempo(DURACION + 1);
            const compromiso = compromisoDe(11n, SAL_A, alice.address);
            await expect(
                sorteo
                    .connect(alice)
                    .comprometer(compromiso, { value: DEPOSITO })
            ).to.be.revertedWithCustomError(sorteo, E_FUERA_COMPROMISO);
        });
    });

    describe("revelar", function () {
        it("acepta la revelación que coincide y emite PostulacionRevelada", async function () {
            const { sorteo, alice } = await conSorteoAbierto();
            await comprometer(sorteo, alice, 11n, SAL_A);
            await avanzarTiempo(DURACION + 1);
            await expect(sorteo.connect(alice).revelar(11n, SAL_A))
                .to.emit(sorteo, "PostulacionRevelada")
                .withArgs(alice.address, 11n);
        });

        it("revierte si el valor no corresponde al compromiso (invariante 1)", async function () {
            const { sorteo, alice } = await conSorteoAbierto();
            await comprometer(sorteo, alice, 11n, SAL_A);
            await avanzarTiempo(DURACION + 1);
            await expect(
                sorteo.connect(alice).revelar(12n, SAL_A)
            ).to.be.revertedWithCustomError(sorteo, E_NO_COINCIDE);
        });

        it("revierte si se revela antes de que termine el compromiso (invariante 3)", async function () {
            const { sorteo, alice } = await conSorteoAbierto();
            await comprometer(sorteo, alice, 11n, SAL_A);
            await expect(
                sorteo.connect(alice).revelar(11n, SAL_A)
            ).to.be.revertedWithCustomError(sorteo, E_FUERA_REVELACION);
        });

        it("revierte la segunda revelación del mismo postulante", async function () {
            const { sorteo, alice } = await conDosRevelados();
            await expect(
                sorteo.connect(alice).revelar(11n, SAL_A)
            ).to.be.revertedWithCustomError(sorteo, E_YA_REVELO);
        });

        it("revierte si revela quien nunca comprometió", async function () {
            const { sorteo, caro } = await conDosRevelados();
            await expect(sorteo.connect(caro).revelar(11n, SAL_A)).to.be
                .revert(ethers);
        });

        it("el compromiso copiado de otro no sirve: incluye la dirección", async function () {
            const { sorteo, alice, bob } = await conSorteoAbierto();
            // Bob registra el hash de Alice (calculado con la dirección de Alice).
            const compromisoDeAlice = compromisoDe(11n, SAL_A, alice.address);
            await sorteo
                .connect(bob)
                .comprometer(compromisoDeAlice, { value: DEPOSITO });
            await avanzarTiempo(DURACION + 1);
            await expect(
                sorteo.connect(bob).revelar(11n, SAL_A)
            ).to.be.revertedWithCustomError(sorteo, E_NO_COINCIDE);
        });
    });

    describe("cerrar", function () {
        it("revierte si todavía no venció el plazo de revelación", async function () {
            const { sorteo } = await conDosRevelados();
            await expect(sorteo.cerrar()).to.be.revert(ethers);
        });

        it("cualquiera puede cerrar vencido el plazo: primero fija el bloque, después sortea", async function () {
            const { sorteo, otro } = await conDosRevelados();
            await avanzarTiempo(DURACION + 1);
            await expect(sorteo.connect(otro).cerrar()).to.emit(
                sorteo,
                "CierreSolicitado"
            );
            expect(await sorteo.cerrado()).to.equal(false);
            await ethers.provider.send("evm_mine", []);
            await expect(sorteo.connect(otro).cerrar()).to.emit(
                sorteo,
                "SorteoCerrado"
            );
        });

        it("el cierre no se bloquea si un comprometido nunca reveló", async function () {
            const { sorteo, alice, bob } = await conSorteoAbierto();
            await comprometer(sorteo, alice, 11n, SAL_A);
            await comprometer(sorteo, bob, 22n, SAL_B);
            await avanzarTiempo(DURACION + 1);
            await sorteo.connect(alice).revelar(11n, SAL_A);
            await avanzarTiempo(DURACION + 1);
            await expect(cerrarSorteo(sorteo)).to.emit(sorteo, "SorteoCerrado");
        });

        it("si nadie completa el cierre en 256 bloques, se fija un bloque nuevo", async function () {
            // El EVM solo recuerda el hash de los últimos 256 bloques.
            const { sorteo } = await conDosRevelados();
            await avanzarTiempo(DURACION + 1);
            await sorteo.cerrar();
            await ethers.provider.send("hardhat_mine", ["0x104"]); // 260 bloques
            await expect(sorteo.cerrar()).to.emit(sorteo, "CierreSolicitado");
            expect(await sorteo.cerrado()).to.equal(false);
            await ethers.provider.send("evm_mine", []);
            await expect(sorteo.cerrar()).to.emit(sorteo, "SorteoCerrado");
        });

        it("el costo de cerrar no crece con la cantidad de postulantes (sin DoS)", async function () {
            // Si `cerrar` recorre a todos los revelados, cualquiera puede
            // sumar postulantes (pagando depósitos) hasta que el cierre
            // supere el límite de gas del bloque: nadie cierra y todos los
            // depósitos quedan atrapados (invariante 7).
            const gasDeCerrar = async (n: number) => {
                const { sorteo } = await conRevelados(n, 1);
                const recibo = await (await cerrarSorteo(sorteo)).wait();
                return Number(recibo!.gasUsed);
            };
            const pocos = await gasDeCerrar(3);
            const muchos = await gasDeCerrar(18);
            expect(muchos - pocos).to.be.lessThan(15_000);
        });
    });

    describe("reclamar", function () {
        it("revierte si el sorteo todavía no cerró", async function () {
            const { sorteo, alice } = await conDosRevelados();
            await expect(
                sorteo.connect(alice).reclamar()
            ).to.be.revertedWithCustomError(sorteo, E_NO_CERRADO);
        });

        it("el ganador recibe su entrada y emite EntradaReclamada (invariante 4)", async function () {
            // Entradas (2) >= revelados (2): ganan todos, sin depender del orden.
            const { entrada, sorteo, alice } = await conDosRevelados(2);
            await avanzarTiempo(DURACION + 1);
            await cerrarSorteo(sorteo);
            await expect(sorteo.connect(alice).reclamar()).to.emit(
                sorteo,
                "EntradaReclamada"
            );
            expect(await entrada.balanceOf(alice.address)).to.equal(1n);
        });

        it("nadie reclama dos veces (invariante 6)", async function () {
            const { sorteo, alice } = await conDosRevelados(2);
            await avanzarTiempo(DURACION + 1);
            await cerrarSorteo(sorteo);
            await sorteo.connect(alice).reclamar();
            await expect(
                sorteo.connect(alice).reclamar()
            ).to.be.revertedWithCustomError(sorteo, E_YA_RECLAMO);
        });

        it("no se entregan más entradas que las anunciadas (invariante 5)", async function () {
            const { entrada, sorteo, alice, bob } = await conDosRevelados(1);
            await avanzarTiempo(DURACION + 1);
            await cerrarSorteo(sorteo);
            // Reclaman los dos: solo uno gana. No se afirma quién (depende
            // del ordenamiento con la entropía, que la spec no fija).
            await sorteo.connect(alice).reclamar();
            await sorteo.connect(bob).reclamar();
            const total =
                (await entrada.balanceOf(alice.address)) +
                (await entrada.balanceOf(bob.address));
            expect(total).to.equal(1n);
        });

        it("con más postulantes que entradas ganan exactamente las anunciadas, una por cabeza (invariantes 4, 5 y 7)", async function () {
            const { entrada, sorteo, postulantes } = await conRevelados(10, 3);
            await cerrarSorteo(sorteo);
            let ganadas = 0n;
            for (const p of postulantes) {
                await sorteo.connect(p).reclamar();
                const suyas = await entrada.balanceOf(p.address);
                expect(suyas <= 1n).to.equal(true);
                ganadas += suyas;
            }
            expect(ganadas).to.equal(3n);
            // Los 7 perdedores recuperaron su depósito; quedan los 3 de
            // los ganadores.
            expect(
                await ethers.provider.getBalance(await sorteo.getAddress())
            ).to.equal(3n * DEPOSITO);
        });

        it("quien reveló y perdió recupera su depósito (invariante 7)", async function () {
            const { entrada, sorteo, alice, bob } = await conDosRevelados(1);
            await avanzarTiempo(DURACION + 1);
            await cerrarSorteo(sorteo);
            await sorteo.connect(alice).reclamar();
            await sorteo.connect(bob).reclamar();
            // Exactamente uno perdió: ese recupera DEPOSITO (menos gas, por
            // eso se compara el agregado) y el otro recibe la entrada.
            const ganado =
                (await entrada.balanceOf(alice.address)) +
                (await entrada.balanceOf(bob.address));
            expect(ganado).to.equal(1n);
            // Sin depender de quién perdió: quedaba 2*DEPOSITO en el
            // contrato y solo el perdedor lo recupera, así que queda 1.
            expect(
                await ethers.provider.getBalance(await sorteo.getAddress())
            ).to.equal(DEPOSITO);
        });

        it("revierte si reclama quien no reveló", async function () {
            const { sorteo, caro } = await conDosRevelados(2);
            await avanzarTiempo(DURACION + 1);
            await cerrarSorteo(sorteo);
            await expect(sorteo.connect(caro).reclamar()).to.be.revert(ethers);
        });
    });

    describe("retirar", function () {
        it("el organizador retira los depósitos que no se devuelven: el del ganador y el de quien no reveló", async function () {
            const { sorteo, organizador, alice, bob, caro } =
                await conSorteoAbierto(1);
            await comprometer(sorteo, alice, 11n, SAL_A);
            await comprometer(sorteo, bob, 22n, SAL_B);
            await comprometer(sorteo, caro, 33n, SAL_C); // caro nunca revela
            await avanzarTiempo(DURACION + 1);
            await sorteo.connect(alice).revelar(11n, SAL_A);
            await sorteo.connect(bob).revelar(22n, SAL_B);
            await avanzarTiempo(DURACION + 1);
            await cerrarSorteo(sorteo);
            // De los 3 depósitos, solo el del perdedor se debe devolver.
            await expect(sorteo.retirar())
                .to.emit(sorteo, "FondosRetirados")
                .withArgs(organizador.address, 2n * DEPOSITO);
            // El perdedor igual recupera el suyo y no queda nada atrapado.
            await sorteo.connect(alice).reclamar();
            await sorteo.connect(bob).reclamar();
            expect(
                await ethers.provider.getBalance(await sorteo.getAddress())
            ).to.equal(0n);
        });

        it("revierte antes del cierre, si llama otro y cuando no queda nada que retirar", async function () {
            const { sorteo, otro } = await conDosRevelados(1);
            await expect(sorteo.retirar()).to.be.revertedWithCustomError(
                sorteo,
                E_NO_CERRADO
            );
            await avanzarTiempo(DURACION + 1);
            await cerrarSorteo(sorteo);
            await expect(sorteo.connect(otro).retirar()).to.be.revert(ethers);
            await sorteo.retirar(); // el depósito del ganador
            await expect(sorteo.retirar()).to.be.revertedWithCustomError(
                sorteo,
                E_SIN_FONDOS
            );
        });
    });

    describe("renounceOwnership", function () {
        it("revierte: el organizador retira lo recaudado y sin él quedaría atrapado", async function () {
            const { sorteo, organizador } = await desplegar();
            await expect(sorteo.renounceOwnership()).to.be.revertedWithCustomError(
                sorteo,
                E_RENUNCIA
            );
            expect(await sorteo.owner()).to.equal(organizador.address);
        });
    });

    describe("transferOwnership", function () {
        it("el traspaso necesita que el nuevo organizador lo acepte", async function () {
            const { sorteo, organizador, otro } = await desplegar();
            await sorteo.transferOwnership(otro.address);
            expect(await sorteo.owner()).to.equal(organizador.address);
            await sorteo.connect(otro).acceptOwnership();
            expect(await sorteo.owner()).to.equal(otro.address);
        });
    });

    describe("Máquina de estados", function () {
        it("Abierto -> En revelación -> Cerrado solo avanza con el tiempo", async function () {
            const { sorteo, alice } = await conSorteoAbierto();
            await comprometer(sorteo, alice, 11n, SAL_A);
            // En revelación ya no se compromete.
            await avanzarTiempo(DURACION + 1);
            await expect(
                sorteo
                    .connect(alice)
                    .comprometer(compromisoDe(5n, SAL_C, alice.address), {
                        value: DEPOSITO,
                    })
            ).to.be.revert(ethers);
            await sorteo.connect(alice).revelar(11n, SAL_A);
            await avanzarTiempo(DURACION + 1);
            await expect(cerrarSorteo(sorteo)).to.emit(sorteo, "SorteoCerrado");
        });
    });

    describe("huecos deliberados", function () {
        it("invariante 8: el resultado no se puede calcular antes de que termine la revelación", async function () {
            // El último en revelar conoce todos los valores revelados. Si el
            // resultado dependiera solo de ellos, podría calcularlo antes de
            // decidir si revela. Ahora depende también del hash de un bloque
            // que recién se fija al cerrar, vencido el plazo de revelación.
            const { sorteo, alice, bob } = await conDosRevelados();
            const ultimaRevelacion = await ethers.provider.getBlockNumber();
            const tras11 = ethers.solidityPackedKeccak256(
                ["uint256", "uint256", "address"],
                [0n, 11n, alice.address]
            );
            const soloRevelados = ethers.solidityPackedKeccak256(
                ["uint256", "uint256", "address"],
                [tras11, 22n, bob.address]
            );
            await avanzarTiempo(DURACION + 1);
            await sorteo.cerrar();
            const bloqueSorteo = await sorteo.bloqueSorteo();
            expect(bloqueSorteo > BigInt(ultimaRevelacion + 1)).to.equal(true);
            await ethers.provider.send("evm_mine", []);
            await sorteo.cerrar();
            const hash = (await ethers.provider.getBlock(Number(bloqueSorteo)))!
                .hash!;
            const esperado = ethers.solidityPackedKeccak256(
                ["uint256", "bytes32"],
                [soloRevelados, hash]
            );
            expect(await sorteo.entropiaFinal()).to.equal(BigInt(esperado));
            expect(await sorteo.entropiaFinal()).to.not.equal(BigInt(soloRevelados));
        });

        it("quien no revela no puede reclamar y su depósito pasa al organizador (consecuencia definida)", async function () {
            const { sorteo, organizador, alice, bob } = await conSorteoAbierto(1);
            await comprometer(sorteo, alice, 11n, SAL_A);
            await comprometer(sorteo, bob, 22n, SAL_B);
            await avanzarTiempo(DURACION + 1);
            await sorteo.connect(alice).revelar(11n, SAL_A); // bob no revela
            await avanzarTiempo(DURACION + 1);
            await cerrarSorteo(sorteo);
            await expect(
                sorteo.connect(bob).reclamar()
            ).to.be.revertedWithCustomError(sorteo, "NoRevelo");
            // Alice, única revelada, gana: los 2 depósitos son del organizador.
            await expect(sorteo.retirar())
                .to.emit(sorteo, "FondosRetirados")
                .withArgs(organizador.address, 2n * DEPOSITO);
        });
    });
});
