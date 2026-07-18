
document.addEventListener("DOMContentLoaded", () => {
  iniciarContador();
  setTimeout(montarPromocoes, 700);
  setTimeout(montarPromocoes, 1800);
});

function montarPromocoes() {
  const cards = [...document.querySelectorAll(".product-card")];
  if (!cards.length) return;

  const produtos = cards.map((card, index) => {
    const title = card.querySelector(".product-title")?.textContent?.trim() || card.querySelector("h3")?.textContent?.trim() || `Produto ${index + 1}`;
    const image = card.querySelector("img")?.src || "";
    const current = preco(card.querySelector(".current-price")?.textContent || card.querySelector(".product-price")?.textContent || "");
    const oldPrice = preco(card.querySelector(".old-price")?.textContent || "");
    const discount = oldPrice > current && current > 0 ? Math.round(((oldPrice-current)/oldPrice)*100) : 0;
    return { card, title, image, current, oldPrice, discount };
  }).sort((a,b) => b.discount - a.discount);

  const destaque = produtos[0];
  document.getElementById("ofertaDoDiaTitulo").textContent = destaque.title;
  document.getElementById("ofertaDoDiaTexto").textContent = destaque.discount ? `Até ${destaque.discount}% de desconto.` : "Confira esta oferta selecionada.";
  document.getElementById("verOfertaDoDia").onclick = () => destaque.card.click();

  const area = document.getElementById("flashProducts");
  area.innerHTML = produtos.slice(0,6).map((p,i) => `
    <article class="flash-card" data-flash="${i}">
      <div class="flash-image-wrap">
        ${p.discount ? `<span class="flash-discount">-${p.discount}%</span>` : ""}
        <img src="${p.image}" alt="${esc(p.title)}">
      </div>
      <div class="flash-card-body">
        <h3>${esc(p.title)}</h3>
        ${p.oldPrice > p.current ? `<small>${fmt(p.oldPrice)}</small>` : ""}
        <strong>${fmt(p.current)}</strong>
        <span>Ver oferta</span>
      </div>
    </article>
  `).join("");

  area.querySelectorAll("[data-flash]").forEach(el => {
    el.onclick = () => produtos[Number(el.dataset.flash)].card.click();
  });
}

function iniciarContador() {
  const el = document.getElementById("flashCountdown");
  if (!el) return;
  let s = 21599;
  setInterval(() => {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    el.textContent = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    s = s > 0 ? s-1 : 21599;
  }, 1000);
}

function preco(v){const n=Number(String(v||"").replace(/[R$\s]/g,"").replace(/\./g,"").replace(",","."));return Number.isFinite(n)?n:0}
function fmt(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function esc(v){return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
