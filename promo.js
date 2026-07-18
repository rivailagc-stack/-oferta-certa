document.addEventListener("DOMContentLoaded", async () => {
  iniciarContadorPromocao();
  await carregarPromocoesReais();
});

async function carregarPromocoesReais() {
  const container = document.getElementById("flashProducts");
  if (!container || typeof supabaseClient === "undefined") return;

  container.innerHTML = '<div class="promo-loading">Carregando ofertas...</div>';

  const { data, error } = await supabaseClient
    .from("products")
    .select("id,title,price,old_price,image_url,image_urls,affiliate_link,marketplace,product_type,stock,active,featured,flash_sale,flash_sale_end_at")
    .eq("active", true)
    .gt("price", 0)
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = "";
    console.error("Erro ao carregar promoções:", error);
    return;
  }

  const produtos = (data || []).map(normalizarProduto);
  const relampagoAtivas = produtos.filter(produto =>
    produto.flash_sale && ofertaAindaValida(produto.flash_sale_end_at)
  );

  const lista = (relampagoAtivas.length ? relampagoAtivas : produtos)
    .sort((a, b) =>
      Number(b.flash_sale) - Number(a.flash_sale) ||
      b.discount - a.discount ||
      Number(b.featured) - Number(a.featured)
    )
    .slice(0, 8);

  if (!lista.length) {
    container.innerHTML = '<p class="promo-empty">Cadastre produtos com preço para aparecerem aqui.</p>';
    return;
  }

  atualizarOfertaDoDia(lista[0]);
  renderizarOfertasRelampago(lista);
}

function normalizarProduto(produto) {
  const price = numero(produto.price);
  const oldPrice = numero(produto.old_price);

  return {
    ...produto,
    price,
    oldPrice,
    discount:
      oldPrice > price && price > 0
        ? Math.round(((oldPrice - price) / oldPrice) * 100)
        : 0,
    image:
      produto.image_url ||
      (Array.isArray(produto.image_urls) ? produto.image_urls[0] : "") ||
      ""
  };
}

function atualizarOfertaDoDia(produto) {
  const titulo = document.getElementById("ofertaDoDiaTitulo");
  const texto = document.getElementById("ofertaDoDiaTexto");
  const botao = document.getElementById("verOfertaDoDia");

  if (titulo) titulo.textContent = produto.title;

  if (texto) {
    texto.textContent = produto.discount
      ? `${produto.discount}% de desconto. Confira enquanto estiver disponível.`
      : `Por ${formatarPreco(produto.price)}. Confira as condições da oferta.`;
  }

  if (botao) {
    botao.onclick = () => abrirProdutoPelaLoja(produto.id);
  }
}

function renderizarOfertasRelampago(produtos) {
  const container = document.getElementById("flashProducts");

  container.innerHTML = produtos.map(produto => `
    <article class="flash-card">
      <button class="flash-card-click" type="button" data-promo-product="${escapar(produto.id)}">
        <div class="flash-image-wrap">
          ${produto.discount
            ? `<span class="flash-discount">-${produto.discount}%</span>`
            : produto.flash_sale
              ? '<span class="flash-discount">OFERTA</span>'
              : ""
          }
          <img src="${escapar(produto.image)}" alt="${escapar(produto.title)}" loading="lazy">
        </div>

        <div class="flash-card-body">
          <h3>${escapar(produto.title)}</h3>

          <div class="flash-price-row">
            ${produto.oldPrice > produto.price
              ? `<small>${formatarPreco(produto.oldPrice)}</small>`
              : ""
            }
            <strong>${formatarPreco(produto.price)}</strong>
          </div>

          <span class="flash-cta">
            ${produto.product_type === "own" ? "Adicionar ao carrinho" : "Ver oferta"}
          </span>
        </div>
      </button>
    </article>
  `).join("");

  container.querySelectorAll("[data-promo-product]").forEach(button => {
    button.addEventListener("click", () =>
      abrirProdutoPelaLoja(button.dataset.promoProduct)
    );
  });
}

function abrirProdutoPelaLoja(id) {
  const detalhes = document.querySelector(`[data-details-id="${CSS.escape(String(id))}"]`);
  if (detalhes) {
    detalhes.click();
    return;
  }

  const card = [...document.querySelectorAll(".product-card")].find(card =>
    card.querySelector(`[data-add-cart-id="${CSS.escape(String(id))}"],[data-buy-id="${CSS.escape(String(id))}"]`)
  );

  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function iniciarContadorPromocao() {
  const element = document.getElementById("flashCountdown");
  if (!element) return;

  const agora = new Date();
  const fim = new Date(agora);
  fim.setHours(23, 59, 59, 999);

  const atualizar = () => {
    let restante = Math.max(0, Math.floor((fim.getTime() - Date.now()) / 1000));
    const horas = Math.floor(restante / 3600);
    restante %= 3600;
    const minutos = Math.floor(restante / 60);
    const segundos = restante % 60;

    element.textContent =
      `${String(horas).padStart(2, "0")}:` +
      `${String(minutos).padStart(2, "0")}:` +
      `${String(segundos).padStart(2, "0")}`;
  };

  atualizar();
  setInterval(atualizar, 1000);
}

function ofertaAindaValida(valor) {
  if (!valor) return true;
  const data = new Date(valor);
  return !Number.isNaN(data.getTime()) && data.getTime() > Date.now();
}

function numero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escapar(valor) {
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
