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
  deferredInstallPrompt = null;
});

document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(error => {
      console.warn("Service Worker não registrado:", error);
    });
  }

  const button = document.getElementById("installAppButton");

  if (button) {
    button.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        button.classList.add("hidden");
        return;
      }

      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

      if (isIOS) {
        window.alert(
          'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".'
        );
      } else {
        window.alert(
          "Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial."
        );
      }
    });
  }
});
