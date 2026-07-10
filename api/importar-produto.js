function normalizarMLB(valor) {
  const m = String(valor || "").match(/MLB-?\d{6,}/i);
  return m ? m[0].replace("-", "").toUpperCase() : null;
}

export default async function handler(req, res) {
  try {
    const { codigoMLB, linkProduto, linkAfiliado, url } = req.query;
    const itemId = normalizarMLB(codigoMLB) || normalizarMLB(linkProduto) || normalizarMLB(url);

    if (!itemId) {
      return res.status(400).json({
        error: "Informe o código MLB ou o link completo do anúncio. O meli.la será usado só no botão Comprar."
      });
    }

    const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
    const item = await itemRes.json();

    if (!item || item.error || !item.title) {
      return res.status(404).json({ error: "Produto não encontrado no Mercado Livre.", itemId });
    }

    const imagens = (item.pictures || []).map(p => p.secure_url || p.url).filter(Boolean);
    let categoria = item.category_id || "Mercado Livre";

    try {
      const catRes = await fetch(`https://api.mercadolibre.com/categories/${item.category_id}`);
      const cat = await catRes.json();
      if (cat?.name) categoria = cat.name;
    } catch (e) {}

    return res.status(200).json({
      itemId,
      nome: item.title || "",
      preco: item.price || 0,
      categoria,
      imagens,
      linkCompra: linkAfiliado || item.permalink || "",
      linkAfiliado: linkAfiliado || "",
      linkProduto: item.permalink || linkProduto || "",
      ativo: item.status === "active",
      estoque: item.available_quantity || 0,
      permalink: item.permalink || ""
    });
  } catch (e) {
    return res.status(500).json({ error: "Erro ao importar produto.", details: String(e) });
  }
}
