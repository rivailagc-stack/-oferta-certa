
const quickTitle = document.getElementById("quickTitle");
const quickPrice = document.getElementById("quickPrice");
const quickMarketplace = document.getElementById("quickMarketplace");
const quickAffiliateLink = document.getElementById("quickAffiliateLink");
const quickImages = document.getElementById("quickImages");
const quickFillButton = document.getElementById("quickFillButton");
const quickFillMessage = document.getElementById("quickFillMessage");

quickFillButton?.addEventListener("click", preencherRapido);

function preencherRapido() {
  const title = quickTitle.value.trim();
  const affiliateLink = quickAffiliateLink.value.trim();
  const price = quickPrice.value.trim();
  const marketplace = quickMarketplace.value;
  const images = quickImages.value
    .split(/\r?\n/)
    .map(url => url.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (!title) {
    mostrarMensagemRapida("Informe o título do produto.", "error");
    return;
  }

  if (!affiliateLink) {
    mostrarMensagemRapida("Informe o link afiliado.", "error");
    return;
  }

  document.getElementById("produtoId").value = "";
  document.getElementById("title").value = title;
  document.getElementById("price").value = price;
  document.getElementById("old_price").value = "";
  document.getElementById("marketplace").value = marketplace;
  document.getElementById("affiliate_link").value = affiliateLink;
  document.getElementById("description").value = gerarDescricaoRapida(title);
  document.getElementById("category").value = sugerirCategoriaRapida(title);
  document.getElementById("featured").checked = false;
  document.getElementById("active").checked = true;

  const productType = document.getElementById("product_type");
  if (productType) {
    productType.value = "affiliate";
    productType.dispatchEvent(new Event("change"));
  }

  if (typeof arquivosSelecionados !== "undefined") {
    arquivosSelecionados.forEach(item => {
      if (item.preview) URL.revokeObjectURL(item.preview);
    });
    arquivosSelecionados = [];
  }

  if (typeof imagensExistentes !== "undefined") {
    imagensExistentes = images;
  }

  if (typeof renderizarPreviews === "function") {
    renderizarPreviews();
  }

  if (typeof tituloFormulario !== "undefined") {
    tituloFormulario.textContent = "Produto preenchido — confira e salve";
  }

  if (typeof botaoCancelar !== "undefined") {
    botaoCancelar.classList.remove("hidden");
  }

  mostrarMensagemRapida(
    images.length
      ? "Formulário preenchido com sucesso. Confira e salve."
      : "Formulário preenchido. Adicione ao menos uma foto real antes de salvar.",
    images.length ? "success" : "warning"
  );

  document.getElementById("produtoForm")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function sugerirCategoriaRapida(title) {
  const text = normalizarRapido(title);

  const rules = [
    ["Eletrônicos", ["celular", "smartphone", "fone", "caixa de som", "televisao", "camera"]],
    ["Informática", ["notebook", "computador", "ssd", "teclado", "mouse", "monitor", "impressora"]],
    ["Casa e Cozinha", ["panela", "pote", "marmita", "taca", "copo", "cozinha", "garrafa", "talher"]],
    ["Ferramentas", ["furadeira", "parafusadeira", "soquete", "ferramenta", "chave", "alicate"]],
    ["Beleza", ["serum", "maquiagem", "shampoo", "perfume", "hidratante", "skin care"]],
    ["Automotivo", ["carro", "moto", "pneu", "capacete", "automotivo"]],
    ["Esporte e Fitness", ["academia", "fitness", "halter", "bicicleta", "esporte"]],
    ["Artesanato", ["croche", "barbante", "linha", "agulha", "artesanato"]],
    ["Pet Shop", ["pet", "cachorro", "gato", "racao"]],
    ["Brinquedos", ["brinquedo", "boneca", "carrinho infantil", "lego"]],
    ["Moda", ["camiseta", "vestido", "calca", "blusa", "roupa"]],
    ["Calçados", ["tenis", "sapato", "sandalia", "chinelo"]]
  ];

  for (const [category, words] of rules) {
    if (words.some(word => text.includes(word))) return category;
  }

  return "Outros";
}

function gerarDescricaoRapida(title) {
  const category = sugerirCategoriaRapida(title);

  const templates = {
    "Casa e Cozinha":
      `${title}. Produto prático para facilitar a organização e o uso no dia a dia. Confira medidas, capacidade, material, cores disponíveis e demais condições diretamente no anúncio oficial.`,
    "Eletrônicos":
      `${title}. Consulte especificações técnicas, compatibilidade, garantia, estoque e condições de pagamento diretamente no anúncio oficial.`,
    "Informática":
      `${title}. Verifique configuração, compatibilidade, garantia, acessórios inclusos e condições da oferta no anúncio oficial.`,
    "Ferramentas":
      `${title}. Ideal para uso doméstico ou profissional. Confira medidas, itens inclusos, material e especificações no anúncio oficial.`,
    "Beleza":
      `${title}. Consulte composição, modo de uso, quantidade, validade e recomendações diretamente no anúncio oficial.`,
    "Artesanato":
      `${title}. Indicado para trabalhos artesanais. Confira cor, espessura, peso, composição e demais características no anúncio oficial.`,
    "Outros":
      `${title}. Confira características, medidas, disponibilidade, frete, preço atualizado e condições de compra diretamente no anúncio oficial.`
  };

  return templates[category] || templates["Outros"];
}

function normalizarRapido(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mostrarMensagemRapida(text, type) {
  quickFillMessage.className = `message ${type}`;
  quickFillMessage.textContent = text;
}
