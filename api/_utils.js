export function normalizarMLB(valor) {
  const m = String(valor || "").match(/MLB-?\d{6,}/i);
  return m ? m[0].replace("-", "").toUpperCase() : null;
}

export async function buscarProdutoMLB(itemId, linkAfiliado = "") {
  const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
  const item = await itemRes.json();

  if (!item || item.error || !item.title) {
    throw new Error("Produto não encontrado na API oficial do Mercado Livre.");
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

  return {
    itemId,
    nome: item.title || "",
    preco: item.price || 0,
    categoria,
    imagens,
    linkCompra: linkAfiliado || item.permalink || "",
    linkAfiliado: linkAfiliado || "",
    linkProduto: item.permalink || "",
    ativo: item.status === "active",
    estoque: item.available_quantity || 0,
    permalink: item.permalink || ""
  };
}
