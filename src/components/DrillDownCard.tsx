"use client";

import React from "react";
import { X, Download, ExternalLink } from "lucide-react";

interface DrillDownItem {
  id?: number;
  name?: string;
  skuName?: string;
  storeName?: string;
  brand?: string;
  city?: string;
  state?: string;
  revenue?: number;
  units?: number;
  [key: string]: any;
}

interface DrillDownCardProps {
  title: string;
  data: {
    items?: DrillDownItem[];
    summary?: any;
    [key: string]: any;
  };
  onClose: () => void;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export default function DrillDownCard({ title, data, onClose }: DrillDownCardProps) {
  const handleExport = () => {
    if (!data.items || data.items.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV content
    const headers = ['Name', 'Brand', 'Location', 'Revenue', 'Units'];
    const csvContent = [
      headers.join(','),
      ...data.items.map(item => [
        `"${item.name || item.skuName || item.storeName || ''}"`,
        `"${item.brand || ''}"`,
        `"${item.city && item.state ? `${item.city}, ${item.state}` : ''}"`,
        item.revenue || 0,
        item.units || 0
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-blue-900 to-blue-950 rounded-2xl border border-blue-500/20 p-6 max-w-6xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="text-blue-300 hover:text-white transition-colors p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {data.items && data.items.length > 0 ? (
            <div className="space-y-3">
              {data.items.map((item, index) => (
                <div key={item.id || index} className="bg-blue-800/30 rounded-lg p-4 border border-blue-600/20 hover:border-blue-500/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-white text-lg mb-1">
                        {item.name || item.skuName || item.storeName || `Item ${index + 1}`}
                      </div>
                      {item.brand && (
                        <div className="text-blue-300 text-sm mb-1">{item.brand}</div>
                      )}
                      {item.city && item.state && (
                        <div className="text-blue-400 text-sm">{item.city}, {item.state}</div>
                      )}
                      {item.description && (
                        <div className="text-blue-300 text-sm mt-2">{item.description}</div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      {item.revenue !== undefined && (
                        <div className="font-semibold text-white text-lg">
                          {fmtCurrency(item.revenue)}
                        </div>
                      )}
                      {item.units !== undefined && (
                        <div className="text-blue-300 text-sm">
                          {fmtNumber(item.units)} units
                        </div>
                      )}
                      {item.percentage !== undefined && (
                        <div className="text-blue-400 text-sm">
                          {item.percentage.toFixed(1)}% of total
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-blue-300 text-lg mb-2">No detailed data available</div>
              <div className="text-blue-400 text-sm">
                Drill-down functionality is being enhanced. Check back soon!
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-blue-600/20">
          <div className="text-blue-300 text-sm">
            {data.items ? `Showing ${data.items.length} items` : 'No items'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => alert('Deep dive page coming soon!')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Deep Dive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
