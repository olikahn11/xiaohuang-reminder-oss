export const CURRENCY_RATES = {
  CNY: { symbol: "¥", rate: 1, label: "人民币 (CNY)" },
  USD: { symbol: "$", rate: 7.24, label: "美元 (USD)" },
  EUR: { symbol: "€", rate: 7.82, label: "欧元 (EUR)" },
  JPY: { symbol: "¥", rate: 0.048, label: "日元 (JPY)" },
  GBP: { symbol: "£", rate: 9.15, label: "英镑 (GBP)" },
  HKD: { symbol: "HK$", rate: 0.93, label: "港币 (HKD)" },
  KRW: { symbol: "₩", rate: 0.0053, label: "韩元 (KRW)" },
};

export function getCurrencySymbol(code = "CNY") {
  return CURRENCY_RATES[code]?.symbol || "¥";
}

export function calculateCNYEquivalent(amount, code = "CNY") {
  if (!amount) return 0;
  const rate = CURRENCY_RATES[code]?.rate || 1;
  return parseFloat(amount) * rate;
}
