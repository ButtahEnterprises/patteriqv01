"use client";

import React from "react";
import { AlertTriangle, TrendingDown, Package } from "lucide-react";

interface InventoryRiskItem {
  skuId: number;
  skuName: string;
  brand?: string;
  currentStock: number;
  predictedStockout: string;
  riskLevel: 'high' | 'medium' | 'low';
  weeksOfStock: number;
}

interface InventoryRiskPanelProps {
  data: InventoryRiskItem[];
}

export default function InventoryRiskPanel({ data }: InventoryRiskPanelProps) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'low': return 'text-green-400 bg-green-500/20 border-green-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <TrendingDown className="h-4 w-4" />;
      case 'low': return <Package className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-blue-900/40 to-blue-950/60 border border-blue-500/20 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Package className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Inventory Risk Analysis</h2>
        </div>
        <div className="text-center py-8 text-blue-300">
          No inventory risk data available
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-900/40 to-blue-950/60 border border-blue-500/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Inventory Risk Analysis</h2>
        </div>
        <div className="text-sm text-blue-300">
          {data.length} items at risk
        </div>
      </div>

      <div className="grid gap-4">
        {data.slice(0, 10).map((item, index) => (
          <div key={item.skuId || index} className="bg-blue-800/30 rounded-lg p-4 border border-blue-600/20">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getRiskColor(item.riskLevel)}`}>
                    {getRiskIcon(item.riskLevel)}
                    <span className="capitalize">{item.riskLevel} Risk</span>
                  </div>
                  <div className="text-sm text-blue-300">
                    {item.weeksOfStock} weeks of stock
                  </div>
                </div>
                <div className="font-medium text-white">{item.skuName}</div>
                {item.brand && (
                  <div className="text-sm text-blue-300">{item.brand}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-blue-300">Current Stock</div>
                <div className="font-semibold text-white">{item.currentStock.toLocaleString()}</div>
                <div className="text-xs text-blue-400 mt-1">
                  Stockout: {item.predictedStockout}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.length > 10 && (
        <div className="text-center mt-4">
          <button className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            View all {data.length} items →
          </button>
        </div>
      )}
    </div>
  );
}
