export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: "Informe a URL do Mercado Livre." });
    }

    // 1. Segue o redirecionamento do link curto / afiliado
    const resposta = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });

    const html = await resposta.text();
    const urlFinal = resposta.url || url;

    // 2. Tenta encontrar MLB na URL final
    let match = urlFinal.match(/MLB-?\d+/i);

    // 3. Se não encontrar, tenta procurar dentro do HTML
    if (!match) {
      match = html.match(/MLB-?\d+/i);
    }

    if (!match) {
      return res.status(400).json({
        error: "Não encontrei o código MLB no link. Tente copiar o link completo do anúncio."
      });
    }

    const itemId = match[0].replace("-", "").toUpperCase();

    // 4. Busca dados na API do Mercado Livre
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
      linkAfiliado: url,
      linkFinal: urlFinal,
      ativo: item.status === "active",
      estoque: item.available_quantity || 0
    });

  } catch (e) {
    return res.status(500).json({
      error: "Erro ao importar produto.",
      details: String(e)
    });
  }
}
