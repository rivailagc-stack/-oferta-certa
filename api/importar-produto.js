import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

function normalizarMLB(valor) {
  if (!valor) return null;
  const m = String(valor).match(/MLB-?\d{6,}/i);
  if (!m) return null;
  return m[0].replace("-", "").toUpperCase();
}

async function buscarDadosPorApi(itemId, linkAfiliado, linkFallback) {
  const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    headers: { "accept": "application/json" }
  });

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
    linkCompra: linkAfiliado || linkFallback || item.permalink || "",
    linkAfiliado: linkAfiliado || "",
    linkProduto: item.permalink || linkFallback || "",
    ativo: item.status === "active",
    estoque: item.available_quantity || 0,
    permalink: item.permalink || ""
  };
}

async function descobrirMLBComFetch(link) {
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

    return normalizarMLB(urlFinal) || normalizarMLB(html);
  } catch (e) {
    return null;
  }
}

async function descobrirMLBComNavegador(link) {
  let browser;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );

    await page.goto(link, {
      waitUntil: "networkidle2",
      timeout: 25000
    });

    await page.waitForTimeout(2500);

    const finalUrl = page.url();

    let itemId = normalizarMLB(finalUrl);

    if (!itemId) {
      const html = await page.content();
      itemId = normalizarMLB(html);
    }

    if (!itemId) {
      const links = await page.$$eval("a", els => els.map(a => a.href).filter(Boolean));
      for (const l of links) {
        itemId = normalizarMLB(l);
        if (itemId) break;
      }
    }

    return itemId;
  } finally {
    if (browser) await browser.close();
  }
}

export default async function handler(req, res) {
  try {
    const { linkAfiliado, linkProduto, codigoMLB, url } = req.query;

    const link = linkAfiliado || linkProduto || url || "";
    const afiliado = linkAfiliado || url || "";

    let itemId =
      normalizarMLB(codigoMLB) ||
      normalizarMLB(linkProduto) ||
      normalizarMLB(linkAfiliado) ||
      normalizarMLB(url);

    if (!itemId && link) {
      itemId = await descobrirMLBComFetch(link);
    }

    if (!itemId && link) {
      itemId = await descobrirMLBComNavegador(link);
    }

    if (!itemId) {
      return res.status(400).json({
        error: "Não consegui descobrir o código MLB. Tente colar também o código MLB ou o link completo do anúncio."
      });
    }

    const dados = await buscarDadosPorApi(itemId, afiliado, link);

    return res.status(200).json(dados);

  } catch (e) {
    return res.status(500).json({
      error: "Erro ao importar produto na V11.",
      details: String(e)
    });
  }
}
