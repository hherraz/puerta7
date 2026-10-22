// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* ================================================================
 *  Canje — Quema de puntos y entrada usada a cambio de una mejora.
 *
 *  Implementa `docs/spec/canje.md` y está validado por
 *  `test/Canje.ts`. Todo el canje ocurre en UNA transacción: si
 *  la emisión de la mejora falla, la quema de puntos y de la
 *  entrada revierte con ella (invariante 7).
 *
 *  Permisos cruzados que el despliegue debe hacer:
 *    1. `Puntos.designarQuemador(canje)`
 *    2. `Entrada.designarOperadorAutorizado(canje, true)`
 *       (habilita `quemar` y `emitirPara` en Entrada)
 *
 *  Autorizaciones previas del titular (flujo de la spec):
 *    - `Puntos.approve(canje, costo)`
 *    - `Entrada.approve(canje, tokenId)`
 * ================================================================ */

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IEntradaCanje {
    function estado(uint256 tokenId) external view returns (uint8);
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(
        address duenio,
        address operador
    ) external view returns (bool);
    function datosAsiento(
        uint256 tokenId
    ) external view returns (uint16 sector, string memory fila, string memory asiento);
    function quemar(uint256 tokenId) external;
    function emitirPara(
        address titular,
        uint16 sector,
        string memory fila,
        string memory asiento
    ) external returns (uint256);
}

interface IPuntosCanje {
    function balanceOf(address cuenta) external view returns (uint256);
    function allowance(
        address duenio,
        address autorizado
    ) external view returns (uint256);
    function quemar(address titular, uint256 cantidad) external;
    function transferFrom(
        address desde,
        address hacia,
        uint256 cantidad
    ) external returns (bool);
}

contract Canje is Ownable2Step {
    // Valor de `Entrada.Estado.Usada`.
    uint8 private constant USADA = 3;

    IEntradaCanje public immutable entrada;
    IPuntosCanje public immutable puntos;

    mapping(uint16 sectorOrigen => mapping(uint16 sectorDestino => uint256))
        private _costos;
    mapping(uint16 sectorOrigen => mapping(uint16 sectorDestino => bool))
        private _costoDefinido;

    event CostoDefinido(
        uint16 indexed sectorOrigen,
        uint16 indexed sectorDestino,
        uint256 costoPuntos
    );
    event Canjeado(
        address indexed titular,
        uint256 indexed tokenIdQuemado,
        uint256 tokenIdNuevo,
        uint256 puntosGastados
    );

    error EntradaNoUsada();
    error NoEsTitular();
    error SectorNoSuperior();
    error CostoNoDefinido();
    error PuntosInsuficientes();
    error AforoDestinoCompleto();
    error AutorizacionInsuficiente();

    constructor(address entrada_, address puntos_) Ownable(msg.sender) {
        entrada = IEntradaCanje(entrada_);
        puntos = IPuntosCanje(puntos_);
    }

    function definirCosto(
        uint16 sectorOrigen,
        uint16 sectorDestino,
        uint256 costoPuntos
    ) external onlyOwner {
        _costos[sectorOrigen][sectorDestino] = costoPuntos;
        _costoDefinido[sectorOrigen][sectorDestino] = true;
        emit CostoDefinido(sectorOrigen, sectorDestino, costoPuntos);
    }

    function consultarCosto(
        uint16 sectorOrigen,
        uint16 sectorDestino
    ) external view returns (uint256) {
        return _costos[sectorOrigen][sectorDestino];
    }

    /// @notice Quema los puntos y la entrada usada `tokenId` del
    /// titular y le emite una en `sectorDestino` (misma fila y
    /// asiento) para el evento siguiente.
    function canjear(uint256 tokenId, uint16 sectorDestino) external {
        // El orden de las guardias es el que verifica la suite:
        // estado -> titular -> sector -> costo -> saldo -> permisos.
        if (entrada.estado(tokenId) != USADA) revert EntradaNoUsada();
        if (entrada.ownerOf(tokenId) != msg.sender) revert NoEsTitular();

        (
            uint16 sectorOrigen,
            string memory fila,
            string memory asiento
        ) = entrada.datosAsiento(tokenId);
        if (sectorDestino <= sectorOrigen) revert SectorNoSuperior();
        if (!_costoDefinido[sectorOrigen][sectorDestino]) {
            revert CostoNoDefinido();
        }
        uint256 costo = _costos[sectorOrigen][sectorDestino];
        if (puntos.balanceOf(msg.sender) < costo) {
            revert PuntosInsuficientes();
        }
        bool puntosAutorizados =
            puntos.allowance(msg.sender, address(this)) >= costo;
        bool entradaAutorizada =
            entrada.getApproved(tokenId) == address(this) ||
            entrada.isApprovedForAll(msg.sender, address(this));
        if (!puntosAutorizados || !entradaAutorizada) {
            revert AutorizacionInsuficiente();
        }

        // Los puntos pasan por `transferFrom`, que DESCUENTA la autorización,
        // y se queman desde acá. Quemarlos directo de la cuenta del titular
        // verificaba el allowance pero nunca lo consumía: un approve hecho
        // una vez valía para todos los canjes futuros.
        if (!puntos.transferFrom(msg.sender, address(this), costo)) {
            revert AutorizacionInsuficiente();
        }
        puntos.quemar(address(this), costo);
        entrada.quemar(tokenId);
        uint256 tokenIdNuevo = entrada.emitirPara(
            msg.sender,
            sectorDestino,
            fila,
            asiento
        );
        emit Canjeado(msg.sender, tokenId, tokenIdNuevo, costo);
    }
}
