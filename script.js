const STATE_KEY = "meilu-calculator-state";
const RATE_ENDPOINT = "https://api.exchangerate-api.com/v4/latest/CNY";
const FALLBACK_EXCHANGE_RATE = 23.65;

const SHIPPING_OPTIONS = {
  mini: {
    cost: 180,
    detail: "送料160円 + 専用封筒20円",
  },
  post: {
    cost: 220,
    detail: "送料215円 + シール約5円",
  },
  plus: {
    cost: 520,
    detail: "送料455円 + 専用箱65円",
  },
  delivery60: {
    cost: 750,
    detail: "ゆうパック 60サイズ",
  },
  delivery80: {
    cost: 870,
    detail: "ゆうパック 80サイズ",
  },
  delivery120: {
    cost: 1200,
    detail: "ゆうパック 120サイズ",
  },
};

const DEFAULT_STATE = {
  currency: "CNY",
  shipping: "mini",
  purchasePrice: "",
  sellingPrice: "300",
  exchangeRate: FALLBACK_EXCHANGE_RATE,
  exchangeRateDate: "",
};

const state = loadState();

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  hydrateForm();
  bindEvents();
  render();
  fetchExchangeRate();
  registerServiceWorker();
});

function bindElements() {
  elements.purchasePrice = document.getElementById("purchasePrice");
  elements.sellingPrice = document.getElementById("sellingPrice");
  elements.purchasePriceUnit = document.getElementById("purchasePriceUnit");
  elements.exchangeRateInfo = document.getElementById("exchangeRateInfo");
  elements.shippingDetail = document.getElementById("shippingDetail");
  elements.profitJPY = document.getElementById("profitJPY");
  elements.profitCNY = document.getElementById("profitCNY");
  elements.profitMargin = document.getElementById("profitMargin");
  elements.feeJPY = document.getElementById("feeJPY");
  elements.shippingJPY = document.getElementById("shippingJPY");
  elements.result = document.getElementById("result");
  elements.currencyButtons = document.querySelectorAll("[data-currency]");
  elements.shippingButtons = document.querySelectorAll("[data-shipping]");
  elements.profitButtons = document.querySelectorAll("[data-target-margin]");
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    return {
      ...DEFAULT_STATE,
      ...saved,
      exchangeRate: toPositiveNumber(saved.exchangeRate) || DEFAULT_STATE.exchangeRate,
      shipping: SHIPPING_OPTIONS[saved.shipping] ? saved.shipping : DEFAULT_STATE.shipping,
      currency: saved.currency === "JPY" ? "JPY" : "CNY",
    };
  } catch (error) {
    return { ...DEFAULT_STATE };
  }
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (error) {
    // Calculation should continue even if storage is unavailable.
  }
}

function hydrateForm() {
  elements.purchasePrice.value = state.purchasePrice;
  elements.sellingPrice.value = state.sellingPrice;
}

function bindEvents() {
  elements.purchasePrice.addEventListener("input", () => {
    state.purchasePrice = elements.purchasePrice.value;
    saveAndRender();
  });

  elements.sellingPrice.addEventListener("input", () => {
    state.sellingPrice = elements.sellingPrice.value;
    clearActiveProfitButton();
    saveAndRender();
  });

  elements.currencyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      blurActiveInput();
      state.currency = button.dataset.currency;
      saveAndRender();
      if (state.currency === "CNY") {
        fetchExchangeRate();
      }
    });
  });

  elements.shippingButtons.forEach((button) => {
    button.addEventListener("click", () => {
      blurActiveInput();
      state.shipping = button.dataset.shipping;
      saveAndRender();
    });
  });

  elements.profitButtons.forEach((button) => {
    button.addEventListener("click", () => {
      blurActiveInput();
      const targetMargin = Number(button.dataset.targetMargin);
      if (calculateSellingPrice(targetMargin)) {
        setActiveProfitButton(button);
      } else {
        clearActiveProfitButton();
      }
    });
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest("input")) {
      blurActiveInput();
    }
  });
}

async function fetchExchangeRate() {
  if (state.currency !== "CNY") {
    render();
    return;
  }

  try {
    const response = await fetch(RATE_ENDPOINT, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Exchange rate request failed: ${response.status}`);
    }
    const data = await response.json();
    const fetchedRate = toPositiveNumber(data.rates && data.rates.JPY);
    if (!fetchedRate) {
      throw new Error("Exchange rate response did not include JPY");
    }
    state.exchangeRate = fetchedRate;
    state.exchangeRateDate = data.date || "";
    saveAndRender();
  } catch (error) {
    render();
  }
}

function saveAndRender() {
  saveState();
  render();
}

function render() {
  const shipping = SHIPPING_OPTIONS[state.shipping] || SHIPPING_OPTIONS.mini;
  const purchaseInput = parseAmount(state.purchasePrice);
  const sellingPrice = parseAmount(state.sellingPrice);
  const purchaseJPY = state.currency === "CNY" && purchaseInput !== null
    ? purchaseInput * state.exchangeRate
    : purchaseInput;

  renderButtons();
  elements.purchasePriceUnit.textContent = state.currency === "CNY" ? "元" : "円";
  elements.shippingDetail.textContent = shipping.detail;
  elements.shippingJPY.textContent = formatYen(shipping.cost);

  renderExchangeInfo(purchaseInput, purchaseJPY);

  if (purchaseJPY === null || sellingPrice === null || sellingPrice <= 0) {
    renderEmptyResult(shipping.cost);
    return;
  }

  const fee = sellingPrice * 0.1;
  const revenueAfterFeeAndShipping = sellingPrice - fee - shipping.cost;
  const profit = revenueAfterFeeAndShipping - purchaseJPY;
  const profitMargin = (profit / sellingPrice) * 100;

  elements.profitJPY.textContent = formatYen(profit);
  elements.profitCNY.textContent = state.currency === "CNY"
    ? `≈ ${formatCny(profit / state.exchangeRate)}元`
    : "";
  elements.profitMargin.textContent = formatPercent(profitMargin);
  elements.feeJPY.textContent = formatYen(fee);
  elements.result.classList.add("is-ready");
  elements.result.classList.toggle("is-negative", profit < 0);
}

function renderButtons() {
  elements.currencyButtons.forEach((button) => {
    const active = button.dataset.currency === state.currency;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  elements.shippingButtons.forEach((button) => {
    const active = button.dataset.shipping === state.shipping;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderExchangeInfo(purchaseInput, purchaseJPY) {
  if (state.currency === "JPY") {
    elements.exchangeRateInfo.textContent = "成本按日元计算";
    return;
  }

  const rateDate = state.exchangeRateDate ? ` (${state.exchangeRateDate})` : "";
  if (purchaseInput === null || purchaseJPY === null) {
    elements.exchangeRateInfo.textContent = `1元 = ${state.exchangeRate.toFixed(2)}円${rateDate}`;
    return;
  }

  elements.exchangeRateInfo.textContent = `1元 = ${state.exchangeRate.toFixed(2)}円${rateDate}，成本约 ${formatYen(purchaseJPY)}円`;
}

function renderEmptyResult(shippingCost) {
  elements.profitJPY.textContent = "--";
  elements.profitCNY.textContent = "";
  elements.profitMargin.textContent = "--";
  elements.feeJPY.textContent = "--";
  elements.shippingJPY.textContent = formatYen(shippingCost);
  elements.result.classList.remove("is-ready");
  elements.result.classList.remove("is-negative");
}

function calculateSellingPrice(targetProfitMargin) {
  const purchaseInput = parseAmount(state.purchasePrice);
  if (purchaseInput === null) {
    return false;
  }

  const purchaseJPY = state.currency === "CNY"
    ? purchaseInput * state.exchangeRate
    : purchaseInput;
  const shipping = SHIPPING_OPTIONS[state.shipping] || SHIPPING_OPTIONS.mini;
  const denominator = 0.9 - (targetProfitMargin / 100);

  if (denominator <= 0) {
    return false;
  }

  const sellingPrice = Math.ceil((purchaseJPY + shipping.cost) / denominator);
  state.sellingPrice = String(sellingPrice);
  elements.sellingPrice.value = state.sellingPrice;
  saveAndRender();
  return true;
}

function setActiveProfitButton(activeButton) {
  elements.profitButtons.forEach((button) => {
    const active = button === activeButton;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function clearActiveProfitButton() {
  elements.profitButtons.forEach((button) => {
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  });
}

function blurActiveInput() {
  const activeElement = document.activeElement;
  if (activeElement && activeElement.matches("input")) {
    activeElement.blur();
  }
}

function parseAmount(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function formatYen(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return String(Math.round(value));
}

function formatCny(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return String(Math.round(value));
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return value.toFixed(1);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
