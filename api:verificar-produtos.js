export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) return res.status(400).json({ error: "Informe a URL do produto." });

    const resposta = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0" }
    });

    const html = await resposta.text();
    const urlFinal = resposta.url || url;

    let match = String(urlFinal).match(/MLB-?\d+/i);
    if (!match) match = html.match(/MLB-?\d+/i);

    if (!match) {
      return res.status(400).json({ ativo: false, error: "Não encontrei o código MLB." });
    }

    const itemId = match[0].replace("-", "").toUpperCase();
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
      permalink: item.permalink || urlFinal
    });

  } catch (e) {
    return res.status(500).json({
      ativo: false,
      error: "Erro ao verificar produto.",
      details: String(e)
    });
  }
}