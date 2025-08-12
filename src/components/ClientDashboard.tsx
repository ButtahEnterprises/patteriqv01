"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { TrendingUp, TrendingDown, DollarSign, Package, Store, Boxes, Download } from 'lucide-react';
import WeekPicker from './WeekPicker';
import UltaComMetrics from './UltaComMetrics';
import StorePerformanceHighlights from './StorePerformanceHighlights';
import StoresAtRiskList from './StoresAtRiskList';
import ClickableStatCard from './ClickableStatCard';
import InventoryRiskPanel from './InventoryRiskPanel';

export default function ClientDashboard({ selectedWeek = 'latest', weeksWindow = 12 }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(selectedWeek);
  const [weeklySummary, setWeeklySummary] = useState<any>(null);
  const [weekComparison, setWeekComparison] = useState<any>(null);
  const [topProductsUnits, setTopProductsUnits] = useState([]);
  const [topProductsRevenue, setTopProductsRevenue] = useState([]);
  const [topStoresRevenue, setTopStoresRevenue] = useState([]);
  const [storesAtRisk, setStoresAtRisk] = useState([]);
  const [config, setConfig] = useState({ demoMode: false });
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [drillDownData, setDrillDownData] = useState<any>(null);

  // Listen for URL parameter changes and update current week
  useEffect(() => {
    const weekFromUrl = searchParams?.get('week') || 'latest';
    if (weekFromUrl !== currentWeek) {
      if (weekFromUrl === 'latest') {
        // Resolve 'latest' to the actual latest week with data
        resolveLatestWeek();
      } else {
        setCurrentWeek(weekFromUrl);
      }
    }
  }, [searchParams, currentWeek]);

  // Function to resolve 'latest' to the actual latest week
  const resolveLatestWeek = async () => {
    try {
      const response = await fetch('/api/weekly-summary');
      if (response.ok) {
        const data = await response.json();
        if (data.week) {
          setCurrentWeek(data.week); // This will be something like "2025-W27"
        }
      }
    } catch (error) {
      console.error('Error resolving latest week:', error);
      // Fallback to 'latest' if resolution fails
      setCurrentWeek('latest');
    }
  };

  // Format currency with proper decimal places
  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(num);
  };

  // Format numbers with proper decimal places
  const formatNumber = (value) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2
    }).format(num);
  };

  // Handle drill-down functionality
  const handleDrillDown = async (type: string, data: any) => {
    console.log('handleDrillDown called with:', { type, data, currentWeek });
    try {
      const weekParam = currentWeek === 'latest' ? '' : `?week=${encodeURIComponent(currentWeek)}`;
      let endpoint = '';
      
      switch (type) {
        case 'total-sales':
          endpoint = '/api/drill-down/top-products-sales';
          break;
        case 'units-sold':
          endpoint = '/api/drill-down/top-products-units';
          break;
        case 'active-skus':
          endpoint = '/api/drill-down/active-skus';
          break;
        case 'active-stores':
          endpoint = '/api/drill-down/top-stores';
          break;
        case 'top-products-units':
        case 'top-products-revenue':
        case 'top-stores-revenue':
          // For bottom cards, use the data directly
          setDrillDownData({ 
            type, 
            data: data || { items: [] }, 
            title: getTitle(type) 
          });
          setShowDrillDown(true);
          return;
        default:
          console.error('Unknown drill-down type:', type);
          return;
      }

      console.log('Fetching from endpoint:', `${endpoint}${weekParam}`);
      const response = await fetch(`${endpoint}${weekParam}`);
      
      if (response.ok) {
        const drillData = await response.json();
        console.log('Drill-down data received:', drillData);
        
        // Format the data with proper decimal places
        let items = [];
        if (drillData.products) {
          items = drillData.products.map(item => ({
            name: item.skuName,
            skuName: item.skuName,
            revenue: parseFloat(item.revenue) || 0,
            units: item.units || 0,
            value: parseFloat(item.revenue) || 0
          }));
        } else if (drillData.stores) {
          items = drillData.stores.map(item => ({
            name: item.storeName,
            storeName: item.storeName,
            revenue: parseFloat(item.revenue) || 0,
            units: item.units || 0,
            value: parseFloat(item.revenue) || 0
          }));
        } else if (drillData.skus) {
          items = drillData.skus.map(item => ({
            name: item.skuName,
            skuName: item.skuName,
            revenue: parseFloat(item.revenue) || 0,
            units: item.units || 0,
            value: item.units || 0
          }));
        }
        
        const formattedData = { items };
        setDrillDownData({ 
          type, 
          data: formattedData, 
          title: getTitle(type) 
        });
        setShowDrillDown(true);
      } else {
        const errorText = await response.text();
        setDrillDownData({ 
          type, 
          data: { items: [], error: `API Error: ${response.status}` }, 
          title: getTitle(type) 
        });
        setShowDrillDown(true);
      }
    } catch (err) {
      console.error('Error fetching drill-down data:', err);
      setDrillDownData({ 
        type, 
        data: { items: [], error: 'Failed to load data' }, 
        title: getTitle(type) 
      });
      setShowDrillDown(true);
    }
  };

  // Get title for drill-down modal
  const getTitle = (type: string) => {
    switch (type) {
      case 'total-sales': return 'Top Products by Sales';
      case 'units-sold': return 'Top Products by Units';
      case 'active-skus': return 'Active SKUs';
      case 'active-stores': return 'Top Performing Stores';
      case 'top-products-units': return 'Top Products — Units';
      case 'top-products-revenue': return 'Top Products — Revenue';
      case 'top-stores-revenue': return 'Top Stores — Revenue';
      default: return 'Details';
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Always pass the week parameter, including 'latest'
        const weekParam = `?week=${encodeURIComponent(currentWeek)}`;
        const weekQueryParam = `&week=${encodeURIComponent(currentWeek)}`;
        
        const [
          summaryRes,
          comparisonRes,
          unitsRes,
          revenueRes,
          storesRes,
          riskRes
        ] = await Promise.all([
          fetch(`/api/weekly-summary${weekParam}`),
          fetch(`/api/week-comparison${weekParam}`),
          fetch(`/api/leaderboards/top-products?by=units&limit=5${weekQueryParam}`),
          fetch(`/api/leaderboards/top-products?by=revenue&limit=5${weekQueryParam}`),
          fetch(`/api/leaderboards/top-stores?limit=5${weekQueryParam}`),
          fetch(`/api/stores-at-risk?lookback=8&limit=10${weekQueryParam}`)
        ]);

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setWeeklySummary(summaryData);
        }
        
        if (comparisonRes.ok) {
          const comparisonData = await comparisonRes.json();
          setWeekComparison(comparisonData);
        }
        
        if (unitsRes.ok) {
          const unitsData = await unitsRes.json();
          setTopProductsUnits(Array.isArray(unitsData) ? unitsData : (unitsData.products || []));
        }
        
        if (revenueRes.ok) {
          const revenueData = await revenueRes.json();
          setTopProductsRevenue(Array.isArray(revenueData) ? revenueData : (revenueData.products || []));
        }
        
        if (storesRes.ok) {
          const storesData = await storesRes.json();
          setTopStoresRevenue(Array.isArray(storesData) ? storesData : (storesData.stores || []));
        }
        
        if (riskRes.ok) {
          const riskData = await riskRes.json();
          setStoresAtRisk(Array.isArray(riskData) ? riskData : (riskData.stores || []));
        }
        
        setConfig({ demoMode: false });
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentWeek]);

  if (loading) {
    return (
      <main>
        <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
          <div className="flex items-center justify-center min-h-[400px] text-blue-300">
            Loading dashboard...
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
          <div className="flex items-center justify-center min-h-[400px] text-red-400">
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
        {/* Header with Logo and Week Picker */}
        <div className="rounded-2xl bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] border border-blue-500/20 p-5 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <img 
                src="/patterniq-logo.svg" 
                alt="PatternIQ" 
                className="h-8 w-auto"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <div className="text-xl sm:text-2xl font-semibold text-white">PatternIQ Analytics</div>
                <div className="text-blue-100 text-xs sm:text-sm">Enterprise Retail Intelligence Dashboard</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <WeekPicker className="rounded-xl bg-blue-600/30 border border-blue-400/30 px-3 py-1.5 text-xs sm:text-sm text-blue-100" />
              <div className="rounded-xl bg-blue-600/30 border border-blue-400/30 px-3 py-1.5 text-xs sm:text-sm text-blue-100">
                Updated: <span className="text-white ml-1">Just now</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        {weeklySummary && (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 mb-6 sm:mb-8">
            {weeklySummary.kpis?.map((kpi, index) => {
              const drillDownTypes = ['total-sales', 'units-sold', 'active-skus', 'active-stores'];
              const icons = [
                <DollarSign key="dollar" className="h-5 w-5 text-green-300" />,
                <Package key="package" className="h-5 w-5 text-blue-300" />,
                <Boxes key="boxes" className="h-5 w-5 text-purple-300" />,
                <Store key="store" className="h-5 w-5 text-teal-300" />
              ];
              
              const getWeekComparison = () => {
                if (!weekComparison?.comparison) return undefined;
                const changeKeys = ['totalSales', 'unitsSold', 'activeSkus', 'activeStores'];
                const changeKey = changeKeys[index];
                const change = weekComparison.comparison[changeKey];
                return change ? {
                  value: change.current || 0,
                  percentage: change.change || 0
                } : undefined;
              };
              
              return (
                <ClickableStatCard
                  key={index}
                  icon={icons[index]}
                  title={kpi.label}
                  value={kpi.value}
                  weekComparison={getWeekComparison()}
                  onClick={() => handleDrillDown(drillDownTypes[index], kpi)}
                  drillDownType={drillDownTypes[index]}
                  currentWeek={currentWeek}
                />
              );
            })}
          </div>
        )}

        {/* Ulta.com Metrics */}
        <div className="mt-8 sm:mt-10">
          <UltaComMetrics 
            currentWeek={currentWeek} 
            demoMode={config.demoMode}
            totalRevenue={weeklySummary?.kpis?.[0]?.value ? parseFloat(String(weeklySummary.kpis[0].value).replace(/[$,]/g, '')) : 0}
          />
        </div>

        {/* Store Performance Highlights */}
        <div className="mt-8 sm:mt-10">
          <StorePerformanceHighlights currentWeek={currentWeek} />
        </div>

        {/* Bottom Cards */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 mb-8 sm:mb-10 mt-10 sm:mt-12">
          {/* Top Products by Units */}
          <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-400/30 rounded-xl p-6 cursor-pointer hover:border-blue-400/50 transition-all"
               onClick={() => handleDrillDown('top-products-units', { items: topProductsUnits })}>
            <h3 className="text-lg font-semibold text-white mb-4">Top Products — Units</h3>
            <div className="space-y-3">
              {topProductsUnits.slice(0, 3).map((product: any, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-blue-100 text-sm truncate">{product.skuName}</span>
                  <span className="text-white font-medium">{formatNumber(product.units)}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Top Products by Revenue */}
          <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-400/30 rounded-xl p-6 cursor-pointer hover:border-blue-400/50 transition-all"
               onClick={() => handleDrillDown('top-products-revenue', { items: topProductsRevenue })}>
            <h3 className="text-lg font-semibold text-white mb-4">Top Products — Revenue</h3>
            <div className="space-y-3">
              {topProductsRevenue.slice(0, 3).map((product: any, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-blue-100 text-sm truncate">{product.skuName}</span>
                  <span className="text-white font-medium">{formatCurrency(product.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Top Stores by Revenue */}
          <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-400/30 rounded-xl p-6 cursor-pointer hover:border-blue-400/50 transition-all"
               onClick={() => handleDrillDown('top-stores-revenue', { items: topStoresRevenue })}>
            <h3 className="text-lg font-semibold text-white mb-4">Top Stores — Revenue</h3>
            <div className="space-y-3">
              {topStoresRevenue.slice(0, 3).map((store: any, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-blue-100 text-sm truncate">{store.storeName}</span>
                  <span className="text-white font-medium">{formatCurrency(store.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Inventory Risk Panel */}
        <div className="mt-10 sm:mt-12">
          <InventoryRiskPanel data={[]} />
        </div>

        {/* Stores at Risk */}
        <div className="mt-10 sm:mt-12">
          <StoresAtRiskList items={storesAtRisk} demoMode={config.demoMode} />
        </div>
        
        {/* Drill-down Modal */}
        {showDrillDown && drillDownData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-blue-900 to-blue-950 rounded-2xl border border-blue-500/20 p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white">{drillDownData.title}</h2>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                  <button onClick={() => setShowDrillDown(false)} className="text-blue-300 hover:text-white">
                    ✕
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {drillDownData.data?.items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-blue-800/30 rounded-lg">
                    <span className="text-blue-100">{item.name || item.skuName || item.storeName}</span>
                    <div className="text-right">
                      <div className="text-white font-medium">
                        {item.revenue ? formatCurrency(item.revenue) : formatNumber(item.units || item.value)}
                      </div>
                      {item.units && item.revenue && (
                        <div className="text-xs text-blue-300">
                          {formatNumber(item.units)} units
                        </div>
                      )}
                    </div>
                  </div>
                )) || <div className="text-center text-blue-300 py-8">No data available</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
