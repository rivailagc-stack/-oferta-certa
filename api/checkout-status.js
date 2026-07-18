import {
  normalizePostalCode,
  getOwnProducts,
  calculateShipping
} from "./shipping-utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const postalCode = normalizePostalCode(req.body?.postal_code);
    const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];

    if (postalCode.length !== 8) {
      return res.status(400).json({ error: "CEP inválido." });
    }

    if (!requestedItems.length || requestedItems.length > 30) {
      return res.status(400).json({ error: "Carrinho inválido." });
    }

    const products = await getOwnProducts(requestedItems);
    const options = await calculateShipping({
      postalCode,
      requestedItems,
      products
    });

    return res.status(200).json({ options });
  } catch (error) {
    console.error(error);
    return res.status(400).json({
      error: error.message || "Erro ao calcular frete."
    });
  }
}
