import { normalizarMLB, buscarProdutoMLB } from "./_utils.js";

export default async function handler(req, res) {
  try {
    const { codigoMLB, url } = req.query;
    const itemId = normalizarMLB(codigoMLB) || normalizarMLB(url);

    if (!itemId) return res.status(400).json({ ativo: false, error: "Informe o código MLB ou link completo." });

    const dados = await buscarProdutoMLB(itemId, "");
    return res.status(200).json({
      ativo: dados.ativo,
      nome: dados.nome,
      preco: dados.preco,
      estoque: dados.estoque,
      permalink: dados.permalink
    });
  } catch (e) {
    return res.status(500).json({ ativo: false, error: "Erro ao verificar produto.", details: String(e) });
  }
}
