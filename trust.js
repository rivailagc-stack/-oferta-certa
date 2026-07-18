
document.addEventListener("DOMContentLoaded", () => {
  criarModal();
  document.addEventListener("click", event => {
    const link = event.target.closest('a[href^="http"]');
    if (!link) return;
    const url = link.getAttribute("href") || "";
    if (!ehMarketplace(url)) return;
    event.preventDefault();
    abrirModal(url, identificarLoja(url));
  });
});

function ehMarketplace(url) {
  const v = String(url).toLowerCase();
  return ["mercadolivre","meli.la","shopee","amazon","tiktok"].some(x => v.includes(x));
}

function identificarLoja(url) {
  const v = String(url).toLowerCase();
  if (v.includes("mercado") || v.includes("meli.la")) return "Mercado Livre";
  if (v.includes("shopee")) return "Shopee";
  if (v.includes("amazon")) return "Amazon";
  if (v.includes("tiktok")) return "TikTok Shop";
  return "marketplace parceiro";
}

function criarModal() {
  const modal = document.createElement("div");
  modal.id = "redirectModal";
  modal.className = "redirect-modal hidden";
  modal.innerHTML = `
    <div class="redirect-backdrop" data-close-redirect></div>
    <section class="redirect-card">
      <button class="redirect-close" data-close-redirect type="button">×</button>
      <div class="redirect-icon">🔒</div>
      <h2>Compra segura</h2>
      <p id="redirectText"></p>
      <div class="redirect-checks">
        <span>✓ Pagamento feito no marketplace</span>
        <span>✓ Frete e prazo exibidos antes da compra</span>
        <span>✓ Confira preço e estoque atualizados</span>
      </div>
      <button id="continueRedirect" class="redirect-continue" type="button">Continuar para a loja</button>
      <button class="redirect-cancel" data-close-redirect type="button">Voltar</button>
    </section>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close-redirect]").forEach(b => b.onclick = fecharModal);
}

function abrirModal(url, loja) {
  document.getElementById("redirectText").textContent =
    `Você será direcionado para o ${loja}, onde o pagamento será concluído com segurança.`;
  document.getElementById("continueRedirect").onclick = () => {
    window.open(url, "_blank", "noopener");
    fecharModal();
  };
  document.getElementById("redirectModal").classList.remove("hidden");
  document.body.classList.add("redirect-open");
}

function fecharModal() {
  document.getElementById("redirectModal")?.classList.add("hidden");
  document.body.classList.remove("redirect-open");
}
