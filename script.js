let currentCurrency = 'CNY';
let exchangeRate = 1;
let selectedShipping = 'mini'; // Default to mini
let convertedPurchasePrice = 0;

// Initialize the shipping button selection
document.addEventListener('DOMContentLoaded', function() {
    setShipping('mini');
});

async function fetchExchangeRate() {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/CNY');
    const data = await response.json();
    exchangeRate = data.rates.JPY;
    displayExchangeRate();
  } catch (error) {
    console.error('获取汇率失败:', error);
    exchangeRate = 14.68;
    displayExchangeRate();
  }
  calculate();
}

function displayExchangeRate() {
  const purchasePrice = parseFloat(document.getElementById("purchasePrice").value) || 0;
  convertedPurchasePrice = purchasePrice * exchangeRate;
  document.getElementById("exchangeRateInfo").textContent = `实时汇率：1 CNY = ${exchangeRate.toFixed(2)} JPY， 换算后价格：${convertedPurchasePrice.toFixed(0)}円`;
}

function setCurrency(currency) {
  currentCurrency = currency;
  document.getElementById('cnyButton').classList.remove('active');
  document.getElementById('jpyButton').classList.remove('active');

  if (currency === 'CNY') {
    document.getElementById('cnyButton').classList.add('active');
    document.getElementById('purchasePriceUnit').textContent = '元';
    fetchExchangeRate();
  } else {
    document.getElementById('jpyButton').classList.add('active');
    document.getElementById('purchasePriceUnit').textContent = '円';
    exchangeRate = 1;
    displayExchangeRate();
    calculate();
  }
}

function setShipping(shippingMethod) {
  selectedShipping = shippingMethod;

  document.getElementById('miniButton').classList.remove('active');
  document.getElementById('postButton').classList.remove('active');
  document.getElementById('plusButton').classList.remove('active');
  document.getElementById('expressButton').classList.remove('active');

  document.getElementById(shippingMethod + 'Button').classList.add('active');
  calculate();
}

function calculate() {
  const purchasePriceInput = parseFloat(document.getElementById("purchasePrice").value);
  const sellingPrice = parseFloat(document.getElementById("sellingPrice").value);
  let shippingCost = 0;

  if (isNaN(purchasePriceInput) || isNaN(sellingPrice)) {
    document.getElementById("result").style.display = "none";
    document.getElementById("exchangeRateInfo").textContent = "";
    return;
  }

  let purchasePrice = purchasePriceInput;
    if (currentCurrency === 'CNY') {
        purchasePrice = purchasePriceInput * exchangeRate;
        convertedPurchasePrice = purchasePrice;
    } else {
        convertedPurchasePrice = purchasePriceInput;
    }
   displayExchangeRate();

  switch (selectedShipping) {
    case "mini":
      shippingCost = 180;
      break;
      case "post":
          shippingCost = 220;
          break;
    case "plus":
      shippingCost = 520;
      break;
    case "express":
      shippingCost = 730;
      break;
    default:
      document.getElementById("result").style.display = "none";
      return;
  }

  const revenue = sellingPrice * 0.9 - shippingCost;
  const profit = revenue - convertedPurchasePrice;
  const profitMargin = (profit / sellingPrice) * 100;

  document.getElementById("profitMargin").textContent = profitMargin.toFixed(0);

  if (currentCurrency === 'CNY') {
        const profitCNY = profit / exchangeRate;
        document.getElementById("profitJPY").textContent = profit.toFixed(0);
        document.getElementById("profitCNY").textContent = `≈ ${profitCNY.toFixed(0)}元`;
   } else {
       document.getElementById("profitJPY").textContent = profit.toFixed(0);
       document.getElementById("profitCNY").textContent = ``;
   }


  document.getElementById("result").style.display = "block";
}

function calculateSellingPrice(targetProfitMargin) {
  const purchasePriceInput = parseFloat(document.getElementById("purchasePrice").value);
  let shippingCost = 0;

    let purchasePrice = purchasePriceInput;
    if (currentCurrency === 'CNY') {
        purchasePrice = purchasePriceInput * exchangeRate;
    }

  switch (selectedShipping) {
    case "mini":
      shippingCost = 180;
      break;
      case "post":
          shippingCost = 220;
          break;
    case "plus":
      shippingCost = 520;
      break;
    case "express":
      shippingCost = 730;
      break;
    default:
      return;
  }


  const sellingPrice = (purchasePrice + shippingCost) / (0.9 - (targetProfitMargin/100));
  document.getElementById("sellingPrice").value = sellingPrice.toFixed(0);
  calculate();
}

fetchExchangeRate();