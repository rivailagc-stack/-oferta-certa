document.addEventListener("DOMContentLoaded", verificarPagamento);

async function verificarPagamento() {
  const badge = document.getElementById("paymentStatusBadge");
  const text = document.getElementById("paymentStatusText");

  try {
    const response = await fetch("/api/checkout-status", { cache: "no-store" });
    const status = await response.json();

    atualizarCheck("checkMpToken", status.mp_access_token, "Access Token");
    atualizarCheck("checkMpPublicKey", status.mp_public_key, "Public Key");
    atualizarCheck(
      "checkSupabaseSecret",
      status.supabase_url && status.supabase_service_key,
      "Chave segura do Supabase"
    );
    atualizarCheck("checkSiteUrl", status.site_url, "Endereço da loja");

    if (status.ready) {
      badge.textContent = "Pronto";
      badge.className = "payment-status-badge ready";
      text.textContent =
        "Checkout interno pronto. Produtos próprios podem receber Pix e cartão sem sair da loja.";
    } else {
      badge.textContent = "Configuração pendente";
      badge.className = "payment-status-badge pending";
      text.textContent =
        "O código está preparado, mas faltam variáveis secretas na Vercel.";
    }
  } catch {
    badge.textContent = "Não verificado";
    badge.className = "payment-status-badge pending";
    text.textContent = "Não foi possível verificar a configuração.";
  }
}

function atualizarCheck(id, ok, label) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = `${ok ? "✓" : "○"} ${label}`;
  element.classList.toggle("ok", ok);
}
