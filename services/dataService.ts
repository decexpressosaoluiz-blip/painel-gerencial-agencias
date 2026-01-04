import Papa from 'papaparse';
import { CteData, DatasConfig, MetaData, Usuario } from '../types';
import { parseCurrency } from '../utils/helpers';

// URLs Específicas para cada Aba
const BASE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRktG6osG27FrV9nhYsMnLcVoRjNmDpfG8lIxEMDhqYabMVvIfw_Kq_IQ8r3b3BM9YgJaSfxRC9cdUI/pub?gid=359294113&single=true&output=csv';
const META_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRktG6osG27FrV9nhYsMnLcVoRjNmDpfG8lIxEMDhqYabMVvIfw_Kq_IQ8r3b3BM9YgJaSfxRC9cdUI/pub?gid=345407316&single=true&output=csv';
const DATAS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRktG6osG27FrV9nhYsMnLcVoRjNmDpfG8lIxEMDhqYabMVvIfw_Kq_IQ8r3b3BM9YgJaSfxRC9cdUI/pub?gid=2142272842&single=true&output=csv';
const USUARIOS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRktG6osG27FrV9nhYsMnLcVoRjNmDpfG8lIxEMDhqYabMVvIfw_Kq_IQ8r3b3BM9YgJaSfxRC9cdUI/pub?gid=8947323&single=true&output=csv';

// Helper to normalize strings for comparisons (remove accents, extra spaces, uppercase)
const normalizeString = (str: string) => {
    if (!str) return '';
    return str.toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/\s+/g, " ")            // Collapse whitespace
        .trim()
        .toUpperCase();
};

// Helper to find key in row object regardless of case or accents
const getKey = (row: any, targetKey: string) => {
  if (!row) return undefined;
  const keys = Object.keys(row);
  const normalizedTarget = normalizeString(targetKey);
  
  const found = keys.find(k => normalizeString(k) === normalizedTarget);
  return found ? row[found] : undefined;
};

// Generic fetcher helper
const fetchCsv = async (url: string): Promise<any[]> => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch CSV from ${url}`);
        const csvText = await response.text();
        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (err) => reject(err)
            });
        });
    } catch (error) {
        console.error("Error fetching CSV:", error);
        return [];
    }
};

export const fetchBaseData = async (): Promise<CteData[]> => {
  try {
    const response = await fetch(BASE_SHEET_URL);
    if (!response.ok) throw new Error('Failed to fetch BASE CSV');
    const csvText = await response.text();
    
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const fields = results.meta.fields || [];

          // Helper to get value by explicit key OR positional index fallback
          const getValue = (row: any, keys: string[], index: number) => {
            // 1. Try explicit keys with robust matching
            for (const k of keys) {
              const val = getKey(row, k);
              if (val !== undefined && val !== null && val !== '') return val;
            }
            // 2. Try index if provided and available
            if (fields[index] && row[fields[index]] !== undefined) {
               return row[fields[index]];
            }
            return '';
          };

          const data: CteData[] = results.data.map((row: any) => ({
            cte: getValue(row, ['CTE'], 0),
            serie: getValue(row, ['SERIE'], 1),
            // Updated keys to include DATA EMISSAO variations
            data: getValue(row, ['DATA EMISSAO', 'DATA_EMISSAO', 'DATA (dd/m/aaaa)', 'DATA (dd/mm/aaaa)', 'DATA', 'Data', 'data'], 2), 
            // Updated keys to include DATA_BAIXA variations
            dataBaixa: getValue(row, ['DATA_BAIXA', 'DATA BAIXA (dd/mm/aaaa)', 'DATA BAIXA', 'Data Baixa', 'data baixa'], 3),
            prazoParaBaixaDias: getValue(row, ['PRAZO PARA BAIXA (DIAS)', 'PRAZO PARA BAIXA'], 4),
            prazoBaixa: getValue(row, ['PRAZO BAIXA'], 5),
            statusPrazo: normalizeString(getValue(row, ['STATUS PRAZO'], 6)),
            coleta: normalizeString(getValue(row, ['COLETA'], 7)),
            entrega: normalizeString(getValue(row, ['ENTREGA'], 8)),
            numeroMdfe: getValue(row, ['NUMERO MDFE'], 9),
            statusMdfe: normalizeString(getValue(row, ['STATUS MDFE'], 10)),
            valorCte: parseCurrency(getValue(row, ['VALOR_CTE', 'VALOR CTE', 'VALOR'], 11) || '0')
          }));
          resolve(data);
        },
        error: (err: Error) => {
            console.error("CSV Parse Error Base", err);
            resolve([]);
        }
      });
    });
  } catch (error) {
    console.error("Could not fetch live base data", error);
    return [];
  }
};

export const fetchUsers = async (): Promise<Usuario[]> => {
  const data = await fetchCsv(USUARIOS_SHEET_URL);
  
  const users: Usuario[] = data.map((row: any) => ({
      usuario: (getKey(row, 'USUARIO') || '').trim(),
      senha: (getKey(row, 'SENHA') || '').toString().trim(),
      // Normalize Unit to match other sources (Uppercased, no accents, trimmed)
      unidade: normalizeString(getKey(row, 'UNIDADE') || '')
  })).filter(u => u.usuario && u.senha);

  // Fallback for critical access if sheet is empty/error
  if (users.length === 0) {
      console.warn("No users found in sheet, returning empty list.");
      return [];
  }
  return users;
};

export const fetchMeta = async (): Promise<MetaData[]> => {
    try {
        const response = await fetch(META_SHEET_URL);
        if (!response.ok) throw new Error('Failed to fetch META CSV');
        const csvText = await response.text();
        
        return new Promise((resolve) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const fields = results.meta.fields || [];
                    
                    const data: MetaData[] = results.data.map((row: any) => {
                        // Try to find Agency Name: Key 'AGENCIA'/'UNIDADE' OR Index 0
                        let agencia = getKey(row, 'AGENCIA') || getKey(row, 'UNIDADE');
                        if ((!agencia) && fields[0]) agencia = row[fields[0]]; // Fallback to col A
                        
                        // Try to find Meta Value: Key 'META' OR Index 1
                        let metaVal = getKey(row, 'META');
                        if ((metaVal === undefined || metaVal === '') && fields[1]) metaVal = row[fields[1]]; // Fallback to col B
                        
                        return {
                            agencia: normalizeString(agencia || ''),
                            meta: parseCurrency(metaVal || '0')
                        };
                    }).filter(m => m.agencia); // Filter out empty rows
                    resolve(data);
                },
                error: (err) => {
                    console.error("CSV Parse Error Meta", err);
                    resolve([]);
                }
            });
        });
    } catch (e) {
        console.error("Failed to fetch meta", e);
        return [];
    }
};

export const fetchDatasConfig = async (): Promise<DatasConfig> => {
  const data = await fetchCsv(DATAS_SHEET_URL);
  
  if (data.length === 0) {
      // Default fallback if sheet is empty
      const today = new Date();
      return {
          dataInicial: `01/${today.getMonth()+1}/${today.getFullYear()}`,
          dataFinal: `30/${today.getMonth()+1}/${today.getFullYear()}`,
          dataAtual: today.toLocaleDateString('pt-BR'),
          feriados: []
      };
  }

  // Row 0 usually contains the single values for Data Inicial, Final, Ontem
  const firstRow = data[0];
  
  const config: DatasConfig = {
      dataInicial: getKey(firstRow, 'DATA INICIAL') || '',
      dataFinal: getKey(firstRow, 'DATA FINAL') || '',
      // Note: Data Atual/Ontem is in column E usually, mapped by header name
      dataAtual: getKey(firstRow, 'DATA ONTEM') || getKey(firstRow, 'DATA ATUAL') || getKey(firstRow, 'DATAATUAL') || '', 
      feriados: []
  };

  // Collect holidays from the FERIADOS column across all rows
  const feriados: string[] = [];
  data.forEach(row => {
      const feriado = getKey(row, 'FERIADOS');
      if (feriado) feriados.push(feriado);
  });
  
  config.feriados = feriados;

  return config;
};