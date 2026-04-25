export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const formatCode = (code: string | number | undefined | null) => {
  if (code === undefined || code === null) return '';
  return String(code).replace(/\.0+$/, '');
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
};

export const formatCurrencyPrecise = (amount: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  }).format(amount);
};

export const truncateToTwo = (num: number) => {
  // Truncamento estrito para 2 casas decimais (sem arredondamento)
  // Adiciona um pequeno epsilon para evitar problemas de precisão de ponto flutuante no JS
  return Math.floor(num * 100 + 0.0000001) / 100;
};

export const calculateItemTotal = (qty: number, unit: number) => {
  return truncateToTwo(qty * unit);
};

export const formatUpToSix = (num: number) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(num);
};

export const formatTruncated = (num: number) => {
  const truncated = truncateToTwo(num);
  const parts = truncated.toString().split('.');
  const integer = parts[0];
  const decimal = (parts[1] || '00').padEnd(2, '0');
  return `${integer},${decimal}`;
};

export const formatFinancial = (num: number) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const truncateToSeven = (num: number) => Math.floor(Number(num.toFixed(10)) * 10000000) / 10000000;

export const parseBrazilianNumber = (str: string): number | null => {
  if (!str) return 0;
  let cleanStr = str.replace(/\s/g, '');
  
  const lastComma = cleanStr.lastIndexOf(',');
  const lastDot = cleanStr.lastIndexOf('.');
  
  if (lastComma > lastDot) {
    // Brazilian format: 1.234,56
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // US format: 1,234.56
    cleanStr = cleanStr.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // Only comma: 1,50
    cleanStr = cleanStr.replace(',', '.');
  }
  
  // Remove anything else that's not a digit, dot or minus
  cleanStr = cleanStr.replace(/[^\d.-]/g, '');
  
  const num = parseFloat(cleanStr);
  return isNaN(num) ? null : num;
};

export const formatDateRef = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  // If already MM/YYYY
  if (dateStr.match(/^\d{2}\/\d{4}$/)) return dateStr;
  // If YYYY-MM-DD
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, d] = dateStr.split('-');
    return `${m}/${y}`;
  }
  // If YYYY-MM
  if (dateStr.match(/^\d{4}-\d{2}$/)) {
    const [y, m] = dateStr.split('-');
    return `${m}/${y}`;
  }
  return dateStr;
};

export const normalizeDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '';
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
  if (dateStr.match(/^\d{4}-\d{2}$/)) return `${dateStr}-31`;
  if (dateStr.match(/^\d{2}\/\d{4}$/)) {
    const [m, y] = dateStr.split('/');
    return `${y}-${m}-31`;
  }
  return dateStr;
};

export const getCurrentRefDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};
