(() => {
  const PICKUP_SERVICE_ID = 999999;
  const modal = document.getElementById("checkoutModal");
  const customerStep = document.getElementById("checkoutCustomerStep");
  const paymentStep = document.getElementById("checkoutPaymentStep");
  const resultStep = document.getElementById("checkoutResultStep");
  const customerForm = document.getElementById("checkoutCustomerForm");
  const customerMessage = document.getElementById("checkoutCustomerMessage");
  const paymentMessage = document.getElementById("checkoutPaymentMessage");
  const addressFields = document.getElementById("checkoutAddressFields");
  const backButton = document.getElementById("voltarDadosCheckout");
  const resultBox = document.getElementById("checkoutResult");

  let context = null;
  let paymentController = null;
  let paymentLocked = false;

  document.addEventListener("click", event => {
    if (event.target.closest("[data-close-checkout]")) closeCheckout();

    const copyPix = event.target.closest("[data-copy-pix]");
    if (copyPix) copyPixCode();

    const closeResult = event.target.closest("[data-checkout-done]");
    if (closeResult) closeCheckout();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !paymentLocked) closeCheckout();
  });

  customerForm?.addEventListener("submit", createCheckout);
  backButton?.addEventListener("click", backToCustomer);

  window.ofertaCertaCheckout = { open: openCheckout, close: closeCheckout };

  function openCheckout(data) {
    context = data;
    paymentLocked = false;
    resetSteps();
    fillSummary();
    configureAddressFields();
    window.ofertaCertaLoja?.closeCart?.();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    document.getElementById("checkoutName")?.focus();
  }

  async function closeCheckout() {
    if (paymentLocked) return;
    await unmountBrick();
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    context = null;
  }

  function resetSteps() {
    customerStep.classList.remove("hidden");
    paymentStep.classList.add("hidden");
    resultStep.classList.add("hidden");
    resultBox.innerHTML = "";
    customerMessage.className = "message hidden";
    customerMessage.textContent = "";
    paymentMessage.className = "message info";
    paymentMessage.textContent = "Carregando pagamento seguro...";
  }

  function fillSummary() {
    const subtotal = Number(context?.subtotal || 0);
    const shipping = Number(context?.shipping?.price || 0);
    document.getElementById("checkoutProductsTotal").textContent = formatPrice(subtotal);
    document.getElementById("checkoutShippingTotal").textContent = context?.shipping?.pickup ? "Grátis" : formatPrice(shipping);
    document.getElementById("checkoutGrandTotal").textContent = formatPrice(subtotal + shipping);
    document.getElementById("checkoutDeliveryLabel").textContent = context?.shipping?.pickup
      ? "📍 Retirada no local — endereço e horário combinados após a compra."
      : `🚚 ${context?.shipping?.service_name || "Entrega selecionada"}`;
  }

  function configureAddressFields() {
    const pickup = Boolean(context?.shipping?.pickup) || Number(context?.shipping?.service_id) === PICKUP_SERVICE_ID;
    const postalCode = document.getElementById("checkoutPostalCode");
    postalCode.value = pickup ? "Retirada" : formatPostalCode(context?.shipping?.postal_code || "");
    addressFields.classList.toggle("hidden", pickup);

    ["checkoutStreet", "checkoutNumber", "checkoutNeighborhood", "checkoutCity", "checkoutState"].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.required = !pickup;
    });
  }

  async function createCheckout(event) {
    event.preventDefault();
    if (!context) return;

    const submit = document.getElementById("continuarPagamento");
    const customer = collectCustomer();
    const validation = validateCustomer(customer, Boolean(context.shipping?.pickup));

    if (validation) {
      showCustomerMessage(validation, "error");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Preparando pagamento...";
    showCustomerMessage("Validando pedido e valores...", "info");

    try {
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: context.items,
          shipping: context.shipping,
          customer
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível preparar o checkout.");

      context.order = data;
      context.customer = customer;
      customerStep.classList.add("hidden");
      paymentStep.classList.remove("hidden");
      await mountPaymentBrick(data);
    } catch (error) {
      showCustomerMessage(error.message, "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Continuar para o pagamento";
    }
  }

  async function mountPaymentBrick(order) {
    await unmountBrick();

    if (!window.MercadoPago) {
      throw new Error("A biblioteca segura do Mercado Pago não carregou. Atualize a página.");
    }

    paymentMessage.className = "message info";
    paymentMessage.textContent = "Carregando Pix e cartão...";

    const mp = new MercadoPago(order.public_key, { locale: "pt-BR" });
    const bricksBuilder = mp.bricks();

    paymentController = await bricksBuilder.create(
      "payment",
      "paymentBrick_container",
      {
        initialization: {
          amount: Number(order.total),
          payer: {
            email: context.customer.email,
            identification: {
              type: "CPF",
              number: digits(context.customer.cpf)
            }
          }
        },
        customization: {
          paymentMethods: {
            bankTransfer: "all",
            creditCard: "all",
            debitCard: "all",
            prepaidCard: "all"
          },
          visual: {
            style: {
              theme: "default"
            }
          }
        },
        callbacks: {
          onReady: () => {
            paymentMessage.className = "message success";
            paymentMessage.textContent = "Pagamento seguro pronto. Escolha Pix ou cartão.";
          },
          onSubmit: ({ formData }) => processPayment(formData),
          onError: error => {
            console.error("Erro Payment Brick:", error);
            paymentMessage.className = "message error";
            paymentMessage.textContent = "Não foi possível carregar uma parte do pagamento. Tente novamente.";
          }
        }
      }
    );
  }

  function processPayment(formData) {
    return new Promise(async (resolve, reject) => {
      paymentLocked = true;
      paymentMessage.className = "message info";
      paymentMessage.textContent = "Processando pagamento. Não feche esta tela...";

      try {
        const response = await fetch("/api/process-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: context.order.order_id,
            idempotency_key: createIdempotencyKey(),
            payment: formData
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Pagamento não processado.");

        await showResult(data);
        resolve();
      } catch (error) {
        paymentLocked = false;
        paymentMessage.className = "message error";
        paymentMessage.textContent = error.message;
        reject(error);
      }
    });
  }

  async function showResult(payment) {
    paymentLocked = false;
    await unmountBrick();
    paymentStep.classList.add("hidden");
    resultStep.classList.remove("hidden");

    if (payment.status === "approved") {
      window.ofertaCertaLoja?.clearCart?.();
      resultBox.innerHTML = `
        <div class="checkout-result-icon">✅</div>
        <h3>Pagamento aprovado!</h3>
        <p>Pedido <strong>#${escapeHtml(shortOrderId(context.order.order_id))}</strong> confirmado. Enviaremos as informações para <strong>${escapeHtml(context.customer.email)}</strong>.</p>
        <div class="checkout-result-actions">
          <button class="button button-primary" type="button" data-checkout-done>Continuar na loja</button>
        </div>
      `;
      return;
    }

    if (payment.payment_method_id === "pix" && payment.pix?.qr_code) {
      window.ofertaCertaLoja?.clearCart?.();
      resultBox.innerHTML = `
        <div class="checkout-result-icon">💠</div>
        <h3>Pix criado</h3>
        <p>Escaneie o QR Code ou copie o código abaixo. O pedido será confirmado automaticamente após o pagamento.</p>
        <div class="pix-box">
          ${payment.pix.qr_code_base64 ? `<img src="data:image/png;base64,${escapeAttribute(payment.pix.qr_code_base64)}" alt="QR Code Pix">` : ""}
          <textarea id="pixCodeValue" class="pix-code" readonly>${escapeHtml(payment.pix.qr_code)}</textarea>
          <div class="checkout-result-actions">
            <button class="button button-primary" type="button" data-copy-pix>Copiar código Pix</button>
            ${payment.pix.ticket_url ? `<a class="button button-light" href="${escapeAttribute(payment.pix.ticket_url)}" target="_blank" rel="noopener">Abrir Pix</a>` : ""}
          </div>
        </div>
        <div class="checkout-result-actions">
          <button class="button button-light" type="button" data-checkout-done>Voltar para a loja</button>
        </div>
      `;
      return;
    }

    if (["pending", "in_process", "authorized"].includes(payment.status)) {
      window.ofertaCertaLoja?.clearCart?.();
      resultBox.innerHTML = `
        <div class="checkout-result-icon">⏳</div>
        <h3>Pagamento em análise</h3>
        <p>O Mercado Pago está processando o pagamento. O pedido será atualizado automaticamente.</p>
        <div class="checkout-result-actions">
          <button class="button button-primary" type="button" data-checkout-done>Continuar na loja</button>
        </div>
      `;
      return;
    }

    resultBox.innerHTML = `
      <div class="checkout-result-icon">⚠️</div>
      <h3>Pagamento não aprovado</h3>
      <p>${escapeHtml(payment.status_message || "Confira os dados ou tente outra forma de pagamento.")}</p>
      <div class="checkout-result-actions">
        <button class="button button-primary" type="button" data-checkout-done>Fechar e tentar novamente</button>
      </div>
    `;
  }

  async function backToCustomer() {
    await unmountBrick();
    paymentStep.classList.add("hidden");
    customerStep.classList.remove("hidden");
  }

  async function unmountBrick() {
    if (paymentController?.unmount) {
      try { await paymentController.unmount(); } catch (error) { console.warn(error); }
    }
    paymentController = null;
    const container = document.getElementById("paymentBrick_container");
    if (container) container.innerHTML = "";
  }

  function collectCustomer() {
    const pickup = Boolean(context?.shipping?.pickup);
    return {
      name: value("checkoutName"),
      email: value("checkoutEmail").toLocaleLowerCase("pt-BR"),
      phone: value("checkoutPhone"),
      cpf: value("checkoutCpf"),
      address: pickup ? null : {
        postal_code: digits(value("checkoutPostalCode")),
        street: value("checkoutStreet"),
        number: value("checkoutNumber"),
        complement: value("checkoutComplement"),
        neighborhood: value("checkoutNeighborhood"),
        city: value("checkoutCity"),
        state: value("checkoutState").toUpperCase()
      }
    };
  }

  function validateCustomer(customer, pickup) {
    if (customer.name.length < 3) return "Informe o nome completo.";
    if (!/^\S+@\S+\.\S+$/.test(customer.email)) return "Informe um e-mail válido.";
    if (![10, 11].includes(digits(customer.phone).length)) return "Informe um celular com DDD.";
    if (!isValidCpf(customer.cpf)) return "Informe um CPF válido.";

    if (!pickup) {
      if (digits(customer.address?.postal_code).length !== 8) return "CEP de entrega inválido.";
      if (!customer.address?.street || !customer.address?.number || !customer.address?.neighborhood || !customer.address?.city) {
        return "Preencha o endereço completo para entrega.";
      }
      if (!/^[A-Z]{2}$/.test(customer.address?.state || "")) return "Informe o estado com duas letras, por exemplo SP.";
    }

    return "";
  }

  function isValidCpf(value) {
    const cpf = digits(value);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== Number(cpf[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
    digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    return digit === Number(cpf[10]);
  }

  function showCustomerMessage(message, type) {
    customerMessage.className = `message ${type}`;
    customerMessage.textContent = message;
  }

  async function copyPixCode() {
    const code = document.getElementById("pixCodeValue")?.value;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      alert("Código Pix copiado.");
    } catch {
      document.getElementById("pixCodeValue")?.select();
    }
  }

  function createIdempotencyKey() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function value(id) { return String(document.getElementById(id)?.value || "").trim(); }
  function digits(value) { return String(value || "").replace(/\D/g, ""); }
  function formatPostalCode(value) {
    const number = digits(value).slice(0, 8);
    return number.length > 5 ? `${number.slice(0, 5)}-${number.slice(5)}` : number;
  }
  function formatPrice(value) {
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function shortOrderId(value) { return String(value || "").split("-")[0].toUpperCase(); }
  function escapeHtml(value = "") {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function escapeAttribute(value = "") { return escapeHtml(value); }
})();
