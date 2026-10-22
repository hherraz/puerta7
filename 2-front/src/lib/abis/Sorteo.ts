/**
 * ABI de `Sorteo` — GENERADO AUTOMÁTICAMENTE.
 *
 * No editar a mano: lo regenera `pnpm --filter @puerta7/hardhat exportar`
 * leyendo `artifacts/contracts/Sorteo.sol/Sorteo.json`.
 *
 * El `as const` es lo que permite a viem inferir los tipos de los args y
 * del retorno en vez de devolverlos como `unknown`.
 */

export const SORTEO_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "entrada_",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "deposito_",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "CompromisoNoCoincide",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "DemasiadasEntradas",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "DepositoExcedido",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "DepositoInsuficiente",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "FueraDePlazoCompromiso",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "FueraDePlazoRevelacion",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NoRevelo",
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
        "name": "RenunciaDeshabilitada",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "SinFondosParaRetirar",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "SorteoNoAbierto",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "SorteoNoCerrado",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "SorteoYaAbierto",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "length",
                "type": "uint256"
            }
        ],
        "name": "StringsInsufficientHexLength",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "YaComprometio",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "YaReclamo",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "YaRevelo",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "bloqueSorteo",
                "type": "uint256"
            }
        ],
        "name": "CierreSolicitado",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "postulante",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "monto",
                "type": "uint256"
            }
        ],
        "name": "DepositoDevuelto",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "postulante",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "EntradaReclamada",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "destinatario",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "monto",
                "type": "uint256"
            }
        ],
        "name": "FondosRetirados",
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
                "name": "postulante",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "bytes32",
                "name": "compromiso",
                "type": "bytes32"
            }
        ],
        "name": "PostulacionComprometida",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "postulante",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "valor",
                "type": "uint256"
            }
        ],
        "name": "PostulacionRevelada",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "cantidadEntradas",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "finCompromiso",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "finRevelacion",
                "type": "uint256"
            }
        ],
        "name": "SorteoAbierto",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "entropiaFinal",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "cantidadGanadores",
                "type": "uint256"
            }
        ],
        "name": "SorteoCerrado",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "MAX_ENTRADAS_POR_SORTEO",
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
        "inputs": [],
        "name": "abierto",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "cantidadEntradas_",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "duracionCompromiso",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "duracionRevelacion",
                "type": "uint256"
            }
        ],
        "name": "abrirSorteo",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "acceptOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "bloqueSorteo",
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
        "inputs": [],
        "name": "cantidadEntradas",
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
        "inputs": [],
        "name": "cerrado",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "cerrar",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "compromiso",
                "type": "bytes32"
            }
        ],
        "name": "comprometer",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "deposito",
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
        "inputs": [],
        "name": "entrada",
        "outputs": [
            {
                "internalType": "contract IEntradaSorteo",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "entropiaFinal",
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
        "inputs": [],
        "name": "finCompromiso",
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
        "inputs": [],
        "name": "finRevelacion",
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
        "name": "reclamar",
        "outputs": [],
        "stateMutability": "nonpayable",
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
        "inputs": [
            {
                "internalType": "uint256",
                "name": "valor",
                "type": "uint256"
            },
            {
                "internalType": "bytes32",
                "name": "salt",
                "type": "bytes32"
            }
        ],
        "name": "revelar",
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
