// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* ================================================================
 *  Sorteo — Asignación de entradas por sorteo con commit-reveal.
 *
 *  Implementa `docs/spec/sorteo.md` y está validado por
 *  `test/Sorteo.ts`.
 *
 *  compromiso = keccak256(abi.encodePacked(valor, salt, msg.sender))
 *
 *  Máquina de estados (por tiempo, no por decisión):
 *    Abierto -> En revelación -> Cerrado
 *
 *  Permiso cruzado: necesita estar designado como operador
 *  autorizado en Entrada (`designarOperadorAutorizado`) para
 *  entregar la entrada a cada ganador vía `emitirPara`. El
 *  despliegue (y el helper de tests) debe hacer esa designación.
 * ================================================================ */

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

interface IEntradaSorteo {
    function emitirPara(
        address titular,
        uint16 sector,
        string memory fila,
        string memory asiento
    ) external returns (uint256);
}

contract Sorteo is Ownable2Step {
    /// @notice Tope de entradas por sorteo. Cerrar cuesta ~30.000 gas por
    /// entrada sorteada: con 500 el cierre usa la mitad de un bloque de
    /// 30M y nunca puede quedar trabado (invariante 7).
    uint256 public constant MAX_ENTRADAS_POR_SORTEO = 500;

    struct Postulacion {
        bytes32 compromiso;
        bool comprometido;
        bool revelado;
        bool reclamo;
    }

    IEntradaSorteo public immutable entrada;
    uint256 public immutable deposito;

    uint256 public cantidadEntradas;
    uint256 public finCompromiso;
    uint256 public finRevelacion;
    uint256 public entropiaFinal;
    bool public abierto;
    bool public cerrado;

    mapping(address postulante => Postulacion) private _postulacion;
    mapping(address postulante => bool) private _esGanador;
    address[] private _revelados;

    /// @dev Entropía acumulada revelación a revelación; `cerrar` la
    /// combina con el hash de `bloqueSorteo` y la publica en `entropiaFinal`.
    uint256 private _entropia;

    /// @notice Bloque cuyo hash se suma a la entropía. Se fija en el primer
    /// `cerrar`, ya vencida la revelación: cuando el último postulante
    /// decide si revela, ese hash todavía no existe (invariante 8).
    uint256 public bloqueSorteo;

    /// @dev Perdedores revelados que todavía no reclamaron su depósito:
    /// eso no lo puede retirar el organizador.
    uint256 private _reembolsosPendientes;

    event SorteoAbierto(
        uint256 cantidadEntradas,
        uint256 finCompromiso,
        uint256 finRevelacion
    );
    event PostulacionComprometida(
        address indexed postulante,
        bytes32 compromiso
    );
    event PostulacionRevelada(address indexed postulante, uint256 valor);
    event SorteoCerrado(uint256 entropiaFinal, uint256 cantidadGanadores);
    event EntradaReclamada(
        address indexed postulante,
        uint256 indexed tokenId
    );
    event DepositoDevuelto(address indexed postulante, uint256 monto);
    event CierreSolicitado(uint256 bloqueSorteo);
    event FondosRetirados(address indexed destinatario, uint256 monto);

    error SorteoNoAbierto();
    error FueraDePlazoCompromiso();
    error FueraDePlazoRevelacion();
    error CompromisoNoCoincide();
    error YaComprometio();
    error YaRevelo();
    error YaReclamo();
    error DepositoInsuficiente();
    error DepositoExcedido();
    error SorteoNoCerrado();
    error NoRevelo();
    error SorteoYaAbierto();
    error DemasiadasEntradas();
    error SinFondosParaRetirar();
    error RenunciaDeshabilitada();

    constructor(address entrada_, uint256 deposito_) Ownable(msg.sender) {
        entrada = IEntradaSorteo(entrada_);
        deposito = deposito_;
    }

    /// @notice Deshabilitada: `retirar` paga a `owner()`, así que sin
    /// organizador los depósitos no devolvibles quedarían atrapados.
    function renounceOwnership() public pure override {
        revert RenunciaDeshabilitada();
    }

    function abrirSorteo(
        uint256 cantidadEntradas_,
        uint256 duracionCompromiso,
        uint256 duracionRevelacion
    ) external onlyOwner {
        // Un solo sorteo por contrato: reabrir movería los plazos de la
        // ronda en curso (invariantes 2 y 3) o, ya cerrada, recalcularía
        // ganadores sobre reclamos hechos (invariante 5).
        if (abierto) revert SorteoYaAbierto();
        if (cantidadEntradas_ > MAX_ENTRADAS_POR_SORTEO) revert DemasiadasEntradas();
        cantidadEntradas = cantidadEntradas_;
        finCompromiso = block.timestamp + duracionCompromiso;
        finRevelacion = finCompromiso + duracionRevelacion;
        abierto = true;
        emit SorteoAbierto(cantidadEntradas, finCompromiso, finRevelacion);
    }

    function comprometer(bytes32 compromiso) external payable {
        if (!abierto) revert SorteoNoAbierto();
        if (block.timestamp >= finCompromiso) revert FueraDePlazoCompromiso();
        if (_postulacion[msg.sender].comprometido) revert YaComprometio();
        if (msg.value < deposito) revert DepositoInsuficiente();
        // `reclamar` devuelve exactamente `deposito`: un excedente no
        // tendría por dónde salir del contrato.
        if (msg.value > deposito) revert DepositoExcedido();

        _postulacion[msg.sender] = Postulacion({
            compromiso: compromiso,
            comprometido: true,
            revelado: false,
            reclamo: false
        });
        emit PostulacionComprometida(msg.sender, compromiso);
    }

    function revelar(uint256 valor, bytes32 salt) external {
        if (block.timestamp < finCompromiso || block.timestamp >= finRevelacion) {
            revert FueraDePlazoRevelacion();
        }
        Postulacion storage p = _postulacion[msg.sender];
        if (p.revelado) revert YaRevelo();
        bytes32 esperado = keccak256(
            abi.encodePacked(valor, salt, msg.sender)
        );
        if (esperado != p.compromiso) revert CompromisoNoCoincide();

        p.revelado = true;
        _revelados.push(msg.sender);
        // Se acumula acá (en orden de revelación, igual que antes al
        // cerrar) para que `cerrar` no recorra a todos los postulantes.
        _entropia = uint256(
            keccak256(abi.encodePacked(_entropia, valor, msg.sender))
        );
        emit PostulacionRevelada(msg.sender, valor);
    }

    /// @notice Cierra el sorteo vencido el plazo de revelación, en dos
    /// llamadas (cualquiera puede hacerlas):
    ///   1) fija `bloqueSorteo`, el bloque siguiente;
    ///   2) ya minado ese bloque, suma su hash a la entropía y sortea.
    /// Quien comprometió y nunca reveló no bloquea el cierre:
    /// simplemente no participa (y pierde su depósito).
    function cerrar() external {
        if (!abierto || cerrado) revert SorteoNoAbierto();
        if (block.timestamp < finRevelacion) revert FueraDePlazoRevelacion();

        // Sesgo del último revelador: si el resultado dependiera solo de
        // lo revelado, el último podría calcularlo antes de decidir si
        // revela. Por eso se le suma el hash de un bloque que se elige
        // recién ahora, con la revelación ya cerrada.
        if (bloqueSorteo == 0) {
            bloqueSorteo = block.number + 1;
            emit CierreSolicitado(bloqueSorteo);
            return;
        }
        // Todavía no se minó el bloque: no hay nada que hacer (igual que
        // `Entrada.confirmarCompras`). No revierte para que la llamada
        // igual se mine y la cadena avance aunque nadie más esté operando.
        if (block.number <= bloqueSorteo) return;
        bytes32 hashBloque = blockhash(bloqueSorteo);
        // El EVM solo recuerda los últimos 256 hashes: si nadie completó
        // el cierre a tiempo, se fija un bloque nuevo.
        if (hashBloque == bytes32(0)) {
            bloqueSorteo = block.number + 1;
            emit CierreSolicitado(bloqueSorteo);
            return;
        }

        // Entropía final: los valores revelados (acumulados en `revelar`)
        // más el hash del bloque del sorteo.
        uint256 entropia = uint256(
            keccak256(abi.encodePacked(_entropia, hashBloque))
        );
        entropiaFinal = entropia;

        // Ganadores: Fisher-Yates parcial sobre los revelados. Solo se
        // mezclan las primeras `cantidadGanadores` posiciones, así el
        // costo depende de las entradas anunciadas (las fija el
        // organizador) y no de cuántos se postularon (cualquiera puede
        // inflar ese número). Cada revelado está una sola vez en la lista,
        // así que nadie gana dos veces (invariantes 4 y 5).
        uint256 total = _revelados.length;
        uint256 cantidadGanadores = cantidadEntradas < total
            ? cantidadEntradas
            : total;
        // Si alcanzan para todos no hay nada que sortear: `reclamar` los
        // trata a todos como ganadores sin marcarlos uno por uno.
        if (cantidadGanadores < total) {
            for (uint256 g = 0; g < cantidadGanadores; g++) {
                uint256 j = g +
                    (uint256(keccak256(abi.encodePacked(entropia, g))) %
                        (total - g));
                address ganador = _revelados[j];
                _revelados[j] = _revelados[g];
                _revelados[g] = ganador;
                _esGanador[ganador] = true;
            }
        }

        _reembolsosPendientes = total - cantidadGanadores;
        cerrado = true;
        emit SorteoCerrado(entropia, cantidadGanadores);
    }

    /// @notice Tras el cierre, el organizador retira lo que no se devuelve
    /// (depósitos de ganadores y de quienes no revelaron). Lo que se les
    /// debe a los perdedores que todavía no reclamaron queda reservado.
    function retirar() external onlyOwner {
        if (!cerrado) revert SorteoNoCerrado();
        uint256 monto = address(this).balance -
            _reembolsosPendientes * deposito;
        if (monto == 0) revert SinFondosParaRetirar();
        (bool ok, ) = owner().call{value: monto}("");
        if (!ok) revert("Transferencia fallida");
        emit FondosRetirados(owner(), monto);
    }

    /// @notice Tras el cierre: el ganador recibe su entrada y quien
    /// reveló y perdió recupera el depósito. Una sola vez (inv. 6).
    function reclamar() external {
        if (!cerrado) revert SorteoNoCerrado();
        Postulacion storage p = _postulacion[msg.sender];
        if (!p.revelado) revert NoRevelo();
        if (p.reclamo) revert YaReclamo();
        p.reclamo = true;

        // Con entradas para todos, `cerrar` no marca ganadores: gana
        // cualquier revelado.
        bool gano = cantidadEntradas >= _revelados.length ||
            _esGanador[msg.sender];
        if (gano) {
            // Asiento sintético único por ganador (una entrada por
            // postulante, invariante 4): fila "S", asiento = su
            // dirección en hex. El depósito del ganador no se devuelve.
            uint256 tokenId = entrada.emitirPara(
                msg.sender,
                1,
                "S",
                Strings.toHexString(msg.sender)
            );
            emit EntradaReclamada(msg.sender, tokenId);
        } else {
            _reembolsosPendientes--;
            (bool ok, ) = msg.sender.call{value: deposito}("");
            if (!ok) revert("Transferencia fallida");
            emit DepositoDevuelto(msg.sender, deposito);
        }
    }
}
