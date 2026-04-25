import { Obra, OrcamentoItem, DiarioObra, DashboardMetrics, DashboardData } from '../types/index';

const API_BASE = '/api';

const fetchJson = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}, message: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${text.substring(0, 20)}...`);
  }
};

export const api = {
  // Dashboard
  getDashboard: async (): Promise<DashboardData> => {
    return fetchJson(`${API_BASE}/dashboard`);
  },

  // Obras
  getObras: async (): Promise<Obra[]> => {
    return fetchJson(`${API_BASE}/obras`);
  },

  getObraById: async (id: string | number): Promise<Obra> => {
    return fetchJson(`${API_BASE}/obras/${id}`);
  },

  createObra: async (data: Partial<Obra>): Promise<Obra> => {
    return fetchJson(`${API_BASE}/obras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  updateObra: async (id: string | number, data: Partial<Obra>): Promise<void> => {
    await fetch(`${API_BASE}/obras/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteObra: async (id: string | number): Promise<void> => {
    await fetch(`${API_BASE}/obras/${id}`, {
      method: 'DELETE'
    });
  },

  // Orçamento
  getOrcamento: async (obraId: string | number, params?: { desonerado?: boolean, estado?: string, data_referencia?: string, bancos_ativos?: any[] }): Promise<OrcamentoItem[]> => {
    let url = `${API_BASE}/obras/${obraId}/orcamento`;
    if (params) {
      const query = new URLSearchParams();
      if (params.desonerado !== undefined) query.append('desonerado', params.desonerado.toString());
      if (params.estado) query.append('estado', params.estado);
      if (params.data_referencia) query.append('data_referencia', params.data_referencia);
      if (params.bancos_ativos) query.append('bancos_ativos', JSON.stringify(params.bancos_ativos));
      url += `?${query.toString()}`;
    }
    return fetchJson(url);
  },

  saveOrcamento: async (obraId: string | number, items: OrcamentoItem[]): Promise<void> => {
    await fetch(`${API_BASE}/obras/${obraId}/orcamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
  },

  updateOrcamentoItem: async (obraId: string | number, itemId: string | number, data: Partial<OrcamentoItem>): Promise<void> => {
    await fetch(`${API_BASE}/obras/${obraId}/orcamento/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteOrcamentoItem: async (obraId: string | number, itemId: string | number, tipo?: string): Promise<void> => {
    let url = `${API_BASE}/obras/${obraId}/orcamento/${itemId}`;
    if (tipo) {
      url += `?tipo=${tipo}`;
    }
    await fetch(url, {
      method: 'DELETE'
    });
  },

  resequenceOrcamento: async (obraId: string | number, activeItemId?: string | number): Promise<void> => {
    await fetch(`${API_BASE}/obras/${obraId}/orcamento/resequence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeItemId })
    });
  },

  // Busca SINAPI (Autocomplete)
  searchSinapi: async (query: string, type: 'insumo' | 'composicao', params?: { desonerado?: boolean, estado?: string, data_referencia?: string, bases?: string[], bancos_ativos?: any[] }): Promise<any[]> => {
    const queryParams = new URLSearchParams();
    queryParams.append('q', query);
    queryParams.append('type', type);
    if (params) {
      if (params.desonerado !== undefined) queryParams.append('desonerado', params.desonerado.toString());
      if (params.estado) queryParams.append('estado', params.estado);
      if (params.data_referencia) queryParams.append('data_referencia', params.data_referencia);
      if (params.bases && params.bases.length > 0) queryParams.append('bases', params.bases.join(','));
      if (params.bancos_ativos && params.bancos_ativos.length > 0) queryParams.append('bancos_ativos', JSON.stringify(params.bancos_ativos));
    }
    return fetchJson(`${API_BASE}/search?${queryParams.toString()}`);
  },

  // Diário de Obra
  getDiarios: async (obraId: string | number): Promise<DiarioObra[]> => {
    return fetchJson(`${API_BASE}/obras/${obraId}/diario`);
  },

  getCronograma: async (obraId: string | number): Promise<any[]> => {
    return fetchJson(`${API_BASE}/obras/${obraId}/cronograma`);
  },

  getMedicoes: async (obraId: string | number): Promise<any[]> => {
    return fetchJson(`${API_BASE}/obras/${obraId}/medicao`);
  },

  getDatabases: async (): Promise<any[]> => {
    const url = `${API_BASE}/databases`;
    console.log("Fetching databases from:", url);
    const res = await fetch(url);
    if (!res.ok) {
        console.error(`Error fetching databases: ${res.status}`);
        return [];
    }
    const data = await res.json();
    console.log("Databases:", data);
    return data;
  }
};
