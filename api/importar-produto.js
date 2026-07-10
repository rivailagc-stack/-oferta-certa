import { normalizarMLB, buscarProdutoMLB } from "./_utils.js";

export default async function handler(req, res) {
  try {
    const { codigoMLB, linkProduto, linkAfiliado, url } = req.query;

    const itemId =
      normalizarMLB(codigoMLB) ||
      normalizarMLB(linkProduto) ||
      normalizarMLB(url);

    if (!itemId) {
      return res.status(400).json({
        error: "Informe o código MLB ou link completo do anúncio."
      });
    }

    const dados = await buscarProdutoMLB(itemId, linkAfiliado || "");
    return res.status(200).json(dados);

  } catch (e) {
    return res.status(500).json({
      error: "Erro ao importar produto.",
      details: String(e)
    });
  }
}
