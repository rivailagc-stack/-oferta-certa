document.addEventListener("DOMContentLoaded", iniciarCentralDivulgacao);

async function iniciarCentralDivulgacao() {
  const container = document.getElementById("categoryShareAdmin");
  const fullUrl = storeBaseUrl();
  document.getElementById("fullStoreShareUrl").textContent = fullUrl;

  document.querySelectorAll("[data-share-store]").forEach(button => {
    button.addEventListener("click", () => shareStore(button.dataset.shareStore));
  });

  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select("category")
      .eq("active", true);

    if (error) throw error;

    const categories = [...new Set((data || []).map(item => String(item.category || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    container.innerHTML = categories.length
      ? categories.map(categoryCard).join("")
      : "<p>Nenhuma categoria ativa encontrada.</p>";

    container.addEventListener("click", event => {
      const button = event.target.closest("button[data-category][data-action]");
      if (!button) return;
      shareCategory(button.dataset.category, button.dataset.action);
    });
  } catch (error) {
    console.error(error);
    container.innerHTML = "<p>Não foi possível carregar as categorias.</p>";
  }
}

function categoryCard(category) {
  const url = categoryUrl(category);
  return `
    <article class="share-center-card">
      <strong>${escapeHtml(category)}</strong>
      <small>${escapeHtml(url)}</small>
      <div class="share-center-actions">
        <button class="button button-primary" type="button" data-category="${escapeHtml(category)}" data-action="social">TikTok/Instagram</button>
        <button class="button button-light" type="button" data-category="${escapeHtml(category)}" data-action="copy">Copiar link</button>
        <button class="button button-light" type="button" data-category="${escapeHtml(category)}" data-action="whatsapp">WhatsApp</button>
      </div>
    </article>
  `;
}

function storeBaseUrl() {
  return `${location.origin}${location.pathname.replace(/admin\.html$/i, "")}`;
}

function categoryUrl(category) {
  const url = new URL(storeBaseUrl());
  url.searchParams.set("categoria", category);
  return url.href;
}

async function shareStore(action) {
  const url = storeBaseUrl();
  const text = `⚡ Oferta Certa\nProdutos próprios e ofertas selecionadas em um só lugar:\n${url}`;
  await executeShare({ action, title: "Oferta Certa", text, url });
}

async function shareCategory(category, action) {
  const url = categoryUrl(category);
  const text = `🔥 Ofertas em ${category}\nConfira a seleção da Oferta Certa:\n${url}`;
  await executeShare({ action, title: `Oferta Certa — ${category}`, text, url });
}

async function executeShare({ action, title, text, url }) {
  if (action === "whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    return;
  }

  if (action === "social" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(action === "copy" ? url : text);
    alert(action === "copy" ? "Link copiado." : "Texto e link copiados para divulgar.");
  } catch {
    window.prompt("Copie o link:", url);
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
