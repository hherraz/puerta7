"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useEnsName } from "wagmi";

import { cn } from "@/lib/utilidades";

/**
 * Botón de conexión con look consistente al resto del sitio.
 * En su estado desconectado es un pill con la misma altura que el nav
 * (h-10); conectado, muta a una cápsula compacta que abre el modal de
 * RainbowKit al click.
 *
 * Usamos un wrappeador porque RainbowKit's `ConnectButton` da más control
 * de estilos cuando lo renderizamos en modo `accountStatus="address"`.
 */
export function ConectarBilletera({ className }: { className?: string }) {
    return (
        <div className={cn("flex items-center", className)}>
            <ConnectButton.Custom>
                {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                    const listo = mounted;
                    const conectado = listo && account;

                    if (!conectado) {
                        return (
                            <button
                                type="button"
                                onClick={openConnectModal}
                                className="tactil foco-anello h-10 rounded-2xl border border-ink-700 bg-ink-900 px-5 text-sm font-medium tracking-tight text-ink-50 transition-colors duration-300 ease-premium hover:border-accent hover:text-accent-fg"
                            >
                                Conectar billetera
                            </button>
                        );
                    }

                    if (chain?.unsupported) {
                        return (
                            <button
                                type="button"
                                onClick={openChainModal}
                                className="tactil foco-anello h-10 rounded-2xl border border-red-700/60 bg-red-950/40 px-4 text-sm font-medium tracking-tight text-red-200"
                            >
                                Red no soportada
                            </button>
                        );
                    }

                    return (
                        <button
                            type="button"
                            onClick={openAccountModal}
                            className="tactil foco-anello inline-flex h-10 items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 px-4 text-sm font-medium tracking-tight text-ink-50 transition-colors duration-300 ease-premium hover:border-accent"
                        >
                            <PuntoConectado />
                            <span className="font-mono text-xs text-ink-300">
                                {account.displayBalance && (
                                    <span className="mr-2 text-ink-400">{account.displayBalance}</span>
                                )}
                                {account.ensName ?? account.displayName}
                            </span>
                        </button>
                    );
                }}
            </ConnectButton.Custom>
        </div>
    );
}

/** Hook con el ENS si lo tiene, encapsulado para no repetir en cada página. */
export function useNombreCuenta(): string | undefined {
    const { address } = useAccount();
    const { data: ensName } = useEnsName({ address });
    return ensName ?? undefined;
}

/** Punto "vivo" al lado del nombre: pulso lento, no spinner, no shimmer. */
function PuntoConectado() {
    return (
        <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
    );
}
