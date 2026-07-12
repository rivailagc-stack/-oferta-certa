let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;

  const button = document.getElementById("installAppButton");
  if (button) button.classList.remove("hidden");
});

window.addEventListener("appinstalled", () => {
  const button = document.getElementById("installAppButton");
  if (button) button.classList.add("hidden");

  fecharModalInstalacao();
  deferredInstallPrompt = null;
});

document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(error => {
      console.warn("Service Worker não registrado:", error);
    });
  }

  criarModalInstalacao();

  const button = document.getElementById("installAppButton");
  if (!button) return;

  button.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      return;
    }

    abrirModalInstalacao();
  });
});

function criarModalInstalacao() {
  if (document.getElementById("installHelpModal")) return;

  const modal = document.createElement("div");
  modal.id = "installHelpModal";
  modal.className = "install-help-modal hidden";
  modal.setAttribute("aria-hidden", "true");

  modal.innerHTML = `
    <div class="install-help-backdrop" data-close-install></div>

    <section class="install-help-card" role="dialog" aria-modal="true" aria-labelledby="installHelpTitle">
      <button class="install-help-close" type="button" aria-label="Fechar" data-close-install>×</button>

      <div class="install-help-icon">📱</div>

      <h2 id="installHelpTitle">Instalar Oferta Certa</h2>

      <div id="installHelpContent"></div>

      <button class="install-help-confirm" type="button" data-close-install>
        Entendi
      </button>
    </section>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll("[data-close-install]").forEach(elemento => {
    elemento.addEventListener("click", fecharModalInstalacao);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") fecharModalInstalacao();
  });
}

function abrirModalInstalacao() {
  const modal = document.getElementById("installHelpModal");
  const content = document.getElementById("installHelpContent");
  if (!modal || !content) return;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    content.innerHTML = `
      <p class="install-help-success">✅ O Oferta Certa já está instalado neste aparelho.</p>
    `;
  } else if (isIOS) {
    content.innerHTML = `
      <p>Para instalar no iPhone:</p>

      <ol class="install-help-steps">
        <li>
          <span class="install-step-number">1</span>
          <div class="install-step-text">
            Toque no botão <strong>Compartilhar</strong> do navegador.
          </div>
        </li>
        <li>
          <span class="install-step-number">2</span>
          <div class="install-step-text">
            Role a lista e toque em <strong>Adicionar à Tela de Início</strong>.
          </div>
        </li>
        <li>
          <span class="install-step-number">3</span>
          <div class="install-step-text">
            Confirme tocando em <strong>Adicionar</strong>.
          </div>
        </li>
      </ol>

      <p class="install-help-note">
        O iPhone exige essa instalação manual.
      </p>
    `;
  } else {
    content.innerHTML = `
      <p>Abra o menu do navegador e escolha:</p>

      <div class="install-help-android-option">
        <strong>Instalar aplicativo</strong>
        <span>ou</span>
        <strong>Adicionar à tela inicial</strong>
      </div>
    `;
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("install-modal-open");
}

function fecharModalInstalacao() {
  const modal = document.getElementById("installHelpModal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("install-modal-open");
}
