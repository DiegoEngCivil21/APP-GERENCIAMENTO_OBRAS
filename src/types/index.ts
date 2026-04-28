export interface Obra {
  id: string | number;
  nome: string;
  cliente: string;
  descricao?: string;
  valor_total?: number;
  status: string;
  localizacao?: string;
  uf?: string;
  endereco?: string;
  data_inicio: string;
  data_fim_prevista?: string;
  bdi?: number;
  bdi_incidencia?: string;
  bdi_tipo?: string;
  desonerado?: number;
  data_referencia?: string;
  bancos_ativos?: string;
  created_at?: string;
  updated_at?: string;
  custos_reais?: Record<number, { quantidade: number; preco_unitario: number }>;
}

export interface Insumo {
  id_insumo: number;
  id?: number; // For compatibility with older code
  base: string;
  codigo: string;
  descricao: string;
  unidade: string;
  tipo: string;
  preco_unitario?: number;
  estado?: string;
  uf?: string; // For compatibility with older code
  tipo_desoneracao?: string;
  data_referencia?: string;
  valor_desonerado?: number;
  valor_nao_desonerado?: number; // For compatibility with older code
}

export interface Composicao {
  id_composicao: number;
  id?: number; // For compatibility with older code
  codigo_composicao: string;
  codigo?: string; // For compatibility with older code
  descricao: string;
  unidade: string;
  base?: string; // For compatibility with older code
  tipo?: string; // For compatibility with older code
  data_referencia?: string; // For compatibility with older code
  uf?: string; // For compatibility with older code
  valor_desonerado?: number;
  valor_nao_desonerado?: number; // For compatibility with older code
  estado?: string;
  categoria?: string;
}

export interface OrcamentoItem {
  id: string | number;
  obra_id?: string | number;
  etapa_id?: number;
  etapa_pai_id?: number | null;
  item_id?: number;
  item: string;
  tipo: 'etapa' | 'composicao' | 'insumo';
  base?: string;
  codigo?: string;
  descricao: string;
  unidade?: string;
  quantidade: number;
  valor_unitario: number;
  valor_bdi: number;
  total: number;
  categoria?: string;
  isEtapa?: boolean;
  manual_price?: number;
  ordem?: number;
}

export interface DiarioObra {
  id?: number | string;
  obra_id?: string | number;
  data: string;
  numero_rdo?: string;
  clima_manha?: string;
  clima_tarde?: string;
  temperatura_max?: number;
  temperatura_min?: number;
  chuva_mm?: number;
  efetivo?: any;
  efetivo_total?: number;
  equipamentos?: any;
  atividades?: string;
  materiais_recebidos?: any;
  visitas?: any;
  ocorrencias?: string;
  acidentes?: string;
  restricoes?: string;
  observacoes_gerais?: string;
  responsavel_registro?: string;
  fotos_urls?: any;
  usuario_responsavel?: string;
  created_at?: string;
  
  // legacy
  texto?: string;
  relato?: string;
  clima?: string;
  mao_de_obra?: string;
}

export interface DashboardMetrics {
  totalObras: number;
  totalInsumos: number;
  totalOrcado: number;
  totalMedido: number;
  progressoMedio: number;
  obrasAndamento: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  obrasRecentes: Obra[];
  cronogramasAtivos: any[];
  ultimasMedicoes: any[];
  ultimosDiarios: any[];
}
