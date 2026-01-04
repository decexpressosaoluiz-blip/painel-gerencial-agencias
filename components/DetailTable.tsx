import React, { useMemo, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { CteData, TabView } from '../types';
import { parseDate } from '../utils/helpers';
import { Download, Filter, ArrowUpDown, ArrowUp, ArrowDown, MapPin, Calendar, Clock, FileText, ChevronRight } from 'lucide-react';

interface DetailTableProps {
  data: CteData[];
  type: TabView;
  unitFilter: string; // If empty, all units
  initialFilter?: string; // Prop to control filter from parent
}

const DetailTable: React.FC<DetailTableProps> = ({ data, type, unitFilter, initialFilter }) => {
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  
  // Sync prop changes to state
  useEffect(() => {
    if (initialFilter) {
      setStatusFilter(initialFilter);
    }
  }, [initialFilter]);

  // Sorting state
  const [sortField, setSortField] = useState<keyof CteData | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Logic to filter and sort data based on the Active Card (Type)
  const processedData = useMemo(() => {
    let filtered = [...data];

    // 1. Filter by logic defined in prompt
    if (type === TabView.BAIXAS) {
       // Filter by Status Dropdown if active
       if (statusFilter !== 'TODOS') {
         filtered = filtered.filter(d => d.statusPrazo === statusFilter);
       }
    } else if (type === TabView.MANIFESTOS) {
       // Filter by Status Dropdown if active
       if (statusFilter !== 'TODOS') {
         filtered = filtered.filter(d => d.statusMdfe === statusFilter);
       }
    }

    // 2. Default Sorting based on prompt rules (only if no manual sort active)
    if (!sortField) {
        if (type === TabView.VENDAS) {
            filtered.sort((a, b) => {
                const da = parseDate(a.data)?.getTime() || 0;
                const db = parseDate(b.data)?.getTime() || 0;
                return da - db;
            });
        } else if (type === TabView.BAIXAS) {
            const statusPriority: Record<string, number> = {
                'SEM BAIXA': 0,
                'FORA DO PRAZO': 1,
                'NO PRAZO': 2
            };
            filtered.sort((a, b) => {
                const pa = statusPriority[a.statusPrazo] ?? 3;
                const pb = statusPriority[b.statusPrazo] ?? 3;
                if (pa !== pb) return pa - pb;
                
                const da = parseDate(a.data)?.getTime() || 0;
                const db = parseDate(b.data)?.getTime() || 0;
                return da - db;
            });
        } else if (type === TabView.MANIFESTOS) {
             const statusPriority: Record<string, number> = {
                'SEM MDFE': 0,
                'COM MDFE': 1
            };
            filtered.sort((a, b) => {
                const pa = statusPriority[a.statusMdfe] ?? 2;
                const pb = statusPriority[b.statusMdfe] ?? 2;
                if (pa !== pb) return pa - pb;
                
                const da = parseDate(a.data)?.getTime() || 0;
                const db = parseDate(b.data)?.getTime() || 0;
                return da - db;
            });
        }
    } else {
        // User manual sort - Robust for all columns
        filtered.sort((a, b) => {
            const va = a[sortField];
            const vb = b[sortField];
            
            if (va === vb) return 0;
            if (va === null || va === undefined) return 1;
            if (vb === null || vb === undefined) return -1;

            // Handle Dates
            if (sortField.includes('data') || sortField === 'prazoBaixa') {
                 const da = parseDate(va as string)?.getTime() || 0;
                 const db = parseDate(vb as string)?.getTime() || 0;
                 return sortDirection === 'asc' ? da - db : db - da;
            }
            // Handle Numbers
            if (typeof va === 'number' && typeof vb === 'number') {
                return sortDirection === 'asc' ? va - vb : vb - va;
            }
            // Handle Strings
            const sa = String(va).toLowerCase();
            const sb = String(vb).toLowerCase();
            if (sa < sb) return sortDirection === 'asc' ? -1 : 1;
            if (sa > sb) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return filtered;
  }, [data, type, statusFilter, sortField, sortDirection]);

  const handleDownload = () => {
    // Columns to export based on type
    let columnsToExport: string[] = [];
    if (type === TabView.BAIXAS) {
        columnsToExport = ['cte', 'serie', 'data', 'dataBaixa', 'prazoParaBaixaDias', 'prazoBaixa', 'statusPrazo', 'coleta', 'entrega', 'valorCte'];
    } else if (type === TabView.MANIFESTOS) {
        columnsToExport = ['cte', 'serie', 'data', 'coleta', 'entrega', 'statusMdfe', 'valorCte'];
    } else {
        // Default full export
        columnsToExport = Object.keys(data[0] || {});
    }

    const exportData = processedData.map(item => {
        const row: any = {};
        columnsToExport.forEach(key => {
            row[key.toUpperCase()] = (item as any)[key];
        });
        return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, `Relatorio_${type}_${new Date().toISOString().split('T')[0]}.xls`);
  };

  const handleSort = (field: keyof CteData) => {
    if (sortField === field) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
        setSortField(field);
        setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: keyof CteData }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="ml-1 text-gray-400 opacity-50" />;
    return sortDirection === 'asc' ? 
        <ArrowUp size={14} className="ml-1 text-[#4649CF]" /> : 
        <ArrowDown size={14} className="ml-1 text-[#4649CF]" />;
  };

  // Define table headers based on TabView
  const tableHeaders: { key: keyof CteData; label: string }[] = [
    { key: 'cte', label: 'CTE' },
    { key: 'data', label: 'Data' },
  ];

  // Conditional Logic for Coleta Column
  // If we are in Manifestos view AND we have a specific unit selected, hide Coleta (redundant).
  // Otherwise (Global view or Vendas/Baixas), show it.
  const showColeta = !(type === TabView.MANIFESTOS && unitFilter);
  if (showColeta) {
      tableHeaders.push({ key: 'coleta', label: 'Coleta' });
  }

  // Conditional Logic for Middle Columns
  if (type === TabView.BAIXAS) {
    // Replace Entrega with Prazo Baixa for Baixas view
    tableHeaders.push({ key: 'prazoBaixa', label: 'Prazo Limite' });
  } else {
    // Keep Entrega for Vendas and Manifestos
    tableHeaders.push({ key: 'entrega', label: 'Entrega' });
  }

  // Common Value Column
  tableHeaders.push({ key: 'valorCte', label: 'Valor' });

  // Conditional Logic for End Columns
  if (type === TabView.BAIXAS) {
    tableHeaders.push({ key: 'statusPrazo', label: 'Status Prazo' });
    tableHeaders.push({ key: 'dataBaixa', label: 'Data Baixa' });
  }
  if (type === TabView.MANIFESTOS) {
    tableHeaders.push({ key: 'statusMdfe', label: 'Status MDFE' });
    tableHeaders.push({ key: 'numeroMdfe', label: 'Num MDFE' });
  }

  // Define Badge Colors
  const getBadgeClass = (val: string) => {
    const v = val.toUpperCase();
    if (v === 'NO PRAZO' || v === 'COM MDFE') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (v === 'SEM BAIXA') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (v === 'FORA DO PRAZO' || v === 'SEM MDFE') return 'bg-[#FEEFEF] text-[#EC1B23] border-red-200';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6 animate-fade-in w-full flex flex-col">
      {/* Table Header / Filters */}
      <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <h3 className="font-bold text-[#0F103A] text-lg">
          Detalhamento: {type === TabView.VENDAS ? 'Vendas' : type === TabView.BAIXAS ? 'Baixas de CTES' : 'Manifestos'}
        </h3>
        
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            {type === TabView.BAIXAS && (
                <div className="relative shrink-0">
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="pl-8 pr-4 py-2 bg-white border border-indigo-100 rounded-lg text-sm font-medium text-[#4649CF] focus:outline-none focus:border-[#4649CF] focus:ring-1 focus:ring-[#4649CF] appearance-none cursor-pointer shadow-sm transition-all"
                    >
                        <option value="TODOS">Todos Status</option>
                        <option value="NO PRAZO">No Prazo</option>
                        <option value="FORA DO PRAZO">Fora do Prazo</option>
                        <option value="SEM BAIXA">Sem Baixa</option>
                    </select>
                    <Filter className="absolute left-2.5 top-2.5 text-[#4649CF]" size={14} />
                </div>
            )}
            
            {type === TabView.MANIFESTOS && (
                 <div className="relative shrink-0">
                 <select 
                     value={statusFilter}
                     onChange={(e) => setStatusFilter(e.target.value)}
                     className="pl-8 pr-4 py-2 bg-white border border-indigo-100 rounded-lg text-sm font-medium text-[#4649CF] focus:outline-none focus:border-[#4649CF] focus:ring-1 focus:ring-[#4649CF] appearance-none cursor-pointer shadow-sm transition-all"
                 >
                     <option value="TODOS">Todos Status</option>
                     <option value="COM MDFE">Com MDFE</option>
                     <option value="SEM MDFE">Sem MDFE</option>
                 </select>
                 <Filter className="absolute left-2.5 top-2.5 text-[#4649CF]" size={14} />
             </div>
            )}

            <button 
                onClick={handleDownload}
                className="flex items-center gap-2 bg-[#1D6F42] hover:bg-[#165633] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 shrink-0"
                title="Baixar planilha Excel"
            >
                <Download size={16} />
                Exportar .xls
            </button>
        </div>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block w-full overflow-x-auto">
        <table className="w-full text-sm text-left">
            <thead className="bg-[#FCFCFE] text-[#707082] font-medium border-b border-gray-100">
                <tr>
                    {tableHeaders.map(h => (
                        <th 
                            key={h.key} 
                            className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors select-none whitespace-nowrap"
                            onClick={() => handleSort(h.key)}
                        >
                            <div className="flex items-center">
                                {h.label}
                                <SortIcon field={h.key} />
                            </div>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
                {processedData.length > 0 ? (
                    processedData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#FCFCFE] transition-colors">
                            {tableHeaders.map(h => {
                                const val = row[h.key];
                                const isStatus = h.key === 'statusPrazo' || h.key === 'statusMdfe';
                                const isMoney = h.key === 'valorCte';

                                return (
                                    <td key={h.key} className="px-6 py-4 text-[#0F103A] whitespace-nowrap">
                                        {isStatus ? (
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getBadgeClass(val as string)}`}>
                                                {val}
                                            </span>
                                        ) : isMoney ? (
                                            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val as number)
                                        ) : (
                                            val
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={tableHeaders.length} className="px-6 py-12 text-center text-gray-400">
                            Nenhum registro encontrado para este filtro.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="block md:hidden bg-[#F2F2F8]">
          {processedData.length > 0 ? (
              processedData.map((row, idx) => {
                  const status = type === TabView.MANIFESTOS ? row.statusMdfe : row.statusPrazo;
                  const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valorCte);

                  return (
                      <div key={idx} className="bg-white border-b border-gray-100 p-4 first:border-t-0">
                          {/* Row 1: CTE and Value */}
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase font-bold block">CTE / Série {row.serie}</span>
                                <span className="text-sm font-bold text-[#4649CF]">{row.cte}</span>
                              </div>
                              <div className="text-right">
                                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Valor</span>
                                  <span className="text-sm font-bold text-[#0F103A]">{formattedValue}</span>
                              </div>
                          </div>

                          {/* Row 2: Dates and Status */}
                          <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                    <Calendar size={12} className="text-[#9798E4]"/>
                                    <span>Emissão: {row.data}</span>
                                </div>
                          </div>

                          {/* Row 3: Route Info (Context Aware) */}
                          <div className="bg-[#F9F9FD] p-3 rounded-lg border border-gray-50 mb-3">
                                {/* Coleta (Hide if filtered in Manifestos) */}
                                {showColeta && (
                                    <div className="flex items-start gap-2 mb-2">
                                        <MapPin size={14} className="text-[#4649CF] mt-0.5 shrink-0" />
                                        <div>
                                            <span className="text-[10px] text-gray-400 uppercase font-bold block">Origem</span>
                                            <span className="text-xs font-medium text-[#0F103A] break-words">{row.coleta}</span>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Divider if we showed Coleta */}
                                {showColeta && <div className="ml-1.5 border-l border-dashed border-gray-300 h-3 my-1"></div>}

                                {/* Destination or Deadline */}
                                <div className="flex items-start gap-2">
                                    {type === TabView.BAIXAS ? (
                                        <>
                                            <Clock size={14} className="text-[#EC1B23] mt-0.5 shrink-0" />
                                            <div>
                                                <span className="text-[10px] text-gray-400 uppercase font-bold block">Prazo Limite</span>
                                                <span className="text-xs font-medium text-[#0F103A]">{row.prazoBaixa || 'N/A'}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <MapPin size={14} className="text-[#EC1B23] mt-0.5 shrink-0" />
                                            <div>
                                                <span className="text-[10px] text-gray-400 uppercase font-bold block">Destino</span>
                                                <span className="text-xs font-medium text-[#0F103A] break-words">{row.entrega}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                          </div>

                          {/* Row 4: Status Badge and Extra Info */}
                          <div className="flex justify-between items-center mt-2">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${getBadgeClass(status)}`}>
                                    {status}
                                </span>

                                <div className="text-right">
                                    {type === TabView.BAIXAS && row.dataBaixa && (
                                         <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                            <Calendar size={10} />
                                            Baixado: {row.dataBaixa}
                                         </span>
                                    )}
                                    {type === TabView.MANIFESTOS && (
                                        <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                                            <FileText size={10} />
                                            MDFE: {row.numeroMdfe || '-'}
                                        </span>
                                    )}
                                </div>
                          </div>
                      </div>
                  );
              })
          ) : (
              <div className="p-8 text-center text-gray-400 text-sm bg-white">
                  Nenhum registro encontrado.
              </div>
          )}
      </div>

      <div className="px-6 py-4 border-t border-gray-100 text-xs text-gray-500 flex justify-between bg-white md:bg-transparent">
          <span>Total de registros: {processedData.length}</span>
      </div>
    </div>
  );
};

export default DetailTable;