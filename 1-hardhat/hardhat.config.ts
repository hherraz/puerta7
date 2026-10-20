import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatIgnitionPlugin from "@nomicfoundation/hardhat-ignition";
import hardhatIgnitionEthersPlugin from "@nomicfoundation/hardhat-ignition-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
    plugins: [
        hardhatToolboxMochaEthersPlugin,
        // El orden importa: el de ethers extiende el de ignition para que
        // `m.contract` resuelva factories de ethers y no de viem.
        hardhatIgnitionPlugin,
        hardhatIgnitionEthersPlugin,
    ],
    solidity: {
        version: "0.8.34"
    },
    networks:{
        // Red en memoria (simulada) que simule la main net
        default: {
            type: "edr-simulated",
            chainType: "l1"
        },
        localhost: {
            type: "http",
            chainType: "l1",
            url: "http://127.0.0.1:8545",
            // Explícito para que `scripts/exportar.ts sepa dónde dejar las
            // direcciones sin tener que adivinarlo.
            chainId: 31337
        }
    }
});