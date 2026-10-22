import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("EntradaModule", (m) => {
  // Precio en wei (por defecto 0.01 ETH)
  const precio = m.getParameter("precio", 10n ** 16n);
  // Cuenta 1 del nodo local como portero (la cuenta 0 es el organizador/deployer)
  const portero = m.getParameter("portero", m.getAccount(1));

  const entrada = m.contract("Entrada", [precio, portero]);
  return { entrada };
});
