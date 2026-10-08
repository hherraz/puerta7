import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
    plugins: [hardhatToolboxMochaEthersPlugin],
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
            url: "http://127.0.0.1:8545"
        }
    }
});