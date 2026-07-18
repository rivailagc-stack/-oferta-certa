(() => {
  const landing = document.getElementById("categoryLanding");
  const title = document.getElementById("categoryLandingTitle");
  const text = document.getElementById("categoryLandingText");
  const categorySelect = document.getElementById("categoria");
  const shareCategoryButton = document.getElementById("divulgarCategoriaPublica");
  const fullStoreButton = document.getElementById("verLojaCompleta");
  const shareStoreButton = document.getElementById("divulgarLojaPublica");

  let activeCategory = "";

  document.addEventListener("DOMContentLoaded", () => {
    waitForCategories(0);
  });

  shareCategoryButton?.addEventListener("click", () => {
    if (activeCategory) shareCategory(activeCategory);
  });

  fullStoreButton?.addEventListener("click", showFullStore);
  shareStoreButton?.addEventListener("click", shareStore);

  function waitForCategories(attempt) {
    const requested = new URLSearchParams(location.search).get("categoria");
    if (!requested) {
      hideLanding();
      return;
    }

    const hasCategories = categorySelect && [...categorySelect.options].some(option => option.value);
    if (!hasCategories && attempt < 20) {
      setTimeout(() => waitForCategories(attempt + 1), 250);
      return;
    }

    applyCategoryFromUrl();
  }

  function applyCategoryFromUrl() {
    if (!categorySelect) return;

    const requested = new URLSearchParams(location.search).get("categoria");
    if (!requested) {
      hideLanding();
      return;
    }

    const options = [...categorySelect.options].map(option => option.value).filter(Boolean);
    const match = options.find(
      category => category.toLocaleLowerCase("pt-BR") === requested.toLocaleLowerCase("pt-BR")
    );

    if (!match) {
      hideLanding();
      return;
    }

    activeCategory = match;
    categorySelect.value = match;
    categorySelect.dispatchEvent(new Event("change", { bubbles: true }));

    title.textContent = `Ofertas em ${match}`;
    text.textContent = `Produtos selecionados da categoria ${match}. Você também pode acessar toda a loja.`;
    landing?.classList.remove("hidden");

    document.querySelector(".products-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function hideLanding() {
    activeCategory = "";
    landing?.classList.add("hidden");
  }

  function showFullStore() {
    const url = new URL(location.href);
    url.searchParams.delete("categoria");
    history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    categorySelect.value = "";
    categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
    hideLanding();
    document.querySelector(".products-section")?.scrollIntoView({ behavior: "smooth" });
  }

  function categoryUrl(category) {
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set("categoria", category);
    return url.href;
  }

  async function shareCategory(category) {
    const url = categoryUrl(category);
    const message = `🔥 Ofertas em ${category}\nConfira os produtos selecionados da Oferta Certa:\n${url}`;
    await share({ title: `Oferta Certa — ${category}`, text: message, url });
  }

  async function shareStore() {
    const url = new URL(location.origin + location.pathname).href;
    const message = `⚡ Oferta Certa\nProdutos próprios e ofertas selecionadas em um só lugar:\n${url}`;
    await share({ title: "Oferta Certa", text: message, url });
  }

  async function share(payload) {
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(payload.text);
      alert("Texto e link copiados. Agora cole no TikTok, Instagram, Facebook ou WhatsApp.");
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(payload.text)}`, "_blank", "noopener");
    }
  }
})();
