# Puerta 7

Entradas NFT (ERC-721) para un único evento. Cada entrada representa un asiento concreto del recinto y se dibuja on-chain.

La especificación vive en [`docs/spec/entrada.md`](docs/spec/entrada.md): ahí están los actores (organizador, comprador, portero), los estados (`Emitida` → `Vendida` → `Usada`), los invariantes y las decisiones de diseño.

## Requisitos

- **Node.js** `>= 24` (versión fijada en `.nvmrc`).
- **pnpm** `>= 11.24.0` (fijado en `packageManager` de `package.json`).
- **Git** para clonar.

## Estructura del workspace

Monorepo pnpm con dos paquetes:

| Carpeta       | Qué hay                                                         |
| ------------- | --------------------------------------------------------------- |
| `1-hardhat/`  | Contratos, tests y despliegues (Hardhat 3 + Ignition + OZ 5.x).  |
| `2-nextjs/`   | Frontend (próximo paso, todavía no creado).                     |

## Instalación

```bash
nvm use            # toma la versión de Node fijada en .nvmrc
pnpm install       # instala todas las dependencias del workspace
```

## Scripts (desde la raíz)

| Comando          | Qué hace                                                  |
| ---------------- | --------------------------------------------------------- |
| `pnpm compilar`  | Compila los contratos (`hardhat compile`).                |
| `pnpm test`      | Corre la suite de Mocha/Chai.                             |
| `pnpm nodo`      | Levanta un nodo EDR simulado en `http://127.0.0.1:8545`.   |
| `pnpm desplegar` | Pendiente: requiere crear el módulo de Ignition (ver abajo). |

## Compilar

```bash
pnpm compilar
```

Salida:

- Artefactos: `1-hardhat/artifacts/`.
- Caché: `1-hardhat/cache/`.

## Tests

```bash
pnpm test
```

Suite en `1-hardhat/test/Entrada.ts`. Cubre:

- **Despliegue**: parámetros válidos e inválidos (precio 0, portero `address(0)`).
- **`emitir`**: control de acceso, validación de sector/fila/asiento, duplicados, atomicidad del lote, happy path.
- **`comprar`**: pago exacto (de más/de menos/cero revierten), sin disponibilidad, transición de estado, eventos, comprador único.
- **`usar`**: solo portero, exige `Vendida`, no reusar.
- **`retirar`**: solo organizador, fondos, eventos, retiradas múltiples.
- **`tokenURI`**: SVG on-chain embebido como data URI base64.
- **Transferencia ERC-721** de `Vendida` y `Usada`.
- **Máquina de estados**: no existe transición directa `Emitida` → `Usada`.

## Nodo local

```bash
pnpm nodo
```

Levanta un nodo EDR simulado en `http://127.0.0.1:8545` con cuentas pre-fondeadas (10 000 ETH cada una). Útil para desplegar y probar contra una red local sin gastar gas real.

## Desplegar

El proyecto usa [Hardhat Ignition](https://hardhat.org/ignition) para despliegues declarativos.

### 1. Crear el módulo de despliegue

Crear `1-hardhat/ignition/modules/Entrada.ts`:

```ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("EntradaModule", (m) => {
    // 0.1 ETH por defecto; sobreescribible al desplegar.
    const precio = m.getParameter("precio", 10n ** 17n);
    // Segunda cuenta del signer por defecto; sobreescribible al desplegar.
    const portero = m.getParameter("portero", m.getAccount(1));

    const entrada = m.contract("Entrada", [precio, portero]);

    return { entrada };
});
```

### 2. Compilar

```bash
pnpm compilar
```

### 3. Desplegar

**Red por defecto (in-memory):**

```bash
pnpm exec --filter @puerta7/hardhat hardhat ignition deploy ignition/modules/Entrada.ts
```

**Nodo local** (con `pnpm nodo` corriendo en otra terminal):

```bash
pnpm exec --filter @puerta7/hardhat hardhat ignition deploy ignition/modules/Entrada.ts --network localhost
```

**Red externa** (Sepolia, mainnet, etc.):

1. Configurar `1-hardhat/.env` (no commitir, está en `.gitignore`):

   ```bash
   SEPOLIA_RPC_URL=https://...
   SEPOLIA_PRIVATE_KEY=0x...
   ```

2. Agregar la red en `1-hardhat/hardhat.config.ts`:

   ```ts
   networks: {
       sepolia: {
           type: "http",
           chainType: "l1",
           url: process.env.SEPOLIA_RPC_URL,
           accounts: [process.env.SEPOLIA_PRIVATE_KEY],
       }
   }
   ```

3. Desplegar:

   ```bash
   pnpm exec --filter @puerta7/hardhat hardhat ignition deploy ignition/modules/Entrada.ts --network sepolia
   ```

### Parámetros al desplegar

Para sobreescribir `precio` o `portero` desde la CLI:

```bash
pnpm exec --filter @puerta7/hardhat hardhat ignition deploy ignition/modules/Entrada.ts \
    --parameters precio=200000000000000000,portero=0xAbc...
```

## Variables de entorno

`1-hardhat/.env` (no commitir):

| Variable              | Descripción                                |
| --------------------- | ------------------------------------------ |
| `SEPOLIA_RPC_URL`     | URL del RPC de Sepolia (Alchemy, Infura…). |
| `SEPOLIA_PRIVATE_KEY` | Clave privada de la cuenta que despliega.  |
| `MAINNET_RPC_URL`     | (Opcional) URL del RPC de mainnet.         |
| `MAINNET_PRIVATE_KEY` | (Opcional) Clave privada para mainnet.     |

## Estado del proyecto

- **Contrato `Entrada`**: parcialmente implementado. La suite de tests cubre funciones y eventos que todavía no están todos en `1-hardhat/contracts/Entrada.sol`. El repo sigue TDD: los tests mandan, el contrato se completa para hacerlos pasar.
- **Especificación**: completa en `docs/spec/entrada.md`.
- **Frontend (`2-nextjs/`)**: pendiente.

## Licencia

MIT.