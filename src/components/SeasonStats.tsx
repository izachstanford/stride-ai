import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { format, parse, startOfYear, endOfYear, isWithinInterval, eachWeekOfInterval, endOfWeek, differenceInDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { AppData } from '../App';
import { Calendar, Target, TrendingUp, Award, Activity, Clock, Zap, BarChart3 } from 'lucide-react';
import InteractiveRunningChart from './InteractiveRunningChart';

interface SeasonStatsProps {
  data: AppData;
}

const SeasonStats: React.FC<SeasonStatsProps> = ({ data }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [drillDownLevel, setDrillDownLevel] = useState<'months' | 'weeks' | 'days'>('months');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<{ weekStart: Date; weekIndex: number } | null>(null);
  const [raceFilter, setRaceFilter] = useState('All');
  const [hoveredTooltip, setHoveredTooltip] = useState<{ field: string; content: string; x: number; y: number } | null>(null);

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

  // Helper functions for race table
  const timeToSeconds = (timeStr: string): number => {
    if (!timeStr || timeStr === 'N/A') return 0;
    
    // Handle "1900-01-01T..." format
    if (timeStr.includes('1900-01-01T') || timeStr.includes('1900-01-02T')) {
      const timePart = timeStr.split('T')[1];
      const [hours, minutes, seconds] = timePart.split(':').map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    }
    
    // Handle "HH:MM:SS" format
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts.map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  };

  const formatTime = (timeStr: string): string => {
    if (!timeStr || timeStr === 'N/A') return 'N/A';
    
    // Handle "1900-01-01T..." format
    if (timeStr.includes('1900-01-01T') || timeStr.includes('1900-01-02T')) {
      const timePart = timeStr.split('T')[1];
      return timePart;
    }
    
    return timeStr;
  };

  const getRaceCategory = (distance: number): string => {
    if (Math.abs(distance - 26.2) < 0.1) return 'Marathon';
    if (Math.abs(distance - 13.1) < 0.1) return 'Half';
    if (Math.abs(distance - 3.1) < 0.1) return '5K';
    return 'Other';
  };

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

  // Running-focused stats
  const runningStats = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(yearStart);
    
    const yearActivities = data.activities
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

    const totalRuns = yearActivities.length;
    const totalMiles = yearActivities.reduce((sum, act) => sum + act.distance, 0);
    const totalHours = yearActivities.reduce((sum, act) => sum + act.hours, 0);
    
    // Trail vs Road metrics
    const trailRuns = yearActivities.filter(act => act.isTrail);
    const roadRuns = yearActivities.filter(act => !act.isTrail);
    const trailMiles = trailRuns.reduce((sum, act) => sum + act.distance, 0);
    const roadMiles = roadRuns.reduce((sum, act) => sum + act.distance, 0);
    const trailPercentage = totalRuns > 0 ? (trailRuns.length / totalRuns) * 100 : 0;
    
    // Calculate advanced running metrics
    const weeksInYear = Math.ceil((Math.min(new Date().getTime(), yearEnd.getTime()) - yearStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const avgWeeklyMiles = totalMiles / Math.max(weeksInYear, 1);
    const avgPace = totalHours > 0 ? (totalHours * 60) / totalMiles : 0; // minutes per mile
    const avgRunDistance = totalRuns > 0 ? totalMiles / totalRuns : 0;
    
    // Find performance peaks
    const weeks = eachWeekOfInterval({ start: yearStart, end: yearEnd });
    let biggestWeek = { miles: 0, date: yearStart, runs: 0 };
    let longestRun = { distance: 0, date: yearStart, name: '' };
    let fastestPace = { pace: Infinity, date: yearStart, distance: 0 };
    
    weeks.forEach(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const weekActivities = yearActivities.filter(act => 
        isWithinInterval(act.date, { start: weekStart, end: weekEnd })
      );
      const weekMiles = weekActivities.reduce((sum, act) => sum + act.distance, 0);
      
      if (weekMiles > biggestWeek.miles) {
        biggestWeek = { miles: weekMiles, date: weekStart, runs: weekActivities.length };
      }
    });

    // Find longest run and fastest pace
    yearActivities.forEach(act => {
      if (act.distance > longestRun.distance) {
        longestRun = {
          distance: act.distance,
          date: act.date,
          name: act['Activity Name'] || 'Long Run'
        };
      }
      
      if (act.hours > 0 && act.distance > 3) { // Only consider runs > 3 miles for pace
        const pace = (act.hours * 60) / act.distance;
        if (pace < fastestPace.pace) {
          fastestPace = { pace, date: act.date, distance: act.distance };
        }
      }
    });

    // Calculate consistency metrics
    const runningDays = new Set(yearActivities.map(act => format(act.date, 'yyyy-MM-dd'))).size;
    const daysInYear = differenceInDays(new Date() < yearEnd ? new Date() : yearEnd, yearStart) + 1;
    const consistencyPercent = (runningDays / daysInYear) * 100;

    return {
      totalRuns,
      totalMiles: Math.round(totalMiles),
      totalHours: Math.round(totalHours),
      avgWeeklyMiles: Math.round(avgWeeklyMiles * 10) / 10,
      avgPace: Math.round(avgPace * 10) / 10,
      avgRunDistance: Math.round(avgRunDistance * 10) / 10,
      biggestWeek: Math.round(biggestWeek.miles * 10) / 10,
      biggestWeekDate: biggestWeek.date,
      biggestWeekRuns: biggestWeek.runs,
      longestRun: Math.round(longestRun.distance * 10) / 10,
      longestRunDate: longestRun.date,
      longestRunName: longestRun.name,
      fastestPace: fastestPace.pace !== Infinity ? Math.round(fastestPace.pace * 10) / 10 : null,
      fastestPaceDate: fastestPace.date,
      fastestPaceDistance: Math.round(fastestPace.distance * 10) / 10,
      runningDays,
      consistencyPercent: Math.round(consistencyPercent * 10) / 10,
      // Trail metrics
      trailRuns: trailRuns.length,
      roadRuns: roadRuns.length,
      trailMiles: Math.round(trailMiles * 10) / 10,
      roadMiles: Math.round(roadMiles * 10) / 10,
      trailPercentage: Math.round(trailPercentage * 10) / 10
    };
  }, [data.activities, selectedYear]);

  // Overall fitness stats
  const fitnessStats = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(yearStart);
    
    const allYearActivities = data.activities
      .map(act => ({
        ...act,
        date: parse(act['Activity Date'], 'MMM dd, yyyy, h:mm:ss a', new Date()),
        distance: act['Distance.1'] ? (act['Distance.1'] / 1609.34) : (parseFloat(act.Distance) || 0),
        hours: (act['Moving Time'] || 0) / 3600
      }))
      .filter(act => act.date.getFullYear() >= 2016) // Only include 2016 and later
      .filter(act => isWithinInterval(act.date, { start: yearStart, end: yearEnd }));

    const totalActivities = allYearActivities.length;
    const totalHours = allYearActivities.reduce((sum, act) => sum + act.hours, 0);
    const totalCalories = allYearActivities.reduce((sum, act) => sum + (act.Calories || 0), 0);
    const uniqueActivityTypes = new Set(allYearActivities.map(act => act['Activity Type'])).size;
    
    // Calculate cross-training metrics
    const nonRunningActivities = allYearActivities.filter(act => !isRunningActivity(act['Activity Type']));
    const crossTrainingHours = nonRunningActivities.reduce((sum, act) => sum + act.hours, 0);
    const crossTrainingPercent = totalHours > 0 ? (crossTrainingHours / totalHours) * 100 : 0;

    return {
      totalActivities,
      totalHours: Math.round(totalHours),
      totalCalories: Math.round(totalCalories),
      uniqueActivityTypes,
      crossTrainingHours: Math.round(crossTrainingHours),
      crossTrainingPercent: Math.round(crossTrainingPercent)
    };
  }, [data.activities, selectedYear]);

  // Monthly drill-down data
  const monthlyData = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
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

    const allActivities = data.activities
      .map(act => ({
        ...act,
        date: parse(act['Activity Date'], 'MMM dd, yyyy, h:mm:ss a', new Date()),
        distance: act['Distance.1'] ? (act['Distance.1'] / 1609.34) : (parseFloat(act.Distance) || 0),
        hours: (act['Moving Time'] || 0) / 3600
      }))
      .filter(act => act.date.getFullYear() >= 2016) // Only include 2016 and later
      .filter(act => isWithinInterval(act.date, { start: yearStart, end: yearEnd }));

    const monthlyStats = [];
    
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(selectedYear, month, 1);
      const monthEnd = new Date(selectedYear, month + 1, 0);
      
      const monthRunning = runningActivities.filter(act =>
        isWithinInterval(act.date, { start: monthStart, end: monthEnd })
      );

      const monthAll = allActivities.filter(act =>
        isWithinInterval(act.date, { start: monthStart, end: monthEnd })
      );

      // Calculate trail vs road breakdown
      const monthTrail = monthRunning.filter(act => act.isTrail);
      const monthRoad = monthRunning.filter(act => !act.isTrail);
      const trailMiles = monthTrail.reduce((sum, act) => sum + act.distance, 0);
      const roadMiles = monthRoad.reduce((sum, act) => sum + act.distance, 0);
      
      // Calculate average pace for the month (overall and by type)
      const totalRunningHours = monthRunning.reduce((sum, act) => sum + act.hours, 0);
      const totalRunningMiles = monthRunning.reduce((sum, act) => sum + act.distance, 0);
      const avgPace = totalRunningMiles > 0 ? (totalRunningHours * 60) / totalRunningMiles : 0;
      
      // Calculate separate trail and road paces
      const trailHours = monthTrail.reduce((sum, act) => sum + act.hours, 0);
      const roadHours = monthRoad.reduce((sum, act) => sum + act.hours, 0);
      const trailPace = trailMiles > 0 ? (trailHours * 60) / trailMiles : null;
      const roadPace = roadMiles > 0 ? (roadHours * 60) / roadMiles : null;

      monthlyStats.push({
        monthNumber: month,
        month: format(monthStart, 'MMM'),
        runs: monthRunning.length,
        runningMiles: Math.round(totalRunningMiles * 10) / 10,
        trailMiles: Math.round(trailMiles * 10) / 10,
        roadMiles: Math.round(roadMiles * 10) / 10,
        runningHours: Math.round(totalRunningHours * 10) / 10,
        allActivities: monthAll.length,
        allHours: Math.round(monthAll.reduce((sum, act) => sum + act.hours, 0) * 10) / 10,
        avgPace: avgPace > 0 ? Math.round(avgPace * 10) / 10 : null,
        trailPace: trailPace ? Math.round(trailPace * 10) / 10 : null,
        roadPace: roadPace ? Math.round(roadPace * 10) / 10 : null
      });
    }

    return monthlyStats;
  }, [data.activities, selectedYear]);

  // Weekly drill-down data (for selected month)
  const weeklyData = useMemo(() => {
    if (selectedMonth === null) return [];

    const monthStart = new Date(selectedYear, selectedMonth, 1);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
    
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
      .filter(act => act.date.getFullYear() >= 2016) // Only include 2016 and later
      .filter(act => isWithinInterval(act.date, { start: monthStart, end: monthEnd }));

    return weeks.map((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart);
      const weekActivities = runningActivities.filter(act =>
        isWithinInterval(act.date, { start: weekStart, end: weekEnd })
      );

      const totalMiles = weekActivities.reduce((sum, act) => sum + act.distance, 0);
      const totalHours = weekActivities.reduce((sum, act) => sum + act.hours, 0);
      const avgPace = totalMiles > 0 ? (totalHours * 60) / totalMiles : 0;
      
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
        avgPace: avgPace > 0 ? Math.round(avgPace * 10) / 10 : null,
        trailPace: trailPace ? Math.round(trailPace * 10) / 10 : null,
        roadPace: roadPace ? Math.round(roadPace * 10) / 10 : null
      };
    });
  }, [data.activities, selectedYear, selectedMonth]);

  // Daily drill-down data (for selected week)
  const dailyData = useMemo(() => {
    if (!selectedWeek) return [];

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
      .filter(act => act.date.getFullYear() >= 2016) // Only include 2016 and later
      .filter(act => isWithinInterval(act.date, { start: selectedWeek.weekStart, end: weekEnd }));

    return days.map((day) => {
      const dayActivities = runningActivities.filter(act =>
        isSameDay(act.date, day)
      );

      const totalMiles = dayActivities.reduce((sum, act) => sum + act.distance, 0);
      const totalHours = dayActivities.reduce((sum, act) => sum + act.hours, 0);
      const avgPace = totalMiles > 0 ? (totalHours * 60) / totalMiles : 0;

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
        avgPace: avgPace > 0 ? Math.round(avgPace * 10) / 10 : null,
        trailPace: trailPace ? Math.round(trailPace * 10) / 10 : null,
        roadPace: roadPace ? Math.round(roadPace * 10) / 10 : null,
        activities
      };
    });
  }, [data.activities, selectedWeek]);

  const yearRaces = useMemo(() => {
    return data.races
      .filter(race => new Date(race.date).getFullYear() === selectedYear)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data.races, selectedYear]);

  // Calculate race stats for PR detection
  const raceStats = useMemo(() => {
    const validRaces = data.races.filter(race => race.time && race.time !== 'N/A');
    
    // Calculate best times for each distance category
    const bestTimes: { [key: string]: { time: string; race: string; date: string; timeSeconds: number } } = {};
    
    ['Marathon', 'Half', '5K', 'Other'].forEach(category => {
      const targetDistance = category === 'Marathon' ? 26.2 :
                            category === 'Half' ? 13.1 :
                            category === '5K' ? 3.1 : 0;

      let categoryRaces;
      if (category === 'Other') {
        categoryRaces = validRaces.filter(race => 
          Math.abs(race.distance - 26.2) >= 0.1 && 
          Math.abs(race.distance - 13.1) >= 0.1 && 
          Math.abs(race.distance - 3.1) >= 0.1
        );
      } else {
        categoryRaces = validRaces.filter(race => Math.abs(race.distance - targetDistance) < 0.1);
      }

      if (categoryRaces.length > 0) {
        let bestRace = categoryRaces[0];
        let bestTimeSeconds = timeToSeconds(bestRace.time);

        categoryRaces.forEach(race => {
          const raceTimeSeconds = timeToSeconds(race.time);
          if (raceTimeSeconds < bestTimeSeconds && raceTimeSeconds > 0) {
            bestRace = race;
            bestTimeSeconds = raceTimeSeconds;
          }
        });

        bestTimes[category] = {
          time: formatTime(bestRace.time),
          race: bestRace.race,
          date: bestRace.date,
          timeSeconds: bestTimeSeconds
        };
      }
    });

    return { bestTimes };
  }, [data.races]);

  // Filter races for table
  const filteredRacesForTable = useMemo(() => {
    let filtered = yearRaces;
    
    if (raceFilter !== 'All') {
      const targetDistance = raceFilter === 'Marathon' ? 26.2 :
                            raceFilter === 'Half' ? 13.1 :
                            raceFilter === '5K' ? 3.1 : 0;
      
      if (raceFilter === 'Other') {
        filtered = filtered.filter(race => 
          Math.abs(race.distance - 26.2) >= 0.1 && 
          Math.abs(race.distance - 13.1) >= 0.1 && 
          Math.abs(race.distance - 3.1) >= 0.1
        );
      } else {
        filtered = filtered.filter(race => Math.abs(race.distance - targetDistance) < 0.1);
      }
    }
    
    return filtered;
  }, [yearRaces, raceFilter]);

  return (
    <div>
      {/* Filters */}
      <div className="filters">
        <select 
          className="filter-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
        >
          {availableYears.map(year => (
            <option key={year} value={year}>{year} Season</option>
          ))}
        </select>
      </div>

      {/* Interactive Charts Section - MOVED TO TOP */}
      <div className="chart-container" style={{ marginBottom: '2rem' }}>
        <InteractiveRunningChart 
          data={data}
          initialLevel="months"
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
        />
      </div>

      {/* Running Performance Section */}
      <div>
        <h2 style={{ color: '#ff9500', fontSize: '1.5rem', marginBottom: '2rem', fontWeight: '600' }}>
          Running Performance
        </h2>
        
        {/* 1. Volume Metrics */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#ccc', fontSize: '1.1rem', marginBottom: '1rem', fontWeight: '500' }}>
            📊 Volume Metrics
          </h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">
                <Target size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Total Runs
              </div>
              <div className="stat-value">{runningStats.totalRuns.toLocaleString()}</div>
              <div className="stat-subtitle">{selectedYear} activities</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <TrendingUp size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Running Miles
              </div>
              <div className="stat-value">{runningStats.totalMiles.toLocaleString()}</div>
              <div className="stat-subtitle">Distance covered</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <Clock size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Running Hours
              </div>
              <div className="stat-value">{runningStats.totalHours}</div>
              <div className="stat-subtitle">Time training</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <Calendar size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Weekly Average
              </div>
              <div className="stat-value">{runningStats.avgWeeklyMiles}</div>
              <div className="stat-subtitle">Miles per week</div>
            </div>
          </div>
        </div>

        {/* 2. Performance Metrics */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#ccc', fontSize: '1.1rem', marginBottom: '1rem', fontWeight: '500' }}>
            ⚡ Performance Metrics
          </h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">
                <Zap size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Average Pace
              </div>
              <div className="stat-value">{runningStats.avgPace}</div>
              <div className="stat-subtitle">minutes per mile</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <Activity size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Average Run
              </div>
              <div className="stat-value">{runningStats.avgRunDistance}</div>
              <div className="stat-subtitle">Miles per run</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <BarChart3 size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Consistency
              </div>
              <div className="stat-value">{runningStats.consistencyPercent}%</div>
              <div className="stat-subtitle">{runningStats.runningDays} running days</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <Award size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Races
              </div>
              <div className="stat-value">{yearRaces.length}</div>
              <div className="stat-subtitle">Events completed</div>
            </div>
          </div>
        </div>

        {/* 3. Trail vs Road Analysis */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#ccc', fontSize: '1.1rem', marginBottom: '1rem', fontWeight: '500' }}>
            🏔️ Trail vs Road Analysis
          </h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">🏔️ Trail Runs</div>
              <div className="stat-value">{runningStats.trailPercentage}%</div>
              <div className="stat-subtitle">{runningStats.trailRuns} of {runningStats.totalRuns} runs</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">🟠 Road Miles</div>
              <div className="stat-value">{runningStats.roadMiles}</div>
              <div className="stat-subtitle">{runningStats.roadRuns} road runs</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">🟤 Trail Miles</div>
              <div className="stat-value">{runningStats.trailMiles}</div>
              <div className="stat-subtitle">{runningStats.trailRuns} trail runs</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">🛤️ Trail Preference</div>
              <div className="stat-value">{runningStats.trailPercentage > 50 ? 'Trail' : runningStats.trailPercentage > 25 ? 'Mixed' : 'Road'}</div>
              <div className="stat-subtitle">{runningStats.trailPercentage}% trail running</div>
            </div>
          </div>
        </div>

        {/* 4. Peak Achievements */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#ccc', fontSize: '1.1rem', marginBottom: '1rem', fontWeight: '500' }}>
            🏆 Peak Achievements
          </h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">🔥 Biggest Week</div>
              <div className="stat-value">{runningStats.biggestWeek}</div>
              <div className="stat-subtitle">
                miles • {runningStats.biggestWeekRuns} runs • {format(runningStats.biggestWeekDate, 'MMM dd')}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">📏 Longest Run</div>
              <div className="stat-value">{runningStats.longestRun}</div>
              <div className="stat-subtitle">
                miles • {format(runningStats.longestRunDate, 'MMM dd')}
              </div>
            </div>

            {runningStats.fastestPace && (
              <div className="stat-card">
                <div className="stat-label">⚡ Fastest Pace</div>
                <div className="stat-value">{runningStats.fastestPace}</div>
                <div className="stat-subtitle">
                  min/mi • {runningStats.fastestPaceDistance}mi • {format(runningStats.fastestPaceDate, 'MMM dd')}
                </div>
              </div>
            )}

            <div className="stat-card">
              <div className="stat-label">📅 Best Month</div>
              <div className="stat-value">{Math.max(...Array.from({length: 12}, (_, i) => {
                const monthStart = new Date(selectedYear, i, 1);
                const monthEnd = new Date(selectedYear, i + 1, 0);
                const monthRuns = data.activities.filter(act => {
                  const actDate = new Date(act['Activity Date']);
                  return actDate >= monthStart && actDate <= monthEnd && 
                         (act['Activity Type'] || '').toLowerCase().includes('run');
                });
                return monthRuns.reduce((sum, act) => sum + (act['Distance.1'] ? (act['Distance.1'] / 1609.34) : (parseFloat(act.Distance) || 0)), 0);
              })).toFixed(0)}</div>
              <div className="stat-subtitle">Highest monthly miles</div>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Fitness Section */}
      <div style={{ marginTop: '3rem' }}>
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
            <div className="stat-subtitle">Total workouts</div>
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
              <BarChart3 size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Activity Types
            </div>
            <div className="stat-value">{fitnessStats.uniqueActivityTypes}</div>
            <div className="stat-subtitle">Unique sports</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Cross-Training</div>
            <div className="stat-value">{fitnessStats.crossTrainingPercent}%</div>
            <div className="stat-subtitle">{fitnessStats.crossTrainingHours} non-running hours</div>
          </div>
        </div>
      </div>


      {/* Complete Race History */}
      {yearRaces.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2 style={{ color: '#ff9500', fontSize: '1.5rem', marginBottom: '1rem', fontWeight: '600' }}>
            {selectedYear} Race History
          </h2>
          
          {/* Race Filter */}
          <div style={{ marginBottom: '1.5rem' }}>
            <select
              value={raceFilter}
              onChange={(e) => setRaceFilter(e.target.value)}
              className="filter-select"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              <option value="All">All Distances</option>
              <option value="Marathon">Marathon</option>
              <option value="Half">Half Marathon</option>
              <option value="5K">5K</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              backgroundColor: '#1a1a1a',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#333' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#ff9500', fontWeight: '600', borderBottom: '1px solid #333' }}>Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#ff9500', fontWeight: '600', borderBottom: '1px solid #333' }}>Race</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#ff9500', fontWeight: '600', borderBottom: '1px solid #333' }}>Distance</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#ff9500', fontWeight: '600', borderBottom: '1px solid #333' }}>Time</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#ff9500', fontWeight: '600', borderBottom: '1px solid #333' }}>Pace</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#ff9500', fontWeight: '600', borderBottom: '1px solid #333' }}>Overall</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#ff9500', fontWeight: '600', borderBottom: '1px solid #333' }}>Division</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#ff9500', fontWeight: '600', borderBottom: '1px solid #333' }}>%tile</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#ff9500', fontWeight: '600', borderBottom: '1px solid #333' }}>Ratings</th>
                </tr>
              </thead>
              <tbody>
                {filteredRacesForTable
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((race, index) => {
                    const distanceCategory = getRaceCategory(race.distance);
                    const isPersonalBest = raceStats.bestTimes[distanceCategory]?.timeSeconds === timeToSeconds(race.time);
                    const isPodium = race.overall_place && race.overall_place <= 3;
                    const isAgGroupPodium = race.division_place && race.division_place <= 3;
                    
                    const getMedalEmoji = () => {
                      if (race.division_place === 1 || isPodium) return '🥇'; // Overall podium = gold medal, or 1st in age group
                      if (race.division_place === 2) return '🥈';
                      if (race.division_place === 3) return '🥉';
                      return null;
                    };

                    return (
                      <tr 
                        key={index}
                        style={{ 
                          borderBottom: '1px solid #333',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={() => {
                          if (race.strava) {
                            window.open(race.strava, '_blank');
                          }
                        }}
                      >
                        <td style={{ padding: '0.75rem', color: '#ccc' }}>
                          {format(new Date(race.date), 'MMM dd, yyyy')}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#fff', fontWeight: '500' }}>
                          {race.race}
                          {isPersonalBest && <span style={{ color: '#ff9500', marginLeft: '0.5rem' }}>PR</span>}
                          {(isAgGroupPodium || isPodium) && <span style={{ marginLeft: '0.5rem' }}>{getMedalEmoji()}</span>}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#fff' }}>
                          {race.distance} mi
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#fff', fontWeight: '500' }}>
                          {formatTime(race.time)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#ccc' }}>
                          {formatPace(race.pace)} per mile
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: isPodium ? '#ffd700' : '#ccc' }}>
                          {race.overall_place || 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#ccc' }}>
                          {race.division_place ? `${race.division_place}/${race.division}` : 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#ccc' }}>
                          {race.percentile ? `${(race.percentile * 100).toFixed(1)}%` : 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                            {race.course_5 && (
                              <span
                                style={{ 
                                  display: 'inline-block',
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  lineHeight: '24px',
                                  textAlign: 'center',
                                  cursor: 'help'
                                }}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredTooltip({
                                    field: 'Course Rating',
                                    content: `${race.course_5}/5`,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top - 10
                                  });
                                }}
                                onMouseLeave={() => setHoveredTooltip(null)}
                              >
                                {race.course_5}
                              </span>
                            )}
                            {race.effort_5 && (
                              <span
                                style={{ 
                                  display: 'inline-block',
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  backgroundColor: '#f59e0b',
                                  color: 'white',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  lineHeight: '24px',
                                  textAlign: 'center',
                                  cursor: 'help'
                                }}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredTooltip({
                                    field: 'Effort Level',
                                    content: `${race.effort_5}/5`,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top - 10
                                  });
                                }}
                                onMouseLeave={() => setHoveredTooltip(null)}
                              >
                                {race.effort_5}
                              </span>
                            )}
                            {race.satisfaction_5 && (
                              <span
                                style={{ 
                                  display: 'inline-block',
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  backgroundColor: '#4ade80',
                                  color: 'white',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  lineHeight: '24px',
                                  textAlign: 'center',
                                  cursor: 'help'
                                }}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredTooltip({
                                    field: 'Satisfaction',
                                    content: `${race.satisfaction_5}/5`,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top - 10
                                  });
                                }}
                                onMouseLeave={() => setHoveredTooltip(null)}
                              >
                                {race.satisfaction_5}
                              </span>
                            )}
                            {(!race.course_5 && !race.effort_5 && !race.satisfaction_5) && (
                              <span style={{ color: '#666', fontSize: '0.8rem' }}>—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: '1rem', color: '#888', fontSize: '0.9rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', margin: '0.5rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '50%', 
                  backgroundColor: '#3b82f6' 
                }}></span>
                <span>Course Rating</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '50%', 
                  backgroundColor: '#f59e0b' 
                }}></span>
                <span>Effort Level</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '50%', 
                  backgroundColor: '#4ade80' 
                }}></span>
                <span>Satisfaction</span>
              </div>
            </div>
            <p>Click any race to view on Strava</p>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {hoveredTooltip && (
        <div
          style={{
            position: 'fixed',
            left: hoveredTooltip.x,
            top: hoveredTooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            zIndex: 1000,
            border: '1px solid #333',
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <strong>{hoveredTooltip.field}:</strong> {hoveredTooltip.content}
        </div>
      )}

    </div>
  );
};

export default SeasonStats;
