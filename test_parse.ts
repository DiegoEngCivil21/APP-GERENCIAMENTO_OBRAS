const parseImportDate = (value: any) => {
    if (!value) return null;
    
    const str = String(value).trim();
    
    // Check if it's a date string first
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
    if (str.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = str.split('/');
      return `${y}-${m}-${d}`;
    }
    if (str.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const [d, m, y] = str.split('-');
      return `${y}-${m}-${d}`;
    }
    if (str.match(/^\d{2}\/\d{4}$/)) {
      const [m, y] = str.split('/');
      return `${y}-${m}-01`;
    }
    if (str.match(/^\d{2}-\d{4}$/)) {
      const [m, y] = str.split('-');
      return `${y}-${m}-01`;
    }
    if (str.match(/^\d{4}-\d{2}$/)) {
      return `${str}-01`;
    }

    // Se for número, trata como data serial do Excel
    if (typeof value === 'number' || (str !== '' && !isNaN(Number(str)))) {
      const numValue = Number(str);
      // Data base do Excel: 30 de dezembro de 1899
      const date = new Date(Math.round((numValue - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    
    // Try parsing as a standard date
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }

    return null;
  };

console.log("10/2025 ->", parseImportDate("10/2025"));
console.log("11-2025 ->", parseImportDate("11-2025"));
console.log("10-2025 ->", parseImportDate("10-2025"));
