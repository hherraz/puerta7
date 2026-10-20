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
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

interface IEntradaSorteo {
    function emitirPara(
        address titular,
        uint16 sector,
        string memory fila,
        string memory asiento
    ) external returns (uint256);
}

contract Sorteo is Ownable {
    struct Postulacion {
        bytes32 compromiso;
        bool comprometido;
        bool revelado;
        uint256 valor;
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

    error SorteoNoAbierto();
    error FueraDePlazoCompromiso();
    error FueraDePlazoRevelacion();
    error CompromisoNoCoincide();
    error YaComprometio();
    error YaRevelo();
    error YaReclamo();
    error DepositoInsuficiente();
    error SorteoNoCerrado();
    error NoRevelo();

    constructor(address entrada_, uint256 deposito_) Ownable(msg.sender) {
        entrada = IEntradaSorteo(entrada_);
        deposito = deposito_;
    }

    function abrirSorteo(
        uint256 cantidadEntradas_,
        uint256 duracionCompromiso,
        uint256 duracionRevelacion
    ) external onlyOwner {
        cantidadEntradas = cantidadEntradas_;
        finCompromiso = block.timestamp + duracionCompromiso;
        finRevelacion = finCompromiso + duracionRevelacion;
        abierto = true;
        cerrado = false;
        emit SorteoAbierto(cantidadEntradas, finCompromiso, finRevelacion);
    }

    function comprometer(bytes32 compromiso) external payable {
        if (!abierto) revert SorteoNoAbierto();
        if (block.timestamp >= finCompromiso) revert FueraDePlazoCompromiso();
        if (_postulacion[msg.sender].comprometido) revert YaComprometio();
        if (msg.value < deposito) revert DepositoInsuficiente();

        _postulacion[msg.sender] = Postulacion({
            compromiso: compromiso,
            comprometido: true,
            revelado: false,
            valor: 0,
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
        p.valor = valor;
        _revelados.push(msg.sender);
        emit PostulacionRevelada(msg.sender, valor);
    }

    /// @notice Cierra el sorteo vencido el plazo de revelación.
    /// Quien comprometió y nunca reveló no bloquea el cierre:
    /// simplemente no participa (y pierde su depósito).
    function cerrar() external {
        if (!abierto || cerrado) revert SorteoNoAbierto();
        if (block.timestamp < finRevelacion) revert FueraDePlazoRevelacion();

        // Entropía final: combina todos los valores revelados.
        uint256 entropia = 0;
        for (uint256 i = 0; i < _revelados.length; i++) {
            entropia = uint256(
                keccak256(
                    abi.encodePacked(
                        entropia,
                        _postulacion[_revelados[i]].valor,
                        _revelados[i]
                    )
                )
            );
        }
        entropiaFinal = entropia;

        // Ganadores: los de menor puntaje hash(entropía, dirección),
        // hasta agotar la cantidad anunciada (invariante 5).
        uint256 cantidadGanadores = cantidadEntradas < _revelados.length
            ? cantidadEntradas
            : _revelados.length;
        bool[] memory elegido = new bool[](_revelados.length);
        for (uint256 g = 0; g < cantidadGanadores; g++) {
            uint256 mejor = type(uint256).max;
            uint256 mejorIndice = 0;
            for (uint256 i = 0; i < _revelados.length; i++) {
                if (elegido[i]) continue;
                uint256 puntaje = uint256(
                    keccak256(abi.encodePacked(entropia, _revelados[i]))
                );
                if (puntaje < mejor) {
                    mejor = puntaje;
                    mejorIndice = i;
                }
            }
            elegido[mejorIndice] = true;
            _esGanador[_revelados[mejorIndice]] = true;
        }

        cerrado = true;
        emit SorteoCerrado(entropia, cantidadGanadores);
    }

    /// @notice Tras el cierre: el ganador recibe su entrada y quien
    /// reveló y perdió recupera el depósito. Una sola vez (inv. 6).
    function reclamar() external {
        if (!cerrado) revert SorteoNoCerrado();
        Postulacion storage p = _postulacion[msg.sender];
        if (!p.revelado) revert NoRevelo();
        if (p.reclamo) revert YaReclamo();
        p.reclamo = true;

        if (_esGanador[msg.sender]) {
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
            (bool ok, ) = msg.sender.call{value: deposito}("");
            if (!ok) revert("Transferencia fallida");
            emit DepositoDevuelto(msg.sender, deposito);
        }
    }
}
