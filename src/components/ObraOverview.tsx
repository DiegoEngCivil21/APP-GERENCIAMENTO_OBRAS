import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
} from "recharts";
import { formatFinancial } from "../utils";

interface ObraOverviewProps {
  obra: any;
  orcamento: any[];
  cronograma: any[];
  medicoes: any[];
  encargos?: {
    desonerado: boolean;
    estado: string;
    dataReferencia: string;
  };
  currentBancosAtivos?: any[];
  bdiIncidence?: "unitario" | "final";
  bdiValue?: number;
}

export const ObraOverview: React.FC<ObraOverviewProps> = ({
  obra,
  orcamento,
  cronograma,
  medicoes,
  encargos,
  currentBancosAtivos,
  bdiIncidence = "unitario",
  bdiValue = 0,
}) => {
  const bdiMultiplier = bdiIncidence === "final" ? 1 + bdiValue / 100 : 1;
  console.log("SCurve Debug:", { medicoes, orcamento, cronograma });
  const totalOrcado =
    orcamento
      .filter(
        (r) => r.tipo === "etapa" && !(r.item || "").toString().includes("."),
      )
      .reduce((acc, r) => acc + (r.total || 0), 0) * bdiMultiplier;
  const totalMedido = medicoes.reduce(
    (acc, med) => acc + (med.total_valor || 0),
    0,
  );
  const variacao = totalOrcado - totalMedido;

  // Use encargos if provided, otherwise fallback to obra data
  const desonerado = encargos ? encargos.desonerado : !!obra?.desonerado;
  const uf = encargos ? encargos.estado : obra?.uf || "DF";
  const dataReferencia = encargos
    ? encargos.dataReferencia
    : obra?.data_referencia || "N/A";
  const bancosAtivos =
    currentBancosAtivos ||
    (() => {
      try {
        return typeof obra?.bancos_ativos === "string"
          ? JSON.parse(obra.bancos_ativos)
          : Array.isArray(obra?.bancos_ativos)
            ? obra.bancos_ativos
            : [];
      } catch (e) {
        return [];
      }
    })();

  // Prepare S-Curve Data (Cumulative Calculated)
  // Helper to parse date robustly
  const parseDate = (fecha: string) => {
    if (!fecha) return null;
    let date = new Date(fecha);
    if (!isNaN(date.getTime())) return date;
    // Try DD/MM/YYYY
    const parts = fecha.split("/");
    if (parts.length === 3) {
      date = new Date(
        parseInt(parts[2]),
        parseInt(parts[1]) - 1,
        parseInt(parts[0]),
      );
      if (!isNaN(date.getTime())) return date;
    }
    return null;
  };

  // Find Project start and end to create a continuous range
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  // Search for a 'Resumo Geral' or root-level activity to define absolute bounds
  const resumoGeralAtv = cronograma.find(act => 
     (act.nome || '').toLowerCase().includes('resumo geral') || 
     (act.nome || '').toLowerCase() === 'resumo da obra' ||
     act.item_numero === '1' || act.item_numero === '01'
  );

  if (resumoGeralAtv) {
      minDate = parseDate(resumoGeralAtv.data_inicio_prevista);
      maxDate = parseDate(resumoGeralAtv.data_fim_prevista || resumoGeralAtv.data_inicio_prevista) || minDate;
  }

  // Fallback to min/max of all activities
  if (!minDate || !maxDate) {
    cronograma.forEach((act) => {
      const start = parseDate(act.data_inicio_prevista);
      const end = parseDate(act.data_fim_prevista) || start;
      if (start && end) {
        if (!minDate || start < minDate) minDate = new Date(start);
        if (!maxDate || end > maxDate) maxDate = new Date(end);
      }
    });
  }

  const getSCurveData = () => {
    // 1. Get unique months from schedule
    const monthsSet = new Set<string>();

    if (minDate && maxDate) {
      let d = new Date(minDate);
      // Generate months spanning the project
      while (d <= maxDate) {
        monthsSet.add(d.toISOString().substring(0, 7));
        d.setMonth(d.getMonth() + 1);
      }
      // Ensure maxDate month is also fully included
      monthsSet.add(maxDate.toISOString().substring(0, 7));
    }

    let maxMedicaoMonth: string | null = null;
    // Add measurement dates in case they are outside project schedule
    medicoes.forEach((med) => {
      const d = parseDate(med.data_medicao);
      if (d) {
        const monthStr = d.toISOString().substring(0, 7);
        monthsSet.add(monthStr);
        if (!maxMedicaoMonth || monthStr > maxMedicaoMonth) {
          maxMedicaoMonth = monthStr;
        }
      }
    });

    if (monthsSet.size === 0) {
      const today = new Date();
      for(let i=0; i<6; i++) {
         const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
         monthsSet.add(d.toISOString().substring(0, 7));
      }
    }

    const sortedMonths = Array.from(monthsSet).sort();
    const relevantMonths = sortedMonths;
    const projectMonths = sortedMonths.filter(m => {
       const mStart = minDate ? minDate.toISOString().substring(0,7) : '';
       const mEnd = maxDate ? maxDate.toISOString().substring(0,7) : '';
       return m >= mStart && m <= mEnd;
    });

    const plannedByMonth = new Map<string, number>();
    
    // Group budget by ETAPAS
    // Filter for level-1 or level-2 stages depending on how they are coded
    const etapas = orcamento.filter(r => r.tipo === "etapa" && (/^\d+$/.test(r.item) || /^\d+\.\d+$/.test(r.item)));
    
    if (etapas.length > 0) {
      let unmappedBudget = 0;
      
      etapas.forEach(etapa => {
        const etapaValue = (etapa.total || 0) * bdiMultiplier;
        
        // Find activity that matches this stage's code or id
        let actForEtapa = cronograma.find(act => 
            act.orcamento_item_id == etapa.id || 
            act.item_numero === etapa.item ||
            (act.item_numero && act.item_numero.toString().split('.')[0] === etapa.item.toString())
        );
        
        if (actForEtapa && actForEtapa.data_inicio_prevista && actForEtapa.data_fim_prevista) {
           const sDate = parseDate(actForEtapa.data_inicio_prevista);
           const eDate = parseDate(actForEtapa.data_fim_prevista);
           
           if (sDate && eDate) {
              const months = [];
              let cur = new Date(sDate.getFullYear(), sDate.getMonth(), 1);
              const endLimit = new Date(eDate.getFullYear(), eDate.getMonth(), 1);
              
              while (cur <= endLimit) {
                 months.push(cur.toISOString().substring(0, 7));
                 cur.setMonth(cur.getMonth() + 1);
              }
              
              if (months.length > 0) {
                 const valuePerMonth = etapaValue / months.length;
                 months.forEach(m => {
                    plannedByMonth.set(m, (plannedByMonth.get(m) || 0) + valuePerMonth);
                 });
              } else {
                 unmappedBudget += etapaValue;
              }
           } else {
              unmappedBudget += etapaValue;
           }
        } else {
           unmappedBudget += etapaValue;
        }
      });
      
      // If there's unmapped budget, spread it over the project months
      if (unmappedBudget > 0 && projectMonths.length > 0) {
          const monthlyValue = unmappedBudget / projectMonths.length;
          projectMonths.forEach(m => {
             plannedByMonth.set(m, (plannedByMonth.get(m) || 0) + monthlyValue);
          });
      }
    } else {
      // Fallback: S-Curve
      const N = projectMonths.length;
      if (totalOrcado > 0 && N > 0) {
        for (let i = 0; i < N; i++) {
          const t1 = i / N;
          const t2 = (i + 1) / N;
          const p1 = t1 * t1 * (3 - 2 * t1);
          const p2 = t2 * t2 * (3 - 2 * t2);
          const monthlyValue = (p2 - p1) * totalOrcado;
          plannedByMonth.set(projectMonths[i], (plannedByMonth.get(projectMonths[i]) || 0) + monthlyValue);
        }
      }
    }

    const actualByMonth = new Map<string, number>();
    medicoes.forEach((med) => {
      const d = parseDate(med.data_medicao);
      if (d) {
        const month = d.toISOString().substring(0, 7);
        actualByMonth.set(
          month,
          (actualByMonth.get(month) || 0) + (med.total_valor || 0),
        );
      }
    });

    let cumPlanned = 0;
    let cumActual = 0;
    const todayStr = new Date().toISOString().substring(0, 7);

    return relevantMonths.map((month) => {
      const currentPlanned = plannedByMonth.get(month) || 0;
      cumPlanned += currentPlanned;

      const planejadoPercent =
        totalOrcado > 0 ? (cumPlanned / totalOrcado) * 100 : 0;
      const planejadoMensalPercent =
        totalOrcado > 0 ? (currentPlanned / totalOrcado) * 100 : 0;

      let currentActual = 0;
      let realizadoPercent: number | null = null;
      let realizedToDate: number | null = null;
      let realizadoMensalPercent: number | null = null;

      if (!maxMedicaoMonth || month <= maxMedicaoMonth || month <= todayStr) {
        currentActual = actualByMonth.get(month) || 0;
        cumActual += currentActual;
        
        if (medicoes.length > 0 || currentActual > 0 || month <= maxMedicaoMonth) {
            realizadoPercent = totalOrcado > 0 ? (cumActual / totalOrcado) * 100 : 0;
            realizadoMensalPercent = totalOrcado > 0 ? (currentActual / totalOrcado) * 100 : 0;
            realizedToDate = cumActual;
        } else if (medicoes.length === 0 && month <= todayStr && month >= projectMonths[0]) {
             // If no measurements yet, but we are within project timeline up to today, EV is 0
            realizadoPercent = 0;
            realizadoMensalPercent = 0;
            realizedToDate = 0;
        }
      }

      let spi: number | null = null;
      if (realizedToDate !== null && cumPlanned > 0) {
        spi = Number((realizedToDate / cumPlanned).toFixed(2));
      }

      return {
        month: month.split("-").reverse().join("/"),
        rawMonth: month,
        planejado: cumPlanned,
        realizado: realizedToDate,
        planejadoPercent: Number(planejadoPercent.toFixed(2)),
        realizadoPercent:
          realizadoPercent !== null
            ? Number(realizadoPercent.toFixed(2))
            : null,
        spi: spi,
        planejadoMensal: currentPlanned,
        realizadoMensal: currentActual,
        planejadoMensalPercent: Number(planejadoMensalPercent.toFixed(2)),
        realizadoMensalPercent:
          realizadoMensalPercent !== null
            ? Number(realizadoMensalPercent.toFixed(2))
            : null,
      };
    });
  };

  const sCurveData = getSCurveData();

  // Metrics for Current Month Snapshot
  const latestMedicaoData = [...sCurveData]
    .reverse()
    .find((d) => d.realizado !== null);
  const currentPV = latestMedicaoData ? latestMedicaoData.planejado : 0;
  const currentEV = latestMedicaoData ? latestMedicaoData.realizado : 0;
  const currentSPI = currentPV > 0 ? currentEV / currentPV : 0;
  const currentSV = currentEV - currentPV;
  const concluidoPercent =
    totalOrcado > 0 ? (currentEV / totalOrcado) * 100 : 0;

  const SCurveTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 min-w-[200px]">
          <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">
            {label}
          </p>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#bbf7d0]"></div>
                Plan. Mensal
              </span>
              <span className="font-black text-slate-700">
                R$ {formatFinancial(data.planejadoMensal || 0)}
              </span>
            </div>
            {(data.realizadoMensal || 0) > 0 && (
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#fca5a5]"></div>
                  Real. Mensal
                </span>
                <span className="font-black text-emerald-700">
                  R$ {formatFinancial(data.realizadoMensal || 0)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-[10px] pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#16a34a]"></div>
                Planned Value (PV)
              </span>
              <div className="text-right">
                <div className="font-black text-green-600">
                  {data.planejadoPercent}%
                </div>
                <div className="font-medium text-slate-400">
                  R$ {formatFinancial(data.planejado)}
                </div>
              </div>
            </div>
            {data.realizado !== null && (
              <div className="flex justify-between items-center text-[10px] pt-1">
                <span className="font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#dc2626]"></div>
                  Earned Value (EV)
                </span>
                <div className="text-right">
                  <div className="font-black text-red-600">
                    {data.realizadoPercent}%
                  </div>
                  <div className="font-medium text-slate-400">
                    R$ {formatFinancial(data.realizado)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Prepare material data: Top items from orcamento by value
  const materialData = orcamento
    .filter((item) => item.tipo !== "etapa")
    .sort((a, b) => (b.total || 0) - (a.total || 0))
    .slice(0, 10)
    .map((item) => {
      const unitPrice =
        bdiIncidence === "unitario"
          ? item.valor_bdi || item.valor_unitario || 0
          : item.valor_unitario || 0;
      const medido =
        ((item.progresso || 0) / 100) * (item.total || 0) * bdiMultiplier;
      return {
        name:
          item.descricao.length > 20
            ? item.descricao.substring(0, 20) + "..."
            : item.descricao,
        orcado: (item.total || 0) * bdiMultiplier,
        medido: medido,
      };
    });

  // Prepare progress data
  const progressData = cronograma
    .sort(
      (a, b) =>
        new Date(a.data_inicio_prevista || 0).getTime() -
        new Date(b.data_inicio_prevista || 0).getTime(),
    )
    .map((act) => ({
      name: act.nome.length > 15 ? act.nome.substring(0, 15) + "..." : act.nome,
      progresso: act.progresso || 0,
    }));

  return (
    <div className="space-y-8 pb-10">
      {/* Header Info Banner */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div className="flex gap-10">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 underline decoration-orange-500 decoration-2 underline-offset-4">
              Localização
            </span>
            <span className="text-sm font-black text-slate-900">{uf}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 underline decoration-blue-500 decoration-2 underline-offset-4">
              Tributação
            </span>
            <span className="text-sm font-black text-slate-900">
              {desonerado ? "Desonerado" : "Não Desonerado"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 underline decoration-emerald-500 decoration-2 underline-offset-4">
              Database Global
            </span>
            <span className="text-sm font-black text-slate-900">
              {dataReferencia}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Fontes:
          </span>
          <div className="flex gap-2">
            {bancosAtivos
              .filter((b: any) => typeof b === "string" || b.active !== false)
              .map((b: any) => (
                <span
                  key={typeof b === "string" ? b : b.id}
                  className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black text-slate-600 uppercase tracking-tight"
                >
                  {typeof b === "string"
                    ? b
                    : `${b.id} (${b.data_referencia || "N/A"})`}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Main Totals - EVM Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Orçamento Total (BAC) */}
        <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-slate-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
          <h4
            className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10"
            title="Budget At Completion"
          >
            Orçamento Total (BAC)
          </h4>
          <p className="text-xl font-black text-slate-900 relative z-10 truncate">
            R$ {formatFinancial(totalOrcado)}
          </p>
        </div>

        {/* Valor Planejado (PV) */}
        <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
          <h4
            className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1 relative z-10"
            title="Planned Value"
          >
            Valor Planejado (PV)
          </h4>
          <p className="text-xl font-black text-blue-600 relative z-10 truncate">
            R$ {formatFinancial(currentPV)}
          </p>
        </div>

        {/* Valor Agregado (EV) */}
        <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
          <h4
            className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1 relative z-10"
            title="Earned Value"
          >
            Valor Agregado (EV)
          </h4>
          <div className="flex items-baseline gap-2 relative z-10">
            <p className="text-xl font-black text-emerald-600 truncate">
              R$ {formatFinancial(currentEV)}
            </p>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              {concluidoPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Variação de Prazo (SV) */}
        <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div
            className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110 ${currentSV >= 0 ? "bg-emerald-50" : "bg-red-50"}`}
          />
          <h4
            className={`text-[9px] font-black uppercase tracking-widest mb-1 relative z-10 ${currentSV >= 0 ? "text-emerald-400" : "text-red-400"}`}
            title="Schedule Variance"
          >
            Variação de Prazo (SV)
          </h4>
          <p
            className={`text-xl font-black relative z-10 truncate ${currentSV >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            R$ {formatFinancial(currentSV)}
          </p>
        </div>

        {/* Índice de Prazo (SPI) */}
        <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div
            className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110 ${currentSPI >= 1 ? "bg-emerald-50" : "bg-red-50"}`}
          />
          <h4
            className={`text-[9px] font-black uppercase tracking-widest mb-1 relative z-10 ${currentSPI >= 1 ? "text-emerald-400" : "text-red-400"}`}
            title="Schedule Performance Index"
          >
            Índice de Prazo (SPI)
          </h4>
          <div className="flex items-center gap-2 relative z-10">
            <p
              className={`text-xl font-black truncate ${currentSPI >= 1 ? "text-emerald-600" : "text-red-600"}`}
            >
              {currentSPI.toFixed(2)}
            </p>
            <span
              className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg ${currentSPI >= 1 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
            >
              {currentSPI >= 1 ? "Adiantado" : "Atrasado"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Curva S */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8 lg:col-span-3">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Curva S e Histograma (Avanço)
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                 {(() => {
                    const s = minDate ? minDate.toLocaleDateString('pt-BR') : '-';
                    const e = maxDate ? maxDate.toLocaleDateString('pt-BR') : '-';
                    return `Prazo: ${s} até ${e}`;
                })()}
              </p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={sCurveData}
                margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
                barCategoryGap="20%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  width={40}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  width={40}
                  domain={[0, 100]}
                />
                <Tooltip
                  content={<SCurveTooltip />}
                  cursor={{ fill: "#f8fafc" }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{
                    fontSize: "10px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    paddingTop: "20px",
                  }}
                />

                <Bar
                  yAxisId="left"
                  dataKey="planejadoMensalPercent"
                  name="% Mensal (Plan)"
                  fill="#bbf7d0"
                  radius={[4, 4, 0, 0]}
                  barSize={30}
                />
                {sCurveData.some((d) => (d.realizadoMensalPercent || 0) > 0) && (
                  <Bar
                    yAxisId="left"
                    dataKey="realizadoMensalPercent"
                    name="% Mensal (Real)"
                    fill="#fca5a5"
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                  />
                )}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="planejadoPercent"
                  name="% Acumulado (PV)"
                  stroke="#16a34a"
                  strokeDasharray="5 5"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="realizadoPercent"
                  name="% Acumulado (EV)"
                  stroke="#dc2626"
                  strokeWidth={3}
                  dot={false}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SPI Chart */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8 lg:col-span-2">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Evolução de Eficiência (SPI)
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                Índice de Desempenho de Prazo
              </p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sCurveData.filter((d) => d.spi !== null)}
                margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                  domain={[0, "auto"]}
                  width={40}
                />
                <Tooltip
                  formatter={(value: number) => [value, "SPI"]}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                />
                <ReferenceLine
                  y={1}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    position: "top",
                    value: "Baseline (1.0)",
                    fill: "#ef4444",
                    fontSize: 10,
                    fontWeight: "bold",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="spi"
                  name="SPI"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Maiores Custos */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8 lg:col-span-2">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Maiores Impactos
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                Principais itens do orçamento
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={materialData}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f1f5f9"
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                  width={100}
                />
                <Tooltip
                  formatter={(value: number) => `R$ ${formatFinancial(value)}`}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{
                    fontSize: "10px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                  }}
                />
                <Bar
                  dataKey="orcado"
                  name="Orçado"
                  fill="#e2e8f0"
                  radius={[0, 4, 4, 0]}
                  barSize={8}
                />
                <Bar
                  dataKey="medido"
                  name="Realizado"
                  fill="#6366f1"
                  radius={[0, 4, 4, 0]}
                  barSize={8}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Progress of Activities */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8 lg:col-span-3">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Progresso do Cronograma
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                Status das 8 primeiras atividades
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar
                  dataKey="progresso"
                  name="Progresso (%)"
                  fill="#f59e0b"
                  radius={[8, 8, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
