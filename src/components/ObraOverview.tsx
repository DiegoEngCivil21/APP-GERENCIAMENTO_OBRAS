import React, { useState, useMemo } from "react";
import { Calendar, X } from "lucide-react";
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
  Cell,
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
  const [filterStart, setFilterStart] = useState<string>("");
  const [filterEnd, setFilterEnd] = useState<string>("");

  const bdiMultiplier = bdiIncidence === "final" ? 1 + bdiValue / 100 : 1;
  console.log("SCurve Debug:", { medicoes, orcamento, cronograma });
  const leafItemsTotal = orcamento
    .filter((r) => r.tipo !== "etapa")
    .reduce((acc, r) => acc + (r.total || 0), 0);
  
  const totalOrcado = leafItemsTotal * bdiMultiplier;
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

  const diffDays = (minDate && maxDate) ? Math.ceil(
    (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24),
  ) : 0;
  const useDayInterval = diffDays <= 60 && diffDays > 0;
  const intervalDays = 5;

  const getSCurveData = () => {
    if (!minDate || !maxDate) return [];

    const intervalsSet = new Set<string>();
    const projectIntervals: string[] = [];

    if (useDayInterval) {
      let d = new Date(minDate);
      // Ensure we start at 00:00:00
      d.setHours(0, 0, 0, 0);
      const endLimit = new Date(maxDate);
      endLimit.setHours(23, 59, 59, 999);

      while (d <= endLimit) {
        const dateStr = d.toISOString().split("T")[0];
        intervalsSet.add(dateStr);
        projectIntervals.push(dateStr);
        d.setDate(d.getDate() + intervalDays);
      }
      // Ensure last date is included if it's significant
      const finalDateStr = endLimit.toISOString().split("T")[0];
      if (!intervalsSet.has(finalDateStr)) {
        intervalsSet.add(finalDateStr);
        projectIntervals.push(finalDateStr);
      }
    } else {
      let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      const endLimit = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      while (d <= endLimit) {
        const monthStr = d.toISOString().substring(0, 7);
        intervalsSet.add(monthStr);
        projectIntervals.push(monthStr);
        d.setMonth(d.getMonth() + 1);
      }
    }

    const plannedByInterval = new Map<string, number>();
    
    // leaf items for precise mapping
    const leafItems = orcamento.filter(r => r.tipo !== 'etapa');
    const mappedLeafIds = new Set<string>();

    // 1. For each budget item, identify associated activities and distribute its value
    leafItems.forEach(item => {
      const itemValue = (item.total || 0) * bdiMultiplier;
      const itemIdNumeric = item.id.replace('item-', '');
      
      // Find activities associated with this item or its stage
      const associatedActs = cronograma.filter(act => {
        const sDate = parseDate(act.data_inicio_prevista);
        const eDate = parseDate(act.data_fim_prevista);
        if (!sDate || !eDate) return false;

        return (
          act.orcamento_item_id?.toString() === itemIdNumeric ||
          (act.item_numero?.toString() === item.item?.toString() && act.item_numero) ||
          (act.etapa_id?.toString() === item.etapa_id?.toString() && act.etapa_id)
        );
      });

      if (associatedActs.length > 0) {
        mappedLeafIds.add(item.id);
        
        // Share total item value among associated activities proportional to their duration
        const activitiesWithDates = associatedActs.map(act => {
            const s = parseDate(act.data_inicio_prevista)!;
            const e = parseDate(act.data_fim_prevista)!;
            const dur = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
            return { act, s, e, dur };
        });

        const totalDuration = activitiesWithDates.reduce((acc, val) => acc + val.dur, 0);
        
        activitiesWithDates.forEach(({ act, s, e, dur }) => {
          const actShare = totalDuration > 0 ? (dur / totalDuration) * itemValue : itemValue / activitiesWithDates.length;
          
          projectIntervals.forEach((intervalKey) => {
            let iStart: Date;
            let iEnd: Date;
            
            if (useDayInterval) {
              iStart = new Date(intervalKey + "T00:00:00Z");
              iEnd = new Date(iStart);
              iEnd.setUTCDate(iEnd.getUTCDate() + intervalDays - 1);
              iEnd.setUTCHours(23, 59, 59, 999);
            } else {
              const [y, m] = intervalKey.split("-").map(Number);
              iStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
              iEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
            }

            const overlapStart = Math.max(s.getTime(), iStart.getTime());
            const overlapEnd = Math.min(e.getTime(), iEnd.getTime());

            if (overlapEnd >= overlapStart) {
              const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
              const valInInterval = (overlapDays / dur) * actShare;
              plannedByInterval.set(intervalKey, (plannedByInterval.get(intervalKey) || 0) + valInInterval);
            }
          });
        });
      }
    });

    // Handle unmapped leaf items (spread over project duration using S-curve)
    const unmappedLeaves = leafItems.filter(it => !mappedLeafIds.has(it.id));
    if (unmappedLeaves.length > 0 && projectIntervals.length > 0) {
      const totalUnmapped = unmappedLeaves.reduce((acc, it) => acc + (it.total || 0), 0) * bdiMultiplier;
      const N = projectIntervals.length;
      for (let i = 0; i < N; i++) {
        const t1 = i / N;
        const t2 = (i + 1) / N;
        const p1 = t1 * t1 * (3 - 2 * t1);
        const p2 = t2 * t2 * (3 - 2 * t2);
        const val = (p2 - p1) * totalUnmapped;
        const key = projectIntervals[i];
        plannedByInterval.set(key, (plannedByInterval.get(key) || 0) + val);
      }
    }

    const actualByInterval = new Map<string, number>();
    medicoes.forEach((med) => {
      const d = parseDate(med.data_medicao);
      if (d) {
        let key = "";
        if (useDayInterval) {
          // Find closest interval start (rounding down to previous 5-day mark)
          const diffFromProjectStart = Math.floor(
            (d.getTime() - minDate!.getTime()) / (1000 * 60 * 60 * 24),
          );
          const intervalIndex = Math.max(
            0,
            Math.floor(diffFromProjectStart / intervalDays),
          );
          key =
            projectIntervals[Math.min(intervalIndex, projectIntervals.length - 1)];
        } else {
          key = d.toISOString().substring(0, 7);
        }

        if (key && intervalsSet.has(key)) {
          actualByInterval.set(
            key,
            (actualByInterval.get(key) || 0) + (med.total_valor || 0),
          );
        }
      }
    });

    let cumPlanned = 0;
    let cumActual = 0;
    const now = new Date();
    const todayKey = useDayInterval
      ? now.toISOString().split("T")[0]
      : now.toISOString().substring(0, 7);

    let maxMedicaoKey: string | null = null;
    medicoes.forEach((med) => {
      const d = parseDate(med.data_medicao);
      if (d) {
        const k = useDayInterval
          ? d.toISOString().split("T")[0]
          : d.toISOString().substring(0, 7);
        if (!maxMedicaoKey || k > maxMedicaoKey) maxMedicaoKey = k;
      }
    });

    return projectIntervals.map((key) => {
      const currentPlanned = plannedByInterval.get(key) || 0;
      cumPlanned += currentPlanned;

      const planejadoPercent =
        totalOrcado > 0 ? Math.min(100, (cumPlanned / totalOrcado) * 100) : 0;
      const planejadoMensalPercent =
        totalOrcado > 0 ? (currentPlanned / totalOrcado) * 100 : 0;

      let currentActual = 0;
      let realizadoPercent: number | null = null;
      let realizedToDate: number | null = null;
      let realizadoMensalPercent: number | null = null;

      if (!maxMedicaoKey || key <= maxMedicaoKey || key <= todayKey) {
        currentActual = actualByInterval.get(key) || 0;
        cumActual += currentActual;

        if (
          medicoes.length > 0 ||
          currentActual > 0 ||
          (maxMedicaoKey && key <= maxMedicaoKey)
        ) {
          realizadoPercent =
            totalOrcado > 0 ? Math.min(100, (cumActual / totalOrcado) * 100) : 0;
          realizadoMensalPercent =
            totalOrcado > 0 ? (currentActual / totalOrcado) * 100 : 0;
          realizedToDate = cumActual;
        } else if (
          medicoes.length === 0 &&
          key <= todayKey &&
          projectIntervals.length > 0 &&
          key >= projectIntervals[0]
        ) {
          realizadoPercent = 0;
          realizadoMensalPercent = 0;
          realizedToDate = 0;
        }
      }

      let spi: number | null = null;
      if (realizedToDate !== null && cumPlanned > 0) {
        spi = Number((realizedToDate / cumPlanned).toFixed(2));
      }

      const label = useDayInterval
        ? key.split("-").reverse().slice(0, 2).join("/")
        : key.split("-").reverse().join("/");

      return {
        month: label,
        rawMonth: key,
        planejado: cumPlanned,
        realizado: realizedToDate,
        planejadoPercent: Number(planejadoPercent.toFixed(2)),
        realizadoPercent:
          realizadoPercent !== null ? Number(realizadoPercent.toFixed(2)) : null,
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

  const sCurveDataRaw = useMemo(() => getSCurveData(), [
    medicoes,
    orcamento,
    cronograma,
    minDate,
    maxDate,
    totalOrcado,
    bdiMultiplier,
  ]);

  const sCurveData = useMemo(() => {
    if (!filterStart && !filterEnd) return sCurveDataRaw;
    return sCurveDataRaw.filter((d) => {
      // Comparison works because keys are YYYY-MM or YYYY-MM-DD
      if (filterStart && d.rawMonth < filterStart) return false;
      if (filterEnd && d.rawMonth > filterEnd) return false;
      return true;
    });
  }, [sCurveDataRaw, filterStart, filterEnd]);

  // Metrics for Current Month Snapshot
  const latestMedicaoData = [...sCurveData]
    .reverse()
    .find((d) => d.realizado !== null);
  const currentPV = latestMedicaoData ? latestMedicaoData.planejado : 0;
  const currentEV = latestMedicaoData ? latestMedicaoData.realizado : 0;
  const currentSPI = currentPV > 0 ? currentEV / currentPV : 0;
  const currentSV = currentEV - currentPV;
  const concluidoPercent =
    totalOrcado > 0 ? Math.min(100, (currentEV / totalOrcado) * 100) : 0;
  const planejadoToDatePercent = totalOrcado > 0 ? Math.min(100, (currentPV / totalOrcado) * 100) : 0;

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
                <div className="w-2 h-2 rounded-full bg-[#93c5fd]"></div>
                Planejado no Período
              </span>
              <span className="font-black text-slate-700">
                R$ {formatFinancial(data.planejadoMensal || 0)} ({data.planejadoMensalPercent}%)
              </span>
            </div>
            {data.realizadoMensalPercent !== null && data.realizadoMensalPercent > 0 && (
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${(data.realizadoMensalPercent || 0) >= (data.planejadoMensalPercent || 0) ? "bg-[#10b981]" : "bg-[#ef4444]"}`}></div>
                  Realizado no Período
                </span>
                <span className={`font-black ${(data.realizadoMensalPercent || 0) >= (data.planejadoMensalPercent || 0) ? "text-emerald-700" : "text-rose-700"}`}>
                  R$ {formatFinancial(data.realizadoMensal || 0)} ({data.realizadoMensalPercent}%)
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-[10px] pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#2563eb]"></div>
                Planejado Acumulado
              </span>
              <div className="text-right">
                <div className="font-black text-blue-600">
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
                  <div className={`w-3 h-3 rounded-full ${data.realizadoPercent >= data.planejadoPercent ? "bg-[#10b981]" : "bg-[#ef4444]"}`}></div>
                  Realizado Acumulado
                </span>
                <div className="text-right">
                  <div className={`font-black ${data.realizadoPercent >= data.planejadoPercent ? "text-emerald-600" : "text-rose-600"}`}>
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

  // Prepare activity data with financial values
  const activityFinancialData = useMemo(() => {
    const actMap = new Map<string | number, { name: string, orcado: number, medido: number }>();
    
    // leaf items for precise mapping
    const leafItems = orcamento.filter(r => r.tipo !== 'etapa');
    const bdiMultiplier = 1 + (bdiValue / 100);

    leafItems.forEach(item => {
      const itemValue = (item.total || 0) * bdiMultiplier;
      const itemIdNumeric = item.id.replace('item-', '');
      
      const associatedActs = cronograma.filter(act => 
        act.orcamento_item_id?.toString() === itemIdNumeric ||
        (act.item_numero?.toString() === item.item?.toString() && act.item_numero) ||
        (act.etapa_id?.toString() === item.etapa_id?.toString() && act.etapa_id)
      );

      if (associatedActs.length > 0) {
        // Distribute value among acts by duration
        const totalDuration = associatedActs.reduce((acc, act) => {
          const s = parseDate(act.data_inicio_prevista);
          const e = parseDate(act.data_fim_prevista);
          if (!s || !e) return acc + 1;
          return acc + Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        }, 0);

        associatedActs.forEach(act => {
          const s = parseDate(act.data_inicio_prevista);
          const e = parseDate(act.data_fim_prevista);
          const dur = (!s || !e) ? 1 : Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const actShare = totalDuration > 0 ? (dur / totalDuration) * itemValue : itemValue / associatedActs.length;
          
          const existing = actMap.get(act.id) || { name: act.nome, orcado: 0, medido: 0 };
          existing.orcado += actShare;
          existing.medido += actShare * ((act.progresso || 0) / 100);
          actMap.set(act.id, existing);
        });
      }
    });

    return Array.from(actMap.values())
      .filter(d => {
        // Filter by date if applicable (finding the activity dates)
        const act = cronograma.find(a => a.nome === d.name || d.name.startsWith(a.nome.substring(0, 15)));
        if (!act) return true;
        const s = act.data_inicio_prevista;
        const e = act.data_fim_prevista || s;
        if (filterStart && e && e < filterStart) return false;
        if (filterEnd && s && s > filterEnd) return false;
        return true;
      })
      .sort((a, b) => b.orcado - a.orcado)
      .slice(0, 10)
      .map(d => ({
        ...d,
        name: d.name.length > 20 ? d.name.substring(0, 20) + '...' : d.name
      }));
  }, [orcamento, cronograma, bdiValue, filterStart, filterEnd]);

  // Prepare progress data
  const progressData = useMemo(() => {
    return cronograma
      .filter(act => {
        const s = act.data_inicio_prevista;
        const e = act.data_fim_prevista || s;
        if (filterStart && e && e < filterStart) return false;
        if (filterEnd && s && s > filterEnd) return false;
        return true;
      })
      .sort((a, b) => new Date(a.data_inicio_prevista || 0).getTime() - new Date(b.data_inicio_prevista || 0).getTime())
      .slice(0, 10)
      .map((act) => ({
        name: act.nome.length > 20 ? act.nome.substring(0, 20) + "..." : act.nome,
        progresso: act.progresso || 0,
      }));
  }, [cronograma, filterStart, filterEnd]);

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

      {/* Main Totals - Dash Balloons Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Orçamento Total (BAC) */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex justify-between items-center group hover:shadow-md transition-all">
          <div className="flex flex-col min-w-0">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 truncate" title="Budget At Completion">
              Orçamento Total
            </h4>
            <p className="text-xl font-extrabold text-slate-900 truncate">
              R$ {formatFinancial(totalOrcado)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#ff7a00] flex-shrink-0 transition-transform group-hover:scale-105 shadow-lg shadow-orange-100 flex items-center justify-center">
             <div className="w-6 h-6 rounded-lg bg-white opacity-20"></div>
          </div>
        </div>

        {/* Valor Planejado (PV) */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex justify-between items-center group hover:shadow-md transition-all">
          <div className="flex flex-col min-w-0">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 truncate" title="Soma de tudo o que deve estar pronto até hoje">
              Planejado Acum.
            </h4>
            <p className="text-xl font-extrabold text-slate-900 truncate">
              R$ {formatFinancial(currentPV)}
            </p>
            <span className="text-[10px] font-bold text-blue-500 mt-0.5">
              {planejadoToDatePercent.toFixed(1)}% do projeto
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#1e6aff] flex-shrink-0 transition-transform group-hover:scale-105 shadow-lg shadow-blue-100 flex items-center justify-center">
             <div className="w-6 h-6 rounded-lg bg-white opacity-20"></div>
          </div>
        </div>

        {/* Realizado Acumulado (EV) */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex justify-between items-center group hover:shadow-md transition-all">
          <div className="flex flex-col min-w-0">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 truncate" title="Soma de tudo o que foi de fato medido até hoje">
              Realizado Acum.
            </h4>
            <p className="text-xl font-extrabold text-slate-900 truncate">
              R$ {formatFinancial(currentEV)}
            </p>
            <span className={`text-[10px] font-bold mt-0.5 ${concluidoPercent >= planejadoToDatePercent ? 'text-emerald-500' : 'text-rose-500'}`}>
              {concluidoPercent.toFixed(1)}% concluído
            </span>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex-shrink-0 transition-transform group-hover:scale-105 shadow-lg flex items-center justify-center ${concluidoPercent >= planejadoToDatePercent ? 'bg-[#00c283] shadow-emerald-100' : 'bg-[#f43f5e] shadow-rose-100'}`}>
             <div className="w-6 h-6 rounded-lg bg-white opacity-20"></div>
          </div>
        </div>

        {/* Desvio Cronograma (SV) */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex justify-between items-center group hover:shadow-md transition-all">
          <div className="flex flex-col min-w-0">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 truncate" title="Diferença entre Realizado e Planejado">
              Desvio Cronog.
            </h4>
            <p className={`text-xl font-extrabold truncate ${currentSV < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              R$ {formatFinancial(currentSV)}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex-shrink-0 transition-transform group-hover:scale-105 shadow-lg flex items-center justify-center ${currentSV < 0 ? 'bg-[#f43f5e] shadow-rose-100' : 'bg-[#00c283] shadow-emerald-100'}`}>
             <div className="w-6 h-6 rounded-lg bg-white opacity-20"></div>
          </div>
        </div>

        {/* Eficiência (SPI) */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex justify-between items-center group hover:shadow-md transition-all">
          <div className="flex flex-col min-w-0">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 truncate" title="Índice de Performance de Prazo">
              Eficiência
            </h4>
            <p className={`text-xl font-extrabold truncate ${currentSPI < 0.9 ? 'text-rose-600' : currentSPI < 1 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {currentSPI.toFixed(2)}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex-shrink-0 transition-transform group-hover:scale-105 shadow-lg flex items-center justify-center ${currentSPI < 0.9 ? 'bg-[#f43f5e] shadow-rose-100' : currentSPI < 1 ? 'bg-[#f59e0b] shadow-amber-100' : 'bg-[#6366f1] shadow-indigo-100'}`}>
             <div className="w-6 h-6 rounded-lg bg-white opacity-20"></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Curva S */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8 lg:col-span-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Curva S e Histograma (Avanço)
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                 {(() => {
                    const s = minDate ? minDate.toLocaleDateString('pt-BR') : '-';
                    const e = maxDate ? maxDate.toLocaleDateString('pt-BR') : '-';
                    return `Prazo Total: ${s} até ${e}`;
                })()}
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 px-2 border-r border-slate-200">
                 <Calendar className="w-3.5 h-3.5 text-slate-400" />
                 <span className="text-[10px] font-black text-slate-500 uppercase">Filtrar:</span>
              </div>
              <input 
                type={useDayInterval ? "date" : "month"} 
                className="text-[10px] font-bold bg-transparent border-none focus:ring-0 text-slate-600 w-28"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
              />
              <span className="text-[10px] font-bold text-slate-300">a</span>
              <input 
                type={useDayInterval ? "date" : "month"} 
                className="text-[10px] font-bold bg-transparent border-none focus:ring-0 text-slate-600 w-28"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
              />
              {(filterStart || filterEnd) && (
                <button 
                  onClick={() => { setFilterStart(""); setFilterEnd(""); }}
                  className="p-1 hover:bg-white rounded-md text-rose-500 transition-colors"
                  title="Limpar Filtro"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
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
                  name="% no Período (Plan)"
                  fill="#93c5fd"
                  radius={[4, 4, 0, 0]}
                  barSize={useDayInterval ? undefined : 32}
                  maxBarSize={32}
                />
                {sCurveData.some((d) => (d.realizadoMensalPercent || 0) > 0) && (
                  <Bar
                    yAxisId="left"
                    dataKey="realizadoMensalPercent"
                    name="% no Período (Real)"
                    radius={[4, 4, 0, 0]}
                    barSize={useDayInterval ? undefined : 32}
                    maxBarSize={32}
                  >
                    {sCurveData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={(entry.realizadoMensalPercent || 0) >= (entry.planejadoMensalPercent || 0) ? "#10b981" : "#ef4444"} 
                      />
                    ))}
                  </Bar>
                )}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="planejadoPercent"
                  name="% Planejado Acumulado"
                  stroke="#2563eb"
                  strokeDasharray="5 5"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="realizadoPercent"
                  name="% Realizado Acumulado"
                  stroke={currentSPI >= 0.98 ? "#10b981" : "#ef4444"}
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
                Impacto Financeiro por Atividade
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                Top 10 atividades mais caras
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activityFinancialData}
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
