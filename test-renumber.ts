const applyAutoRenumber = (orcamentoList) => {
  const sorted = [...orcamentoList].sort((a, b) => {
    const itemA = (a.item || '').toString();
    const itemB = (b.item || '').toString();
    return itemA.localeCompare(itemB, undefined, { numeric: true });
  });

  const counters = [];
  return sorted.map(row => {
    const parts = (row.item || '').toString().split('.');
    let isZeroEnded = false;
    if (parts.length > 1 && parts[parts.length - 1] === '0') {
      isZeroEnded = true;
    }
    const depth = isZeroEnded ? parts.length - 2 : parts.length - 1;
    const safeDepth = Math.max(0, depth);

    while (counters.length <= safeDepth) {
      counters.push(0);
    }
    
    counters[safeDepth]++;
    
    for (let i = safeDepth + 1; i < counters.length; i++) {
        counters[i] = 0;
    }

    let generatedItem = counters.slice(0, safeDepth + 1).join('.');
    if (isZeroEnded) {
      generatedItem += '.0';
    }

    return { ...row, item: generatedItem };
  });
};

const items = [
  { item: '1.0' },
  { item: '1.1' },
  { item: '1.2' }, 
  { item: '2.0' },
  { item: '3.0' },
];

const renumbered = applyAutoRenumber(items);
console.log(renumbered);
