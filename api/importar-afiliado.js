import { normalizarMLB, buscarProdutoMLB } from "./_utils.js";

async function tentarFetch(link) {
  try {
    const r = await fetch(link, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    const finalUrl = r.url || link;
    const html = await r.text();
    return normalizarMLB(finalUrl) || normalizarMLB(html);
  } catch (e) {
    return null;
  }
}

async function tentarNavegador(link) {
  let browser;
  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise(r => setTimeout(r, 4500));

    let itemId = normalizarMLB(page.url());

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
  } catch (e) {
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

export default async function handler(req, res) {
  try {
    const { linkAfiliado, url } = req.query;
    const link = linkAfiliado || url;

    if (!link) {
      return res.status(400).json({ error: "Informe o link de afiliado meli.la." });
    }

    let itemId = normalizarMLB(link);
    if (!itemId) itemId = await tentarFetch(link);
    if (!itemId) itemId = await tentarNavegador(link);

    if (!itemId) {
      return res.status(400).json({
        error: "Não consegui descobrir o MLB pelo meli.la. O Mercado Livre bloqueou o redirecionamento. Use o campo de emergência com o código MLB se aparecer."
      });
    }

    const dados = await buscarProdutoMLB(itemId, link);
    return res.status(200).json(dados);

  } catch (e) {
    return res.status(500).json({
      error: "Erro ao importar pelo link de afiliado.",
      details: String(e)
    });
  }
}
