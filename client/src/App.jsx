import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'

function App() {
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeChart, setActiveChart] = useState('pie') // 'pie' or 'bar'

  // Date range state
  const [dateRange, setDateRange] = useState('today')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

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
        axios.get(`/api/history?limit=200&startTime=${startTime}&endTime=${endTime}`),
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

    // 先按选中的应用筛选
    if (selectedApp && selectedApp !== 'Others') {
      // 找到选中项的 originalKey（用于匹配 history 中的原始数据）
      // 从 processedStats 中查找，因为它包含所有数据
      const selectedItem = processedStats.find(item => item.name === selectedApp);
      const filterKey = selectedItem?.originalKey || selectedApp;

      filtered = filtered.filter(visit => {
        const titleLower = (visit.title || '').toLowerCase();
        const appNameLower = (visit.app_name || '').toLowerCase();
        const urlLower = (visit.url || '').toLowerCase();
        const filterKeyLower = filterKey.toLowerCase();

        // 检查 URL 中是否包含 filterKey（域名匹配）
        if (urlLower.includes(filterKeyLower)) return true;
        // 检查 title 中是否包含 filterKey
        if (titleLower.includes(filterKeyLower)) return true;
        // 检查 app_name 中是否包含 filterKey
        if (appNameLower.includes(filterKeyLower)) return true;

        return false;
      })
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
    '#6366f1',  // Indigo:  深邃的蓝紫
    '#10b981',  // Emerald: 清新的翠绿
    '#f59e0b',  // Amber:   温暖的琥珀黄
    '#ec4899',  // Pink:    现代感强的洋红
    '#3b82f6',  // Blue:    经典的科技蓝
    '#8b5cf6',  // Violet:  柔和的浅紫
    '#14b8a6',  // Teal:    青色
    '#f97316',  // Orange:  活力的橙色
    '#06b6d4',  // Cyan:    明亮的青蓝
    '#d946ef',  // Fuchsia: 亮紫红
    '#84cc16',  // Lime:    酸橙绿
    '#e11d48',  // Rose:    玫瑰红
    '#0ea5e9',  // Sky:     天蓝色
    '#a855f7',  // Purple:  紫色
    '#22c55e',  // Green:   绿色
  ];
  const OTHERS_COLOR = '#64748b'; // 灰色专门用于 Others

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

  // Summary Metrics
  const totalDuration = useMemo(() => stats.reduce((acc, curr) => acc + curr.total_duration, 0), [stats]);
  const mostUsedApp = stats.length > 0 ? stats[0].title : 'N/A';

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
          const percentage = totalDuration > 0
            ? ((entry.value / totalDuration) * 100).toFixed(1)
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
                backgroundColor: isSelected ? '#2d3a52' : 'transparent',
                border: isSelected ? '1px solid #6366f1' : '1px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: '10px',
                height: '10px',
                backgroundColor: color,
                borderRadius: '2px',
                flexShrink: 0
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
    return <div className="loading-container">Loading Dashboard...</div>
  }

  return (
    <div className="app-container">
      <div className="dashboard-header">
        <h1>Daily Monitor</h1>
        <div className="header-controls">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="control-select"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>

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
          <span className="label">Total Active Time (Today)</span>
          <span className="value">{formatDuration(totalDuration)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Most Used Application</span>
          <span className="value" style={{ fontSize: '1.2rem', marginTop: 'auto' }}>
            {mostUsedApp}
          </span>
        </div>
        <div className="summary-card">
          <span className="label">Sessions Tracked</span>
          <span className="value">{history.length}+</span>
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
                          fill={isSelected ? '#6366f1' : (selectedApp ? '#64748b' : '#e2e8f0')}
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
                backgroundColor: '#2d3a52',
                border: '1px solid #6366f1',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '13px'
              }}>
                <span style={{ color: '#e2e8f0' }}>Filtered by: <strong style={{ color: '#6366f1' }}>{selectedApp}</strong></span>
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
                  <td style={{ color: '#888', fontFamily: 'monospace' }}>
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
                  <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                    {searchFilter ? 'No matching activities found' : 'No activities recorded'}
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