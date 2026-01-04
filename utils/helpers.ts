import { DatasConfig } from '../types';

// Helper to parse "dd/mm/yyyy" or "yyyy-mm-dd" to Date object (Local Time)
export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  let parts: string[] = [];
  
  // Try dd/mm/yyyy
  if (dateStr.includes('/')) {
    parts = dateStr.split('/');
    if (parts.length === 3) {
       // Assuming dd/mm/yyyy
       return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
  } 
  
  // Try yyyy-mm-dd (ISO-like)
  if (dateStr.includes('-')) {
    parts = dateStr.split('-');
    if (parts.length === 3) {
       // Assuming yyyy-mm-dd
       return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }

  return null;
};

// Helper to parse "yyyy-mm-dd" from input[type=date] into a Local Date object set to 00:00:00
export const parseInputDate = (isoStr: string): Date | null => {
    if (!isoStr) return null;
    const parts = isoStr.split('-');
    if (parts.length !== 3) return null;
    // Parts: [yyyy, mm, dd]
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('pt-BR').format(value);
};

export const parseCurrency = (val: string): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  const strVal = val.toString().trim();
  
  // Check if it's already a clean number string (e.g. "1000.50" without commas)
  // Logic: If it has a comma, it's likely PT-BR (decimal separator).
  // If it has ONLY dots and no commas, it might be US format or simple integer.
  
  if (strVal.includes(',')) {
      // Handle Brazilian format 1.000,00 -> 1000.00
      // Remove dots (thousands), Replace comma with dot, Remove everything else
      let clean = strVal.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      return parseFloat(clean) || 0;
  } else {
      // Handle US/Raw format 1000.00 or 1000
      // Just clean non-numeric chars except dot and minus
      let clean = strVal.replace(/[^\d.-]/g, '');
      return parseFloat(clean) || 0;
  }
};

// Calculate Business Days
export const calculateBusinessDays = (start: Date, end: Date, holidays: Date[]): number => {
  let count = 0;
  const curDate = new Date(start.getTime());
  const endDate = new Date(end.getTime());
  // Normalize times to midnight to avoid issues
  curDate.setHours(0,0,0,0);
  endDate.setHours(0,0,0,0);

  const holidayStrings = holidays.map(h => {
      const d = new Date(h.getTime());
      d.setHours(0,0,0,0);
      return d.toDateString();
  });

  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sun, 6 = Sat
      if (!holidayStrings.includes(curDate.toDateString())) {
        count++;
      }
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
};

export const calculateProjection = (
  currentSales: number,
  config: DatasConfig,
  filterStartDate?: string,
  filterEndDate?: string
): number => {
  const startMonth = parseDate(config.dataInicial);
  const endMonth = parseDate(config.dataFinal);
  const current = parseDate(config.dataAtual);
  
  if (!startMonth || !endMonth || !current) return 0;

  const holidays = config.feriados.map(f => parseDate(f)).filter((d): d is Date => d !== null);

  // 1. Calculate Total Business Days in the Month (The Goal Post)
  const totalMonthBusinessDays = calculateBusinessDays(startMonth, endMonth, holidays);

  // 2. Determine the period used to calculate the average sales
  let periodStart = startMonth;
  let periodEnd = current; // Default to DataAtual (Reference Date)

  // If a specific filter is applied, use that range to calculate the average
  if (filterStartDate && filterEndDate) {
      // Use helper to parse input format consistently
      const fStart = parseInputDate(filterStartDate);
      const fEnd = parseInputDate(filterEndDate);

      if (fStart && fEnd) {
          // If we have a parseable start date, use it if it's within logical bounds? 
          // Actually, we trust the filter for the 'start' of the period being analyzed.
          periodStart = fStart;

          // For the end date:
          // If the filter End Date is BEFORE the "Current Reference Date" (Data Ontem), 
          // we use the filter End Date (analyzing a past closed period).
          // If the filter End Date is AFTER the "Current Reference Date", 
          // we cap it at "Current Reference Date" because we don't have sales data for the future days yet.
          periodEnd = fEnd < current ? fEnd : current;
      }
  }

  // Calculate business days in the accumulation period
  const passedBusinessDays = calculateBusinessDays(periodStart, periodEnd, holidays);

  if (passedBusinessDays === 0) return 0;

  const dailyAverage = currentSales / passedBusinessDays;
  return dailyAverage * totalMonthBusinessDays;
};