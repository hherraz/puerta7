# Puerta 7 — Frontend (`2-front/`)

Frontend Next.js para el sistema de entradas NFT del proyecto. Se conecta al contrato `Entrada` definido en `1-hardhat/contracts/Entrada.sol`.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript estricto
- Tailwind CSS 3 (paleta propia: `ink` + un único acento `amber-700`)
- wagmi v2 + viem + RainbowKit + TanStack Query para la capa de wallet/contrato
- Tipografía: Geist (sans) + Geist Mono (numerics) vía `next/font/google`

## Requisitos

- Node.js >= 22 (definido en la raíz `package.json`)
- pnpm >= 11
- Una wallet instalada en el navegador (MetaMask, Rabby, Frame, etc.)

## Comandos

```bash
# desde la raíz del monorepo
pnpm install                                         # instala todos los workspaces
pnpm --filter @puerta7/front dev                     # arranca el front
pnpm --filter @puerta7/hardhat nodo                  # (en otra terminal) nodo local de Hardhat
pnpm --filter @puerta7/hardhat compilar              # compila el contrato
pnpm --filter @puerta7/hardhat test                  # corre los tests
```

## Configuración inicial

1. Copiá `.env.example` a `.env` y completá la dirección del contrato:
   ```bash
   cp .env.example .env
   ```
2. Para Hardhat local, dejá `NEXT_PUBLIC_CHAIN_ID=31337` y `NEXT_PUBLIC_CONTRATO_ENTRADA=0x...` con la dirección que imprima el script de despliegue. Por ahora `0x0000…` es válido si querés ver el front sin haber desplegado.
3. Para producción / redes públicas, sumá el projectId de [Reown Cloud](https://cloud.reown.com) en `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

## Estructura

```
src/
├── app/                  # rutas del App Router
│   ├── page.tsx          # landing / Hero
│   ├── comprar/          # flujo del Comprador
│   ├── mis-entradas/     # NFTs en poder del usuario
│   ├── portero/          # vista del Portero
│   └── organizador/      # panel del Organizador + /emitir
├── components/           # UI y secciones reutilizables
├── lib/                  # wagmi config, ABI, helpers
└── tipos/                # tipos de dominio compartidos
```

## Estado del contrato

`Entrada.sol` está incompleto. Solo expone `emitir()` (con firma distinta a la que esperan los tests) y `retirar()`.

El ABI declarado en [`src/lib/contrato.ts`](src/lib/contrato.ts) refleja la API **deseada** (la que cubren los tests en `1-hardhat/test/Entrada.ts`):

| Función | Estado |
| --- | --- |
| `emitir(filas[], asientos[], sectores[])` | pendiente refactor en Solidity |
| `comprar()` (payable con `precio` exacto) | no existe |
| `usar(tokenId)` | no existe |
| `retirar()` | existe; falta evento `FondosRetirados` |
| `emitidas()`, `disponibles()` | no existen |
| `tokenURI(tokenId)` con SVG on-chain | no existe |

Mientras el contrato no esté completo, las pantallas de Comprador y Portero están diseñadas pero sus transacciones devolverán `function not found` o revertirán. Cuando termines la implementación del contrato, no necesitás tocar el frontend: el ABI ya está alineado con los tests.
