import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Usuario, CteData, MetaData, DatasConfig, TabView } from '../types';
import { formatCurrency, formatNumber, calculateProjection, parseDate, parseInputDate } from '../utils/helpers';
import Card, { CardStatus } from './Card';
import DetailTable from './DetailTable';
import ManagerialTable from './ManagerialTable';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  CheckCircle2, 
  FileText, 
  AlertTriangle,
  LogOut,
  MapPin,
  ExternalLink,
  Warehouse,
  Search,
  X,
  ArrowLeft,
  Calendar,
  Home,
  Filter
} from 'lucide-react';

interface DashboardProps {
  user: Usuario;
  data: {
    base: CteData[];
    meta: MetaData[];
    datas: DatasConfig;
  };
  onLogout: () => void;
}

// Chart sorting options
type ChartSortOption = 'FATURAMENTO' | 'PROJECAO' | 'META_PCT';

const Dashboard: React.FC<DashboardProps> = ({ user, data, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabView>(TabView.NONE);
  const [activeFilter, setActiveFilter] = useState<string>('TODOS');
  
  // Date Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Chart Sorting State
  const [chartSort, setChartSort] = useState<ChartSortOption>('PROJECAO');

  // Initialize dates from config if available, or default to current month
  useEffect(() => {
    if (data.datas && (!startDate || !endDate)) {
        // Convert dd/mm/yyyy to yyyy-mm-dd for input type="date"
        const formatDateForInput = (dateStr: string) => {
            const dateObj = parseDate(dateStr);
            if (!dateObj) return '';
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        if (data.datas.dataInicial) setStartDate(formatDateForInput(data.datas.dataInicial));
        if (data.datas.dataFinal) setEndDate(formatDateForInput(data.datas.dataFinal));
    }
  }, [data.datas, startDate, endDate]);
  
  // State for Global/Managerial View vs Unit View
  const [selectedUnit, setSelectedUnit] = useState<string>(user.unidade || '');
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Is the user a "Global" user (no assigned unit)?
  const isGlobalUser = !user.unidade;
  
  // Are we currently viewing the Managerial Overview?
  const isManagerialView = isGlobalUser && !selectedUnit;

  // Calculate the most recent date in the base data (Column C)
  const lastEmissionDate = useMemo(() => {
    if (!data.base || data.base.length === 0) return null;
    
    let maxTs = 0;
    let maxStr = '';
    
    data.base.forEach(d => {
        const dateObj = parseDate(d.data);
        if (dateObj) {
            const ts = dateObj.getTime();
            if (ts > maxTs) {
                maxTs = ts;
                maxStr = d.data;
            }
        }
    });
    return maxStr;
  }, [data.base]);

  // Extract all unique units for the search autocomplete
  const allUnits = useMemo(() => {
    const units = new Set<string>();
    data.base.forEach(d => {
        if(d.coleta) units.add(d.coleta);
        if(d.entrega) units.add(d.entrega);
    });
    return Array.from(units).sort();
  }, [data.base]);

  // Filter units based on search term
  const filteredUnitsSuggestion = useMemo(() => {
    if (!searchTerm) return [];
    return allUnits.filter(u => u.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, allUnits]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredData = useMemo(() => {
    let baseData = data.base;

    // Apply Date Filter
    if (startDate && endDate) {
        const start = parseInputDate(startDate);
        const end = parseInputDate(endDate);

        if (start && end) {
             // Set end to end of day
             end.setHours(23, 59, 59, 999);
             
             baseData = baseData.filter(d => {
                const dDate = parseDate(d.data);
                if (!dDate) return false;
                return dDate >= start && dDate <= end;
            });
        }
    }
    
    return baseData; 
  }, [data.base, startDate, endDate]);

  const metrics = useMemo(() => {
    const unitContext = selectedUnit; 
    const isGlobalContext = !unitContext;

    // VENDAS (Based on COLETA)
    const vendasData = filteredData.filter(d => isGlobalContext || d.coleta === unitContext);
    const vendasTotal = vendasData.reduce((acc, curr) => acc + curr.valorCte, 0);

    // PROJECTION - Pass Filter Dates
    const projectedTotal = calculateProjection(vendasTotal, data.datas, startDate, endDate);
    const metaValue = isGlobalContext 
        ? data.meta.reduce((acc, m) => acc + m.meta, 0) 
        : (data.meta.find(m => m.agencia === unitContext)?.meta || 0);
    
    // BAIXAS (Based on ENTREGA)
    const baixasData = filteredData.filter(d => isGlobalContext || d.entrega === unitContext);
    const baixasNoPrazo = baixasData.filter(d => d.statusPrazo === 'NO PRAZO').length;
    const baixasForaPrazo = baixasData.filter(d => d.statusPrazo === 'FORA DO PRAZO').length;
    const baixasSemBaixa = baixasData.filter(d => d.statusPrazo === 'SEM BAIXA').length;
    const baixasTotal = baixasData.length;

    // MANIFESTOS (Based on COLETA)
    const manifestosData = filteredData.filter(d => isGlobalContext || d.coleta === unitContext);
    const manifestosCom = manifestosData.filter(d => d.statusMdfe === 'COM MDFE').length;
    const manifestosSem = manifestosData.filter(d => d.statusMdfe === 'SEM MDFE').length;

    return {
      vendasTotal,
      projectedTotal,
      metaValue,
      baixasData,
      manifestosData,
      vendasData,
      baixasStats: { noPrazo: baixasNoPrazo, foraPrazo: baixasForaPrazo, semBaixa: baixasSemBaixa, total: baixasTotal },
      manifestosStats: { com: manifestosCom, sem: manifestosSem, total: manifestosCom + manifestosSem }
    };
  }, [filteredData, selectedUnit, data.meta, data.datas, startDate, endDate]);

  // Data for the Chart (Global View Only)
  const chartData = useMemo(() => {
    if (!isManagerialView) return [];
    
    // Create list of units from Meta to ensure we cover targets
    const units = data.meta.map(m => m.agencia);
    // Also add units from filtered data if they have sales but no meta (edge case)
    filteredData.forEach(d => { if(d.coleta && !units.includes(d.coleta)) units.push(d.coleta); });

    const chartItems = units.map(unit => {
        const vendasUnit = filteredData.filter(d => d.coleta === unit).reduce((acc, curr) => acc + curr.valorCte, 0);
        const projecao = calculateProjection(vendasUnit, data.datas, startDate, endDate);
        const meta = data.meta.find(m => m.agencia === unit)?.meta || 0;
        
        // Filter out units with 0 meta and 0 projection to keep chart clean
        if (meta === 0 && projecao === 0) return null;

        return {
            name: unit.replace('DEC - ', ''), // Shorten name for chart
            fullName: unit,
            Vendas: vendasUnit, // Realized Revenue
            Projeção: projecao,
            Meta: meta,
            pct: meta > 0 ? (projecao / meta) * 100 : 0
        };
    }).filter(item => item !== null);

    // Dynamic Sorting
    chartItems.sort((a, b) => {
        if (!a || !b) return 0;
        if (chartSort === 'FATURAMENTO') return b.Vendas - a.Vendas;
        if (chartSort === 'META_PCT') return b.pct - a.pct;
        // Default: Projeção
        return b.Projeção - a.Projeção;
    });

    return chartItems.slice(0, 20); // Top 20
  }, [isManagerialView, filteredData, data.meta, data.datas, startDate, endDate, chartSort]);

  const handleLogout = () => {
    onLogout();
  };

  const getTableData = () => {
    switch (activeTab) {
      case TabView.VENDAS: return metrics.vendasData;
      case TabView.BAIXAS: return metrics.baixasData;
      case TabView.MANIFESTOS: return metrics.manifestosData;
      default: return [];
    }
  };

  const handleFilterClick = (tab: TabView, filter: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab(tab);
    setActiveFilter(filter);
  };

  // Logic to handle main card click - Reset filter to TODOS
  const handleMainCardClick = (tab: TabView) => {
    if (activeTab === tab) {
        // Toggle off if already active
        setActiveTab(TabView.NONE);
        setActiveFilter('TODOS');
    } else {
        // Activate and Reset Filter
        setActiveTab(tab);
        setActiveFilter('TODOS');
    }
  };

  const calculatePercentage = (val: number, total: number) => {
    if (!total) return '0.0';
    return ((val / total) * 100).toFixed(1);
  };

  const selectUnit = (unit: string) => {
    setSelectedUnit(unit);
    setSearchTerm('');
    setShowSuggestions(false);
    setActiveTab(TabView.NONE);
    setActiveFilter('TODOS');
  };

  const clearSelection = () => {
      setSelectedUnit('');
      setSearchTerm('');
      setActiveTab(TabView.NONE);
      setActiveFilter('TODOS');
  };

  // Click handler for Home Icon
  const handleHomeClick = () => {
    if (isGlobalUser) {
        clearSelection();
    }
  };

  // Updated Color Logic (Green >= 100, Yellow >= 95, Red < 95)
  const getProjectionColorClass = (current: number, target: number) => {
      if (target === 0) return 'text-[#0F103A]';
      const pct = (current / target) * 100;
      if (pct >= 100) return 'text-[#059669]'; // Emerald-600
      if (pct >= 95) return 'text-[#D97706]'; // Amber-600
      return 'text-[#DC2626]'; // Red-600
  };
  
  const getProjectionBgClass = (current: number, target: number) => {
    if (target === 0) return 'bg-[#4649CF]';
    const pct = (current / target) * 100;
    if (pct >= 100) return 'bg-[#059669]'; // Emerald-600
    if (pct >= 95) return 'bg-[#D97706]'; // Amber-600
    return 'bg-[#DC2626]'; // Red-600
  };

  // Chart Base Colors (used for fills)
  const getChartBaseColor = (pct: number) => {
      if (pct >= 100) return '#059669'; // Green
      if (pct >= 95) return '#D97706'; // Yellow/Amber
      return '#DC2626'; // Red
  };

  // Calculate percentage of realized sales vs meta
  const salesPct = metrics.metaValue > 0 ? (metrics.vendasTotal / metrics.metaValue) * 100 : 0;
  
  // Use Projection performance to determine color for Vendas bar
  const vendasColorClass = getProjectionColorClass(metrics.projectedTotal, metrics.metaValue);
  const vendasBgClass = getProjectionBgClass(metrics.projectedTotal, metrics.metaValue);

  // --- CARD STATUS LOGIC ---
  const getVendasStatus = (): CardStatus => {
     if (metrics.metaValue === 0) return 'positive'; // Default to positive if no meta (neutral was blue)
     const pct = (metrics.projectedTotal / metrics.metaValue) * 100;
     if (pct >= 100) return 'positive';
     if (pct >= 95) return 'warning';
     return 'negative';
  };

  const getBaixasStatus = (): CardStatus => {
      const total = metrics.baixasStats.total;
      if (total === 0) return 'positive'; // Default to positive
      
      const noPrazoPct = (metrics.baixasStats.noPrazo / total) * 100;
      const semBaixaPct = (metrics.baixasStats.semBaixa / total) * 100;
      const foraPrazoPct = (metrics.baixasStats.foraPrazo / total) * 100;

      // If "Sem Baixa" is dominant (e.g., > 50%), use Warning (Yellow)
      if (foraPrazoPct >= 5) return 'negative'; // Critical issues take precedence
      if (semBaixaPct >= 50) return 'warning'; // High pending volume = Yellow
      if (noPrazoPct >= 90) return 'positive'; // Good performance
      if (semBaixaPct > 20) return 'warning'; // Moderate pending
      
      return 'positive'; // Default fallback (was neutral) - Consider "OK" state as Green
  };

  const getManifestosStatus = (): CardStatus => {
      const total = metrics.manifestosStats.total;
      if (total === 0) return 'positive'; // Default to positive
      
      const semMdfePct = (metrics.manifestosStats.sem / total) * 100;
      if (semMdfePct === 0) return 'positive';
      if (semMdfePct <= 5) return 'warning';
      return 'negative';
  };

  return (
    <div className="min-h-screen bg-[#F2F2F8] pb-12 overflow-x-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          
          {/* LEFT: Logo/Home + Title + Subtitle */}
          <div className="flex items-center gap-3 md:gap-4 w-full xl:w-auto overflow-hidden">
             
             {/* Home Icon / Reset Button */}
             <div 
                onClick={handleHomeClick}
                className={`bg-[#1A1B62] p-2.5 rounded-xl shrink-0 transition-transform ${isGlobalUser ? 'cursor-pointer hover:scale-105 active:scale-95 shadow-md hover:shadow-lg' : ''}`}
                title={isGlobalUser ? "Voltar para Visão Geral" : "Painel"}
             >
                {isGlobalUser && selectedUnit ? (
                    <ArrowLeft className="text-white" size={24} />
                ) : (
                    <Warehouse className="text-white" size={24} />
                )}
             </div>

             {/* Title Block */}
             <div className="flex flex-col min-w-0 justify-center">
                {/* Main Title (Unit Name) */}
                <h1 className="text-lg md:text-xl font-bold text-[#0F103A] leading-tight truncate flex items-center gap-2">
                    {selectedUnit || "Visão Geral"}
                    {!selectedUnit && <span className="text-sm font-normal text-gray-400 hidden sm:inline">(Todas Unidades)</span>}
                </h1>
                
                {/* Subtitle (Date Info) */}
                {lastEmissionDate && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></div>
                        <span className="text-xs text-gray-500 font-medium truncate">
                            Dados até: <strong className="text-[#0F103A]">{lastEmissionDate}</strong>
                        </span>
                    </div>
                )}
             </div>
          </div>
          
          {/* RIGHT: Controls (Filters, Search, Buttons) */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
             
             {/* Date Filters */}
             <div className="flex items-center gap-2 bg-[#F2F2F8] p-1.5 rounded-lg border border-transparent focus-within:bg-white focus-within:border-[#9798E4] transition-colors order-2 md:order-1">
                <div className="flex items-center px-1 text-[#4649CF]">
                    <Calendar size={16} />
                </div>
                <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent border-none text-xs font-medium text-[#0F103A] outline-none focus:ring-0 w-24 sm:w-28"
                />
                <span className="text-gray-400 text-xs">até</span>
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent border-none text-xs font-medium text-[#0F103A] outline-none focus:ring-0 w-24 sm:w-28"
                />
             </div>

             {/* Search Bar for Global Users */}
             {isGlobalUser && (
                 <div ref={searchRef} className="relative w-full md:w-60 z-40 order-3 md:order-2">
                     <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Buscar unidade..." 
                            value={searchTerm}
                            onFocus={() => setShowSuggestions(true)}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setShowSuggestions(true);
                            }}
                            className="w-full pl-9 pr-8 py-2 bg-[#F2F2F8] border border-transparent focus:bg-white focus:border-[#9798E4] rounded-lg text-sm text-[#0F103A] outline-none transition-all shadow-sm"
                        />
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                        {searchTerm && (
                             <button 
                                onClick={() => { setSearchTerm(''); setShowSuggestions(false); }}
                                className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                             >
                                 <X size={16} />
                             </button>
                        )}
                     </div>
                     {/* Autocomplete Dropdown */}
                     {showSuggestions && searchTerm && (
                         <div className="absolute top-full left-0 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 max-h-60 overflow-y-auto">
                             {filteredUnitsSuggestion.length > 0 ? (
                                 filteredUnitsSuggestion.map(unit => (
                                     <div 
                                        key={unit}
                                        onClick={() => selectUnit(unit)}
                                        className="px-4 py-2 hover:bg-[#F2F2F8] cursor-pointer text-sm text-[#0F103A] flex items-center"
                                     >
                                        <Warehouse size={14} className="mr-2 text-gray-400" />
                                        {unit}
                                     </div>
                                 ))
                             ) : (
                                 <div className="px-4 py-3 text-sm text-gray-500 text-center">Nenhuma unidade encontrada</div>
                             )}
                         </div>
                     )}
                 </div>
             )}

             {/* Action Buttons */}
             <div className="flex gap-2 justify-between md:justify-start order-1 md:order-3">
                <a 
                    href="https://pendencias-sle.vercel.app/#/login" 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex-1 md:flex-none justify-center md:justify-start flex items-center gap-2 bg-[#FEEFEF] hover:bg-[#FCD7D9] text-[#EC1B23] px-3 py-2 rounded-lg text-xs font-bold transition-colors border border-red-100 whitespace-nowrap shadow-sm"
                >
                    <AlertTriangle size={14} />
                    <span>PENDÊNCIAS</span>
                    <ExternalLink size={12} className="opacity-50" />
                </a>
                
                <button 
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 bg-[#1A1B62] hover:bg-[#24268B] text-white px-3 py-2 rounded-lg transition-all shadow-sm active:scale-95"
                    title="Sair do sistema"
                >
                    <LogOut size={16} />
                    <span className="text-xs font-bold hidden sm:inline">SAIR</span>
                </button>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          
          {/* Vendas */}
          <Card 
            title="Vendas" 
            value={formatCurrency(metrics.vendasTotal)}
            subtitle="Acumulado Período"
            icon={<DollarSign size={24} />}
            isActive={activeTab === TabView.VENDAS}
            onClick={() => handleMainCardClick(TabView.VENDAS)}
            status={getVendasStatus()}
            tooltip="Soma total do valor de todos os CTEs emitidos no período selecionado, com base na data de emissão."
          >
             {/* Progress of Realized vs Meta */}
             <div className="mt-3">
                 <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-500">Realizado</span>
                    <span className={`font-bold ${vendasColorClass}`}>
                        {salesPct.toFixed(1)}%
                    </span>
                 </div>
                 <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                        className={`h-1.5 rounded-full transition-all duration-500 ${vendasBgClass}`}
                        style={{ width: `${Math.min(salesPct, 100)}%` }}
                    />
                 </div>
                 <div className="mt-2 text-[10px] text-gray-400">
                    {isManagerialView ? 'Clique para ver ranking de vendas' : 'Clique para detalhar'}
                 </div>
             </div>
          </Card>

          {/* Vendas Projetadas */}
          <Card 
            title="Projeção x Meta"
            value={formatCurrency(metrics.projectedTotal)}
            subtitle={`Meta: ${formatCurrency(metrics.metaValue)}`}
            icon={<TrendingUp size={24} />}
            // Allow Global users to click here to sort Managerial Table by Projection
            isActive={isManagerialView && activeTab === TabView.VENDAS} // Reuse VENDAS tab state for projection sort
            onClick={() => {
                 if (isManagerialView) handleMainCardClick(TabView.VENDAS);
            }}
            status={getVendasStatus()}
            tooltip="Estimativa de fechamento do mês baseada na média diária de vendas (dias úteis) multiplicada pelos dias úteis totais do mês."
          >
            <div className="mt-3">
                 <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-500">Progresso da Meta</span>
                    <span className={`font-bold ${getProjectionColorClass(metrics.projectedTotal, metrics.metaValue)}`}>
                        {metrics.metaValue > 0 ? ((metrics.projectedTotal / metrics.metaValue) * 100).toFixed(1) : 0}%
                    </span>
                 </div>
                 <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                        className={`h-2 rounded-full transition-all duration-500 ${getProjectionBgClass(metrics.projectedTotal, metrics.metaValue)}`}
                        style={{ width: `${Math.min((metrics.projectedTotal / metrics.metaValue) * 100, 100)}%` }}
                    />
                 </div>
            </div>
          </Card>

          {/* Baixas */}
          <Card 
            title="Baixas" 
            value={`${formatNumber(metrics.baixasStats.total)} Docs`}
            subtitle="Volume Total"
            icon={<CheckCircle2 size={24} />}
            isActive={activeTab === TabView.BAIXAS}
            onClick={() => handleMainCardClick(TabView.BAIXAS)}
            status={getBaixasStatus()}
            tooltip="Monitoramento do status de entrega. O status é calculado com base na 'Data de Baixa' vs 'Prazo Limite'. 'Sem Baixa' indica pendência."
          >
             <div className="mt-4 grid grid-cols-3 gap-2">
                 {/* No Prazo */}
                 <div 
                    onClick={(e) => handleFilterClick(TabView.BAIXAS, 'NO PRAZO', e)}
                    className={`cursor-pointer rounded-lg p-2 border transition-colors flex flex-col items-center text-center
                        ${activeTab === TabView.BAIXAS && activeFilter === 'NO PRAZO' ? 'bg-emerald-200 border-emerald-300 ring-1 ring-emerald-400' : 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100'}
                    `}
                 >
                     <span className="text-[10px] font-bold text-emerald-700 uppercase leading-tight">No Prazo</span>
                     <span className="text-lg font-bold text-emerald-800 mt-1">{metrics.baixasStats.noPrazo}</span>
                     <span className="text-[10px] text-emerald-600">{calculatePercentage(metrics.baixasStats.noPrazo, metrics.baixasStats.total)}%</span>
                 </div>

                 {/* Fora do Prazo */}
                 <div 
                    onClick={(e) => handleFilterClick(TabView.BAIXAS, 'FORA DO PRAZO', e)}
                    className={`cursor-pointer rounded-lg p-2 border transition-colors flex flex-col items-center text-center
                        ${activeTab === TabView.BAIXAS && activeFilter === 'FORA DO PRAZO' ? 'bg-red-200 border-red-300 ring-1 ring-red-400' : 'bg-red-50 border-red-100 hover:bg-red-100'}
                    `}
                 >
                     <span className="text-[10px] font-bold text-red-700 uppercase leading-tight">Fora Prazo</span>
                     <span className="text-lg font-bold text-red-800 mt-1">{metrics.baixasStats.foraPrazo}</span>
                     <span className="text-[10px] text-red-600">{calculatePercentage(metrics.baixasStats.foraPrazo, metrics.baixasStats.total)}%</span>
                 </div>

                 {/* Sem Baixa */}
                 <div 
                    onClick={(e) => handleFilterClick(TabView.BAIXAS, 'SEM BAIXA', e)}
                    className={`cursor-pointer rounded-lg p-2 border transition-colors flex flex-col items-center text-center
                        ${activeTab === TabView.BAIXAS && activeFilter === 'SEM BAIXA' ? 'bg-amber-200 border-amber-300 ring-1 ring-amber-400' : 'bg-amber-50 border-amber-100 hover:bg-amber-100'}
                    `}
                 >
                     <span className="text-[10px] font-bold text-amber-700 uppercase leading-tight">Sem Baixa</span>
                     <span className="text-lg font-bold text-amber-800 mt-1">{metrics.baixasStats.semBaixa}</span>
                     <span className="text-[10px] text-amber-600">{calculatePercentage(metrics.baixasStats.semBaixa, metrics.baixasStats.total)}%</span>
                 </div>
             </div>
          </Card>

          {/* Manifestos */}
          <Card 
            title="Manifestos" 
            value={`${formatNumber(metrics.manifestosStats.total)} Docs`}
            subtitle="Controle de MDFE"
            icon={<FileText size={24} />}
            isActive={activeTab === TabView.MANIFESTOS}
            onClick={() => handleMainCardClick(TabView.MANIFESTOS)}
            status={getManifestosStatus()}
            tooltip="Conformidade de emissão de MDFE (Manifesto Eletrônico). Documentos 'Sem MDFE' indicam pendência fiscal/operacional."
          >
             <div className="mt-4 grid grid-cols-2 gap-2">
                 {/* Com MDFE */}
                 <div 
                    onClick={(e) => handleFilterClick(TabView.MANIFESTOS, 'COM MDFE', e)}
                    className={`cursor-pointer rounded-lg p-2 border transition-colors flex flex-col items-center text-center
                        ${activeTab === TabView.MANIFESTOS && activeFilter === 'COM MDFE' ? 'bg-emerald-200 border-emerald-300 ring-1 ring-emerald-400' : 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100'}
                    `}
                 >
                     <span className="text-[10px] font-bold text-emerald-700 uppercase leading-tight">Com MDFE</span>
                     <span className="text-lg font-bold text-emerald-800 mt-1">{metrics.manifestosStats.com}</span>
                     <span className="text-[10px] text-emerald-600">{calculatePercentage(metrics.manifestosStats.com, metrics.manifestosStats.total)}%</span>
                 </div>

                 {/* Sem MDFE */}
                 <div 
                    onClick={(e) => handleFilterClick(TabView.MANIFESTOS, 'SEM MDFE', e)}
                    className={`cursor-pointer rounded-lg p-2 border transition-colors flex flex-col items-center text-center
                        ${activeTab === TabView.MANIFESTOS && activeFilter === 'SEM MDFE' ? 'bg-red-200 border-red-300 ring-1 ring-red-400' : 'bg-red-50 border-red-100 hover:bg-red-100'}
                    `}
                 >
                     <span className="text-[10px] font-bold text-red-700 uppercase leading-tight">Sem MDFE</span>
                     <span className="text-lg font-bold text-red-800 mt-1">{metrics.manifestosStats.sem}</span>
                     <span className="text-[10px] text-red-600">{calculatePercentage(metrics.manifestosStats.sem, metrics.manifestosStats.total)}%</span>
                 </div>
             </div>
          </Card>
        </div>

        {/* Global View Chart */}
        {isManagerialView && activeTab === TabView.NONE && (chartData as any[]).length > 0 && (
            <div className="mt-6 bg-white p-5 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-[#0F103A]">Performance Geral: Projeção vs Meta</h3>
                        <p className="text-xs text-gray-500">Acompanhamento de vendas e projeção por unidade</p>
                    </div>

                    {/* Chart Sort Filter */}
                    <div className="relative">
                        <select 
                            value={chartSort}
                            onChange={(e) => setChartSort(e.target.value as ChartSortOption)}
                            className="pl-8 pr-4 py-2 bg-white border border-indigo-100 rounded-lg text-sm font-medium text-[#4649CF] focus:outline-none focus:border-[#4649CF] focus:ring-1 focus:ring-[#4649CF] appearance-none cursor-pointer shadow-sm transition-all"
                        >
                            <option value="FATURAMENTO">Maior Faturamento Atual</option>
                            <option value="PROJECAO">Maior Projeção</option>
                            <option value="META_PCT">Maior Atingimento (%)</option>
                        </select>
                        <Filter className="absolute left-2.5 top-2.5 text-[#4649CF]" size={14} />
                    </div>
                </div>

                {/* Vertical Chart Container - Needs more height for vertical bars */}
                <div className="h-[600px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={chartData as any[]}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            barGap={-20} // Negative gap to make bars overlap (Meta behind Projection)
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                                type="number" 
                                tick={{fontSize: 10, fill: '#707082'}} 
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `R$ ${(value/1000).toFixed(0)}k`}
                            />
                            <YAxis 
                                type="category" 
                                dataKey="name" 
                                tick={{fontSize: 10, fill: '#0F103A', fontWeight: 500}} 
                                width={150} // Increased width to fit long names
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip 
                                cursor={{fill: 'transparent'}}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        // Payload contains data for all bars. Source data in payload[0].payload
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg text-xs z-50">
                                                <p className="font-bold text-[#0F103A] mb-2 text-sm">{data.fullName}</p>
                                                <div className="flex justify-between gap-6 mb-1">
                                                    <span className="text-gray-500">Realizado:</span>
                                                    <span className={`font-medium ${getProjectionColorClass(data.Vendas, data.Meta)}`}>{formatCurrency(data.Vendas)}</span>
                                                </div>
                                                <div className="flex justify-between gap-6 mb-1">
                                                    <span className="text-gray-500">Projeção:</span>
                                                    <span className={`font-medium ${getProjectionColorClass(data.Projeção, data.Meta)}`}>{formatCurrency(data.Projeção)}</span>
                                                </div>
                                                <div className="flex justify-between gap-6 mb-2">
                                                    <span className="text-gray-500">Meta:</span>
                                                    <span className="font-medium text-[#0F103A]">{formatCurrency(data.Meta)}</span>
                                                </div>
                                                <div className="flex justify-between gap-6 pt-2 border-t border-gray-100">
                                                    <span className="text-gray-500">Atingimento:</span>
                                                    <span className={`font-bold ${getProjectionColorClass(data.Projeção, data.Meta)}`}>
                                                        {data.pct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            {/* Layer 1: Meta Bar (Background/Shadow - Grey) */}
                            <Bar 
                                dataKey="Meta" 
                                barSize={20} 
                                radius={[0, 4, 4, 0]} 
                                fill="#E2E8F0" 
                                animationDuration={0}
                            />
                            
                            {/* Layer 2: Projection Bar (Middle - Dynamic Color with Opacity) */}
                            <Bar 
                                dataKey="Projeção" 
                                barSize={20} 
                                radius={[0, 4, 4, 0]}
                                fillOpacity={0.4}
                            >
                                {(chartData as any[]).map((entry, index) => (
                                    <Cell key={`cell-proj-${index}`} fill={getChartBaseColor(entry.pct)} />
                                ))}
                            </Bar>

                            {/* Layer 3: Vendas Bar (Front - Dynamic Color Solid) */}
                             <Bar 
                                dataKey="Vendas" 
                                barSize={20} 
                                radius={[0, 4, 4, 0]}
                            >
                                {(chartData as any[]).map((entry, index) => (
                                    <Cell key={`cell-vendas-${index}`} fill={getChartBaseColor(entry.pct)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* Dynamic Content Section */}
        {activeTab !== TabView.NONE && (
            isManagerialView ? (
                <ManagerialTable 
                    data={filteredData} // Pass filtered data here
                    meta={data.meta}
                    datas={data.datas}
                    activeTab={activeTab}
                    activeFilter={activeFilter}
                    onSelectUnit={(unit) => selectUnit(unit)}
                    onFilterChange={(newFilter) => setActiveFilter(newFilter)}
                    startDate={startDate}
                    endDate={endDate}
                />
            ) : (
                <DetailTable 
                    data={getTableData()} 
                    type={activeTab} 
                    unitFilter={selectedUnit}
                    initialFilter={activeFilter}
                />
            )
        )}

      </main>
    </div>
  );
};

export default Dashboard;