export default async function handler(req, res) {
  try {
    const { linkAfiliado, linkProduto, url } = req.query;
    const link = linkAfiliado || linkProduto || url;

    if (!link) {
      return res.status(400).json({ error: "Informe seu link meli.la ou link do Mercado Livre." });
    }

    let urlFinal = link;
    let html = "";

    async function abrirLink(u) {
      const resposta = await fetch(u, {
        method: "GET",
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
      const texto = await resposta.text();
      return { finalUrl: resposta.url || u, html: texto };
    }

    function acharMLB(texto) {
      if (!texto) return null;
      const patterns = [
        /MLB-?\d{6,}/i,
        /"item_id"\s*:\s*"?(MLB-?\d{6,})"?/i,
        /"id"\s*:\s*"?(MLB-?\d{6,})"?/i,
        /\/(MLB-?\d{6,})-/i
      ];
      for (const p of patterns) {
        const m = String(texto).match(p);
        if (m) return (m[1] || m[0]).replace(/[/"']/g, "");
      }
      return null;
    }

    function linksDoHtml(texto) {
      if (!texto) return [];
      const links = [];
      const regex = /https?:\/\/[^"' <>()]+/gi;
      let m;
      while ((m = regex.exec(texto)) !== null) {
        const l = m[0].replace(/\\u002F/g, "/").replace(/&amp;/g, "&");
        if (l.includes("mercadolivre") || l.includes("mercadolibre") || l.includes("produto.mercadolivre")) {
          links.push(l);
        }
      }
      return [...new Set(links)].slice(0, 8);
    }

    // 1) tenta abrir o link informado
    try {
      const aberto = await abrirLink(link);
      urlFinal = aberto.finalUrl;
      html = aberto.html;
    } catch (e) {}

    let itemId = acharMLB(urlFinal) || acharMLB(html);

    // 2) tenta canonical / og:url / URLs do HTML
    if (!itemId && html) {
      const possiveis = linksDoHtml(html);
      for (const l of possiveis) {
        itemId = acharMLB(l);
        if (itemId) {
          urlFinal = l;
          break;
        }
      }
    }

    // 3) tenta seguir links internos achados no HTML
    if (!itemId && html) {
      const possiveis = linksDoHtml(html);
      for (const l of possiveis) {
        try {
          const aberto2 = await abrirLink(l);
          itemId = acharMLB(aberto2.finalUrl) || acharMLB(aberto2.html);
          if (itemId) {
            urlFinal = aberto2.finalUrl;
            html = aberto2.html;
            break;
          }
        } catch (e) {}
      }
    }

    if (!itemId) {
      return res.status(400).json({
        error: "Não consegui descobrir o anúncio pelo meli.la. Abra o produto, toque em compartilhar e copie o link completo; mantenha seu meli.la no campo de afiliado."
      });
    }

    itemId = itemId.replace("-", "").toUpperCase();

    const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: { "accept": "application/json" }
    });

    const item = await itemRes.json();

    if (!item || item.error) {
      return res.status(404).json({ error: "Produto não encontrado no Mercado Livre." });
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
      linkCompra: linkAfiliado || link,
      linkAfiliado: linkAfiliado || link,
      linkProduto: item.permalink || urlFinal,
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
