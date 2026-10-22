// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* ================================================================
 *  Reventa — Mercado secundario con techo de precio y comisión.
 *
 *  Implementa `docs/spec/reventa.md` y está validado por
 *  `test/Reventa.ts`.
 *
 *  - Techo: porcentaje sobre `Entrada.precio()` (110 = +10%).
 *  - Comisión: porcentaje del precio, queda para el organizador.
 *  - Patrón pull: la compra no transfiere ETH a nadie; vendedor
 *    y organizador retiran después con `retirar()`. Junto con
 *    marcar el listado como vendido ANTES de transferir el NFT
 *    (checks-effects-interactions), esto cierra la reentrada
 *    del invariante 7.
 * ================================================================ */

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IEntradaReventa {
    function precio() external view returns (uint256);
    function estado(uint256 tokenId) external view returns (uint8);
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(
        address duenio,
        address operador
    ) external view returns (bool);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function transferencias(uint256 tokenId) external view returns (uint256);
}

contract Reventa is Ownable2Step {
    // Valor de `Entrada.Estado.Usada`.
    uint8 private constant USADA = 3;

    struct DatosListado {
        uint256 tokenId;
        address vendedor;
        uint256 precio;
        // Fijada al listar: es la que el vendedor aceptó. Si se leyera
        // al comprar, el organizador podría subirla justo antes de una
        // compra y quedarse con el pago del vendedor.
        uint256 comisionPorcentaje;
        // Cambios de dueño de la entrada al listarse. Si después cambia,
        // el listado deja de valer: si la entrada se fue y volvió al
        // vendedor, el listado viejo no revive al precio viejo.
        uint256 transferencias;
        bool activo;
    }

    IEntradaReventa public immutable entrada;
    uint256 public techoPorcentaje;
    uint256 public comisionPorcentaje;

    mapping(uint256 idListado => DatosListado) private _listados;
    mapping(address cuenta => uint256) private _retirable;
    uint256 private _ultimoListado;

    event Configurado(uint256 techoPorcentaje, uint256 comisionPorcentaje);
    event Listado(
        uint256 indexed idListado,
        uint256 indexed tokenId,
        address indexed vendedor,
        uint256 precio
    );
    event Comprado(
        uint256 indexed idListado,
        address indexed comprador,
        uint256 precio,
        uint256 comision
    );
    event Cancelado(uint256 indexed idListado);
    event Retirado(address indexed direccion, uint256 monto);

    error EntradaUsada();
    error NoEsTitular();
    error PrecioSobreTecho();
    error ListadoInactivo();
    error NoEsVendedor();
    error PagoIncorrecto();
    error SinFondosParaRetirar();
    error AutorizacionInsuficiente();
    error ComisionInvalida();
    error RenunciaDeshabilitada();

    constructor(address entrada_) Ownable(msg.sender) {
        entrada = IEntradaReventa(entrada_);
    }

    /// @notice Deshabilitada: la comisión se acredita a `owner()` y, sin
    /// organizador, quedaría atrapada para siempre (invariante 8).
    function renounceOwnership() public pure override {
        revert RenunciaDeshabilitada();
    }

    function configurar(
        uint256 techoPorcentaje_,
        uint256 comisionPorcentaje_
    ) external onlyOwner {
        // Más del 100% haría revertir por underflow toda compra.
        if (comisionPorcentaje_ > 100) revert ComisionInvalida();
        techoPorcentaje = techoPorcentaje_;
        comisionPorcentaje = comisionPorcentaje_;
        emit Configurado(techoPorcentaje, comisionPorcentaje);
    }

    /// @notice Lista una entrada a `precio`. Requiere el `approve`
    /// previo del token a este contrato. No escrowa el NFT.
    function listar(uint256 tokenId, uint256 precio) external {
        if (entrada.ownerOf(tokenId) != msg.sender) revert NoEsTitular();
        if (entrada.estado(tokenId) == USADA) revert EntradaUsada();
        uint256 precioMaximo = (entrada.precio() * techoPorcentaje) / 100;
        if (precio > precioMaximo) revert PrecioSobreTecho();
        if (!_autorizado(tokenId, msg.sender)) {
            revert AutorizacionInsuficiente();
        }

        uint256 idListado = ++_ultimoListado;
        _listados[idListado] = DatosListado({
            tokenId: tokenId,
            vendedor: msg.sender,
            precio: precio,
            comisionPorcentaje: comisionPorcentaje,
            transferencias: entrada.transferencias(tokenId),
            activo: true
        });
        emit Listado(idListado, tokenId, msg.sender, precio);
    }

    function comprar(uint256 idListado) external payable {
        DatosListado storage listado = _listados[idListado];
        if (!listado.activo) revert ListadoInactivo();
        // La entrada usada (o transferida) mientras estaba listada
        // invalida el listado.
        if (
            entrada.estado(listado.tokenId) == USADA ||
            entrada.ownerOf(listado.tokenId) != listado.vendedor ||
            entrada.transferencias(listado.tokenId) != listado.transferencias
        ) revert ListadoInactivo();
        if (msg.value != listado.precio) revert PagoIncorrecto();

        // Effects antes que interactions (anti-reentrada).
        listado.activo = false;
        uint256 comision = (listado.precio * listado.comisionPorcentaje) / 100;
        _retirable[listado.vendedor] += listado.precio - comision;
        _retirable[owner()] += comision;

        entrada.transferFrom(listado.vendedor, msg.sender, listado.tokenId);
        emit Comprado(idListado, msg.sender, listado.precio, comision);
    }

    function cancelar(uint256 idListado) external {
        DatosListado storage listado = _listados[idListado];
        if (!listado.activo) revert ListadoInactivo();
        if (msg.sender != listado.vendedor) revert NoEsVendedor();
        listado.activo = false;
        emit Cancelado(idListado);
    }

    /// @notice Patrón pull: cada uno retira lo acumulado a su nombre.
    function retirar() external {
        uint256 monto = _retirable[msg.sender];
        if (monto == 0) revert SinFondosParaRetirar();
        _retirable[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: monto}("");
        if (!ok) revert("Transferencia fallida");
        emit Retirado(msg.sender, monto);
    }

    function _autorizado(
        uint256 tokenId,
        address duenio
    ) private view returns (bool) {
        return
            entrada.getApproved(tokenId) == address(this) ||
            entrada.isApprovedForAll(duenio, address(this));
    }
}
