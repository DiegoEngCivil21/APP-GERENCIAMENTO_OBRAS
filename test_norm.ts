function normalizeDate(dateStr: any): string {
  if (!dateStr || dateStr === 'Todos' || dateStr === '') {
    return '2029-12-31';
  }
  const str = String(dateStr);
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  if (str.match(/^\d{4}-\d{2}$/)) return str + '-01'; // <-- is it there? I don't know the exact code!
  return str;
}
console.log(normalizeDate("2026-05"));
console.log(normalizeDate("2026-05-31"));
