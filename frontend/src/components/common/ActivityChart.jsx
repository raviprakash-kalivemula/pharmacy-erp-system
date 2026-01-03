import React, { useState, useEffect } from 'react';
import useFetch from '../../hooks/useFetch';
import { TrendingUp, Users, Activity } from 'lucide-react';

const ActivityChart = ({ filters = {} }) => {
  const [chartData, setChartData] = useState(null);

  // Build query string
  const queryString = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  const { data: auditData, loading } = useFetch(
    `/api/audit-logs?limit=1000${queryString ? '&' + queryString : ''}`
  );

  // Process data for charts
  useEffect(() => {
    if (auditData?.logs) {
      const logs = auditData.logs;

      // Timeline chart: count by date
      const timelineMap = {};
      logs.forEach((log) => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        timelineMap[date] = (timelineMap[date] || 0) + 1;
      });

      // Sort timeline by date
      const timeline = Object.entries(timelineMap)
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .slice(-30); // Last 30 days

      // User pie: count by user
      const userMap = {};
      logs.forEach((log) => {
        const username = typeof log.user_id === 'object' ? log.user_id.username : 'Unknown';
        userMap[username] = (userMap[username] || 0) + 1;
      });

      const users = Object.entries(userMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 users

      // Action breakdown
      const actionMap = {};
      logs.forEach((log) => {
        actionMap[log.action] = (actionMap[log.action] || 0) + 1;
      });

      const actions = Object.entries(actionMap).map(([action, count]) => ({
        action,
        count,
        percentage: Math.round((count / logs.length) * 100),
      }));

      setChartData({
        timeline,
        users,
        actions,
        total: logs.length,
      });
    }
  }, [auditData]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4 h-64 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-3 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="text-center text-gray-500 py-8">
        No data available for selected filters
      </div>
    );
  }

  // Calculate colors for pie chart
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
  ];

  // Helper: Calculate pie chart paths (simplified SVG)
  const generatePieChart = (data, colors) => {
    let total = data.reduce((sum, item) => sum + item.count, 0);
    let currentAngle = -Math.PI / 2; // Start at top

    return data.map((item, idx) => {
      const sliceAngle = (item.count / total) * 2 * Math.PI;
      const endAngle = currentAngle + sliceAngle;

      // Calculate arc endpoints
      const x1 = 50 + 40 * Math.cos(currentAngle);
      const y1 = 50 + 40 * Math.sin(currentAngle);
      const x2 = 50 + 40 * Math.cos(endAngle);
      const y2 = 50 + 40 * Math.sin(endAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const pathData = [
        `M 50 50`,
        `L ${x1} ${y1}`,
        `A 40 40 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ');

      currentAngle = endAngle;

      return {
        path: pathData,
        color: colors[idx],
        label: item.name,
        value: item.count,
      };
    });
  };

  const pieSlices = generatePieChart(chartData.users, colors);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Activities</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{chartData.total}</p>
            </div>
            <Activity className="text-blue-600" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Active Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{chartData.users.length}</p>
            </div>
            <Users className="text-green-600" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Activity Trend</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {chartData.timeline.length > 1
                  ? chartData.timeline[chartData.timeline.length - 1][1] >
                    chartData.timeline[0][1]
                    ? '↑'
                    : '↓'
                  : '→'}
              </p>
            </div>
            <TrendingUp className="text-amber-600" size={24} />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Timeline Chart */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h3>
          <div className="space-y-2 h-64 flex flex-col justify-end">
            {chartData.timeline.length > 0 ? (
              <>
                <div className="flex-1 flex items-end gap-1">
                  {chartData.timeline.map(([date, count]) => {
                    const maxCount = Math.max(...chartData.timeline.map(([, c]) => c));
                    const height = (count / maxCount) * 100;

                    return (
                      <div key={date} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                          style={{ height: `${height}%`, minHeight: '2px' }}
                          title={`${date}: ${count} activities`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-gray-500 text-center">
                  {chartData.timeline[0][0]} to {chartData.timeline[chartData.timeline.length - 1][0]}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-400 h-full flex items-center justify-center">
                No timeline data
              </div>
            )}
          </div>
        </div>

        {/* Action Breakdown */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Action Breakdown</h3>
          <div className="space-y-3">
            {chartData.actions.map((action, idx) => (
              <div key={action.action} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[idx % colors.length] }}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {action.action}
                    </span>
                    <span className="text-xs text-gray-500">
                      {action.count} ({action.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${action.percentage}%`,
                        backgroundColor: colors[idx % colors.length],
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Users */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Contributors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {chartData.users.map((user, idx) => {
            const percentage = Math.round((user.count / chartData.total) * 100);

            return (
              <div key={user.name} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors[idx % colors.length] }}
                  />
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {user.name}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{user.count}</div>
                <div className="text-xs text-gray-500">{percentage}% of total</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ActivityChart;
