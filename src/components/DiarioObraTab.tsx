import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Plus, Pencil, Trash2, Eye, X, Camera, ImageIcon, ZoomIn, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const CLIMA: any = {
  ensolarado: { icon: "☀️", label: "Ensolarado" },
  nublado: { icon: "☁️", label: "Nublado" },
  parcialmente_nublado: { icon: "⛅", label: "Parc. Nublado" },
  chuvoso: { icon: "🌧️", label: "Chuvoso" },
  tempestade: { icon: "⛈️", label: "Tempestade" },
};

const EMPTY = {
  data: new Date().toISOString().split("T")[0],
  numero_rdo: "",
  clima_manha: "ensolarado",
  clima_tarde: "ensolarado",
  temperatura_max: "",
  temperatura_min: "",
  chuva_mm: "",
  efetivo: [] as any[],
  efetivo_total: "",
  equipamentos: [] as any[],
  atividades: "",
  materiais_recebidos: [] as any[],
  ocorrencias: "",
  visitas: [] as any[],
  acidentes: "",
  restricoes: "",
  observacoes_gerais: "",
  responsavel_registro: "",
  fotos_urls: [] as any[],
};

export default function DiarioObraTab({ obraId, onRefresh }: { obraId: string | number, onRefresh?: () => void }) {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [rdoCount, setRdoCount] = useState(0);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [lightbox, setLightbox] = useState({ open: false, urls: [] as string[], idx: 0 });

  const load = () => api.getDiarios(obraId)
    .then(r => {
      const parsed = r.map(item => ({
        ...item,
        efetivo: typeof item.efetivo === "string" ? JSON.parse(item.efetivo) : item.efetivo,
        equipamentos: typeof item.equipamentos === "string" ? JSON.parse(item.equipamentos) : item.equipamentos,
        materiais_recebidos: typeof item.materiais_recebidos === "string" ? JSON.parse(item.materiais_recebidos) : item.materiais_recebidos,
        visitas: typeof item.visitas === "string" ? JSON.parse(item.visitas) : item.visitas,
        fotos_urls: typeof item.fotos_urls === "string" ? JSON.parse(item.fotos_urls) : item.fotos_urls
      }));
      setRegistros(parsed);
      setRdoCount(parsed.length);
    })
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, [obraId]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, numero_rdo: `RDO-${String(rdoCount + 1).padStart(3, "0")}` });
    setModalOpen(true);
  };
  const openEdit = (r: any) => { setEditing(r); setForm({ ...r }); setModalOpen(true); };
  const openView = (r: any) => { setViewing(r); setViewOpen(true); };

  const handleSave = async () => {
    const dataToSend = {
      ...form,
      obra_id: obraId,
      efetivo_total: form.efetivo?.reduce((s: number, e: any) => s + (parseInt(e.quantidade) || 0), 0) || parseInt(form.efetivo_total) || 0,
      temperatura_max: parseFloat(form.temperatura_max) || null,
      temperatura_min: parseFloat(form.temperatura_min) || null,
      chuva_mm: parseFloat(form.chuva_mm) || null,
    };
    if (editing && editing.id) {
      await api.updateDiario(obraId, editing.id, dataToSend);
    } else {
      await api.createDiario(obraId, dataToSend);
    }
    setModalOpen(false);
    load();
    if (onRefresh) onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este registro?")) return;
    await api.deleteDiario(obraId, id);
    load();
    if (onRefresh) onRefresh();
  };

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handlePhotoUpload = async (e: any) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingPhotos(true);
    const uploadedUrls = [];
    for (const file of files as File[]) {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onload = (ev) => resolve(ev.target?.result);
        reader.readAsDataURL(file);
      });
      const base64Url = await base64Promise;
      uploadedUrls.push(base64Url);
    }
    set("fotos_urls", [...(form.fotos_urls || []), ...uploadedUrls]);
    setUploadingPhotos(false);
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    const updated = (form.fotos_urls || []).filter((_: any, i: number) => i !== idx);
    set("fotos_urls", updated);
  };

  const openLightbox = (urls: string[], idx: number) => setLightbox({ open: true, urls, idx });

  const addEfetivo = () => set("efetivo", [...(form.efetivo || []), { funcao: "", quantidade: 1, empresa: "" }]);
  const updateEfetivo = (idx: number, k: string, v: any) => { const a = [...(form.efetivo || [])]; a[idx] = { ...a[idx], [k]: v }; set("efetivo", a); };
  const removeEfetivo = (idx: number) => set("efetivo", (form.efetivo || []).filter((_: any, i: number) => i !== idx));

  const addEquip = () => set("equipamentos", [...(form.equipamentos || []), { descricao: "", quantidade: 1, horas_trabalhadas: "" }]);
  const updateEquip = (idx: number, k: string, v: any) => { const a = [...(form.equipamentos || [])]; a[idx] = { ...a[idx], [k]: v }; set("equipamentos", a); };
  const removeEquip = (idx: number) => set("equipamentos", (form.equipamentos || []).filter((_: any, i: number) => i !== idx));

  const addMaterial = () => set("materiais_recebidos", [...(form.materiais_recebidos || []), { descricao: "", quantidade: "", unidade: "", fornecedor: "", nota_fiscal: "" }]);
  const updateMaterial = (idx: number, k: string, v: any) => { const a = [...(form.materiais_recebidos || [])]; a[idx] = { ...a[idx], [k]: v }; set("materiais_recebidos", a); };
  const removeMaterial = (idx: number) => set("materiais_recebidos", (form.materiais_recebidos || []).filter((_: any, i: number) => i !== idx));

  const addVisita = () => set("visitas", [...(form.visitas || []), { visitante: "", empresa: "", motivo: "" }]);
  const updateVisita = (idx: number, k: string, v: any) => { const a = [...(form.visitas || [])]; a[idx] = { ...a[idx], [k]: v }; set("visitas", a); };
  const removeVisita = (idx: number) => set("visitas", (form.visitas || []).filter((_: any, i: number) => i !== idx));

  const fmtDate = (d: string) => {
    try { return format(parseISO(d), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }); } catch { return d; }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openNew} className="px-5 py-2.5 flex items-center justify-center rounded-xl font-bold transition-colors bg-[#F97316] hover:bg-orange-600 text-white text-sm">
          <Plus size={17} className="mr-2" /> Novo RDO
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-50 rounded-2xl animate-pulse border border-slate-100" />)}</div>
      ) : registros.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">Nenhum registro de diário</p>
          <button className="px-4 py-2 mt-4 rounded-xl border border-slate-200 font-medium transition-colors hover:bg-slate-50 text-slate-700" onClick={openNew}>Criar primeiro RDO</button>
        </div>
      ) : (
        <div className="space-y-4">
          {registros.map((r) => (
            <div key={r.id} className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    {r.numero_rdo && <span className="text-sm font-bold text-[#F97316]">{r.numero_rdo}</span>}
                    <p className="text-sm font-bold text-slate-900">{fmtDate(r.data)}</p>
                    <span className="text-sm inline-flex gap-1">
                      {CLIMA[r.clima_manha]?.icon} {CLIMA[r.clima_tarde]?.icon}
                    </span>
                    {r.efetivo_total > 0 && (
                      <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                        👷 {r.efetivo_total}
                      </span>
                    )}
                    {r.temperatura_max && <span className="text-xs text-slate-500">🌡 {r.temperatura_min}°/{r.temperatura_max}°C</span>}
                    {r.chuva_mm > 0 && <span className="text-xs text-blue-500">💧 {r.chuva_mm}mm</span>}
                  </div>
                  {r.atividades && <p className="text-sm text-slate-600 leading-relaxed mb-2 line-clamp-2">{r.atividades}</p>}
                  {r.ocorrencias && <p className="text-sm text-red-500 flex items-start gap-1.5 line-clamp-1"><AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> {r.ocorrencias}</p>}
                  {r.restricoes && <p className="text-sm text-yellow-600 line-clamp-1 mt-1">🚧 {r.restricoes}</p>}
                  {r.fotos_urls?.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 mt-2 bg-slate-50 px-2.5 py-1 rounded-md">
                    <ImageIcon className="w-3.5 h-3.5" /> {r.fotos_urls.length} foto{r.fotos_urls.length !== 1 ? "s" : ""}
                  </span>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors" title="Visualizar" onClick={() => openView(r)}><Eye size={18} /></button>
                  <button className="p-2 text-slate-500 hover:text-[#003366] hover:bg-blue-50 rounded-xl transition-colors" title="Editar" onClick={() => openEdit(r)}><Pencil size={18} /></button>
                  <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Excluir" onClick={() => handleDelete(r.id)}><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 sm:px-8 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-bold text-xl text-slate-800">{editing ? "Editar RDO" : "Novo Registro Diário de Obra"}</h3>
              <button onClick={() => setModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-5 sm:px-8 overflow-y-auto flex-1 space-y-8 py-8">
              {/* Identificação */}
              <Section title="Identificação">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Número RDO</label>
                    <input className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-400 font-medium text-[#F97316] bg-slate-50" value={form.numero_rdo || ""} onChange={e => set("numero_rdo", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Data *</label>
                    <input className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" type="date" value={form.data || ""} onChange={e => set("data", e.target.value)} />
                  </div>
                </div>
              </Section>

              {/* Clima */}
              <Section title="Condições Climáticas">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Clima Manhã</label>
                    <select className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.clima_manha} onChange={e => set("clima_manha", e.target.value)}>
                      {Object.entries(CLIMA).map(([k, v]: any) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Clima Tarde</label>
                    <select className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.clima_tarde} onChange={e => set("clima_tarde", e.target.value)}>
                      {Object.entries(CLIMA).map(([k, v]: any) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Temp. Máx (°C)</label>
                    <input className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" type="number" value={form.temperatura_max || ""} onChange={e => set("temperatura_max", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Temp. Mín (°C)</label>
                    <input className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" type="number" value={form.temperatura_min || ""} onChange={e => set("temperatura_min", e.target.value)} />
                  </div>
                </div>
                <div className="mt-4 w-1/4">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Chuva (mm)</label>
                  <input className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" type="number" value={form.chuva_mm || ""} onChange={e => set("chuva_mm", e.target.value)} />
                </div>
              </Section>

              {/* Efetivo */}
              <Section title="Efetivo de mão de obra" onAdd={addEfetivo}>
                {(form.efetivo || []).length === 0 ? (
                  <p className="text-sm text-slate-500 mt-2">Nenhum registro. Clique + para adicionar.</p>
                ) : (
                  <div className="space-y-3 mt-4">
                    {(form.efetivo || []).map((e: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-[1fr,100px,1fr] gap-3 items-center">
                        <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Função" value={e.funcao || ""} onChange={ev => updateEfetivo(idx, "funcao", ev.target.value)} />
                        <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-center" type="number" placeholder="Qtd" value={e.quantidade || ""} onChange={ev => updateEfetivo(idx, "quantidade", ev.target.value)} />
                        <div className="flex gap-2">
                          <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Empresa" value={e.empresa || ""} onChange={ev => updateEfetivo(idx, "empresa", ev.target.value)} />
                          <button type="button" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 rounded-lg flex-shrink-0 transition-colors" onClick={() => removeEfetivo(idx)}><X size={18} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Equipamentos */}
              <Section title="Equipamentos utilizados" onAdd={addEquip}>
                {(form.equipamentos || []).length === 0 ? (
                  <p className="text-sm text-slate-500 mt-2">Nenhum equipamento.</p>
                ) : (
                  <div className="space-y-3 mt-4">
                    {(form.equipamentos || []).map((e: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-[1fr,100px,120px] gap-3 items-center">
                        <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Equipamento" value={e.descricao || ""} onChange={ev => updateEquip(idx, "descricao", ev.target.value)} />
                        <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-center" type="number" placeholder="Qtd" value={e.quantidade || ""} onChange={ev => updateEquip(idx, "quantidade", ev.target.value)} />
                        <div className="flex gap-2">
                          <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-center" type="number" placeholder="Horas" value={e.horas_trabalhadas || ""} onChange={ev => updateEquip(idx, "horas_trabalhadas", ev.target.value)} />
                          <button type="button" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 rounded-lg flex-shrink-0 transition-colors" onClick={() => removeEquip(idx)}><X size={18} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Atividades */}
              <Section title="Atividades realizadas">
                <textarea className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none mt-2" rows={4} value={form.atividades || ""} onChange={e => set("atividades", e.target.value)} placeholder="Descreva detalhadamente as atividades executadas no dia..." />
              </Section>

              {/* Materiais Recebidos */}
              <Section title="Materiais recebidos" onAdd={addMaterial}>
                {(form.materiais_recebidos || []).length === 0 ? (
                  <p className="text-sm text-slate-500 mt-2">Nenhum material recebido.</p>
                ) : (
                  <div className="space-y-3 mt-4">
                    {(form.materiais_recebidos || []).map((m: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-[2fr,80px,80px,1fr] gap-3 items-center">
                        <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Descrição" value={m.descricao || ""} onChange={ev => updateMaterial(idx, "descricao", ev.target.value)} />
                        <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-center" type="number" placeholder="Qtd" value={m.quantidade || ""} onChange={ev => updateMaterial(idx, "quantidade", ev.target.value)} />
                        <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-center" placeholder="Un." value={m.unidade || ""} onChange={ev => updateMaterial(idx, "unidade", ev.target.value)} />
                        <div className="flex gap-2">
                          <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="NF" value={m.nota_fiscal || ""} onChange={ev => updateMaterial(idx, "nota_fiscal", ev.target.value)} />
                          <button type="button" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 rounded-lg flex-shrink-0 transition-colors" onClick={() => removeMaterial(idx)}><X size={18} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Visitas */}
              <Section title="Visitas" onAdd={addVisita}>
                {(form.visitas || []).length === 0 ? (
                  <p className="text-sm text-slate-500 mt-2">Nenhuma visita registrada.</p>
                ) : (
                  <div className="space-y-3 mt-4">
                    {(form.visitas || []).map((v: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-[1fr,1fr,1fr] gap-3 items-center">
                        <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Visitante" value={v.visitante || ""} onChange={ev => updateVisita(idx, "visitante", ev.target.value)} />
                        <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Empresa" value={v.empresa || ""} onChange={ev => updateVisita(idx, "empresa", ev.target.value)} />
                        <div className="flex gap-2">
                          <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Motivo" value={v.motivo || ""} onChange={ev => updateVisita(idx, "motivo", ev.target.value)} />
                          <button type="button" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 rounded-lg flex-shrink-0 transition-colors" onClick={() => removeVisita(idx)}><X size={18} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Ocorrências */}
              <Section title="Ocorrências e problemas">
                <textarea className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none mt-2" rows={3} value={form.ocorrencias || ""} onChange={e => set("ocorrencias", e.target.value)} placeholder="Problemas, paralisações, não conformidades..." />
              </Section>

              <Section title="Acidentes / quase-acidentes">
                <textarea className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none mt-2" rows={2} value={form.acidentes || ""} onChange={e => set("acidentes", e.target.value)} placeholder="Relatar qualquer acidente ou situação de risco..." />
              </Section>

              <Section title="Restrições e impedimentos">
                <textarea className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none mt-2" rows={2} value={form.restricoes || ""} onChange={e => set("restricoes", e.target.value)} placeholder="Impedimentos para execução dos serviços..." />
              </Section>

              <Section title="Observações gerais">
                <textarea className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none mt-2" rows={2} value={form.observacoes_gerais || ""} onChange={e => set("observacoes_gerais", e.target.value)} />
              </Section>

              <Section title="">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Responsável pelo Registro</label>
                <input className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.responsavel_registro || ""} onChange={e => set("responsavel_registro", e.target.value)} />
              </Section>

              {/* Fotos */}
              <Section title="Fotos da obra">
                <div className="space-y-4 mt-2">
                  <div className="border border-slate-200 border-dashed rounded-xl p-4">
                    {/* Grid de fotos */}
                    {(form.fotos_urls || []).length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
                        {(form.fotos_urls || []).map((url: string, idx: number) => (
                          <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200">
                            <img src={url} alt={`foto-${idx}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openLightbox(form.fotos_urls, idx)}
                                className="p-1.5 bg-white/90 hover:bg-white rounded-full transition-colors"
                              >
                                <ZoomIn className="w-4 h-4 text-slate-700" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removePhoto(idx)}
                                className="p-1.5 bg-white/90 hover:bg-white rounded-full transition-colors"
                              >
                                <X className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Upload button */}
                    <label className={`flex flex-col items-center gap-2 justify-center w-full h-20 rounded-xl cursor-pointer transition-colors ${uploadingPhotos ? "bg-orange-50" : "hover:bg-slate-50"}`}>
                      {uploadingPhotos ? (
                        <><Loader2 className="w-5 h-5 text-orange-400 animate-spin" /><span className="text-sm text-orange-500 font-medium tracking-wide">Processando...</span></>
                      ) : (
                        <><Camera className="w-5 h-5 text-slate-400" /><span className="text-sm text-slate-500 font-medium tracking-wide">Clique para adicionar fotos</span></>
                      )}
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhotos} />
                    </label>
                  </div>
                </div>
              </Section>
            </div>
            
            <div className="p-5 sm:px-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
              <button className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="px-5 py-2.5 bg-[#F97316] hover:bg-orange-600 rounded-xl text-sm font-bold text-white shadow-sm transition-colors" onClick={handleSave}>Salvar RDO</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 sm:px-8 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-bold text-xl text-slate-800">{viewing?.numero_rdo || "Diário de Obra"} <span className="text-slate-400 font-normal ml-2 text-sm">{viewing ? fmtDate(viewing.data) : ""}</span></h3>
              <button onClick={() => setViewOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X size={20}/></button>
            </div>
            <div className="p-5 sm:px-8 overflow-y-auto flex-1">
              {viewing && <RdoView rdo={viewing} fmtDate={fmtDate} onOpenLightbox={openLightbox} />}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox.open && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(l => ({ ...l, open: false }))}>
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: (l.idx - 1 + l.urls.length) % l.urls.length })); }}
            className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <img
            src={lightbox.urls[lightbox.idx]}
            alt="foto em tela cheia"
            className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl relative z-0"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: (l.idx + 1) % l.urls.length })); }}
            className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <button
            onClick={() => setLightbox(l => ({ ...l, open: false }))}
            className="absolute top-4 right-4 sm:right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-sm z-10">
            {lightbox.idx + 1} / {lightbox.urls.length}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, onAdd, children }: { title: string, onAdd?: () => void, children: React.ReactNode }) {
  return (
    <div className="pt-2">
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">{title}</h4>
          {onAdd && (
            <button type="button" className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg flex-shrink-0 transition-colors" onClick={onAdd} title="Adicionar item">
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function RdoView({ rdo, fmtDate, onOpenLightbox }: { rdo: any, fmtDate: (d: string) => string, onOpenLightbox?: (urls: string[], idx: number) => void }) {
  const CLIMA: any = {
    ensolarado: { icon: "☀️", label: "Ensolarado" },
    nublado: { icon: "☁️", label: "Nublado" },
    parcialmente_nublado: { icon: "⛅", label: "Parc. Nublado" },
    chuvoso: { icon: "🌧️", label: "Chuvoso" },
    tempestade: { icon: "⛈️", label: "Tempestade" },
  };
  const field = (label: string, value: any) => value ? (
    <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p><p className="text-sm font-medium text-slate-800">{value}</p></div>
  ) : null;

  return (
    <div className="space-y-8 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 rounded-2xl p-5 border border-slate-100">
        {field("Clima Manhã", CLIMA[rdo.clima_manha] ? `${CLIMA[rdo.clima_manha]?.icon} ${CLIMA[rdo.clima_manha]?.label}` : undefined)}
        {field("Clima Tarde", CLIMA[rdo.clima_tarde] ? `${CLIMA[rdo.clima_tarde]?.icon} ${CLIMA[rdo.clima_tarde]?.label}` : undefined)}
        {field("Efetivo Total", rdo.efetivo_total ? `${rdo.efetivo_total} trabalhadores` : null)}
        {field("Temperatura", rdo.temperatura_max ? `${rdo.temperatura_min}°C / ${rdo.temperatura_max}°C` : null)}
        {field("Chuva", rdo.chuva_mm ? `${rdo.chuva_mm} mm` : null)}
      </div>

      {rdo.efetivo?.length > 0 && (
        <ViewSection title="Efetivo">
          <div className="overflow-hidden border border-slate-200 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 font-semibold text-slate-700">Função</th>
                  <th className="text-center p-3 font-semibold text-slate-700 w-20">Qtd</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Empresa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rdo.efetivo.map((e: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-700">{e.funcao}</td>
                    <td className="p-3 text-center font-medium text-slate-900">{e.quantidade}</td>
                    <td className="p-3 text-slate-600">{e.empresa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ViewSection>
      )}

      {rdo.equipamentos?.length > 0 && (
        <ViewSection title="Equipamentos">
          <div className="overflow-hidden border border-slate-200 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 font-semibold text-slate-700">Equipamento</th>
                  <th className="text-center p-3 font-semibold text-slate-700 w-20">Qtd</th>
                  <th className="text-center p-3 font-semibold text-slate-700 w-24">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rdo.equipamentos.map((e: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-700">{e.descricao}</td>
                    <td className="p-3 text-center font-medium text-slate-900">{e.quantidade}</td>
                    <td className="p-3 text-center text-slate-600">{e.horas_trabalhadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ViewSection>
      )}

      {rdo.atividades && (
        <ViewSection title="Atividades Realizadas">
          <div className="text-slate-700 leading-relaxed whitespace-pre-wrap rounded-xl border border-slate-200 p-4">
            {rdo.atividades}
          </div>
        </ViewSection>
      )}

      {rdo.materiais_recebidos?.length > 0 && (
        <ViewSection title="Materiais Recebidos">
          <div className="overflow-hidden border border-slate-200 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 font-semibold text-slate-700">Descrição</th>
                  <th className="text-center p-3 font-semibold text-slate-700 w-16">Qtd</th>
                  <th className="text-center p-3 font-semibold text-slate-700 w-16">Un</th>
                  <th className="text-left p-3 font-semibold text-slate-700 w-32">NF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rdo.materiais_recebidos.map((m: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-700">{m.descricao}</td>
                    <td className="p-3 text-center font-medium text-slate-900">{m.quantidade}</td>
                    <td className="p-3 text-center text-slate-600">{m.unidade}</td>
                    <td className="p-3 text-slate-500 font-mono text-xs">{m.nota_fiscal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ViewSection>
      )}

      {rdo.visitas?.length > 0 && (
        <ViewSection title="Visitas">
          <ul className="space-y-2 rounded-xl border border-slate-200 p-4">
            {rdo.visitas.map((v: any, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="font-semibold text-slate-800 whitespace-nowrap">{v.visitante}</span>
                <span className="text-slate-300">—</span>
                <span className="text-slate-600 font-medium whitespace-nowrap">{v.empresa}</span>
                {v.motivo && <span className="text-slate-500 border-l border-slate-200 pl-2 ml-1">({v.motivo})</span>}
              </li>
            ))}
          </ul>
        </ViewSection>
      )}

      {rdo.ocorrencias && <ViewSection title="Ocorrências"><div className="bg-red-50 text-red-800 rounded-xl p-4 whitespace-pre-wrap leading-relaxed border border-red-100 flex gap-3"><AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} /><div>{rdo.ocorrencias}</div></div></ViewSection>}
      {rdo.acidentes && <ViewSection title="Acidentes"><div className="bg-red-50 text-red-800 rounded-xl p-4 whitespace-pre-wrap leading-relaxed border border-red-100">{rdo.acidentes}</div></ViewSection>}
      {rdo.restricoes && <ViewSection title="Restrições"><div className="bg-amber-50 text-amber-800 rounded-xl p-4 whitespace-pre-wrap leading-relaxed border border-amber-100">{rdo.restricoes}</div></ViewSection>}
      {rdo.observacoes_gerais && <ViewSection title="Observações Gerais"><div className="bg-slate-50 border border-slate-200 rounded-xl p-4 whitespace-pre-wrap leading-relaxed text-slate-700">{rdo.observacoes_gerais}</div></ViewSection>}
      
      {rdo.fotos_urls?.length > 0 && (
        <ViewSection title={`Fotos da Obra (${rdo.fotos_urls.length})`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {rdo.fotos_urls.map((url: string, idx: number) => (
              <button
                key={idx}
                type="button"
                onClick={() => onOpenLightbox && onOpenLightbox(rdo.fotos_urls, idx)}
                className="aspect-square rounded-2xl overflow-hidden border border-slate-200 hover:ring-2 hover:ring-orange-400 transition-all focus:outline-none shadow-sm"
              >
                <img src={url} alt={`foto-${idx}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </ViewSection>
      )}

      {rdo.responsavel_registro && (
        <div className="pt-4 mt-8 border-t border-slate-200">
          <p className="text-sm font-medium text-slate-500">Registrado por: <span className="font-bold text-slate-800">{rdo.responsavel_registro}</span></p>
        </div>
      )}
    </div>
  );
}

function ViewSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="pt-2">
      <p className="text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );
}
