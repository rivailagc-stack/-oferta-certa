export default async function handler(req, res) {
  try {
    const { codigoMLB, url } = req.query;

    function normalizarMLB(valor) {
      if (!valor) return null;
      const m = String(valor).match(/MLB-?\d{6,}/i);
      if (!m) return null;
      return m[0].replace("-", "").toUpperCase();
    }

    const itemId = normalizarMLB(codigoMLB) || normalizarMLB(url);

    if (!itemId) {
      return res.status(400).json({ ativo: false, error: "Informe o código MLB ou link completo." });
    }

    const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
    const item = await itemRes.json();

    if (!item || item.error) {
      return res.status(404).json({ ativo: false, error: "Produto não encontrado." });
    }

    return res.status(200).json({
      ativo: item.status === "active",
      status: item.status,
      nome: item.title || "",
      preco: item.price || 0,
      estoque: item.available_quantity || 0,
      permalink: item.permalink || ""
    });

  } catch (e) {
    return res.status(500).json({
      ativo: false,
      error: "Erro ao verificar produto.",
      details: String(e)
    });
  }
}
