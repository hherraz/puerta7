"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhat, sepolia } from "wagmi/chains";
import { http } from "wagmi";

/**
 * Cliente wagmi compartido. Hardhat local (`31337`) por defecto, Sepolia
 * como red secundaria en caso de deploy público.
 *
 * El chain objetivo en runtime lo decide el código del componente —
 * este config expone ambos para que el wallet del usuario pueda cambiar.
 */
const walletConnectProjectId =
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = getDefaultConfig({
    appName: "Puerta 7",
    projectId: walletConnectProjectId || "puerta7-local-dev",
    chains: [hardhat, sepolia],
    transports: {
        [hardhat.id]: http("http://127.0.0.1:8545"),
        [sepolia.id]: http(),
    },
    ssr: true,
});
