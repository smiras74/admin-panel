'use client';

import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: 'green' | 'amber' | 'blue' | 'purple' | 'red' | 'slate' | 'pink';
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
}

const colorStyles = {
  green: {
    bg: 'bg-green-900/30',
    icon: 'bg-green-800 text-green-400',
    accent: 'text-green-400',
  },
  amber: {
    bg: 'bg-amber-900/30',
    icon: 'bg-amber-800 text-amber-400',
    accent: 'text-amber-400',
  },
  blue: {
    bg: 'bg-blue-900/30',
    icon: 'bg-blue-800 text-blue-400',
    accent: 'text-blue-400',
  },
  purple: {
    bg: 'bg-purple-900/30',
    icon: 'bg-purple-800 text-purple-400',
    accent: 'text-purple-400',
  },
  red: {
    bg: 'bg-red-900/30',
    icon: 'bg-red-800 text-red-400',
    accent: 'text-red-400',
  },
  slate: {
    bg: 'bg-gray-800',
    icon: 'bg-gray-700 text-gray-400',
    accent: 'text-gray-400',
  },
  pink: {
    bg: 'bg-pink-900/30',
    icon: 'bg-pink-800 text-pink-400',
    accent: 'text-pink-400',
  },
};

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  subtitle,
  trend,
  onClick 
}: StatCardProps) {
  const styles = colorStyles[color];
  
  return (
    <div 
      className={`
        ${styles.bg} rounded-xl p-4 sm:p-5 border border-gray-700/50
        ${onClick ? 'cursor-pointer hover:border-gray-600 hover:-translate-y-0.5 transition-all duration-200' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-400 truncate">{title}</p>
          <p className="text-2xl sm:text-3xl font-semibold mt-1 text-gray-100">
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={`text-xs mt-1 ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% vs hier
            </p>
          )}
        </div>
        <div className={`${styles.icon} p-2.5 rounded-lg shrink-0 ml-3`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>
    </div>
  );
}
