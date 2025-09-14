import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parse } from 'date-fns';
import { AppData } from '../App';
import { TrendingUp, Target, Zap } from 'lucide-react';

interface PerformanceLabProps {
  data: AppData;
}

const PerformanceLab: React.FC<PerformanceLabProps> = ({ data }) => {
  // Helper function to convert time strings to seconds for comparison
  const timeToSeconds = (timeString: string): number => {
    if (!timeString) return 0;
    const parts = timeString.split(':');
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    return 0;
  };

  // Helper function to format seconds back to time string
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get available distances
  const availableDistances = useMemo(() => {
    const distances = new Set<string>();
    data.races.forEach(race => {
      if (race.distance && race.time) {
        // Convert distance to readable format
        const distanceLabel = Math.abs(race.distance - 26.2) < 0.1 ? 'Marathon' :
                             Math.abs(race.distance - 13.1) < 0.1 ? 'Half Marathon' :
                             Math.abs(race.distance - 3.1) < 0.1 ? '5K' :
                             Math.abs(race.distance - 6.21371) < 0.1 ? '10K' :
                             Math.abs(race.distance - 9.3) < 0.1 ? '15K' :
                             `${race.distance} miles`;
        distances.add(distanceLabel);
      }
    });
    return Array.from(distances).sort();
  }, [data.races]);

  // State for selected distance
  const [selectedDistance, setSelectedDistance] = useState<string>('');

  // Set default to Marathon when available distances load
  useEffect(() => {
    if (availableDistances.length > 0 && !selectedDistance) {
      const marathon = availableDistances.find(d => d.includes('26.2') || d.includes('Marathon'));
      const halfMarathon = availableDistances.find(d => d.includes('13.1') || d.includes('Half'));
      setSelectedDistance(marathon || halfMarathon || availableDistances[0]);
    }
  }, [availableDistances, selectedDistance]);

  // Race progress data for selected distance
  const raceProgressData = useMemo(() => {
    if (!selectedDistance) return [];

    // Convert selected distance back to numeric
    const getDistanceValue = (label: string): number => {
      if (label === 'Marathon') return 26.2;
      if (label === 'Half Marathon') return 13.1;
      if (label === '5K') return 3.1;
      if (label === '10K') return 6.21371;
      if (label === '15K') return 9.3;
      return parseFloat(label.replace(' miles', ''));
    };

    const targetDistance = getDistanceValue(selectedDistance);

    const filteredRaces = data.races
      .filter(race => Math.abs(race.distance - targetDistance) < 0.1 && race.time)
      .filter(race => {
        // Handle different time formats
        let timeStr = '';
        if (race.time.includes('T')) {
          // Format: "1900-01-01T23:14:00"
          timeStr = race.time.split('T')[1];
        } else {
          // Format: "03:39:53"
          timeStr = race.time;
        }
        const timeSeconds = timeToSeconds(timeStr || '');
        return timeSeconds > 0; // Filter out invalid times
      })
      .map(race => ({
        ...race,
        timeSeconds: race.time.includes('T') ? 
          timeToSeconds(race.time.split('T')[1] || '') : 
          timeToSeconds(race.time || ''),
        date: new Date(race.date)
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort by date

    return filteredRaces.map((race, index) => ({
      raceNumber: index + 1,
      raceName: race.race,
      date: race.date.toISOString().split('T')[0],
      dateFormatted: format(race.date, 'MMM yyyy'),
      timeSeconds: race.timeSeconds,
      timeFormatted: race.time.includes('T') ? race.time.split('T')[1] : race.time,
      personalBest: index === 0 ? race.timeSeconds : Math.min(race.timeSeconds, ...filteredRaces.slice(0, index).map(r => r.timeSeconds))
    }));
  }, [data.races, selectedDistance]);

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    if (raceProgressData.length === 0) return null;

    const times = raceProgressData.map(race => race.timeSeconds);
    const firstTime = times[0];
    const lastTime = times[times.length - 1];
    const bestTime = Math.min(...times);
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    
    const improvementFromFirstToPR = ((firstTime - bestTime) / firstTime) * 100;
    const improvementFromAvg = ((avgTime - bestTime) / avgTime) * 100;
    
    return {
      totalRaces: raceProgressData.length,
      bestTime: formatTime(bestTime),
      firstTime: formatTime(firstTime),
      lastTime: formatTime(lastTime),
      avgTime: formatTime(Math.round(avgTime)),
      improvementFromFirstToPR: improvementFromFirstToPR,
      improvementFromAvg: improvementFromAvg,
      consistency: (1 - (Math.max(...times) - Math.min(...times)) / avgTime) * 100
    };
  }, [raceProgressData]);

  // Calculate Y-axis domain for better scaling
  const yAxisDomain = useMemo(() => {
    if (raceProgressData.length === 0) return ['auto', 'auto'];
    
    const times = raceProgressData.map(race => race.timeSeconds);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const range = maxTime - minTime;
    const padding = range * 0.1; // 10% padding
    
    return [
      Math.max(0, minTime - padding),
      maxTime + padding
    ];
  }, [raceProgressData]);

  const formatTooltipTime = (value: number) => {
    return formatTime(value);
  };

  const formatYAxisTime = (value: number) => {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
    return `${minutes}:00`;
  };

  return (
    <div className="performance-lab">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: '#ff9500', fontSize: '2rem', marginBottom: '0.5rem', fontWeight: '700' }}>
          Performance Lab
        </h1>
        <p style={{ color: '#888', fontSize: '1.1rem', lineHeight: '1.5' }}>
          Insights and analytics to track and improve running performance
        </p>
      </div>

      {/* Race Progress Analysis */}
      <div className="analysis-section" style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#ff9500', fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
            Race Progression Analysis
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ color: '#ccc', fontSize: '0.9rem' }}>Distance:</label>
            <select
              className="filter-select"
              value={selectedDistance}
              onChange={(e) => setSelectedDistance(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              {availableDistances.map(distance => (
                <option key={distance} value={distance}>{distance}</option>
              ))}
            </select>
          </div>
        </div>

        {performanceMetrics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="stat-card">
              <div className="stat-label">
                <Target size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Personal Best
              </div>
              <div className="stat-value">{performanceMetrics.bestTime}</div>
              <div className="stat-subtitle">{performanceMetrics.improvementFromAvg.toFixed(1)}% faster than average</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-label">
                <TrendingUp size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Total Improvement
              </div>
              <div className="stat-value" style={{ color: performanceMetrics.improvementFromFirstToPR >= 0 ? '#4ade80' : '#f87171' }}>
                {performanceMetrics.improvementFromFirstToPR >= 0 ? '+' : ''}{performanceMetrics.improvementFromFirstToPR.toFixed(1)}%
              </div>
              <div className="stat-subtitle">from first race to PR</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <Zap size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Consistency Score
              </div>
              <div className="stat-value">{performanceMetrics.consistency.toFixed(1)}%</div>
              <div className="stat-subtitle">based on time variance</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Total Races</div>
              <div className="stat-value">{performanceMetrics.totalRaces}</div>
              <div className="stat-subtitle">at {selectedDistance}</div>
            </div>
          </div>
        )}

        {raceProgressData.length > 0 ? (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={raceProgressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="raceNumber" 
                  stroke="#ccc" 
                  fontSize={12}
                  label={{ value: 'Race Number', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fill: '#ccc' } }}
                />
                <YAxis 
                  domain={yAxisDomain}
                  stroke="#ff9500" 
                  fontSize={12}
                  tickFormatter={formatYAxisTime}
                  label={{ value: 'Finish Time', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#ff9500' } }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid #333', 
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelStyle={{ color: '#ff9500' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'timeSeconds') return [formatTooltipTime(value), 'Finish Time'];
                    if (name === 'personalBest') return [formatTooltipTime(value), 'Personal Best'];
                    return [value, name];
                  }}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0] && payload[0].payload) {
                      const race = payload[0].payload;
                      return `${race.raceName} (${race.dateFormatted})`;
                    }
                    return `Race ${label}`;
                  }}
                />
                {/* Actual race times */}
                <Line 
                  type="monotone" 
                  dataKey="timeSeconds" 
                  stroke="#ff9500" 
                  strokeWidth={3}
                  dot={{ fill: '#ff9500', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, stroke: '#ff9500', strokeWidth: 2, fill: '#fff' }}
                />
                {/* Personal best line for reference */}
                <Line 
                  type="monotone" 
                  dataKey="personalBest" 
                  stroke="#4ade80" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>
                🟠 Race Times • 🟢 Personal Best Progression (Dashed)
              </p>
              <p style={{ color: '#888', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
                Y-axis auto-scaled to emphasize performance trends
              </p>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            <p>No race data available for {selectedDistance}</p>
            <p style={{ fontSize: '0.9rem' }}>Select a different distance or add race data to see your progression</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceLab;
