export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: "Informe a URL do Mercado Livre." });
    }

    const resposta = await fetch(url, { redirect: "follow" });
    const urlFinal = resposta.url || url;

    const match = urlFinal.match(/(MLB-?\d+)/i);

    if (!match) {
      return res.status(400).json({ error: "Não encontrei o código MLB no link." });
    }

    const itemId = match[1].replace("-", "").toUpperCase();

    const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
    const item = await itemRes.json();

    if (!item || item.error) {
      return res.status(404).json({ error: "Produto não encontrado." });
    }

    const imagens = (item.pictures || [])
      .map(p => p.secure_url || p.url)
      .filter(Boolean);

    return res.status(200).json({
      nome: item.title || "",
      preco: item.price || 0,
      categoria: item.category_id || "Mercado Livre",
      imagens,
      link: urlFinal,
      ativo: item.status === "active"
    });

  } catch (e) {
    return res.status(500).json({
      error: "Erro ao importar produto.",
      details: String(e)
    });
  }
}
