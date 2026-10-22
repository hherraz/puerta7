/**
 * ABI de `Reventa` — GENERADO AUTOMÁTICAMENTE.
 *
 * No editar a mano: lo regenera `pnpm --filter @puerta7/hardhat exportar`
 * leyendo `artifacts/contracts/Reventa.sol/Reventa.json`.
 *
 * El `as const` es lo que permite a viem inferir los tipos de los args y
 * del retorno en vez de devolverlos como `unknown`.
 */

export const REVENTA_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "entrada_",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "AutorizacionInsuficiente",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "ComisionInvalida",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "EntradaUsada",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "ListadoInactivo",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NoEsTitular",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NoEsVendedor",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }
        ],
        "name": "OwnableInvalidOwner",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "OwnableUnauthorizedAccount",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "PagoIncorrecto",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "PrecioSobreTecho",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "RenunciaDeshabilitada",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "SinFondosParaRetirar",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "idListado",
                "type": "uint256"
            }
        ],
        "name": "Cancelado",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "idListado",
                "type": "uint256"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "comprador",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "precio",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "comision",
                "type": "uint256"
            }
        ],
        "name": "Comprado",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "techoPorcentaje",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "comisionPorcentaje",
                "type": "uint256"
            }
        ],
        "name": "Configurado",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "idListado",
                "type": "uint256"
            },
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "vendedor",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "precio",
                "type": "uint256"
            }
        ],
        "name": "Listado",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferStarted",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "direccion",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "monto",
                "type": "uint256"
            }
        ],
        "name": "Retirado",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "acceptOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "idListado",
                "type": "uint256"
            }
        ],
        "name": "cancelar",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "comisionPorcentaje",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "idListado",
                "type": "uint256"
            }
        ],
        "name": "comprar",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "techoPorcentaje_",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "comisionPorcentaje_",
                "type": "uint256"
            }
        ],
        "name": "configurar",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "entrada",
        "outputs": [
            {
                "internalType": "contract IEntradaReventa",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "precio",
                "type": "uint256"
            }
        ],
        "name": "listar",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "pendingOwner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "pure",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "retirar",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "techoPorcentaje",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;
