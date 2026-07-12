
const sheetFile = document.getElementById("sheetFile");
const sheetPreviewBox = document.getElementById("sheetPreviewBox");
const sheetPreviewTable = document.getElementById("sheetPreviewTable");
const sheetPreviewTitle = document.getElementById("sheetPreviewTitle");
const importarPlanilha = document.getElementById("importarPlanilha");
const cancelarPlanilha = document.getElementById("cancelarPlanilha");
const sheetMensagem = document.getElementById("sheetMensagem");

let produtosPlanilha = [];

sheetFile.addEventListener("change", lerPlanilha);
importarPlanilha.addEventListener("click", importarProdutosPlanilha);
cancelarPlanilha.addEventListener("click", () => limparPlanilha());

async function lerPlanilha(event) {
  const arquivo = event.target.files?.[0];
  if (!arquivo) return;

  esconderMensagemPlanilha();

  try {
    const buffer = await arquivo.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const primeiraAba = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[primeiraAba];

    const linhas = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false
    });

    if (linhas.length < 2) {
      throw new Error("A planilha não possui produtos.");
    }

    const cabecalho = linhas[0].map(normalizarCabecalhoPlanilha);

    produtosPlanilha = linhas
      .slice(1)
      .filter(linha => linha.some(celula => String(celula || "").trim()))
      .map((linha, indice) => transformarLinhaPlanilha(cabecalho, linha, indice + 2));

    const erros = produtosPlanilha.filter(item => item.__errors.length);

    sheetPreviewTitle.textContent =
      `${produtosPlanilha.length} produto(s) encontrado(s)` +
      (erros.length ? ` — ${erros.length} com erro` : "");

    renderizarPreviewPlanilha();
    sheetPreviewBox.classList.remove("hidden");
    importarPlanilha.disabled = !produtosPlanilha.length || erros.length > 0;
  } catch (error) {
    produtosPlanilha = [];
    sheetPreviewBox.classList.add("hidden");
    mostrarMensagemPlanilha(error.message, "error");
  } finally {
    sheetFile.value = "";
  }
}

function transformarLinhaPlanilha(cabecalho, linha, numeroLinha) {
  const bruto = {};
  cabecalho.forEach((coluna, indice) => {
    bruto[coluna] = String(linha[indice] ?? "").trim();
  });

  const imagens = [
    bruto.imagem_1,
    bruto.imagem_2,
    bruto.imagem_3,
    bruto.imagem_4,
    bruto.imagem_5
  ].filter(Boolean);

  const produto = {
    title: bruto.titulo,
    description: bruto.descricao || null,
    price: numeroPlanilha(bruto.preco),
    old_price: numeroPlanilha(bruto.preco_antigo),
    category: bruto.categoria,
    marketplace: bruto.loja || "Mercado Livre",
    affiliate_link: bruto.link_afiliado,
    image_url: imagens[0] || null,
    image_urls: imagens,
    product_type: "affiliate",
    featured: booleanoPlanilha(bruto.destaque, false),
    active: booleanoPlanilha(bruto.ativo, true),
    __line: numeroLinha,
    __errors: []
  };

  if (!produto.title) produto.__errors.push("Título obrigatório");
  if (!produto.category) produto.__errors.push("Categoria obrigatória");
  if (!produto.affiliate_link) produto.__errors.push("Link afiliado obrigatório");
  if (!produto.image_url) produto.__errors.push("Informe ao menos Imagem 1");
  if (produto.price === null) produto.__errors.push("Preço inválido");

  return produto;
}

function renderizarPreviewPlanilha() {
  sheetPreviewTable.innerHTML = `
    <div class="sheet-table-row sheet-table-head">
      <span>Linha</span>
      <span>Produto</span>
      <span>Loja</span>
      <span>Preço</span>
      <span>Status</span>
    </div>
    ${produtosPlanilha.map(item => `
      <div class="sheet-table-row ${item.__errors.length ? "has-error" : ""}">
        <span>${item.__line}</span>
        <span>
          <strong>${escaparTextoPlanilha(item.title || "Sem título")}</strong>
          <small>${escaparTextoPlanilha(item.category || "Sem categoria")}</small>
        </span>
        <span>${escaparTextoPlanilha(item.marketplace)}</span>
        <span>${item.price === null ? "Inválido" : formatarPrecoPlanilha(item.price)}</span>
        <span>
          ${item.__errors.length
            ? `<b class="sheet-error-text">${escaparTextoPlanilha(item.__errors.join(", "))}</b>`
            : '<b class="sheet-ok-text">Pronto</b>'
          }
        </span>
      </div>
    `).join("")}
  `;
}

async function importarProdutosPlanilha() {
  if (!produtosPlanilha.length) return;

  importarPlanilha.disabled = true;
  importarPlanilha.textContent = "Importando...";
  esconderMensagemPlanilha();

  let criados = 0;
  let atualizados = 0;
  let falhas = 0;

  for (const item of produtosPlanilha) {
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
      console.error("Falha ao importar:", item.title, error);
      falhas++;
    }
  }

  importarPlanilha.disabled = false;
  importarPlanilha.textContent = "Importar produtos";

  if (falhas) {
    mostrarMensagemPlanilha(
      `${criados} criado(s), ${atualizados} atualizado(s) e ${falhas} com falha.`,
      "error"
    );
  } else {
    mostrarMensagemPlanilha(
      `${criados} criado(s) e ${atualizados} atualizado(s) com sucesso.`,
      "success"
    );
    limparPlanilha(false);

    if (typeof carregarProdutosAdmin === "function") {
      await carregarProdutosAdmin();
    }
  }
}

function limparPlanilha(apagarMensagem = true) {
  produtosPlanilha = [];
  sheetPreviewTable.innerHTML = "";
  sheetPreviewBox.classList.add("hidden");
  importarPlanilha.disabled = false;
  importarPlanilha.textContent = "Importar produtos";
  if (apagarMensagem) esconderMensagemPlanilha();
}

function normalizarCabecalhoPlanilha(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function numeroPlanilha(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return null;

  const normalizado = texto
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function booleanoPlanilha(valor, padrao) {
  const texto = String(valor || "").trim().toLowerCase();
  if (!texto) return padrao;
  return ["sim", "s", "true", "1", "yes"].includes(texto);
}

function escaparTextoPlanilha(valor) {
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarPrecoPlanilha(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function mostrarMensagemPlanilha(texto, tipo) {
  sheetMensagem.className = `message ${tipo}`;
  sheetMensagem.textContent = texto;
}

function esconderMensagemPlanilha() {
  sheetMensagem.className = "message hidden";
  sheetMensagem.textContent = "";
}
