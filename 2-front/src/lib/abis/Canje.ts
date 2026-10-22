/**
 * ABI de `Canje` — GENERADO AUTOMÁTICAMENTE.
 *
 * No editar a mano: lo regenera `pnpm --filter @puerta7/hardhat exportar`
 * leyendo `artifacts/contracts/Canje.sol/Canje.json`.
 *
 * El `as const` es lo que permite a viem inferir los tipos de los args y
 * del retorno en vez de devolverlos como `unknown`.
 */

export const CANJE_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "entrada_",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "puntos_",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "AforoDestinoCompleto",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "AutorizacionInsuficiente",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "CostoNoDefinido",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "EntradaNoUsada",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NoEsTitular",
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
        "name": "PuntosInsuficientes",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "SectorNoSuperior",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "titular",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "tokenIdQuemado",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "tokenIdNuevo",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "puntosGastados",
                "type": "uint256"
            }
        ],
        "name": "Canjeado",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint16",
                "name": "sectorOrigen",
                "type": "uint16"
            },
            {
                "indexed": true,
                "internalType": "uint16",
                "name": "sectorDestino",
                "type": "uint16"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "costoPuntos",
                "type": "uint256"
            }
        ],
        "name": "CostoDefinido",
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
                "name": "tokenId",
                "type": "uint256"
            },
            {
                "internalType": "uint16",
                "name": "sectorDestino",
                "type": "uint16"
            }
        ],
        "name": "canjear",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint16",
                "name": "sectorOrigen",
                "type": "uint16"
            },
            {
                "internalType": "uint16",
                "name": "sectorDestino",
                "type": "uint16"
            }
        ],
        "name": "consultarCosto",
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
                "internalType": "uint16",
                "name": "sectorOrigen",
                "type": "uint16"
            },
            {
                "internalType": "uint16",
                "name": "sectorDestino",
                "type": "uint16"
            },
            {
                "internalType": "uint256",
                "name": "costoPuntos",
                "type": "uint256"
            }
        ],
        "name": "definirCosto",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "entrada",
        "outputs": [
            {
                "internalType": "contract IEntradaCanje",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
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
        "name": "puntos",
        "outputs": [
            {
                "internalType": "contract IPuntosCanje",
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
        "stateMutability": "nonpayable",
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
