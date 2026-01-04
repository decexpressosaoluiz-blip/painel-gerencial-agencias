import React, { useMemo, useState } from 'react';
import { CteData, MetaData, DatasConfig, TabView } from '../types';
import { formatCurrency, formatNumber, calculateProjection } from '../utils/helpers';
import { Filter, ArrowUpDown, ArrowUp, ArrowDown, Warehouse, TrendingUp, AlertTriangle, CheckCircle, FileText, Target, ChevronRight } from 'lucide-react';

interface ManagerialTableProps {
  data: CteData[];
  meta: MetaData[];
  datas: DatasConfig;
  activeTab: TabView;
  activeFilter: string;
  onSelectUnit: (unit: string) => void;
  onFilterChange?: (filter: string) => void;
  startDate?: string;
  endDate?: string;
}

const ManagerialTable: React.FC<ManagerialTableProps> = ({ 
  data, 
  meta, 
  datas, 
  activeTab, 
  activeFilter,
  onSelectUnit,
  onFilterChange,
  startDate,
  endDate
}) => {
  // Sorting State
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const unitStats = useMemo(() => {
    // 1. Identify all unique units (Union of Coleta and Entrega)
    const units = new Set<string>();
    data.forEach(d => {
      if (d.coleta) units.add(d.coleta);
      if (d.entrega) units.add(d.entrega);
    });

    const stats: any[] = [];

    units.forEach(unit => {
      // Vendas & Manifestos based on COLETA
      const vendasDocs = data.filter(d => d.coleta === unit);
      const vendasTotal = vendasDocs.reduce((acc, curr) => acc + curr.valorCte, 0);
      
      // Calculate Projection passing the filter dates
      const projected = calculateProjection(vendasTotal, datas, startDate, endDate);
      
      const metaVal = meta.find(m => m.agencia === unit)?.meta || 0;
      const projectionPct = metaVal > 0 ? (projected / metaVal) * 100 : 0;

      // Manifestos
      const totalManifestos = vendasDocs.length; // Same as sales/coleta docs
      const semMdfe = vendasDocs.filter(d => d.statusMdfe === 'SEM MDFE').length;
      const semMdfePct = totalManifestos > 0 ? (semMdfe / totalManifestos) * 100 : 0;

      // Baixas based on ENTREGA
      const baixasDocs = data.filter(d => d.entrega === unit);
      const totalBaixas = baixasDocs.length;
      
      const noPrazo = baixasDocs.filter(d => d.statusPrazo === 'NO PRAZO').length;
      const noPrazoPct = totalBaixas > 0 ? (noPrazo / totalBaixas) * 100 : 0;
      
      const foraPrazo = baixasDocs.filter(d => d.statusPrazo === 'FORA DO PRAZO').length;
      const foraPrazoPct = totalBaixas > 0 ? (foraPrazo / totalBaixas) * 100 : 0;
      
      const semBaixa = baixasDocs.filter(d => d.statusPrazo === 'SEM BAIXA').length;
      const semBaixaPct = totalBaixas > 0 ? (semBaixa / totalBaixas) * 100 : 0;

      stats.push({
        unit,
        vendasTotal,
        projected,
        metaVal,
        projectionPct,
        semMdfe,
        semMdfePct,
        totalManifestos,
        noPrazo,
        noPrazoPct,
        foraPrazo,
        foraPrazoPct,
        semBaixa,
        semBaixaPct,
        totalBaixas
      });
    });

    // Determine what to sort by
    let sortKey = sortField;
    let direction = sortDirection;

    // Default Sorting if no manual sort active
    if (!sortKey) {
        if (activeTab === TabView.MANIFESTOS) {
             sortKey = 'semMdfePct';
             direction = 'desc'; // Default worst to best (Higher Sem MDFE is bad)
        } else if (activeTab === TabView.BAIXAS) {
            if (activeFilter === 'NO PRAZO') sortKey = 'noPrazoPct';
            else if (activeFilter === 'FORA DO PRAZO') sortKey = 'foraPrazoPct';
            else sortKey = 'semBaixaPct'; // Default risk
            direction = 'desc';
        } else {
            sortKey = 'projectionPct';
            direction = 'desc';
        }
    }

    return stats.sort((a, b) => {
        const valA = a[sortKey!];
        const valB = b[sortKey!];

        if (valA === valB) return 0;
        
        // Handle string sorting (Unit name)
        if (typeof valA === 'string' && typeof valB === 'string') {
             return direction === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        }
        
        // Handle number sorting
        return direction === 'asc' ? valA - valB : valB - valA;
    });

  }, [data, meta, datas, activeTab, activeFilter, sortField, sortDirection, startDate, endDate]);

  const handleSort = (field: string) => {
    if (sortField === field) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
        setSortField(field);
        setSortDirection('desc'); // Default to high-to-low for numbers
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="ml-1 text-gray-400 opacity-50" />;
    return sortDirection === 'asc' ? 
        <ArrowUp size={14} className="ml-1 text-[#4649CF]" /> : 
        <ArrowDown size={14} className="ml-1 text-[#4649CF]" />;
  };

  // --- COLOR CODING LOGIC ---

  // Vendas: >100% Green, 90-99.9% Yellow, <90% Red
  const getProjectionColor = (pct: number) => {
    if (pct >= 100) return 'text-emerald-600';
    if (pct >= 90) return 'text-amber-600';
    return 'text-red-600';
  };

  // Sem Baixa: <5% Green, 5-9.99% Yellow, >10% Red
  const getSemBaixaColor = (pct: number) => {
    if (pct < 5) return 'text-emerald-600';
    if (pct < 10) return 'text-amber-600';
    return 'text-red-600';
  };

  // Manifestos (Pendência/Sem MDFE displayed, but logic based on Success/Com MDFE):
  // User req: Com MDFE > 95% Green => Sem MDFE < 5% Green
  // User req: Com MDFE 90-95% Yellow => Sem MDFE 5-10% Yellow
  // User req: Com MDFE < 90% Red => Sem MDFE > 10% Red
  const getManifestoColor = (pctSemMdfe: number) => {
      if (pctSemMdfe < 5) return 'text-emerald-600';
      if (pctSemMdfe <= 10) return 'text-amber-600';
      return 'text-red-600';
  };

  // Dynamic Columns based on View
  const renderHeaders = () => {
    if (activeTab === TabView.MANIFESTOS) {
      return (
        <>
          <th className="px-6 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-gray-50" onClick={() => handleSort('totalManifestos')}>
              <div className="flex justify-end items-center">Total Docs <SortIcon field="totalManifestos" /></div>
          </th>
          <th className="px-6 py-4 text-right text-red-600 whitespace-nowrap cursor-pointer hover:bg-gray-50" onClick={() => handleSort('semMdfe')}>
              <div className="flex justify-end items-center">Qtd Sem MDFE <SortIcon field="semMdfe" /></div>
          </th>
          <th className="px-6 py-4 text-right text-red-600 whitespace-nowrap cursor-pointer hover:bg-gray-50" onClick={() => handleSort('semMdfePct')}>
              <div className="flex justify-end items-center">% Sem MDFE <SortIcon field="semMdfePct" /></div>
          </th>
        </>
      );
    }
    if (activeTab === TabView.BAIXAS) {
      let label = 'Sem Baixa';
      let sortKeyQtd = 'semBaixa';
      let sortKeyPct = 'semBaixaPct';
      let color = 'text-amber-600';
      
      // If TODOS, default column highlight to Sem Baixa (Highest risk)
      if (activeFilter === 'NO PRAZO') { 
          label = 'No Prazo'; color = 'text-emerald-600'; 
          sortKeyQtd = 'noPrazo'; sortKeyPct = 'noPrazoPct';
      }
      if (activeFilter === 'FORA DO PRAZO') { 
          label = 'Fora Prazo'; color = 'text-red-600'; 
          sortKeyQtd = 'foraPrazo'; sortKeyPct = 'foraPrazoPct';
      }

      return (
        <>
          <th className="px-6 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-gray-50" onClick={() => handleSort('totalBaixas')}>
              <div className="flex justify-end items-center">Total Baixas <SortIcon field="totalBaixas" /></div>
          </th>
          <th className={`px-6 py-4 text-right ${color} whitespace-nowrap cursor-pointer hover:bg-gray-50`} onClick={() => handleSort(sortKeyQtd)}>
              <div className="flex justify-end items-center">Qtd {label} <SortIcon field={sortKeyQtd} /></div>
          </th>
          <th className={`px-6 py-4 text-right ${color} whitespace-nowrap cursor-pointer hover:bg-gray-50`} onClick={() => handleSort(sortKeyPct)}>
              <div className="flex justify-end items-center">% {label} <SortIcon field={sortKeyPct} /></div>
          </th>
        </>
      );
    }
    // Default Vendas/Projeção
    return (
      <>
        <th className="px-6 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-gray-50" onClick={() => handleSort('vendasTotal')}>
            <div className="flex justify-end items-center">Vendas (D-1) <SortIcon field="vendasTotal" /></div>
        </th>
        <th className="px-6 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-gray-50" onClick={() => handleSort('projected')}>
            <div className="flex justify-end items-center">Projeção <SortIcon field="projected" /></div>
        </th>
        <th className="px-6 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-gray-50" onClick={() => handleSort('metaVal')}>
            <div className="flex justify-end items-center">Meta <SortIcon field="metaVal" /></div>
        </th>
        <th className="px-6 py-4 text-right text-[#4649CF] whitespace-nowrap cursor-pointer hover:bg-gray-50" onClick={() => handleSort('projectionPct')}>
            <div className="flex justify-end items-center">% Projeção <SortIcon field="projectionPct" /></div>
        </th>
      </>
    );
  };

  const renderRow = (row: any) => {
    if (activeTab === TabView.MANIFESTOS) {
      return (
        <>
          <td className="px-6 py-4 text-right text-[#0F103A] font-medium">{formatNumber(row.totalManifestos)}</td>
          <td className={`px-6 py-4 text-right font-bold ${getManifestoColor(row.semMdfePct)}`}>{formatNumber(row.semMdfe)}</td>
          <td className={`px-6 py-4 text-right font-bold ${getManifestoColor(row.semMdfePct)}`}>{row.semMdfePct.toFixed(1)}%</td>
        </>
      );
    }
    if (activeTab === TabView.BAIXAS) {
      // Default to Sem Baixa stats if TODOS or Sem Baixa
      let count = row.semBaixa;
      let pct = row.semBaixaPct;
      let colorClass = getSemBaixaColor(row.semBaixaPct); 

      if (activeFilter === 'NO PRAZO') { count = row.noPrazo; pct = row.noPrazoPct; colorClass = 'text-emerald-600'; }
      if (activeFilter === 'FORA DO PRAZO') { count = row.foraPrazo; pct = row.foraPrazoPct; colorClass = 'text-red-600'; }

      return (
        <>
          <td className="px-6 py-4 text-right text-[#0F103A] font-medium">{formatNumber(row.totalBaixas)}</td>
          <td className={`px-6 py-4 text-right font-bold ${colorClass}`}>{formatNumber(count)}</td>
          <td className={`px-6 py-4 text-right font-bold ${colorClass}`}>{pct.toFixed(1)}%</td>
        </>
      );
    }
    // Default Vendas
    return (
      <>
        <td className="px-6 py-4 text-right text-[#0F103A] font-medium">{formatCurrency(row.vendasTotal)}</td>
        <td className="px-6 py-4 text-right text-[#707082]">{formatCurrency(row.projected)}</td>
        <td className="px-6 py-4 text-right text-[#707082]">{formatCurrency(row.metaVal)}</td>
        <td className={`px-6 py-4 text-right font-bold ${getProjectionColor(row.projectionPct)}`}>{row.projectionPct.toFixed(1)}%</td>
      </>
    );
  };

  const getTitle = () => {
    const filterText = activeFilter === 'TODOS' ? 'Geral' : activeFilter;
    if (activeTab === TabView.MANIFESTOS) return `Ranking: Pendência de MDFE (${filterText})`;
    if (activeTab === TabView.BAIXAS) return `Ranking: Baixas (${filterText})`;
    return "Ranking: Projeção de Vendas";
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6 animate-fade-in w-full flex flex-col">
      <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h3 className="font-bold text-[#0F103A] text-lg">{getTitle()}</h3>
            <p className="text-xs text-gray-500 mt-1">Clique na unidade para ver detalhes</p>
        </div>
        
        {/* Dropdown for Managerial View Sorting/Filtering */}
        {(activeTab === TabView.BAIXAS || activeTab === TabView.MANIFESTOS) && onFilterChange && (
            <div className="relative shrink-0 w-full md:w-auto">
                <select 
                    value={activeFilter}
                    onChange={(e) => onFilterChange(e.target.value)}
                    className="w-full md:w-auto pl-8 pr-4 py-2 bg-white border border-indigo-100 rounded-lg text-sm font-medium text-[#4649CF] focus:outline-none focus:border-[#4649CF] focus:ring-1 focus:ring-[#4649CF] appearance-none cursor-pointer shadow-sm transition-all"
                >
                    <option value="TODOS">Todos (Risco)</option>
                    {activeTab === TabView.BAIXAS ? (
                        <>
                            <option value="SEM BAIXA">Sem Baixa</option>
                            <option value="FORA DO PRAZO">Fora do Prazo</option>
                            <option value="NO PRAZO">No Prazo</option>
                        </>
                    ) : (
                        <>
                            <option value="SEM MDFE">Sem MDFE</option>
                            <option value="COM MDFE">Com MDFE</option>
                        </>
                    )}
                </select>
                <Filter className="absolute left-2.5 top-2.5 text-[#4649CF]" size={14} />
            </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block w-full overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[700px]">
          <thead className="bg-[#FCFCFE] text-[#707082] font-medium border-b border-gray-100">
            <tr>
              <th 
                  className="px-6 py-4 w-1/3 whitespace-nowrap cursor-pointer hover:bg-gray-50" 
                  onClick={() => handleSort('unit')}
              >
                  <div className="flex items-center">Unidade <SortIcon field="unit" /></div>
              </th>
              {renderHeaders()}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {unitStats.map((row) => (
              <tr 
                key={row.unit} 
                className="hover:bg-[#F2F2F8] transition-colors cursor-pointer group"
                onClick={() => onSelectUnit(row.unit)}
              >
                <td className="px-6 py-4 font-bold text-[#0F103A] group-hover:text-[#4649CF] whitespace-nowrap">
                  {row.unit}
                </td>
                {renderRow(row)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="block md:hidden bg-[#F2F2F8] p-3 space-y-3">
          {unitStats.length > 0 ? (
              unitStats.map((row) => {
                  if (activeTab === TabView.MANIFESTOS) {
                      return (
                        <div key={row.unit} onClick={() => onSelectUnit(row.unit)} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 relative overflow-hidden active:scale-[0.99] transition-all">
                             <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="bg-indigo-50 p-1.5 rounded-lg shrink-0">
                                        <Warehouse size={16} className="text-[#4649CF]" />
                                    </div>
                                    <span className="text-sm font-bold text-[#0F103A] break-words">{row.unit}</span>
                                </div>
                                <ChevronRight size={16} className="text-gray-300 absolute right-4 top-4" />
                            </div>
                            
                            <div className="mt-4 flex justify-between items-end border-b border-gray-50 pb-3 mb-3">
                                 <span className="text-[10px] text-gray-400 uppercase font-bold">Total Documentos</span>
                                 <span className="text-lg font-bold text-[#0F103A]">{formatNumber(row.totalManifestos)}</span>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                                 <div className="flex items-center gap-2">
                                    <FileText size={14} className={getManifestoColor(row.semMdfePct).replace('text-', 'text-opacity-80 text-')} />
                                    <span className="text-xs font-medium text-gray-600">Sem MDFE</span>
                                 </div>
                                 <div className="text-right">
                                     <span className={`text-sm font-bold block ${getManifestoColor(row.semMdfePct)}`}>{formatNumber(row.semMdfe)}</span>
                                     <span className={`text-[10px] font-bold ${getManifestoColor(row.semMdfePct)}`}>{row.semMdfePct.toFixed(1)}%</span>
                                 </div>
                            </div>
                        </div>
                      );
                  }

                  if (activeTab === TabView.BAIXAS) {
                      let count = row.semBaixa;
                      let pct = row.semBaixaPct;
                      let colorClass = getSemBaixaColor(row.semBaixaPct); 
                      let label = "Sem Baixa";

                      if (activeFilter === 'NO PRAZO') { count = row.noPrazo; pct = row.noPrazoPct; colorClass = 'text-emerald-600'; label = "No Prazo"; }
                      if (activeFilter === 'FORA DO PRAZO') { count = row.foraPrazo; pct = row.foraPrazoPct; colorClass = 'text-red-600'; label = "Fora Prazo"; }

                      return (
                        <div key={row.unit} onClick={() => onSelectUnit(row.unit)} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 relative overflow-hidden active:scale-[0.99] transition-all">
                             <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="bg-indigo-50 p-1.5 rounded-lg shrink-0">
                                        <Warehouse size={16} className="text-[#4649CF]" />
                                    </div>
                                    <span className="text-sm font-bold text-[#0F103A] break-words">{row.unit}</span>
                                </div>
                                <ChevronRight size={16} className="text-gray-300 absolute right-4 top-4" />
                            </div>

                             <div className="mt-4 flex justify-between items-end border-b border-gray-50 pb-3 mb-3">
                                 <span className="text-[10px] text-gray-400 uppercase font-bold">Total Baixas</span>
                                 <span className="text-lg font-bold text-[#0F103A]">{formatNumber(row.totalBaixas)}</span>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                                 <div className="flex items-center gap-2">
                                    {activeFilter === 'NO PRAZO' ? <CheckCircle size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className={colorClass} />}
                                    <span className="text-xs font-medium text-gray-600">{label}</span>
                                 </div>
                                 <div className="text-right">
                                     <span className={`text-sm font-bold block ${colorClass}`}>{formatNumber(count)}</span>
                                     <span className={`text-[10px] font-bold ${colorClass}`}>{pct.toFixed(1)}%</span>
                                 </div>
                            </div>
                        </div>
                      );
                  }

                  // Default Vendas
                  return (
                      <div key={row.unit} onClick={() => onSelectUnit(row.unit)} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 relative overflow-hidden active:scale-[0.99] transition-all">
                          <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="bg-indigo-50 p-1.5 rounded-lg shrink-0">
                                        <Warehouse size={16} className="text-[#4649CF]" />
                                    </div>
                                    <span className="text-sm font-bold text-[#0F103A] break-words">{row.unit}</span>
                                </div>
                                <ChevronRight size={16} className="text-gray-300 absolute right-4 top-4" />
                          </div>
                          
                          <div className="mt-2 text-right border-b border-gray-50 pb-3 mb-3">
                                <span className="text-[10px] text-gray-400 uppercase font-bold block">Vendas (D-1)</span>
                                <span className="text-lg font-bold text-[#0F103A]">{formatCurrency(row.vendasTotal)}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <TrendingUp size={12} className="text-gray-400" />
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Projeção</span>
                                    </div>
                                    <span className="text-xs font-bold text-[#0F103A]">{formatCurrency(row.projected)}</span>
                                </div>
                                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Target size={12} className="text-gray-400" />
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Meta</span>
                                    </div>
                                    <span className="text-xs font-bold text-[#0F103A]">{formatCurrency(row.metaVal)}</span>
                                </div>
                          </div>

                          <div className="mt-3 flex justify-between items-center bg-[#F9F9FD] px-3 py-2 rounded-lg">
                               <span className="text-xs text-gray-500 font-medium">Atingimento da Meta</span>
                               <span className={`text-sm font-bold ${getProjectionColor(row.projectionPct)}`}>{row.projectionPct.toFixed(1)}%</span>
                          </div>
                      </div>
                  );
              })
          ) : (
              <div className="p-8 text-center text-gray-400 text-sm bg-white rounded-xl">
                  Nenhum registro encontrado.
              </div>
          )}
      </div>
    </div>
  );
};

export default ManagerialTable;