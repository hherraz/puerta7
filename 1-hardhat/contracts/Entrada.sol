pragma solidity ^0.8.28;

import { ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract Entrada is ERC721, Ownable {

    enum Estado {
        Inexistente,
        Emitida,
        Vendida,
        Utilizada
    }

    struct Asiento {
        uint16 fila;
        uint16 columna;
    }

    uint256 public immutable precio;
    address public immutable portero;

    mapping(uint256 tokenId => Estado) public estado;
    mapping(uint256 tokenId => Asiento) private _asiento;

    mapping(uint256 clave => bool) private _emitido;

    uint256[] private _disponibles;

    uint256 private _ultimoId;

    event EntradaEmitida(uint256 indexed tokenId, uint256 fila, uint256 columna);
    event EntradaVendida(uint256 indexed tokenId, address indexed comprador);
    event EntradaUtilizada(uint256 indexed tokenId);

    error AsientoInvalido(uint16 fila, uint16 columna);
    error AsientoYaEmitido(uint16 fila, uint16 columna);
    error PagoIncorrecto(uint256 enviado, uint256 precio);
    error SinDisponibilidadEntradas();
    error NoEsPortero(address cuenta);
    error EntradaNoVendida(uint256 tokenId);
    error EntradaYaUtilizada(uint256 tokenId);
    error TransferenciaFallida();

    constructor(uint256 precio_, address portero_) ERC721("Puerta7", "P7") Ownable(msg.sender) {
        precio = precio_;
        portero = portero_;
    }

    // ---------------------------------------
    // Organizador
    // ---------------------------------------
    
    // Creado a mano o creado con IA
    ///@notice Emite los asientos, marcándolos como disponibles para la venta. El token queda en poder del contrato (estado Emitida) hasta que alguien compre
    
    function emitir(uint16 fila, uint16 columna, uint16[] calldata numeros) external onlyOwner {
        for (uint256 i = 0; i < numeros.length; i++) {
            uint16 numero = numeros[i];
            if(fila == 0 || numero == 0) revert AsientoInvalido(fila, numero);

            uint256 clave = (uint256(fila) << 32) | uint256(columna) << 16 | numero;
            
            if(_emitido[clave]) revert AsientoYaEmitido(fila, columna);
            _emitido[clave] = true;

            uint256 tokenId = ++_ultimoId;
            _asiento[tokenId] = Asiento(fila, columna);
            estado[tokenId] = Estado.Emitida;
            _disponibles.push(tokenId);

            emit EntradaEmitida(tokenId, fila, columna);
        }
    }

    function retirar() external onlyOwner {
        (bool ok,) = owner().call{value: address(this).balance}("");
        if(!ok) revert TransferenciaFallida();
    }

    // MEJORAR Lo que falta del organizador y agregar las funciones del protero y del comprador
}