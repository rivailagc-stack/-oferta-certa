export default async function handler(req, res) {
  try {
    const { linkAfiliado, linkProduto, codigoMLB, url } = req.query;

    const afiliado = linkAfiliado || url || "";
    const link = linkProduto || linkAfiliado || url || "";

    function normalizarMLB(valor) {
      if (!valor) return null;
      const m = String(valor).match(/MLB-?\d{6,}/i);
      if (!m) return null;
      return m[0].replace("-", "").toUpperCase();
    }

    let itemId = normalizarMLB(codigoMLB) || normalizarMLB(linkProduto);

    // tenta descobrir o MLB pelo link de afiliado ou pelo link informado
    if (!itemId && link) {
      try {
        const resposta = await fetch(link, {
          method: "GET",
          redirect: "follow",
          headers: {
            "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        });

        const urlFinal = resposta.url || link;
        const html = await resposta.text();

        itemId =
          normalizarMLB(urlFinal) ||
          normalizarMLB(html);
      } catch (e) {}
    }

    if (!itemId) {
      return res.status(400).json({
        error: "Não consegui achar o código MLB automaticamente. Cole o código MLB do produto ou o link completo do anúncio."
      });
    }

    // API oficial pública do Mercado Livre para o item
    const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: { "accept": "application/json" }
    });

    const item = await itemRes.json();

    if (!item || item.error || !item.title) {
      return res.status(404).json({
        error: "Produto não encontrado na API oficial do Mercado Livre.",
        itemId
      });
    }

    const imagens = (item.pictures || [])
      .map(p => p.secure_url || p.url)
      .filter(Boolean);

    let categoria = item.category_id || "Mercado Livre";

    try {
      const catRes = await fetch(`https://api.mercadolibre.com/categories/${item.category_id}`);
      const cat = await catRes.json();
      if (cat && cat.name) categoria = cat.name;
    } catch (e) {}

    return res.status(200).json({
      itemId,
      nome: item.title || "",
      preco: item.price || 0,
      categoria,
      imagens,
      linkCompra: afiliado || item.permalink || link,
      linkAfiliado: afiliado || "",
      linkProduto: item.permalink || linkProduto || "",
      ativo: item.status === "active",
      estoque: item.available_quantity || 0,
      permalink: item.permalink || ""
    });

  } catch (e) {
    return res.status(500).json({
      error: "Erro ao importar produto.",
      details: String(e)
    });
  }
}
