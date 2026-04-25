export function calculateCriticalPath(db: any, obraId: number | string) {
  const atividades = db.prepare("SELECT * FROM v2_atividades WHERE obra_id = ?").all(obraId) as any[];
  const dependencias = db.prepare(`
    SELECT d.* FROM v2_atividade_dependencias d
    JOIN v2_atividades a ON d.atividade_id = a.id
    WHERE a.obra_id = ?
  `).all(obraId) as any[];

  const atvMap = new Map();
  atividades.forEach(a => atvMap.set(a.id, a));

  const dependents = new Map();
  const predecessors = new Map();
  atividades.forEach(a => {
    dependents.set(a.id, []);
    predecessors.set(a.id, []);
  });

  dependencias.forEach(d => {
    if (atvMap.has(d.atividade_id) && atvMap.has(d.depende_de_id)) {
      dependents.get(d.depende_de_id).push(d.atividade_id);
      predecessors.get(d.atividade_id).push(d.depende_de_id);
    }
  });

  // 1. Forward Pass (Early Start, Early Finish)
  const es = new Map();
  const ef = new Map();
  const sorted = topologicalSort(atividades, predecessors);
  
  sorted.forEach(id => {
    const atv = atvMap.get(id);
    const preds = predecessors.get(id) || [];
    let earlyStart = 0; // Simplified: days from start
    preds.forEach(pId => {
      earlyStart = Math.max(earlyStart, ef.get(pId) || 0);
    });
    es.set(id, earlyStart);
    ef.set(id, earlyStart + (atv.duracao_dias || 0));
  });

  // 2. Backward Pass (Late Start, Late Finish)
  const ls = new Map();
  const lf = new Map();
  const maxFinish = Math.max(...Array.from(ef.values()));
  
  const reverseSorted = [...sorted].reverse();
  reverseSorted.forEach(id => {
    const atv = atvMap.get(id);
    const deps = dependents.get(id) || [];
    let lateFinish = maxFinish;
    deps.forEach(dId => {
      lateFinish = Math.min(lateFinish, ls.get(dId) || maxFinish);
    });
    lf.set(id, lateFinish);
    ls.set(id, lateFinish - (atv.duracao_dias || 0));
  });

  // 3. Identify Critical Path (Slack = 0)
  return atividades.filter(a => {
    const slack = (ls.get(a.id) || 0) - (es.get(a.id) || 0);
    return Math.abs(slack) <= 0.5; // Threshold for floating point
  });
}

function topologicalSort(atividades: any[], predecessors: Map<number, number[]>) {
  const sorted: number[] = [];
  const visited = new Set();
  function visit(id: number) {
    if (visited.has(id)) return;
    (predecessors.get(id) || []).forEach(pId => visit(pId));
    visited.add(id);
    sorted.push(id);
  }
  atividades.forEach(a => visit(a.id));
  return sorted;
}
