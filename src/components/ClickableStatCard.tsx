"use client";

import React, { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface WeekComparison {
  value: number;
  percentage: number;
}

interface ClickableStatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  note?: string;
  weekComparison?: WeekComparison;
  onClick?: () => void;
  drillDownType: string;
  currentWeek: string;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

const toNumber = (v: string | number): number => {
  if (typeof v === "number") return v;
  const cleaned = v.toString().replace(/[^0-9.-]/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

export default function ClickableStatCard({
  icon,
  title,
  value,
  note,
  weekComparison,
  onClick,
  drillDownType,
  currentWeek
}: ClickableStatCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [drillDownData, setDrillDownData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const isCurrency = /sales|revenue|gmv/i.test(title);
  const num = toNumber(value);
  const displayValue = isCurrency ? fmtCurrency(num) : fmtNumber(num);

  const handleClick = async () => {
    if (onClick) {
      onClick();
    }
    
    // Fetch drill-down data
    setLoading(true);
    try {
      const weekParam = currentWeek === 'latest' ? '' : `?week=${encodeURIComponent(currentWeek)}`;
      const response = await fetch(`/api/drill-down/${drillDownType}${weekParam}`);
      
      if (response.ok) {
        const data = await response.json();
        setDrillDownData(data);
        setShowDrillDown(true);
      } else {
        // Fallback to alert for now
        alert(`Drill-down data for ${title} will be available soon.`);
      }
    } catch (error) {
      console.error('Error fetching drill-down data:', error);
      alert(`Drill-down data for ${title} will be available soon.`);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = () => {
    if (!weekComparison) return null;
    
    if (weekComparison.percentage > 0) {
      return <TrendingUp className="h-4 w-4 text-green-400" />;
    } else if (weekComparison.percentage < 0) {
      return <TrendingDown className="h-4 w-4 text-red-400" />;
    } else {
      return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    if (!weekComparison) return "text-gray-400";
    
    if (weekComparison.percentage > 0) {
      return "text-green-400";
    } else if (weekComparison.percentage < 0) {
      return "text-red-400";
    } else {
      return "text-gray-400";
    }
  };

  const formatPercentage = (pct: number) => {
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  };

  return (
    <>
      <div 
        className={`group rounded-2xl bg-gradient-to-b from-blue-900/40 to-blue-950/60 border border-blue-500/20 p-5 shadow-lg transition-all duration-200 cursor-pointer ${
          isHovered ? 'border-blue-400/40 shadow-xl transform scale-[1.02]' : ''
        }`}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className={`h-10 w-10 rounded-xl bg-blue-600/30 flex items-center justify-center transition-colors duration-200 ${
            isHovered ? 'bg-blue-500/40' : ''
          }`}>
            {icon}
          </div>
          <div className="text-[11px] sm:text-xs uppercase tracking-wider text-blue-200">{title}</div>
        </div>
        
        <div className="text-3xl sm:text-4xl font-semibold leading-tight text-white mb-2">
          {loading ? "..." : displayValue}
        </div>
        
        {/* Week-over-Week Comparison */}
        {weekComparison && (
          <div className="flex items-center gap-2 mb-2">
            {getTrendIcon()}
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              {formatPercentage(weekComparison.percentage)} vs last week
            </span>
          </div>
        )}
        
        {note && (
          <div className="text-xs sm:text-sm text-blue-300">{note}</div>
        )}
        
        {/* Click hint */}
        <div className={`text-xs text-blue-400 mt-2 transition-opacity duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          Click for details →
        </div>
      </div>

      {/* Drill-down Modal */}
      {showDrillDown && drillDownData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-blue-900 to-blue-950 rounded-2xl border border-blue-500/20 p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white">{title} - Details</h2>
              <button
                onClick={() => setShowDrillDown(false)}
                className="text-blue-300 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {drillDownData.items ? (
                drillDownData.items.map((item: any, index: number) => (
                  <div key={index} className="bg-blue-800/30 rounded-lg p-4 border border-blue-600/20">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-white">{item.name || item.skuName || item.storeName}</div>
                        {item.brand && <div className="text-sm text-blue-300">{item.brand}</div>}
                        {item.city && item.state && (
                          <div className="text-sm text-blue-300">{item.city}, {item.state}</div>
                        )}
                      </div>
                      <div className="text-right">
                        {item.revenue && (
                          <div className="font-semibold text-white">{fmtCurrency(item.revenue)}</div>
                        )}
                        {item.units && (
                          <div className="text-sm text-blue-300">{fmtNumber(item.units)} units</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-blue-300 py-8">
                  Detailed data will be available soon.
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDrillDown(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => alert('Export functionality coming soon!')}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
