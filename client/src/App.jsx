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

  // Notification state
  const [notificationEnabled, setNotificationEnabled] = useState(false)
  const [notificationThreshold, setNotificationThreshold] = useState(60) // minutes
  const [totalTimeToday, setTotalTimeToday] = useState(0)

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

      // Calculate total time for notifications
      const total = statsRes.data.reduce((acc, curr) => acc + curr.total_duration, 0)
      setTotalTimeToday(total)
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

  // Request notification permission
  useEffect(() => {
    if (notificationEnabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [notificationEnabled])

  // Check for time threshold notifications
  useEffect(() => {
    if (notificationEnabled && 'Notification' in window && Notification.permission === 'granted') {
      const totalMinutes = Math.floor(totalTimeToday / 1000 / 60)
      if (totalMinutes >= notificationThreshold && totalMinutes % notificationThreshold === 0) {
        new Notification('Daily Monitor Alert', {
          body: `You've been active for ${totalMinutes} minutes today!`,
          icon: '/favicon.ico'
        })
      }
    }
  }, [totalTimeToday, notificationEnabled, notificationThreshold])

  // Filter history based on search
  const filteredHistory = useMemo(() => {
    if (!searchFilter) return history
    const lowerFilter = searchFilter.toLowerCase()
    return history.filter(visit =>
      (visit.app_name && visit.app_name.toLowerCase().includes(lowerFilter)) ||
      (visit.title && visit.title.toLowerCase().includes(lowerFilter)) ||
      (visit.url && visit.url.toLowerCase().includes(lowerFilter))
    )
  }, [history, searchFilter])

  const pieData = useMemo(() => stats.map(item => {
    let displayTitle = item.title;
    if (item.title === 'www.bilibili.com') {
      displayTitle = '哔哩哔哩 (゜-゜)つロ 干杯~';
    }
    // No truncation for bar chart context primarily, but keep it sane
    // item.title.substring(0, 50) + '...';

    return {
      name: displayTitle,
      displayName: displayTitle,
      value: item.total_duration
    };
  }), [stats]);

  const COLORS = ['#646cff', '#00C49F', '#FFBB28', '#FF8042', '#a78bfa', '#f472b6', '#3b82f6'];

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  const handleExport = async (format) => {
    try {
      const { startTime, endTime } = getDateRangeTimestamps()
      const url = `/api/export?format=${format}&startTime=${startTime}&endTime=${endTime}`
      window.open(url, '_blank')
    } catch (error) {
      console.error('Error exporting data:', error)
    }
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

  if (loading) {
    return <div className="loading-container">Loading Dashboard...</div>
  }

  return (
    <div className="app-container">
      <div className="dashboard-header">
        <h1>Daily Monitor</h1>
        <div className="header-controls">
          <button onClick={() => handleExport('json')} className="export-btn">
            Export JSON
          </button>
          <button onClick={() => handleExport('csv')} className="export-btn">
            Export CSV
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>Date Range</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #444',
              background: '#2a2a2a',
              color: '#fff',
              cursor: 'pointer'
            }}
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
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #444',
                  background: '#2a2a2a',
                  color: '#fff'
                }}
              />
              <span style={{ color: '#888' }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #444',
                  background: '#2a2a2a',
                  color: '#fff'
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>Time Alerts</h3>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={notificationEnabled}
              onChange={(e) => setNotificationEnabled(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Enable Notifications</span>
          </label>

          {notificationEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Alert every</span>
              <input
                type="number"
                value={notificationThreshold}
                onChange={(e) => setNotificationThreshold(parseInt(e.target.value) || 60)}
                min="1"
                style={{
                  width: '80px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #444',
                  background: '#2a2a2a',
                  color: '#fff'
                }}
              />
              <span>minutes</span>
            </div>
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
            <ResponsiveContainer width="100%" height={500}>
              {activeChart === 'pie' ? (
                <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={80}
                    outerRadius={160}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="displayName"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    wrapperStyle={{ paddingTop: '10px', fontSize: '14px' }} 
                  />
                </PieChart>
              ) : (
                <BarChart data={pieData} layout="vertical" margin={{ left: 0, right: 30, top: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#444" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="displayName" 
                    type="category" 
                    width={200} 
                    tick={{ fill: '#e2e8f0', fontSize: 13, fontWeight: 500 }} 
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Duration" barSize={30}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
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
          <h2 style={{ margin: 0 }}>Recent Activity Log</h2>
          <input
            type="text"
            placeholder="Search by app, title, or URL..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #444',
              background: '#2a2a2a',
              color: '#fff',
              width: '300px'
            }}
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