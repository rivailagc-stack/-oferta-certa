export default async function handler(req, res) {
  try {
    const { linkProduto, linkAfiliado, url } = req.query;

    const link = linkProduto || linkAfiliado || url;

    if (!link) {
      return res.status(400).json({
        error: "Informe o link do Mercado Livre."
      });
    }

    let urlFinal = link;
    let html = "";

    const resposta = await fetch(link, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });

    urlFinal = resposta.url || link;
    html = await resposta.text();

    let match = urlFinal.match(/MLB-?\d+/i);

    if (!match) {
      match = html.match(/MLB-?\d+/i);
    }

    if (!match) {
      const permalinkMatch = html.match(/https?:\/\/[^"' ]*mercadolivre[^"' ]*/i);

      if (permalinkMatch) {
        const segundaResposta = await fetch(permalinkMatch[0], {
          method: "GET",
          redirect: "follow",
          headers: {
            "user-agent": "Mozilla/5.0"
          }
        });

        const segundaUrl = segundaResposta.url || permalinkMatch[0];
        const segundoHtml = await segundaResposta.text();

        match = segundaUrl.match(/MLB-?\d+/i) || segundoHtml.match(/MLB-?\d+/i);
        urlFinal = segundaUrl;
        html = segundoHtml;
      }
    }

    if (!match) {
      return res.status(400).json({
        error: "Não encontrei o código MLB. Tente abrir o produto no Mercado Livre e copiar o link completo do anúncio."
      });
    }

    const itemId = match[0].replace("-", "").toUpperCase();

    const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
    const item = await itemRes.json();

    if (!item || item.error) {
      return res.status(404).json({
        error: "Produto não encontrado no Mercado Livre."
      });
    }

    const imagens = (item.pictures || [])
      .map(p => p.secure_url || p.url)
      .filter(Boolean);

    let categoria = item.category_id || "Mercado Livre";

    try {
      const catRes = await fetch(`https://api.mercadolibre.com/categories/${item.category_id}`);
      const cat = await catRes.json();

      if (cat && cat.name) {
        categoria = cat.name;
      }
    } catch (e) {}

    return res.status(200).json({
      itemId,
      nome: item.title || "",
      preco: item.price || 0,
      categoria,
      imagens,
      linkCompra: linkAfiliado || url || link,
      linkAfiliado: linkAfiliado || url || link,
      linkFinal: urlFinal,
      ativo: item.status === "active",
      estoque: item.available_quantity || 0,
      permalink: item.permalink || urlFinal
    });

  } catch (e) {
    return res.status(500).json({
      error: "Erro ao importar produto.",
      details: String(e)
    });
  }
}
