import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';
import { format, parse, startOfQuarter, endOfQuarter, isWithinInterval } from 'date-fns';
import { AppData } from '../App';
import { Activity, TrendingUp, Calendar, Clock, Award } from 'lucide-react';
import InteractiveRunningChart from './InteractiveRunningChart';

interface ThePulseProps {
  data: AppData;
}

const ThePulse: React.FC<ThePulseProps> = ({ data }) => {
  // Helper function to identify running activities
  const isRunningActivity = (activityType: string) => {
    if (!activityType) return false;
    const type = activityType.toLowerCase().trim();
    return type.includes('run') && !type.includes('walk') && !type.includes('hike');
  };

  // Helper function to classify trail runs
  const isTrailRun = (activity: any) => {
    const dirtDistance = activity['Dirt Distance'] || 0; // meters
    const elevationGain = activity['Elevation Gain'] || 0; // feet
    const totalDistance = activity['Distance.1'] ? 
      activity['Distance.1'] / 1609.34 : 
      parseFloat(activity.Distance || 0); // miles
    
    const elevationPerMile = totalDistance > 0 ? elevationGain / totalDistance : 0;
    const dirtPercentage = totalDistance > 0 ? (dirtDistance / 1609.34) / totalDistance * 100 : 0;
    
    // Trail run criteria (OR logic - any one qualifies):
    return (
      elevationPerMile > 50 ||           // > 50 ft/mi elevation (very hilly terrain)
      dirtPercentage > 50                // > 50% of run on dirt/trail surface
    );
  };

  // Running-focused stats
  const runningStats = useMemo(() => {
    const runningActivities = data.activities
      .filter(act => {
        const activityDate = parse(act['Activity Date'], 'MMM dd, yyyy, h:mm:ss a', new Date());
        return activityDate.getFullYear() >= 2016 && isRunningActivity(act['Activity Type']); // Only include 2016 and later
      });
    
    const totalRuns = runningActivities.length;
    const totalRunningMiles = runningActivities.reduce((sum, act) => sum + (act['Distance.1'] ? (act['Distance.1'] / 1609.34) : (parseFloat(act.Distance) || 0)), 0);
    const totalRunningHours = runningActivities.reduce((sum, act) => sum + (act['Moving Time'] || 0), 0) / 3600;
    const totalRaces = data.races.length;

    // Trail vs Road metrics
    const trailRuns = runningActivities.filter(act => isTrailRun(act));
    const roadRuns = runningActivities.filter(act => !isTrailRun(act));
    const trailMiles = trailRuns.reduce((sum, act) => sum + (act['Distance.1'] ? (act['Distance.1'] / 1609.34) : (parseFloat(act.Distance) || 0)), 0);
    const roadMiles = roadRuns.reduce((sum, act) => sum + (act['Distance.1'] ? (act['Distance.1'] / 1609.34) : (parseFloat(act.Distance) || 0)), 0);
    const trailPercentage = totalRuns > 0 ? (trailRuns.length / totalRuns) * 100 : 0;

    // Calculate total elevation gain (in feet)
    const totalElevationGain = runningActivities.reduce((sum, act) => sum + (act['Elevation Gain'] || 0), 0);

    // Calculate Earth circumference percentage
    // Earth's circumference at equator = 24,901 miles
    const earthCircumferenceMiles = 24901;
    const earthCircumferencePercentage = (totalRunningMiles / earthCircumferenceMiles) * 100;

    return {
      totalRuns,
      totalRunningMiles: Math.round(totalRunningMiles),
      totalRunningHours: Math.round(totalRunningHours),
      totalRaces,
      trailRuns: trailRuns.length,
      roadRuns: roadRuns.length,
      trailMiles: Math.round(trailMiles),
      roadMiles: Math.round(roadMiles),
      trailPercentage: Math.round(trailPercentage * 10) / 10,
      totalElevationGain: Math.round(totalElevationGain),
      earthCircumferencePercentage: Math.round(earthCircumferencePercentage * 100) / 100 // 2 decimal places
    };
  }, [data.activities, data.races]);

  // General fitness stats
  const fitnessStats = useMemo(() => {
    const allActivities = data.activities.filter(act => {
      const activityDate = parse(act['Activity Date'], 'MMM dd, yyyy, h:mm:ss a', new Date());
      return activityDate.getFullYear() >= 2016; // Only include 2016 and later
    });
    
    const totalActivities = allActivities.length;
    const totalHours = allActivities.reduce((sum, act) => sum + (act['Moving Time'] || 0), 0) / 3600;
    const uniqueActivityTypes = new Set(allActivities.map(act => act['Activity Type'])).size;
    
    // Calculate average exercise hours per week
    const activitiesWithDates = allActivities.filter(act => act['Activity Date']);
    const avgHoursPerWeek = activitiesWithDates.length > 0 ? (() => {
      const dates = activitiesWithDates.map(act => new Date(act['Activity Date']));
      const firstActivity = new Date(Math.min(...dates.map(d => d.getTime())));
      const lastActivity = new Date(Math.max(...dates.map(d => d.getTime())));
      const weeksDiff = Math.max(1, (lastActivity.getTime() - firstActivity.getTime()) / (1000 * 60 * 60 * 24 * 7));
      return totalHours / weeksDiff;
    })() : 0;

    return {
      totalActivities,
      totalHours: Math.round(totalHours),
      uniqueActivityTypes,
      avgHoursPerWeek: Math.round(avgHoursPerWeek * 10) / 10 // Round to 1 decimal place
    };
  }, [data.activities]);

  // Yearly running miles data
  const yearlyRunningData = useMemo(() => {
    const runningActivities = data.activities
      .filter(act => isRunningActivity(act['Activity Type']))
      .map(act => ({
        ...act,
        date: parse(act['Activity Date'], 'MMM dd, yyyy, h:mm:ss a', new Date()),
        distance: act['Distance.1'] ? (act['Distance.1'] / 1609.34) : (parseFloat(act.Distance) || 0)
      }))
      .filter(act => act.date.getFullYear() >= 2016); // Only include 2016 and later

    const yearlyData = new Map();
    runningActivities.forEach(act => {
      const year = act.date.getFullYear();
      if (!yearlyData.has(year)) {
        yearlyData.set(year, 0);
      }
      yearlyData.set(year, yearlyData.get(year) + act.distance);
    });

    return Array.from(yearlyData.entries())
      .map(([year, miles]) => ({
        year: year.toString(),
        miles: Math.round(miles)
      }))
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [data.activities]);

  // Yearly hours by activity type data
  const yearlyActivityData = useMemo(() => {
    const activitiesWithYear = data.activities
      .map(act => ({
        ...act,
        date: parse(act['Activity Date'], 'MMM dd, yyyy, h:mm:ss a', new Date()),
        hours: (act['Moving Time'] || 0) / 3600
      }))
      .filter(act => act.date.getFullYear() >= 2016); // Only include 2016 and later

    const yearlyData = new Map();
    
    activitiesWithYear.forEach(act => {
      const year = act.date.getFullYear();
      const activityType = act['Activity Type'];
      
      if (!yearlyData.has(year)) {
        yearlyData.set(year, {});
      }
      
      const yearData = yearlyData.get(year);
      if (!yearData[activityType]) {
        yearData[activityType] = 0;
      }
      yearData[activityType] += act.hours;
    });

    // Get all unique activity types for consistent data structure
    const allActivityTypes = Array.from(new Set(data.activities.map(act => act['Activity Type'])));
    
    return Array.from(yearlyData.entries())
      .map(([year, activities]) => {
        const yearData: { year: string; [key: string]: any } = { year: year.toString() };
        allActivityTypes.forEach(type => {
          yearData[type] = Math.round((activities[type] || 0) * 10) / 10;
        });
        return yearData;
      })
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [data.activities]);

  // Top 3 times for key distances
  const topTimes = useMemo(() => {
    // Helper function to convert time string to seconds for comparison
    const timeToSeconds = (timeStr: string) => {
      if (!timeStr) return Infinity;
      
      // Handle formats like "03:39:53" or "1900-01-01T23:14:00"
      let timeOnly = timeStr;
      if (timeStr.includes('T')) {
        timeOnly = timeStr.split('T')[1];
      }
      
      const parts = timeOnly.split(':');
      if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
      }
      return Infinity;
    };

    const keyDistances = [
      { distance: 26.2, label: 'Marathon' },
      { distance: 13.1, label: 'Half Marathon' },
      { distance: 3.1, label: '5K' }
    ];

    const results: { [key: string]: any[] } = {};

    keyDistances.forEach(({ distance, label }) => {
      const distanceRaces = data.races
        .filter(race => {
          if (!race.distance || race.distance !== distance || !race.time || !race.date) return false;
          const raceDate = new Date(race.date);
          return raceDate.getFullYear() >= 2016; // Only include 2016 and later
        })
        .map(race => ({
          ...race,
          timeSeconds: timeToSeconds(race.time)
        }))
        .filter(race => race.timeSeconds < Infinity)
        .sort((a, b) => a.timeSeconds - b.timeSeconds)
        .slice(0, 3); // Top 3 fastest

      results[label] = distanceRaces.map((race, index) => ({
        ...race,
        medalEmoji: index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉',
        medalColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32',
        rank: index + 1
      }));
    });

    return results;
  }, [data.races]);

  // Helper function to format pace without seconds
  const formatPace = (pace: string) => {
    if (!pace) return 'N/A';
    // Remove seconds from pace format (e.g., "07:36:00" -> "7:36")
    const parts = pace.split(':');
    if (parts.length >= 2) {
      const minutes = parseInt(parts[0]);
      const seconds = parts[1];
      return `${minutes}:${seconds}`;
    }
    return pace;
  };

  return (
    <div>
      {/* Running Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#ff9500', fontSize: '1.5rem', marginBottom: '1rem', fontWeight: '600' }}>
          Running Stats
        </h2>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              <Activity size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Total Runs
            </div>
            <div className="stat-value">{runningStats.totalRuns.toLocaleString()}</div>
            <div className="stat-subtitle">Running activities</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <TrendingUp size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Running Miles
            </div>
            <div className="stat-value">{runningStats.totalRunningMiles.toLocaleString()}</div>
            <div className="stat-subtitle">Distance covered</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <Clock size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Running Hours
            </div>
            <div className="stat-value">{runningStats.totalRunningHours.toLocaleString()}</div>
            <div className="stat-subtitle">Time running</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <Award size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Races
            </div>
            <div className="stat-value">{runningStats.totalRaces}</div>
            <div className="stat-subtitle">Events completed</div>
          </div>
        </div>

        {/* Trail vs Road Breakdown */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">🏔️ Trail Runs</div>
            <div className="stat-value">{runningStats.trailPercentage}%</div>
            <div className="stat-subtitle">{runningStats.trailRuns} of {runningStats.totalRuns} lifetime runs</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">⛰️ Total Elevation</div>
            <div className="stat-value">{runningStats.totalElevationGain.toLocaleString()}</div>
            <div className="stat-subtitle">feet of vertical gain</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">🌍 Earth Circumference</div>
            <div className="stat-value">{runningStats.earthCircumferencePercentage}%</div>
            <div className="stat-subtitle">{runningStats.totalRunningMiles.toLocaleString()} of 24,901 miles</div>
          </div>
        </div>

        {/* Interactive Running Chart */}
        <div className="chart-container">
          <InteractiveRunningChart 
            data={data}
            initialLevel="years"
          />
        </div>
      </div>

      {/* General Fitness Section */}
      <div>
        <h2 style={{ color: '#ff9500', fontSize: '1.5rem', marginBottom: '1rem', fontWeight: '600' }}>
          Overall Fitness
        </h2>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              <Activity size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              All Activities
            </div>
            <div className="stat-value">{fitnessStats.totalActivities.toLocaleString()}</div>
            <div className="stat-subtitle">Total Strava activities</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <Clock size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Total Hours
            </div>
            <div className="stat-value">{fitnessStats.totalHours.toLocaleString()}</div>
            <div className="stat-subtitle">All activities</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <TrendingUp size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Activity Types
            </div>
            <div className="stat-value">{fitnessStats.uniqueActivityTypes}</div>
            <div className="stat-subtitle">Unique sports</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <Award size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Exercise Hours/Week
            </div>
            <div className="stat-value">{fitnessStats.avgHoursPerWeek}</div>
            <div className="stat-subtitle">Average across all time</div>
          </div>
        </div>
        {/* Hours by Activity Type by Year Chart */}
        {yearlyActivityData.length > 0 && (
          <div className="chart-container">
            <h3 className="chart-title">Training Hours by Activity Type (Yearly)</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={yearlyActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="year" 
                  stroke="#ccc" 
                  fontSize={12}
                />
                <YAxis 
                  stroke="#ccc" 
                  fontSize={12}
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#ccc' } }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid #333', 
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelStyle={{ color: '#ff9500' }}
                />
                <Bar dataKey="Run" stackId="a" fill="#ff9500" />
                <Bar dataKey="Ride" stackId="a" fill="#4fc3f7" />
                <Bar dataKey="Walk" stackId="a" fill="#66bb6a" />
                <Bar dataKey="Weight Training" stackId="a" fill="#ab47bc" />
                <Bar dataKey="Yoga" stackId="a" fill="#f06292" />
                <Bar dataKey="Swim" stackId="a" fill="#26c6da" />
                <Bar dataKey="Hike" stackId="a" fill="#8bc34a" />
                <Bar dataKey="Workout" stackId="a" fill="#ffa726" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Personal Records Section */}
      <div style={{ marginTop: '3rem' }}>
        <h2 style={{ color: '#ff9500', fontSize: '1.5rem', marginBottom: '2rem', fontWeight: '600' }}>
          Lifetime Personal Records
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          {['Marathon', 'Half Marathon', '5K'].map(distance => {
            const times = topTimes[distance] || [];
            if (times.length === 0) return null;
            
            return (
              <div key={distance} style={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '12px',
                padding: '1.5rem'
              }}>
                <h3 style={{ 
                  color: '#ff9500', 
                  fontSize: '1.25rem', 
                  marginBottom: '1rem'
                }}>
                  {distance}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {times.map((time, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem',
                      background: index === 0 ? 'rgba(255, 215, 0, 0.1)' : 
                                 index === 1 ? 'rgba(192, 192, 192, 0.1)' : 
                                 'rgba(205, 127, 50, 0.1)',
                      border: `1px solid ${time.medalColor}`,
                      borderRadius: '8px',
                      cursor: time.strava ? 'pointer' : 'default'
                    }}
                    onClick={() => {
                      if (time.strava) {
                        window.open(time.strava, '_blank');
                      }
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>{time.medalEmoji}</span>
                        <div>
                          <div style={{ 
                            color: '#fff', 
                            fontSize: '1.1rem', 
                            fontWeight: '600' 
                          }}>
                            {time.time}
                          </div>
                          <div style={{ 
                            color: '#ccc', 
                            fontSize: '0.9rem' 
                          }}>
                            {formatPace(time.pace)} per mile
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                          color: '#ff9500', 
                          fontSize: '0.95rem', 
                          fontWeight: '500' 
                        }}>
                          {time.race}
                        </div>
                        <div style={{ 
                          color: '#888', 
                          fontSize: '0.85rem' 
                        }}>
                          {format(new Date(time.date), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ThePulse;
