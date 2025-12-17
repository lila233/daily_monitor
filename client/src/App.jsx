import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import CustomSelect from './components/CustomSelect'

function App() {
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeChart, setActiveChart] = useState('pie') // 'pie' or 'bar'

  // Date range state
  const [dateRange, setDateRange] = useState('today')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'last30days', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Range' }
  ];

  // Filter state
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedApp, setSelectedApp] = useState(null) // 图表联动筛选

  // Calculate date range timestamps
  const getDateRangeTimestamps = () => {
    const now = new Date()
    let startTime, endTime

    switch (dateRange) {
      case 'today':
        startTime = startOfDay(now).getTime()
        endTime = endOfDay(now).getTime()
        break
      case 'yesterday':
        startTime = startOfDay(subDays(now, 1)).getTime()
        endTime = endOfDay(subDays(now, 1)).getTime()
        break
      case 'last7days':
        startTime = startOfDay(subDays(now, 7)).getTime()
        endTime = endOfDay(now).getTime()
        break
      case 'last30days':
        startTime = startOfDay(subDays(now, 30)).getTime()
        endTime = endOfDay(now).getTime()
        break
      case 'custom':
        if (customStartDate && customEndDate) {
          startTime = new Date(customStartDate).getTime()
          endTime = endOfDay(new Date(customEndDate)).getTime()
        } else {
          startTime = startOfDay(now).getTime()
          endTime = endOfDay(now).getTime()
        }
        break
      default:
        startTime = startOfDay(now).getTime()
        endTime = endOfDay(now).getTime()
    }

    return { startTime, endTime }
  }

  const fetchData = async () => {
    try {
      const { startTime, endTime } = getDateRangeTimestamps()
      const [historyRes, statsRes] = await Promise.all([
        axios.get(`/api/history?limit=5000&startTime=${startTime}&endTime=${endTime}`),
        axios.get(`/api/stats?startTime=${startTime}&endTime=${endTime}`)
      ])
      setHistory(historyRes.data)
      setStats(statsRes.data)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [dateRange, customStartDate, customEndDate])

  // 处理后的完整数据（排序后）
  const processedStats = useMemo(() => {
    if (!stats || stats.length === 0) return [];

    const processedData = stats.map(item => {
      return {
        name: item.title,
        displayName: item.title,
        originalKey: item.original_key,
        value: item.total_duration
      };
    });

    processedData.sort((a, b) => b.value - a.value);
    return processedData;
  }, [stats]);

  // 饼状图数据：最多13个（12 + Others）
  const pieData = useMemo(() => {
    if (processedStats.length > 12) {
      const topItems = processedStats.slice(0, 12);
      const otherItems = processedStats.slice(12);
      const otherTotal = otherItems.reduce((sum, item) => sum + item.value, 0);

      return [
        ...topItems,
        { name: 'Others', displayName: 'Others', originalKey: 'Others', value: otherTotal }
      ];
    }
    return processedStats;
  }, [processedStats]);

  // 柱状图数据：最多16个（15 + Others）
  const barData = useMemo(() => {
    if (processedStats.length > 15) {
      const topItems = processedStats.slice(0, 15);
      const otherItems = processedStats.slice(15);
      const otherTotal = otherItems.reduce((sum, item) => sum + item.value, 0);

      return [
        ...topItems,
        { name: 'Others', displayName: 'Others', originalKey: 'Others', value: otherTotal }
      ];
    }
    return processedStats;
  }, [processedStats]);

  // Filter history based on search and selected app
  const filteredHistory = useMemo(() => {
    let filtered = history

    // Filter by selected app or category
    if (selectedApp) {
      if (selectedApp === 'Others') {
         // Identify top items (which are NOT in "Others")
         // Matches pieData slice logic: top 12 items.
         const topItemsCount = 12; 
         // We use slice(0, 12) to get the top 12 items that are explicitly shown.
         // Any visit that has an original_key matching one of these should be EXCLUDED.
         const topKeys = processedStats.slice(0, topItemsCount).map(item => item.originalKey);
         
         filtered = filtered.filter(visit => {
            // Include if the visit's key is NOT in the top keys
            // Use original_key if available (from new server update)
            return visit.original_key && !topKeys.includes(visit.original_key);
         });
         
      } else {
          // Specific app selected
          const selectedItem = processedStats.find(item => item.name === selectedApp);
          const filterKey = selectedItem?.originalKey;
          
          if (filterKey) {
              const filterKeyFallback = selectedApp;
              filtered = filtered.filter(visit => {
                  // Primary check: exact match on original_key
                  if (visit.original_key === filterKey) return true;
                  
                  // Secondary check (fallback): fuzzy match if original_key is missing or for legacy data
                  const titleLower = (visit.title || '').toLowerCase();
                  const appNameLower = (visit.app_name || '').toLowerCase();
                  const urlLower = (visit.url || '').toLowerCase();
                  const filterKeyLower = filterKeyFallback.toLowerCase();

                  if (urlLower.includes(filterKeyLower)) return true;
                  if (titleLower.includes(filterKeyLower)) return true;
                  if (appNameLower.includes(filterKeyLower)) return true;
                  
                  return false;
              });
          }
      }
    }

    // 再按搜索词筛选
    if (searchFilter) {
      const lowerFilter = searchFilter.toLowerCase()
      filtered = filtered.filter(visit =>
        (visit.app_name && visit.app_name.toLowerCase().includes(lowerFilter)) ||
        (visit.title && visit.title.toLowerCase().includes(lowerFilter)) ||
        (visit.url && visit.url.toLowerCase().includes(lowerFilter))
      )
    }

    return filtered
  }, [history, searchFilter, selectedApp, processedStats])

  // 颜色数组 - 不包含灰色，灰色专门用于 Others
  const COLORS = [
    '#8b5cf6', // Violet:  Primary Accent
    '#3b82f6', // Blue:    Tech Blue
    '#06b6d4', // Cyan:    Bright Cyan
    '#10b981', // Emerald: Success Green
    '#f59e0b', // Amber:   Warmth
    '#ec4899', // Pink:    Vibrant
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#d946ef', // Fuchsia
    '#84cc16', // Lime
    '#e11d48', // Rose
    '#0ea5e9', // Sky
    '#a855f7', // Purple
    '#22c55e', // Green
  ];
  const OTHERS_COLOR = '#475569'; // Slate 600 for Others

  // 获取颜色 - Others 使用灰色，其他使用彩色
  const getColor = (entry, index) => {
    if (entry.name === 'Others') return OTHERS_COLOR;
    return COLORS[index % COLORS.length];
  };

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Summary Metrics Calculation
  const globalTotalDuration = useMemo(() => stats.reduce((acc, curr) => acc + curr.total_duration, 0), [stats]);
  const globalMostUsedApp = stats.length > 0 ? stats[0].title : 'N/A';
  
  // Calculate displayed metrics based on filter
  const displayMetrics = useMemo(() => {
    if (selectedApp && selectedApp !== 'Others') {
      // Find stats for selected app
      const selectedItem = processedStats.find(item => item.name === selectedApp);
      const duration = selectedItem ? selectedItem.value : 0;
      
      return {
        durationTitle: `Active Time (${selectedApp})`,
        durationValue: duration,
        mostUsedTitle: 'Selected Application',
        mostUsedValue: selectedApp,
        sessionCountTitle: `Sessions (${selectedApp})`,
        sessionCountValue: filteredHistory.length
      };
    } else if (selectedApp === 'Others') {
       // Logic for "Others" category
       const topItemsCount = 12; // Matches pieData slice logic roughly
       // Re-calculate others duration strictly from stats not in top 12? 
       // Simpler: use the value from pieData if available, or sum stats.
       // For now, let's just sum filtered history duration as an approximation or re-sum from stats
       const othersTotal = processedStats.slice(topItemsCount).reduce((sum, item) => sum + item.value, 0);
       
       return {
        durationTitle: 'Active Time (Others)',
        durationValue: othersTotal,
        mostUsedTitle: 'Category',
        mostUsedValue: 'Others',
        sessionCountTitle: 'Sessions (Others)',
        sessionCountValue: filteredHistory.length
       };
    }
    
    // Default global view
    return {
      durationTitle: 'Total Active Time (Today)',
      durationValue: globalTotalDuration,
      mostUsedTitle: 'Most Used Application',
      mostUsedValue: globalMostUsedApp,
      sessionCountTitle: 'Total Sessions Tracked',
      sessionCountValue: history.length
    };
  }, [selectedApp, processedStats, filteredHistory.length, globalTotalDuration, globalMostUsedApp, history.length]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p style={{ margin: 0, fontWeight: 'bold', color: '#fff' }}>{payload[0].payload.name}</p>
          <p style={{ margin: 0, color: '#ccc' }}>
            Duration: {formatDuration(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // 点击图表/图例时的处理函数
  const handleChartClick = (data) => {
    if (data && data.name) {
      // 如果点击的是已选中的，则取消选中
      if (selectedApp === data.name) {
        setSelectedApp(null);
      } else {
        setSelectedApp(data.name);
      }
    }
  };

  // 自定义图例渲染 - 显示名称和百分比，支持点击
  const renderCustomLegend = () => {
    // 直接使用 pieData，不依赖 Recharts 传入的 payload（避免重复项）
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        paddingLeft: '0px',
        maxHeight: '480px',
        overflowY: 'auto'
      }}>
        {pieData.map((entry, index) => {
          const percentage = globalTotalDuration > 0
            ? ((entry.value / globalTotalDuration) * 100).toFixed(1)
            : 0;
          const isSelected = selectedApp === entry.name;
          const color = getColor(entry, index);
          return (
            <div
              key={`legend-${index}`}
              onClick={() => handleChartClick(entry)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '5px 8px',
                borderRadius: '6px',
                backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                border: isSelected ? '1px solid #8b5cf6' : '1px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: '10px',
                height: '10px',
                backgroundColor: color,
                borderRadius: '2px',
                flexShrink: 0,
                boxShadow: isSelected ? `0 0 8px ${color}` : 'none'
              }} />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '300px',
                color: '#e2e8f0'
              }}>
                <span style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginRight: '10px'
                }} title={entry.displayName}>
                  {entry.displayName}
                </span>
                <span style={{ color: '#6366f1', fontWeight: '500', flexShrink: 0 }}>
                  {percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        Loading Dashboard...
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="dashboard-header">
        <h1>Daily Monitor</h1>
        <div className="header-controls">
          <CustomSelect
            value={dateRange}
            options={dateRangeOptions}
            onChange={(newValue) => setDateRange(newValue)}
          />

          {dateRange === 'custom' && (
            <>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="control-input"
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="control-input"
              />
            </>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="summary-grid">
        <div className="summary-card">
          <span className="label">{displayMetrics.durationTitle}</span>
          <div className="summary-card-value-container">
            <span className="value">{formatDuration(displayMetrics.durationValue)}</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="label">{displayMetrics.mostUsedTitle}</span>
          <div className="summary-card-value-container">
            <div className="value text-value" title={displayMetrics.mostUsedValue}>
              {displayMetrics.mostUsedValue}
            </div>
          </div>
        </div>
        <div className="summary-card">
          <span className="label">{displayMetrics.sessionCountTitle}</span>
          <div className="summary-card-value-container">
            <span className="value">{displayMetrics.sessionCountValue}</span>
          </div>
        </div>
      </div>


      
      {/* Charts Grid - Single Column with Toggle */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h2>{activeChart === 'pie' ? 'Distribution (Last 24h)' : 'Top Apps by Duration'}</h2>
            <button 
              className="toggle-btn" 
              onClick={() => setActiveChart(prev => prev === 'pie' ? 'bar' : 'pie')}
            >
              Switch to {activeChart === 'pie' ? 'Bar Chart' : 'Pie Chart'}
            </button>
          </div>
          
          {stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={520}>
              {activeChart === 'pie' ? (
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }} style={{ background: 'transparent' }}>
                  <Pie
                    data={pieData}
                    cx="40%"
                    cy="50%"
                    innerRadius={120}
                    outerRadius={190}
                    paddingAngle={2}
                    cornerRadius={3}
                    dataKey="value"
                    nameKey="displayName"
                    stroke="none"
                    onClick={(data) => handleChartClick(data)}
                    style={{ cursor: 'pointer' }}
                    isAnimationActive={false}
                  >
                    {pieData.map((entry, index) => {
                      const isSelected = selectedApp === entry.name;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={getColor(entry, index)}
                          opacity={selectedApp && !isSelected ? 0.4 : 1}
                          stroke={isSelected ? '#fff' : 'none'}
                          strokeWidth={isSelected ? 3 : 0}
                          style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    content={renderCustomLegend}
                  />
                </PieChart>
              ) : (
                <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 50, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#444" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="displayName"
                    type="category"
                    width={220}
                    interval={0}
                    tick={({ x, y, payload }) => {
                      const isSelected = selectedApp === payload.value;
                      return (
                        <text
                          x={x}
                          y={y}
                          dy={4}
                          textAnchor="end"
                          fill={isSelected ? '#a78bfa' : (selectedApp ? '#64748b' : '#94a3b8')}
                          fontSize={13}
                          fontWeight={isSelected ? 700 : 500}
                          style={{ transition: 'all 0.2s ease' }}
                        >
                          {payload.value}
                        </text>
                      );
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                    name="Duration"
                    barSize={26}
                    onClick={(data) => handleChartClick(data)}
                    style={{ cursor: 'pointer' }}
                  >
                    {barData.map((entry, index) => {
                      const isSelected = selectedApp === entry.name;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={getColor(entry, index)}
                          opacity={selectedApp && !isSelected ? 0.4 : 1}
                          stroke={isSelected ? '#fff' : 'transparent'}
                          strokeWidth={isSelected ? 2 : 0}
                          style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="loading-container" style={{ height: '200px' }}>No data available</div>
          )}
        </div>
      </div>

      {/* History Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ margin: 0 }}>Recent Activity Log</h2>
            {selectedApp && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid #8b5cf6',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '13px',
                boxShadow: '0 0 10px rgba(139, 92, 246, 0.2)'
              }}>
                <span style={{ color: '#e2e8f0' }}>Filtered by: <strong style={{ color: '#a78bfa' }}>{selectedApp}</strong></span>
                <button
                  onClick={() => setSelectedApp(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontSize: '16px',
                    lineHeight: 1
                  }}
                  title="Clear filter"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <input
            type="text"
            placeholder="Search by app, title, or URL..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="control-input"
            style={{ width: '300px' }}
          />
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Application</th>
                <th>Details / Title</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length > 0 ? (
                filteredHistory.map(visit => (
                <tr key={visit.id}>
                  <td className="time-cell">
                    {format(new Date(visit.start_time), 'HH:mm:ss')}
                  </td>
                  <td style={{ fontWeight: '500', color: '#fff' }}>{visit.app_name}</td>
                  <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={visit.title}>
                    {visit.title}
                  </td>
                  <td>{formatDuration(visit.duration)}</td>
                </tr>
              ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    {selectedApp ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>No recent logs for <strong style={{ color: 'var(--accent-color)' }}>{selectedApp}</strong></span>
                        <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Try changing the date range or selecting a different app.</span>
                      </div>
                    ) : (
                      searchFilter ? 'No matching activities found' : 'No activities recorded'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default App