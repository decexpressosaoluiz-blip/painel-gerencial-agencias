import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export type CardStatus = 'neutral' | 'positive' | 'warning' | 'negative';

interface CardProps {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
  children?: React.ReactNode;
  status?: CardStatus;
  tooltip?: string;
}

const Card: React.FC<CardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  onClick, 
  isActive, 
  children,
  status = 'neutral',
  tooltip
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Define styles based on status
  const getStatusStyles = () => {
    switch (status) {
      case 'positive':
        return {
          border: 'border-l-4 border-l-emerald-500 border-y-transparent border-r-transparent',
          shadow: 'hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)]',
          iconBg: 'bg-emerald-50 text-emerald-600',
          activeRing: 'ring-emerald-500'
        };
      case 'warning':
        return {
          border: 'border-l-4 border-l-amber-500 border-y-transparent border-r-transparent',
          shadow: 'hover:shadow-[0_8px_30px_rgb(245,158,11,0.12)]',
          iconBg: 'bg-amber-50 text-amber-600',
          activeRing: 'ring-amber-500'
        };
      case 'negative':
        return {
          border: 'border-l-4 border-l-red-500 border-y-transparent border-r-transparent',
          shadow: 'hover:shadow-[0_8px_30px_rgb(239,68,68,0.12)]',
          iconBg: 'bg-red-50 text-red-600',
          activeRing: 'ring-red-500'
        };
      default:
        return {
          border: 'border-l-4 border-l-transparent', // Invisible border to keep layout consistent
          shadow: 'hover:shadow-lg',
          iconBg: 'bg-[#F2F2F8] text-[#4649CF]',
          activeRing: 'ring-[#4649CF]'
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-visible rounded-xl bg-white border border-gray-100 transition-all duration-300 cursor-pointer group
        ${styles.border}
        ${styles.shadow}
        ${isActive ? `ring-2 ${styles.activeRing} shadow-md` : ''} 
        hover:z-[100]
      `}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-bold text-[#707082] uppercase tracking-wider">{title}</p>
              {tooltip && (
                <div 
                  className="relative z-[101]"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  <HelpCircle size={14} className="text-gray-300 hover:text-[#4649CF] transition-colors cursor-help" />
                  
                  {/* Tooltip Popup */}
                  {showTooltip && (
                    <div className="absolute left-0 top-full mt-2 w-56 sm:w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-[999] pointer-events-none whitespace-normal break-words leading-relaxed text-left">
                      {tooltip}
                      {/* Arrow pointing up */}
                      <div className="absolute left-1.5 -top-1 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {value !== undefined && (
              <h3 className="mt-1 text-2xl font-bold text-[#0F103A] tracking-tight">
                {value}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-[#757581] font-medium">
                {subtitle}
              </p>
            )}
          </div>
          
          {icon && (
            <div className={`p-2.5 rounded-xl transition-colors ${styles.iconBg} ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
              {icon}
            </div>
          )}
        </div>
        
        {children && (
          <div className="mt-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;