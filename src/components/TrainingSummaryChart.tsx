import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';

interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date: string;
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;
  average_speed: number;
  max_speed: number;
}

interface TrainingSummaryChartProps {
  activities: StravaActivity[];
}

interface WeeklySummary {
  week: string;
  weekLabel: string;
  totalMiles: number;
  totalTime: number; // in minutes
  runCount: number;
  avgPace: number; // in minutes per mile
  totalElevation: number;
}

const TrainingSummaryChart: React.FC<TrainingSummaryChartProps> = ({ activities }) => {
  // Generate last 4 weeks data
  const generateWeeklySummaries = (): WeeklySummary[] => {
    const weeks: WeeklySummary[] = [];
    
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 }); // Monday start
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      // Filter activities for this week
      const weekActivities = activities.filter(activity => {
        const activityDate = new Date(activity.start_date);
        return activityDate >= weekStart && activityDate <= weekEnd;
      });
      
      // Calculate weekly metrics
      const totalDistance = weekActivities.reduce((sum, act) => sum + act.distance, 0);
      const totalMiles = totalDistance / 1609.34; // Convert meters to miles
      const totalTimeSeconds = weekActivities.reduce((sum, act) => sum + act.moving_time, 0);
      const totalTime = totalTimeSeconds / 60; // Convert to minutes
      const runCount = weekActivities.length;
      const totalElevation = weekActivities.reduce((sum, act) => sum + (act.total_elevation_gain || 0), 0);
      
      // Calculate average pace (minutes per mile)
      const avgPace = totalMiles > 0 ? totalTime / totalMiles : 0;
      
      weeks.push({
        week: format(weekStart, 'yyyy-MM-dd'),
        weekLabel: i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `${i} weeks ago`,
        totalMiles: Math.round(totalMiles * 10) / 10,
        totalTime: Math.round(totalTime),
        runCount,
        avgPace: Math.round(avgPace * 100) / 100,
        totalElevation: Math.round(totalElevation * 3.28084) // Convert meters to feet
      });
    }
    
    return weeks;
  };

  const formatPace = (pace: number) => {
    if (pace === 0) return '0:00';
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const weeklySummaries = generateWeeklySummaries();
  const totalMiles = weeklySummaries.reduce((sum, week) => sum + week.totalMiles, 0);
  const totalRuns = weeklySummaries.reduce((sum, week) => sum + week.runCount, 0);
  const avgWeeklyMiles = totalMiles / 4;

  return (
    <div className="training-summary-chart">
      <div className="summary-header">
        <h3>Last 4 Weeks Training Summary</h3>
        <div className="quick-stats">
          <div className="stat-item">
            <span className="stat-value">{Math.round(totalMiles)}</span>
            <span className="stat-label">Total Miles</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{totalRuns}</span>
            <span className="stat-label">Total Runs</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{Math.round(avgWeeklyMiles)}</span>
            <span className="stat-label">Avg Weekly Miles</span>
          </div>
        </div>
      </div>

      <div className="charts-container">
        <div className="chart-section">
          <h4>Weekly Mileage</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklySummaries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="weekLabel" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number) => [`${value} miles`, 'Weekly Mileage']}
                labelStyle={{ color: '#333' }}
              />
              <Bar dataKey="totalMiles" fill="#ff6b35" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h4>Training Consistency</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklySummaries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="weekLabel" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number) => [`${value} runs`, 'Number of Runs']}
                labelStyle={{ color: '#333' }}
              />
              <Line 
                type="monotone" 
                dataKey="runCount" 
                stroke="#4a90e2" 
                strokeWidth={3}
                dot={{ fill: '#4a90e2', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="weekly-breakdown">
        <h4>Weekly Breakdown</h4>
        <div className="breakdown-grid">
          {weeklySummaries.map((week, index) => (
            <div key={week.week} className="week-card">
              <div className="week-header">
                <strong>{week.weekLabel}</strong>
                <span className="week-date">
                  {format(new Date(week.week), 'MMM dd')}
                </span>
              </div>
              <div className="week-stats">
                <div className="week-stat">
                  <span className="value">{week.totalMiles}</span>
                  <span className="label">miles</span>
                </div>
                <div className="week-stat">
                  <span className="value">{week.runCount}</span>
                  <span className="label">runs</span>
                </div>
                <div className="week-stat">
                  <span className="value">{formatPace(week.avgPace)}</span>
                  <span className="label">avg pace</span>
                </div>
                <div className="week-stat">
                  <span className="value">{Math.round(week.totalTime / 60)}h</span>
                  <span className="label">total time</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {activities.length === 0 && (
        <div className="no-data-message">
          <p>No recent running activities found. Connect with Strava to see your training summary.</p>
        </div>
      )}
    </div>
  );
};

export default TrainingSummaryChart;
