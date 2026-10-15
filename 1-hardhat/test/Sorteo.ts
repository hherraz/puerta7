import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

// ============================================================
// Suite Sorteo — Sesión 2 (docs/spec/sorteo.md)
//
// ESTADO: `Sorteo.sol` todavía no existe. Esta suite es la spec
// ejecutable (TDD): queda desactivada con `describe.skip` hasta
// que el contrato se implemente en su sesión. Al implementarlo,
// sacar el `.skip` exterior y correr.
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
// La función de designación no existe en Entrada hoy y no se
// inventa acá: la fija la implementación de la sesión y su
// script de despliegue debe invocarla tras desplegar Sorteo.
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

describe.skip("Sorteo [PENDIENTE: implementar Sorteo.sol en sesión 2]", function () {
    describe("abrirSorteo", function () {
        it("revierte si llama alguien distinto al organizador", async function () {
            const { sorteo, alice } = await desplegar();
            await expect(
                sorteo.connect(alice).abrirSorteo(2, DURACION, DURACION)
            ).to.be.reverted;
        });

        it("emite SorteoAbierto con la cantidad de entradas anunciada", async function () {
            const { sorteo } = await desplegar();
            await expect(sorteo.abrirSorteo(2, DURACION, DURACION)).to.emit(
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
                .reverted;
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
            await expect(sorteo.cerrar()).to.be.reverted;
        });

        it("cualquiera puede cerrar vencido el plazo y emite SorteoCerrado", async function () {
            const { sorteo, otro } = await conDosRevelados();
            await avanzarTiempo(DURACION + 1);
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
            await expect(sorteo.cerrar()).to.emit(sorteo, "SorteoCerrado");
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
            await sorteo.cerrar();
            await expect(sorteo.connect(alice).reclamar()).to.emit(
                sorteo,
                "EntradaReclamada"
            );
            expect(await entrada.balanceOf(alice.address)).to.equal(1n);
        });

        it("nadie reclama dos veces (invariante 6)", async function () {
            const { sorteo, alice } = await conDosRevelados(2);
            await avanzarTiempo(DURACION + 1);
            await sorteo.cerrar();
            await sorteo.connect(alice).reclamar();
            await expect(
                sorteo.connect(alice).reclamar()
            ).to.be.revertedWithCustomError(sorteo, E_YA_RECLAMO);
        });

        it("no se entregan más entradas que las anunciadas (invariante 5)", async function () {
            const { entrada, sorteo, alice, bob } = await conDosRevelados(1);
            await avanzarTiempo(DURACION + 1);
            await sorteo.cerrar();
            // Reclaman los dos: solo uno gana. No se afirma quién (depende
            // del ordenamiento con la entropía, que la spec no fija).
            await sorteo.connect(alice).reclamar();
            await sorteo.connect(bob).reclamar();
            const total =
                (await entrada.balanceOf(alice.address)) +
                (await entrada.balanceOf(bob.address));
            expect(total).to.equal(1n);
        });

        it("quien reveló y perdió recupera su depósito (invariante 7)", async function () {
            const { entrada, sorteo, alice, bob } = await conDosRevelados(1);
            await avanzarTiempo(DURACION + 1);
            await sorteo.cerrar();
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
            await sorteo.cerrar();
            await expect(sorteo.connect(caro).reclamar()).to.be.reverted;
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
            ).to.be.reverted;
            await sorteo.connect(alice).revelar(11n, SAL_A);
            await avanzarTiempo(DURACION + 1);
            await expect(sorteo.cerrar()).to.emit(sorteo, "SorteoCerrado");
        });
    });

    describe("huecos deliberados", function () {
        it.skip("invariante 8: el resultado no se puede calcular antes de que termine la revelación", async function () {});

        it.skip("quien no revela: sin consecuencia definida no hay cierre justo posible", async function () {});
    });
});
