document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const sharedTitle = params.get("title") || "";
  const sharedText = params.get("text") || "";
  const sharedUrl = params.get("url") || extrairUrl(sharedText);

  if (!sharedUrl && !sharedTitle && !sharedText) return;

  const box = document.getElementById("shareImportBox");
  const text = document.getElementById("shareImportText");
  const useButton = document.getElementById("usarLinkCompartilhado");
  const closeButton = document.getElementById("fecharLinkCompartilhado");

  if (!box || !text) return;

  text.textContent = [sharedTitle, sharedText, sharedUrl]
    .filter(Boolean)
    .join(" — ");

  box.classList.remove("hidden");

  useButton.addEventListener("click", () => {
    const affiliateInput = document.getElementById("affiliate_link");
    const titleInput = document.getElementById("title");
    const marketplaceSelect = document.getElementById("marketplace");
    const productType = document.getElementById("product_type");

    if (productType) productType.value = "affiliate";
    if (productType) productType.dispatchEvent(new Event("change"));

    if (affiliateInput && sharedUrl) affiliateInput.value = sharedUrl;
    if (titleInput && sharedTitle && !titleInput.value) titleInput.value = sharedTitle;

    if (marketplaceSelect && sharedUrl) {
      const lower = sharedUrl.toLowerCase();
      if (lower.includes("mercadolivre") || lower.includes("meli.la")) {
        marketplaceSelect.value = "Mercado Livre";
      } else if (lower.includes("shopee")) {
        marketplaceSelect.value = "Shopee";
      } else if (lower.includes("amazon")) {
        marketplaceSelect.value = "Amazon";
      } else if (lower.includes("tiktok")) {
        marketplaceSelect.value = "TikTok Shop";
      }
    }

    box.classList.add("hidden");
    window.history.replaceState({}, "", "/admin.html");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  closeButton.addEventListener("click", () => {
    box.classList.add("hidden");
    window.history.replaceState({}, "", "/admin.html");
  });
});

function extrairUrl(texto) {
  const match = String(texto || "").match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : "";
}
