import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Usuario } from './types';
import { fetchBaseData, fetchDatasConfig, fetchMeta, fetchUsers } from './services/dataService';

export default function App() {
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // App-wide data cache
  const [appData, setAppData] = useState<any>({
    base: [],
    users: [],
    meta: [],
    datas: null
  });

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
        const [users, base, meta, datas] = await Promise.all([
            fetchUsers(),
            fetchBaseData(),
            fetchMeta(),
            fetchDatasConfig()
        ]);
        setAppData({ users, base, meta, datas });
    } catch (e) {
        console.error("Failed to load initial data", e);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleLogout = () => {
    setUser(null);
  };

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F2F2F8]">
            <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-[#4649CF] border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-[#4649CF] font-medium">Carregando painel...</p>
            </div>
        </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route 
          path="/login" 
          element={<Login users={appData.users} onLogin={setUser} />} 
        />
        <Route 
          path="/" 
          element={
            user ? (
              <Dashboard user={user} data={appData} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </HashRouter>
  );
}