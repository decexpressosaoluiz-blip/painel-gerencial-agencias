import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Usuario } from '../types';
import { Truck, Lock, User as UserIcon } from 'lucide-react';

interface LoginProps {
  users: Usuario[];
  onLogin: (user: Usuario) => void;
}

const Login: React.FC<LoginProps> = ({ users, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    const found = users.find(u => 
      u.usuario.toLowerCase() === cleanUser.toLowerCase() && 
      u.senha === cleanPass
    );

    if (found) {
      onLogin(found);
      navigate('/');
    } else {
      setError('Usuário ou senha inválidos');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F2F2F8] flex items-center justify-center p-4 overflow-y-auto">
      {/* Added max-h constraint and safe margins for landscape mobile */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden my-auto max-h-[90vh] flex flex-col">
        <div className="bg-[#1A1B62] p-6 text-center relative shrink-0">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            <div className="relative z-10 flex justify-center mb-3">
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                    <Truck size={32} className="text-white" />
                </div>
            </div>
            <h1 className="relative z-10 text-xl font-bold text-white tracking-wide">Painel Operacional</h1>
            <p className="relative z-10 text-indigo-200 text-sm mt-1">Acesse suas métricas de transporte</p>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-[#FEEFEF] border border-red-200 text-[#EC1B23] px-4 py-3 rounded-lg text-sm flex items-center">
                <span className="mr-2">⚠️</span> {error}
              </div>
            )}
            
            <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#707082] uppercase tracking-wider">Usuário</label>
                <div className="relative">
                    <UserIcon className="absolute left-3 top-3 text-[#9798E4]" size={18} />
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#FCFCFE] border border-gray-200 rounded-lg text-[#0F103A] focus:ring-2 focus:ring-[#4649CF] focus:border-transparent outline-none transition-all text-sm"
                        placeholder="Digite seu usuário"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#707082] uppercase tracking-wider">Senha</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 text-[#9798E4]" size={18} />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#FCFCFE] border border-gray-200 rounded-lg text-[#0F103A] focus:ring-2 focus:ring-[#4649CF] focus:border-transparent outline-none transition-all text-sm"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#4649CF] hover:bg-[#313392] text-white font-bold py-3.5 rounded-lg transition-all transform hover:scale-[1.01] shadow-lg shadow-indigo-500/30 text-sm"
            >
              Entrar
            </button>
          </form>
          
          <div className="mt-6 text-center">
             <p className="text-[10px] text-[#9899C8]">© 2026 São Luiz Express. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;