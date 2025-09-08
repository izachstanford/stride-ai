import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { format, parse, startOfYear, endOfYear, isWithinInterval, eachWeekOfInterval, endOfWeek, differenceInDays, eachDayOfInterval, isSameDay, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { AppData } from '../App';

interface InteractiveRunningChartProps {
  data: AppData;
  initialLevel: 'years' | 'months';
  selectedYear?: number;
  onYearChange?: (year: number) => void;
}

type DrillDownLevel = 'years' | 'months' | 'weeks' | 'days';

const InteractiveRunningChart: React.FC<InteractiveRunningChartProps> = ({ 
  data, 
  initialLevel, 
  selectedYear, 
  onYearChange 
}) => {
  const [drillDownLevel, setDrillDownLevel] = useState<DrillDownLevel>(initialLevel);
  const [selectedYearInternal, setSelectedYearInternal] = useState<number>(selectedYear || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<{weekStart: Date, weekIndex: number} | null>(null);

  // Use external year if provided, otherwise internal
  const currentYear = selectedYear || selectedYearInternal;

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
    
    return (
      elevationPerMile > 50 ||           // > 50 ft/mi elevation (very hilly terrain)
      dirtPercentage > 50                // > 50% of run on dirt/trail surface
    );
  };

  // Get available years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    data.activities
      .filter(act => isRunningActivity(act['Activity Type']))
      .forEach(act => {
        const date = parse(act['Activity Date'], 'MMM dd, yyyy, h:mm:ss a', new Date());
        const year = date.getFullYear();
        if (year >= 2016) { // Only include 2016 and later
          years.add(year);
        }
      });
    return Array.from(years).sort((a, b) => a - b); // Chronological order (oldest first)
  }, [data.activities]);

  // Yearly data aggregation
  const yearlyData = useMemo(() => {
    if (drillDownLevel !== 'years') return [];

    const runningActivities = data.activities
      .filter(act => isRunningActivity(act['Activity Type']))
      .map(act => ({
        ...act,
        date: parse(act['Activity Date'], 'MMM dd, yyyy, h:mm:ss a', new Date()),
        distance: act['Distance.1'] ? (act['Distance.1'] / 1609.34) : (parseFloat(act.Distance) || 0),
        hours: (act['Moving Time'] || 0) / 3600,
        isTrail: isTrailRun(act)
      }))
      .filter(act => act.date.getFullYear() >= 2016); // Only include 2016 and later

    const yearlyStats = [];
    
    // Sort years chronologically for the chart
    const sortedYears = [...availableYears].sort((a, b) => a - b);
    
    for (const year of sortedYears) {
      const yearStart = startOfYear(new Date(year, 0, 1));
      const yearEnd = endOfYear(yearStart);
      
      const yearActivities = runningActivities.filter(act =>
        isWithinInterval(act.date, { start: yearStart, end: yearEnd })
      );

      const totalMiles = yearActivities.reduce((sum, act) => sum + act.distance, 0);
      const totalHours = yearActivities.reduce((sum, act) => sum + act.hours, 0);
      
      // Trail vs road breakdown
      const trailActivities = yearActivities.filter(act => act.isTrail);
      const roadActivities = yearActivities.filter(act => !act.isTrail);
      const trailMiles = trailActivities.reduce((sum, act) => sum + act.distance, 0);
      const roadMiles = roadActivities.reduce((sum, act) => sum + act.distance, 0);
      
      // Calculate separate trail and road paces
      const trailHours = trailActivities.reduce((sum, act) => sum + act.hours, 0);
      const roadHours = roadActivities.reduce((sum, act) => sum + act.hours, 0);
      const trailPace = trailMiles > 0 ? (trailHours * 60) / trailMiles : null;
      const roadPace = roadMiles > 0 ? (roadHours * 60) / roadMiles : null;

      yearlyStats.push({
        year: year.toString(),
        runs: yearActivities.length,
        totalMiles: Math.round(totalMiles * 10) / 10,
        trailMiles: Math.round(trailMiles * 10) / 10,
        roadMiles: Math.round(roadMiles * 10) / 10,
        totalHours: Math.round(totalHours * 10) / 10,
        trailPace: trailPace ? Math.round(trailPace * 10) / 10 : null,
        roadPace: roadPace ? Math.round(roadPace * 10) / 10 : null
      });
    }

    return yearlyStats;
  }, [data.activities, availableYears]);

  // Monthly data aggregation (for when drilling down from years)
  const monthlyData = useMemo(() => {
    if (drillDownLevel !== 'months') return [];

    const yearStart = startOfYear(new Date(currentYear, 0, 1));
    const yearEnd = endOfYear(yearStart);
    
    const runningActivities = data.activities
      .filter(act => isRunningActivity(act['Activity Type']))
      .map(act => ({
        ...act,
        date: parse(act['Activity Date'], 'MMM dd, yyyy, h:mm:ss a', new Date()),
        distance: act['Distance.1'] ? (act['Distance.1'] / 1609.34) : (parseFloat(act.Distance) || 0),
        hours: (act['Moving Time'] || 0) / 3600,
        isTrail: isTrailRun(act)
      }))
      .filter(act => act.date.getFullYear() >= 2016) // Only include 2016 and later
      .filter(act => isWithinInterval(act.date, { start: yearStart, end: yearEnd }));

    const monthlyStats = [];
    
    for (let month = 0; month < 12; month++) {
      const monthStart = startOfMonth(new Date(currentYear, month, 1));
      const monthEnd = endOfMonth(monthStart);
      
      const monthRunning = runningActivities.filter(act =>
        isWithinInterval(act.date, { start: monthStart, end: monthEnd })
      );

      // Calculate trail vs road breakdown
      const monthTrail = monthRunning.filter(act => act.isTrail);
      const monthRoad = monthRunning.filter(act => !act.isTrail);
      const trailMiles = monthTrail.reduce((sum, act) => sum + act.distance, 0);
      const roadMiles = monthRoad.reduce((sum, act) => sum + act.distance, 0);
      
      // Calculate separate trail and road paces
      const trailHours = monthTrail.reduce((sum, act) => sum + act.hours, 0);
      const roadHours = monthRoad.reduce((sum, act) => sum + act.hours, 0);
      const trailPace = trailMiles > 0 ? (trailHours * 60) / trailMiles : null;
      const roadPace = roadMiles > 0 ? (roadHours * 60) / roadMiles : null;

      monthlyStats.push({
        monthNumber: month,
        month: format(monthStart, 'MMM'),
        runs: monthRunning.length,
        runningMiles: Math.round((trailMiles + roadMiles) * 10) / 10,
        trailMiles: Math.round(trailMiles * 10) / 10,
        roadMiles: Math.round(roadMiles * 10) / 10,
        runningHours: Math.round(monthRunning.reduce((sum, act) => sum + act.hours, 0) * 10) / 10,
        trailPace: trailPace ? Math.round(trailPace * 10) / 10 : null,
        roadPace: roadPace ? Math.round(roadPace * 10) / 10 : null
      });
    }

    return monthlyStats;
  }, [data.activities, currentYear, drillDownLevel]);

  // Weekly drill-down data (for selected month)
  const weeklyData = useMemo(() => {
    if (drillDownLevel !== 'weeks' || selectedMonth === null) return [];

    const monthStart = new Date(currentYear, selectedMonth, 1);
    const monthEnd = new Date(currentYear, selectedMonth + 1, 0);
    
    const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd });
    
    const runningActivities = data.activities
      .filter(act => isRunningActivity(act['Activity Type']))
      .map(act => ({
        ...act,
        date: parse(act['Activity Date'], 'MMM dd, yyyy, h:mm:ss a', new Date()),
        distance: act['Distance.1'] ? (act['Distance.1'] / 1609.34) : (parseFloat(act.Distance) || 0),
        hours: (act['Moving Time'] || 0) / 3600,
        isTrail: isTrailRun(act)
      }))
      .filter(act => act.date.getFullYear() >= 2016)
      .filter(act => isWithinInterval(act.date, { start: monthStart, end: monthEnd }));

    return weeks.map((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart);
      const weekActivities = runningActivities.filter(act =>
        isWithinInterval(act.date, { start: weekStart, end: weekEnd })
      );

      const totalMiles = weekActivities.reduce((sum, act) => sum + act.distance, 0);
      const totalHours = weekActivities.reduce((sum, act) => sum + act.hours, 0);
      
      // Trail vs road breakdown
      const trailActivities = weekActivities.filter(act => act.isTrail);
      const roadActivities = weekActivities.filter(act => !act.isTrail);
      const trailMiles = trailActivities.reduce((sum, act) => sum + act.distance, 0);
      const roadMiles = roadActivities.reduce((sum, act) => sum + act.distance, 0);
      
      // Calculate separate trail and road paces
      const trailHours = trailActivities.reduce((sum, act) => sum + act.hours, 0);
      const roadHours = roadActivities.reduce((sum, act) => sum + act.hours, 0);
      const trailPace = trailMiles > 0 ? (trailHours * 60) / trailMiles : null;
      const roadPace = roadMiles > 0 ? (roadHours * 60) / roadMiles : null;

      return {
        weekIndex: index,
        weekStart,
        week: `Week ${index + 1}`,
        weekOf: format(weekStart, 'MMM dd'),
        runs: weekActivities.length,
        miles: Math.round(totalMiles * 10) / 10,
        trailMiles: Math.round(trailMiles * 10) / 10,
        roadMiles: Math.round(roadMiles * 10) / 10,
        hours: Math.round(totalHours * 10) / 10,
        trailPace: trailPace ? Math.round(trailPace * 10) / 10 : null,
        roadPace: roadPace ? Math.round(roadPace * 10) / 10 : null
      };
    });
  }, [data.activities, currentYear, selectedMonth, drillDownLevel]);

  // Daily drill-down data (for selected week)
  const dailyData = useMemo(() => {
    if (drillDownLevel !== 'days' || !selectedWeek) return [];

    const weekEnd = endOfWeek(selectedWeek.weekStart);
    const days = eachDayOfInterval({ start: selectedWeek.weekStart, end: weekEnd });
    
    const runningActivities = data.activities
      .filter(act => isRunningActivity(act['Activity Type']))
      .map(act => ({
        ...act,
        date: parse(act['Activity Date'], 'MMM dd, yyyy, h:mm:ss a', new Date()),
        distance: act['Distance.1'] ? (act['Distance.1'] / 1609.34) : (parseFloat(act.Distance) || 0),
        hours: (act['Moving Time'] || 0) / 3600,
        isTrail: isTrailRun(act)
      }))
      .filter(act => act.date.getFullYear() >= 2016)
      .filter(act => isWithinInterval(act.date, { start: selectedWeek.weekStart, end: weekEnd }));

    return days.map((day) => {
      const dayActivities = runningActivities.filter(act =>
        isSameDay(act.date, day)
      );

      const totalMiles = dayActivities.reduce((sum, act) => sum + act.distance, 0);
      const totalHours = dayActivities.reduce((sum, act) => sum + act.hours, 0);

      // Trail vs road breakdown
      const trailActivities = dayActivities.filter(act => act.isTrail);
      const roadActivities = dayActivities.filter(act => !act.isTrail);
      const trailMiles = trailActivities.reduce((sum, act) => sum + act.distance, 0);
      const roadMiles = roadActivities.reduce((sum, act) => sum + act.distance, 0);
      
      // Calculate separate trail and road paces
      const trailHours = trailActivities.reduce((sum, act) => sum + act.hours, 0);
      const roadHours = roadActivities.reduce((sum, act) => sum + act.hours, 0);
      const trailPace = trailMiles > 0 ? (trailHours * 60) / trailMiles : null;
      const roadPace = roadMiles > 0 ? (roadHours * 60) / roadMiles : null;

      // Get activity details for tooltip
      const activities = dayActivities.map(act => ({
        name: act['Activity Name'] || 'Run',
        distance: Math.round(act.distance * 10) / 10,
        time: Math.round(act.hours * 60), // minutes
        pace: act.distance > 0 ? Math.round((act.hours * 60) / act.distance * 10) / 10 : 0,
        isTrail: act.isTrail,
        activityId: act['Activity ID'],
        stravaUrl: act['Activity ID'] ? `https://www.strava.com/activities/${act['Activity ID']}` : null
      }));

      return {
        dayOfWeek: format(day, 'EEE'), // Mon, Tue, etc.
        date: format(day, 'MMM dd'),
        fullDate: day,
        runs: dayActivities.length,
        miles: Math.round(totalMiles * 10) / 10,
        trailMiles: Math.round(trailMiles * 10) / 10,
        roadMiles: Math.round(roadMiles * 10) / 10,
        hours: Math.round(totalHours * 10) / 10,
        trailPace: trailPace ? Math.round(trailPace * 10) / 10 : null,
        roadPace: roadPace ? Math.round(roadPace * 10) / 10 : null,
        activities
      };
    });
  }, [data.activities, selectedWeek, drillDownLevel]);

  const handleYearClick = (data: any) => {
    if (data && data.activeLabel) {
      const year = parseInt(data.activeLabel);
      setSelectedYearInternal(year);
      if (onYearChange) onYearChange(year);
      setDrillDownLevel('months');
      setSelectedMonth(null);
      setSelectedWeek(null);
    }
  };

  const handleMonthClick = (data: any) => {
    if (data && data.activeLabel) {
      const monthData = monthlyData.find(m => m.month === data.activeLabel);
      if (monthData) {
        setSelectedMonth(monthData.monthNumber);
        setDrillDownLevel('weeks');
        setSelectedWeek(null);
      }
    }
  };

  const handleWeekClick = (data: any) => {
    if (data && data.activeLabel) {
      const weekData = weeklyData.find(w => w.week === data.activeLabel);
      if (weekData) {
        setSelectedWeek({ weekStart: weekData.weekStart, weekIndex: weekData.weekIndex });
        setDrillDownLevel('days');
      }
    }
  };

  const handleDayClick = (data: any) => {
    if (data && data.activeLabel) {
      // Find the corresponding day data
      const clickedDay = dailyData.find(day => day.dayOfWeek === data.activeLabel);
      if (clickedDay && clickedDay.activities && clickedDay.activities.length > 0) {
        const firstActivity = clickedDay.activities[0];
        if (firstActivity.stravaUrl) {
          window.open(firstActivity.stravaUrl, '_blank');
        }
      }
    }
  };

  const renderChart = () => {
    if (drillDownLevel === 'years') {
      return (
        <ComposedChart 
          data={yearlyData}
          onClick={handleYearClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="year" 
            stroke="#ccc" 
            fontSize={12}
          />
          <YAxis 
            yAxisId="miles"
            stroke="#ff9500" 
            fontSize={12}
            label={{ value: 'Miles', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#ff9500' } }}
          />
          <YAxis 
            yAxisId="pace"
            orientation="right"
            stroke="#888" 
            fontSize={12}
            label={{ value: 'Pace (min/mi)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#888' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a1a', 
              border: '1px solid #333', 
              borderRadius: '8px',
              color: '#fff'
            }}
            labelStyle={{ color: '#ff9500' }}
            formatter={(value, name) => {
              if (name === 'roadMiles') return [value, 'Road Miles'];
              if (name === 'trailMiles') return [value, 'Trail Miles'];
              if (name === 'roadPace') return [value ? `${value} min/mi` : 'N/A', 'Road Pace'];
              if (name === 'trailPace') return [value ? `${value} min/mi` : 'N/A', 'Trail Pace'];
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0] && payload[0].payload) {
                const yearData = payload[0].payload;
                const totalMiles = (yearData.roadMiles || 0) + (yearData.trailMiles || 0);
                return (
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      {label}
                    </div>
                    <div style={{ color: '#ff9500', fontWeight: 'bold', fontSize: '1rem' }}>
                      Total: {totalMiles} miles
                    </div>
                  </div>
                );
              }
              return label;
            }}
          />
          <Bar 
            yAxisId="miles"
            dataKey="roadMiles" 
            stackId="miles"
            fill="#ff9500" 
            radius={[0, 0, 0, 0]}
            name="roadMiles"
          />
          <Bar 
            yAxisId="miles"
            dataKey="trailMiles" 
            stackId="miles"
            fill="#8B4513" 
            radius={[4, 4, 0, 0]}
            name="trailMiles"
          />
          <Line 
            yAxisId="pace"
            type="monotone" 
            dataKey="roadPace" 
            stroke="#ff9500" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#ff9500', strokeWidth: 0, r: 4 }}
            name="roadPace"
            connectNulls={false}
          />
          <Line 
            yAxisId="pace"
            type="monotone" 
            dataKey="trailPace" 
            stroke="#8B4513" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#8B4513', strokeWidth: 0, r: 4 }}
            name="trailPace"
            connectNulls={false}
          />
        </ComposedChart>
      );
    }

    if (drillDownLevel === 'months') {
      return (
        <ComposedChart 
          data={monthlyData}
          onClick={handleMonthClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="month" 
            stroke="#ccc" 
            fontSize={12}
          />
          <YAxis 
            yAxisId="miles"
            stroke="#ff9500" 
            fontSize={12}
            label={{ value: 'Miles', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#ff9500' } }}
          />
          <YAxis 
            yAxisId="pace"
            orientation="right"
            stroke="#888" 
            fontSize={12}
            label={{ value: 'Pace (min/mi)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#888' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a1a', 
              border: '1px solid #333', 
              borderRadius: '8px',
              color: '#fff'
            }}
            labelStyle={{ color: '#ff9500' }}
            formatter={(value, name, props) => {
              if (name === 'roadMiles') return [value, 'Road Miles'];
              if (name === 'trailMiles') return [value, 'Trail Miles'];
              if (name === 'roadPace') return [value ? `${value} min/mi` : 'N/A', 'Road Pace'];
              if (name === 'trailPace') return [value ? `${value} min/mi` : 'N/A', 'Trail Pace'];
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0] && payload[0].payload) {
                const monthData = payload[0].payload;
                const totalMiles = (monthData.roadMiles || 0) + (monthData.trailMiles || 0);
                return (
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      {label}
                    </div>
                    <div style={{ color: '#ff9500', fontWeight: 'bold', fontSize: '1rem' }}>
                      Total: {totalMiles} miles
                    </div>
                  </div>
                );
              }
              return label;
            }}
          />
          <Bar 
            yAxisId="miles"
            dataKey="roadMiles" 
            stackId="miles"
            fill="#ff9500" 
            radius={[0, 0, 0, 0]}
            name="roadMiles"
          />
          <Bar 
            yAxisId="miles"
            dataKey="trailMiles" 
            stackId="miles"
            fill="#8B4513" 
            radius={[4, 4, 0, 0]}
            name="trailMiles"
          />
          <Line 
            yAxisId="pace"
            type="monotone" 
            dataKey="roadPace" 
            stroke="#ff9500" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#ff9500', strokeWidth: 0, r: 4 }}
            name="roadPace"
            connectNulls={false}
          />
          <Line 
            yAxisId="pace"
            type="monotone" 
            dataKey="trailPace" 
            stroke="#8B4513" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#8B4513', strokeWidth: 0, r: 4 }}
            name="trailPace"
            connectNulls={false}
          />
        </ComposedChart>
      );
    }

    if (drillDownLevel === 'weeks') {
      return (
        <ComposedChart 
          data={weeklyData}
          onClick={handleWeekClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="week" 
            stroke="#ccc" 
            fontSize={12}
          />
          <YAxis 
            yAxisId="miles"
            stroke="#ff9500" 
            fontSize={12}
            label={{ value: 'Miles', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#ff9500' } }}
          />
          <YAxis 
            yAxisId="pace"
            orientation="right"
            stroke="#888" 
            fontSize={12}
            label={{ value: 'Pace (min/mi)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#888' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a1a', 
              border: '1px solid #333', 
              borderRadius: '8px',
              color: '#fff'
            }}
            labelStyle={{ color: '#ff9500' }}
            formatter={(value, name) => {
              if (name === 'roadMiles') return [value, 'Road Miles'];
              if (name === 'trailMiles') return [value, 'Trail Miles'];
              if (name === 'roadPace') return [value ? `${value} min/mi` : 'N/A', 'Road Pace'];
              if (name === 'trailPace') return [value ? `${value} min/mi` : 'N/A', 'Trail Pace'];
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0] && payload[0].payload) {
                const weekData = payload[0].payload;
                const totalMiles = (weekData.roadMiles || 0) + (weekData.trailMiles || 0);
                return (
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      {label}
                    </div>
                    <div style={{ color: '#ff9500', fontWeight: 'bold', fontSize: '1rem' }}>
                      Total: {totalMiles} miles
                    </div>
                  </div>
                );
              }
              return label;
            }}
          />
          <Bar 
            yAxisId="miles"
            dataKey="roadMiles" 
            stackId="miles"
            fill="#ff9500" 
            radius={[0, 0, 0, 0]}
          />
          <Bar 
            yAxisId="miles"
            dataKey="trailMiles" 
            stackId="miles"
            fill="#8B4513" 
            radius={[4, 4, 0, 0]}
          />
          <Line 
            yAxisId="pace"
            type="monotone" 
            dataKey="roadPace" 
            stroke="#ff9500" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#ff9500', strokeWidth: 0, r: 4 }}
            name="roadPace"
            connectNulls={false}
          />
          <Line 
            yAxisId="pace"
            type="monotone" 
            dataKey="trailPace" 
            stroke="#8B4513" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#8B4513', strokeWidth: 0, r: 4 }}
            name="trailPace"
            connectNulls={false}
          />
        </ComposedChart>
      );
    }

    if (drillDownLevel === 'days') {
      return (
        <ComposedChart 
          data={dailyData}
          onClick={handleDayClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="dayOfWeek" 
            stroke="#ccc" 
            fontSize={12}
          />
          <YAxis 
            yAxisId="miles"
            stroke="#ff9500" 
            fontSize={12}
            label={{ value: 'Miles', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#ff9500' } }}
          />
          <YAxis 
            yAxisId="pace"
            orientation="right"
            stroke="#888" 
            fontSize={12}
            label={{ value: 'Pace (min/mi)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#888' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a1a', 
              border: '1px solid #333', 
              borderRadius: '8px',
              color: '#fff',
              pointerEvents: 'auto',
              cursor: 'pointer',
              zIndex: 1000
            }}
            labelStyle={{ color: '#ff9500' }}
            wrapperStyle={{ pointerEvents: 'auto' }}
            allowEscapeViewBox={{ x: false, y: false }}
            formatter={(value, name, props) => {
              if (name === 'roadMiles' || name === 'trailMiles') {
                const dayData = props.payload;
                if (dayData && dayData.activities && dayData.activities.length > 0 && value > 0) {
                  const typeLabel = name === 'roadMiles' ? 'Road' : 'Trail';
                  const filteredActivities = dayData.activities
                    .filter((activity: any) => name === 'trailMiles' ? activity.isTrail : !activity.isTrail);
                  
                  if (filteredActivities.length === 0) {
                    return null;
                  }
                  
                  return [
                    <>
                      <div>{value} {typeLabel.toLowerCase()} miles</div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                        {filteredActivities.map((activity: any, index: number) => (
                          <div key={index} style={{ color: '#ccc', marginBottom: '0.25rem' }}>
                            <div>
                              {activity.name}: {activity.distance}mi in {activity.time}min
                              {activity.pace > 0 && ` (${activity.pace} min/mi)`}
                            </div>
                            {activity.stravaUrl && (
                              <div style={{ fontSize: '0.8rem' }}>
                                <a 
                                  href={activity.stravaUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ color: '#ff9500', textDecoration: 'none' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  🔗 Click bar to view run on Strava
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>,
                    `${dayData.date}`
                  ];
                }
                return null;
              }
              if (name === 'roadPace') return [value ? `${value} min/mi` : 'N/A', 'Road Pace'];
              if (name === 'trailPace') return [value ? `${value} min/mi` : 'N/A', 'Trail Pace'];
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0] && payload[0].payload) {
                const dayData = payload[0].payload;
                const totalMiles = (dayData.roadMiles || 0) + (dayData.trailMiles || 0);
                return (
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      {dayData.dayOfWeek}, {dayData.date}
                    </div>
                    <div style={{ color: '#ff9500', fontWeight: 'bold', fontSize: '1rem' }}>
                      Total: {totalMiles} miles
                    </div>
                  </div>
                );
              }
              return label;
            }}
          />
          <Bar 
            yAxisId="miles"
            dataKey="roadMiles" 
            stackId="miles"
            fill="#ff9500" 
            radius={[0, 0, 0, 0]}
            cursor="pointer"
          />
          <Bar 
            yAxisId="miles"
            dataKey="trailMiles" 
            stackId="miles"
            fill="#8B4513" 
            radius={[4, 4, 0, 0]}
            cursor="pointer"
          />
          <Line 
            yAxisId="pace"
            type="monotone" 
            dataKey="roadPace" 
            stroke="#ff9500" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#ff9500', strokeWidth: 0, r: 4 }}
            name="roadPace"
            connectNulls={false}
          />
          <Line 
            yAxisId="pace"
            type="monotone" 
            dataKey="trailPace" 
            stroke="#8B4513" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#8B4513', strokeWidth: 0, r: 4 }}
            name="trailPace"
            connectNulls={false}
          />
        </ComposedChart>
      );
    }

    return <div>No data available</div>;
  };

  const getHelpText = () => {
    switch (drillDownLevel) {
      case 'years':
        return (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>
              🟠 Road Miles/Pace • 🟤 Trail Miles/Pace
            </p>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
              💡 Click bar to drill down to months
            </p>
          </div>
        );
      case 'months':
        return (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>
              🟠 Road Miles/Pace • 🟤 Trail Miles/Pace
            </p>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
              💡 Click bar to drill down to weeks
            </p>
          </div>
        );
      case 'weeks':
        return (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>
              🟠 Road Miles • 🟤 Trail Miles
            </p>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
              💡 Click bar to drill down to days
            </p>
          </div>
        );
      case 'days':
        return (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>
              🟠 Road Miles • 🟤 Trail Miles
            </p>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
              💡 Click bar to view run on Strava
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const getChartTitle = () => {
    switch (drillDownLevel) {
      case 'years':
        return 'Yearly Overview';
      case 'months':
        return `${currentYear} Monthly Overview`;
      case 'weeks':
        return `${format(new Date(currentYear, selectedMonth || 0, 1), 'MMMM yyyy')} Weekly Breakdown`;
      case 'days':
        return selectedWeek ? `Week of ${format(selectedWeek.weekStart, 'MMM dd, yyyy')}` : 'Daily Breakdown';
      default:
        return 'Running Overview';
    }
  };

  const handleBackClick = () => {
    if (drillDownLevel === 'days') {
      setDrillDownLevel('weeks');
      setSelectedWeek(null);
    } else if (drillDownLevel === 'weeks') {
      setDrillDownLevel('months');
      setSelectedMonth(null);
    } else if (drillDownLevel === 'months') {
      setDrillDownLevel(initialLevel);
      setSelectedYearInternal(selectedYear || new Date().getFullYear()); // Reset to initial year if external
      setSelectedMonth(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: '#ff9500', fontSize: '1.2rem', margin: 0, textAlign: 'center', flex: 1 }}>
          {getChartTitle()}
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {drillDownLevel !== initialLevel && (
            <button
              className="filter-select"
              onClick={handleBackClick}
              style={{ 
                padding: '0.5rem 1rem', 
                cursor: 'pointer',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap'
              }}
            >
              ← Back to {drillDownLevel === 'days' ? 'Weeks' : drillDownLevel === 'weeks' ? 'Months' : 'Years'}
            </button>
          )}
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={400}>
        {renderChart()}
      </ResponsiveContainer>
      
      {getHelpText()}
    </div>
  );
};

export default InteractiveRunningChart;
