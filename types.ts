export interface CteData {
  cte: string;
  serie: string;
  data: string; // dd/mm/aaaa
  dataBaixa: string; // dd/mm/aaaa
  prazoParaBaixaDias: string;
  prazoBaixa: string;
  statusPrazo: 'NO PRAZO' | 'FORA DO PRAZO' | 'SEM BAIXA' | string;
  coleta: string; // ORIGEM
  entrega: string; // DESTINO
  numeroMdfe: string;
  statusMdfe: 'COM MDFE' | 'SEM MDFE' | string;
  valorCte: number;
}

export interface MetaData {
  agencia: string;
  meta: number;
}

export interface DatasConfig {
  dataInicial: string;
  dataFinal: string;
  feriados: string[];
  dataAtual: string;
}

export interface Usuario {
  usuario: string;
  senha: string;
  unidade: string; // Can be empty for general access
}

export interface DashboardMetrics {
  vendasTotal: number;
  vendasProjetadas: number;
  baixasTotal: number;
  baixasNoPrazo: number;
  baixasForaPrazo: number;
  baixasSemBaixa: number;
  manifestosTotal: number;
  manifestosComMdfe: number;
  manifestosSemMdfe: number;
}

export enum TabView {
  NONE = 'NONE',
  VENDAS = 'VENDAS',
  BAIXAS = 'BAIXAS',
  MANIFESTOS = 'MANIFESTOS'
}