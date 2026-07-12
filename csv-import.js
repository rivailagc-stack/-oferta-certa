
const csvFile = document.getElementById("csvFile");
const baixarModeloCsv = document.getElementById("baixarModeloCsv");
const csvPreviewBox = document.getElementById("csvPreviewBox");
const csvPreviewTable = document.getElementById("csvPreviewTable");
const csvPreviewTitle = document.getElementById("csvPreviewTitle");
const importarCsv = document.getElementById("importarCsv");
const cancelarCsv = document.getElementById("cancelarCsv");
const csvMensagem = document.getElementById("csvMensagem");

let csvProdutos = [];

baixarModeloCsv.addEventListener("click", baixarModelo);
csvFile.addEventListener("change", lerArquivoCsv);
importarCsv.addEventListener("click", importarProdutosCsv);
cancelarCsv.addEventListener("click", limparImportacaoCsv);

function baixarModelo() {
  const cabecalho = [
    "title",
    "description",
    "price",
    "old_price",
    "category",
    "marketplace",
    "affiliate_link",
    "image_1",
    "image_2",
    "image_3",
    "image_4",
    "image_5",
    "featured",
    "active"
  ];

  const exemplo = [
    "Jogo de Taças Diamond 6 Peças",
    "Conjunto de taças para água, vinho e suco.",
    "129,90",
    "159,90",
    "Casa e Cozinha",
    "Mercado Livre",
    "https://meli.la/exemplo",
    "https://exemplo.com/foto1.jpg",
    "https://exemplo.com/foto2.jpg",
    "",
    "",
    "",
    "SIM",
    "SIM"
  ];

  const conteudo = [cabecalho, exemplo]
    .map(linha => linha.map(escaparCampoCsv).join(";"))
    .join("\n");

  const blob = new Blob(["\ufeff" + conteudo], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-oferta-certa.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function lerArquivoCsv(event) {
  const arquivo = event.target.files?.[0];
  if (!arquivo) return;

  esconderCsvMensagem();

  try {
    const texto = await arquivo.text();
    const linhas = parseCsv(texto);

    if (linhas.length < 2) {
      throw new Error("A planilha não possui produtos.");
    }

    const cabecalho = linhas[0].map(normalizarCabecalho);
    csvProdutos = linhas
      .slice(1)
      .filter(linha => linha.some(celula => String(celula || "").trim()))
      .map((linha, indice) => transformarLinha(cabecalho, linha, indice + 2));

    const erros = csvProdutos.filter(item => item.__errors.length);

    csvPreviewTitle.textContent =
      `${csvProdutos.length} produto(s) encontrado(s)` +
      (erros.length ? ` — ${erros.length} com erro` : "");

    renderizarPreviewCsv();
    csvPreviewBox.classList.remove("hidden");
    importarCsv.disabled = !csvProdutos.length || erros.length > 0;
  } catch (error) {
    csvProdutos = [];
    csvPreviewBox.classList.add("hidden");
    mostrarCsvMensagem(error.message, "error");
  } finally {
    csvFile.value = "";
  }
}

function transformarLinha(cabecalho, linha, numeroLinha) {
  const bruto = {};

  cabecalho.forEach((coluna, indice) => {
    bruto[coluna] = String(linha[indice] ?? "").trim();
  });

  const imagens = [
    bruto.image_1,
    bruto.image_2,
    bruto.image_3,
    bruto.image_4,
    bruto.image_5
  ].filter(Boolean);

  const produto = {
    title: bruto.title,
    description: bruto.description || null,
    price: numeroCsv(bruto.price),
    old_price: numeroCsv(bruto.old_price),
    category: bruto.category,
    marketplace: bruto.marketplace || "Mercado Livre",
    affiliate_link: bruto.affiliate_link,
    image_url: imagens[0] || null,
    image_urls: imagens,
    product_type: "affiliate",
    featured: booleanoCsv(bruto.featured, false),
    active: booleanoCsv(bruto.active, true),
    __line: numeroLinha,
    __errors: []
  };

  if (!produto.title) produto.__errors.push("Título obrigatório");
  if (!produto.category) produto.__errors.push("Categoria obrigatória");
  if (!produto.affiliate_link) produto.__errors.push("Link afiliado obrigatório");
  if (!produto.image_url) produto.__errors.push("Informe ao menos image_1");
  if (produto.price === null) produto.__errors.push("Preço inválido");

  return produto;
}

function renderizarPreviewCsv() {
  csvPreviewTable.innerHTML = `
    <div class="csv-table-row csv-table-head">
      <span>Linha</span>
      <span>Produto</span>
      <span>Loja</span>
      <span>Preço</span>
      <span>Status</span>
    </div>
    ${csvProdutos.map(item => `
      <div class="csv-table-row ${item.__errors.length ? "has-error" : ""}">
        <span>${item.__line}</span>
        <span>
          <strong>${escaparTextoCsv(item.title || "Sem título")}</strong>
          <small>${escaparTextoCsv(item.category || "Sem categoria")}</small>
        </span>
        <span>${escaparTextoCsv(item.marketplace)}</span>
        <span>${item.price === null ? "Inválido" : formatarPrecoCsv(item.price)}</span>
        <span>
          ${item.__errors.length
            ? `<b class="csv-error-text">${escaparTextoCsv(item.__errors.join(", "))}</b>`
            : '<b class="csv-ok-text">Pronto</b>'
          }
        </span>
      </div>
    `).join("")}
  `;
}

async function importarProdutosCsv() {
  if (!csvProdutos.length) return;

  importarCsv.disabled = true;
  importarCsv.textContent = "Importando...";
  esconderCsvMensagem();

  let criados = 0;
  let atualizados = 0;
  let falhas = 0;

  for (const item of csvProdutos) {
    const produto = { ...item };
    delete produto.__line;
    delete produto.__errors;

    try {
      const { data: existente, error: buscaErro } = await supabaseClient
        .from("products")
        .select("id")
        .eq("affiliate_link", produto.affiliate_link)
        .maybeSingle();

      if (buscaErro) throw buscaErro;

      if (existente?.id) {
        const { error } = await supabaseClient
          .from("products")
          .update(produto)
          .eq("id", existente.id);

        if (error) throw error;
        atualizados++;
      } else {
        const { error } = await supabaseClient
          .from("products")
          .insert(produto);

        if (error) throw error;
        criados++;
      }
    } catch (error) {
      console.error("Falha ao importar produto:", item.title, error);
      falhas++;
    }
  }

  importarCsv.disabled = false;
  importarCsv.textContent = "Importar produtos";

  if (falhas) {
    mostrarCsvMensagem(
      `${criados} criado(s), ${atualizados} atualizado(s) e ${falhas} com falha.`,
      "error"
    );
  } else {
    mostrarCsvMensagem(
      `${criados} criado(s) e ${atualizados} atualizado(s) com sucesso.`,
      "success"
    );
    limparImportacaoCsv(false);

    if (typeof carregarProdutosAdmin === "function") {
      await carregarProdutosAdmin();
    }
  }
}

function limparImportacaoCsv(apagarMensagem = true) {
  csvProdutos = [];
  csvPreviewTable.innerHTML = "";
  csvPreviewBox.classList.add("hidden");
  importarCsv.disabled = false;
  importarCsv.textContent = "Importar produtos";

  if (apagarMensagem) esconderCsvMensagem();
}

function parseCsv(texto) {
  const limpo = texto.replace(/^\uFEFF/, "");
  const primeiraLinha = limpo.split(/\r?\n/, 1)[0] || "";
  const separador = primeiraLinha.includes(";") ? ";" : ",";

  const linhas = [];
  let linha = [];
  let campo = "";
  let entreAspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const caractere = limpo[i];
    const proximo = limpo[i + 1];

    if (caractere === '"') {
      if (entreAspas && proximo === '"') {
        campo += '"';
        i++;
      } else {
        entreAspas = !entreAspas;
      }
    } else if (caractere === separador && !entreAspas) {
      linha.push(campo);
      campo = "";
    } else if ((caractere === "\n" || caractere === "\r") && !entreAspas) {
      if (caractere === "\r" && proximo === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += caractere;
    }
  }

  if (campo.length || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }

  return linhas;
}

function normalizarCabecalho(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function numeroCsv(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return null;

  let normalizado = texto
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function booleanoCsv(valor, padrao) {
  const texto = String(valor || "").trim().toLowerCase();
  if (!texto) return padrao;
  return ["sim", "s", "true", "1", "yes"].includes(texto);
}

function escaparCampoCsv(valor) {
  const texto = String(valor ?? "");
  return `"${texto.replace(/"/g, '""')}"`;
}

function escaparTextoCsv(valor) {
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarPrecoCsv(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function mostrarCsvMensagem(texto, tipo) {
  csvMensagem.className = `message ${tipo}`;
  csvMensagem.textContent = texto;
}

function esconderCsvMensagem() {
  csvMensagem.className = "message hidden";
  csvMensagem.textContent = "";
}
