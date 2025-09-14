import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { AppData } from '../App';
import { Medal, MapPin, Trophy, Award, Target, Calendar, TrendingUp, Eye } from 'lucide-react';

interface BibBookProps {
  data: AppData;
}

const BibBook: React.FC<BibBookProps> = ({ data }) => {
  const [hoveredTooltip, setHoveredTooltip] = useState<{ field: string; content: string; x: number; y: number } | null>(null);
  const [raceFilter, setRaceFilter] = useState<string>('all');

  // Helper function to convert time strings to seconds for comparison
  const timeToSeconds = (timeString: string): number => {
    if (!timeString) return 0;
    let timeStr = timeString;
    if (timeStr.includes('T')) timeStr = timeStr.split('T')[1];
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    return 0;
  };

  // Helper function to format time display
  const formatTime = (timeString: string): string => {
    if (!timeString) return 'N/A';
    if (timeString.includes('T')) return timeString.split('T')[1];
    return timeString;
  };

  // Calculate comprehensive race statistics
  const raceStats = useMemo(() => {
    const validRaces = data.races.filter(race => race.time);
    
    // Distance breakdown
    const distanceBreakdown = {
      'Marathon': validRaces.filter(r => Math.abs(r.distance - 26.2) < 0.1).length,
      'Half Marathon': validRaces.filter(r => Math.abs(r.distance - 13.1) < 0.1).length,
      '10K': validRaces.filter(r => Math.abs(r.distance - 6.21371) < 0.1).length,
      '5K': validRaces.filter(r => Math.abs(r.distance - 3.1) < 0.1).length,
      '15K': validRaces.filter(r => Math.abs(r.distance - 9.3) < 0.1).length
    };

    // Podium finishes
    const overallPodiums = validRaces.filter(race => race.overall_place && race.overall_place <= 3);
    const agGroupPodiums = validRaces.filter(race => race.division_place && race.division_place <= 3);
    
    // Percentile analysis
    const racesWithPercentile = validRaces.filter(race => race.percentile !== null && race.percentile !== undefined);
    const avgPercentile = racesWithPercentile.length > 0 ? 
      racesWithPercentile.reduce((sum, race) => sum + race.percentile!, 0) / racesWithPercentile.length : 0;

    // States/locations
    const states = new Set<string>();
    validRaces.forEach(race => {
      if (race.race_location) {
        const state = race.race_location.split(',').pop()?.trim();
        if (state) states.add(state);
      }
    });

    // Years active
    const years = new Set<number>();
    validRaces.forEach(race => {
      if (race.date) {
        const year = new Date(race.date).getFullYear();
        years.add(year);
      }
    });

    // Best performances by distance
    const bestTimes: { [key: string]: { time: string; race: string; date: string; timeSeconds: number; strava?: string } } = {};
    Object.keys(distanceBreakdown).forEach(distance => {
      const targetDistance = distance === 'Marathon' ? 26.2 :
                            distance === 'Half Marathon' ? 13.1 :
                            distance === '10K' ? 6.21371 :
                            distance === '5K' ? 3.1 :
                            distance === '15K' ? 9.3 : 0;
      
      const distanceRaces = validRaces.filter(race => Math.abs(race.distance - targetDistance) < 0.1);
      if (distanceRaces.length > 0) {
        let bestRace = distanceRaces[0];
        let bestTimeSeconds = timeToSeconds(bestRace.time);
        
        distanceRaces.forEach(race => {
          const raceTimeSeconds = timeToSeconds(race.time);
          if (raceTimeSeconds < bestTimeSeconds && raceTimeSeconds > 0) {
            bestRace = race;
            bestTimeSeconds = raceTimeSeconds;
          }
        });
        
        bestTimes[distance] = {
          time: formatTime(bestRace.time),
          race: bestRace.race,
          date: bestRace.date,
          timeSeconds: bestTimeSeconds,
          strava: bestRace.strava
        };
      }
    });

    // Recent achievements (last 2 years)
    const recentRaces = validRaces.filter(race => {
      const raceYear = new Date(race.date).getFullYear();
      return raceYear >= 2023;
    });

    return {
      totalRaces: validRaces.length,
      distanceBreakdown,
      overallPodiums: overallPodiums.length,
      agGroupPodiums: agGroupPodiums.length,
      avgPercentile: avgPercentile * 100,
      statesCount: states.size,
      yearsActive: Array.from(years).sort(),
      bestTimes,
      overallPodiumRaces: overallPodiums,
      agGroupPodiumRaces: agGroupPodiums,
      recentRaces: recentRaces.length
    };
  }, [data.races]);

  // Data for distance distribution chart
  const distanceChartData = useMemo(() => {
    return Object.entries(raceStats.distanceBreakdown)
      .filter(([_, count]) => count > 0)
      .map(([distance, count]) => ({ distance, count }));
  }, [raceStats.distanceBreakdown]);

  // Data for yearly race count
  const yearlyRaceData = useMemo(() => {
    const yearCounts: { [key: number]: number } = {};
    data.races.filter(race => race.time).forEach(race => {
      const year = new Date(race.date).getFullYear();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    
    return Object.entries(yearCounts)
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [data.races]);

  // Colors for charts
  const COLORS = ['#ff9500', '#4ade80', '#3b82f6', '#f59e0b', '#ef4444'];

  const handleRaceClick = (race: any) => {
    if (race.strava) {
      window.open(race.strava, '_blank');
    }
  };


  // Helper function to categorize race distances
  const getRaceCategory = (distance: number): string => {
    if (Math.abs(distance - 26.2) < 0.1) return 'Marathon';
    if (Math.abs(distance - 13.1) < 0.1) return 'Half';
    if (Math.abs(distance - 3.1) < 0.1) return '5K';
    return 'Other';
  };

  // Filter races based on selected category
  const filteredRacesForTable = useMemo(() => {
    const validRaces = data.races.filter(race => race.time);
    
    if (raceFilter === 'all') {
      return validRaces;
    }
    
    return validRaces.filter(race => getRaceCategory(race.distance) === raceFilter);
  }, [data.races, raceFilter]);

  const getPlacementDisplay = (race: any) => {
    if (race.overall_place) {
      const suffix = race.overall_place === 1 ? 'st' : 
                    race.overall_place === 2 ? 'nd' : 
                    race.overall_place === 3 ? 'rd' : 'th';
      return `${race.overall_place}${suffix}`;
    }
    return 'N/A';
  };

  return (
    <div className="bib-book">

      {/* Key Statistics Grid */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ color: '#ff9500', fontSize: '1.5rem', marginBottom: '1.5rem', fontWeight: '600' }}>
          Racing Overview
        </h2>
        
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="stat-card">
            <div className="stat-label">
              <Trophy size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Total Races
            </div>
            <div className="stat-value">{raceStats.totalRaces}</div>
            <div className="stat-subtitle">across {raceStats.yearsActive.length} years</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <Medal size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Overall Podiums
            </div>
            <div className="stat-value">{raceStats.overallPodiums}</div>
            <div className="stat-subtitle">top 3 overall finishes</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <Award size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Age Group Podiums
            </div>
            <div className="stat-value">{raceStats.agGroupPodiums}</div>
            <div className="stat-subtitle">division top 3 finishes</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <Target size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Average Percentile
            </div>
            <div className="stat-value">{raceStats.avgPercentile.toFixed(1)}%</div>
            <div className="stat-subtitle">top {(100 - raceStats.avgPercentile).toFixed(0)}% of field</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <MapPin size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              States Raced
            </div>
            <div className="stat-value">{raceStats.statesCount}</div>
            <div className="stat-subtitle">different locations</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <Calendar size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
              Recent Activity
            </div>
            <div className="stat-value">{raceStats.recentRaces}</div>
            <div className="stat-subtitle">races since 2023</div>
          </div>
        </div>
      </div>

      {/* Distance Breakdown and Personal Records */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
        {/* Distance Distribution Chart */}
        <div className="chart-container">
          <h3 style={{ color: '#ff9500', fontSize: '1.2rem', marginBottom: '1rem', fontWeight: '600' }}>
            📊 Races by Distance
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distanceChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ distance, count, percent }) => `${distance}: ${count} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {distanceChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, 'Races']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Personal Records */}
        <div>
          <h3 style={{ color: '#ff9500', fontSize: '1.2rem', marginBottom: '1rem', fontWeight: '600' }}>
            ⚡ Personal Records
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(raceStats.bestTimes).map(([distance, record]) => (
              <div 
                key={distance} 
                className="stat-card" 
                style={{ 
                  padding: '0.75rem',
                  cursor: record.strava ? 'pointer' : 'default'
                }}
                onClick={() => {
                  if (record.strava) {
                    window.open(record.strava, '_blank');
                  }
                }}
                onMouseEnter={(e) => {
                  if (record.strava) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 149, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (record.strava) {
                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#ff9500', fontWeight: '600', fontSize: '0.9rem' }}>{distance}</div>
                    <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700' }}>{record.time}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#888', fontSize: '0.8rem' }}>{record.race}</div>
                    <div style={{ color: '#888', fontSize: '0.7rem' }}>
                      {format(new Date(record.date), 'MMM yyyy')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Racing Activity Over Time */}
      <div className="chart-container" style={{ marginBottom: '3rem' }}>
        <h3 style={{ color: '#ff9500', fontSize: '1.2rem', marginBottom: '1rem', fontWeight: '600' }}>
          📈 Racing Activity by Year
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={yearlyRaceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="year" stroke="#ccc" fontSize={12} />
            <YAxis stroke="#ccc" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1a1a', 
                border: '1px solid #333', 
                borderRadius: '8px',
                color: '#fff'
              }}
              formatter={(value) => [value, 'Races']}
            />
            <Bar dataKey="count" fill="#ff9500" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Podium Finishes Section */}
      {(raceStats.overallPodiumRaces.length > 0 || raceStats.agGroupPodiumRaces.length > 0) && (
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ color: '#ff9500', fontSize: '1.5rem', marginBottom: '1.5rem', fontWeight: '600' }}>
            Podium Achievements
          </h2>
          
          {raceStats.overallPodiumRaces.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ color: '#4ade80', fontSize: '1.1rem', marginBottom: '1rem' }}>Overall Podium Finishes</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {raceStats.overallPodiumRaces.map((race, index) => (
                  <div key={index} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => handleRaceClick(race)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: '#ff9500', fontWeight: '600' }}>{race.race}</div>
                        <div style={{ color: '#4ade80', fontSize: '1.2rem', fontWeight: '700', margin: '0.25rem 0' }}>
                          {getPlacementDisplay(race)} Overall
                        </div>
                        <div style={{ color: '#888', fontSize: '0.9rem' }}>
                          {formatTime(race.time)} • {format(new Date(race.date), 'MMM dd, yyyy')}
                        </div>
                      </div>
                      <Trophy size={24} style={{ color: '#ffd700' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {raceStats.agGroupPodiumRaces.length > 0 && (
            <div>
              <h4 style={{ color: '#3b82f6', fontSize: '1.1rem', marginBottom: '1rem' }}>Age Group Podium Finishes</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {raceStats.agGroupPodiumRaces
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((race, index) => (
                  <div key={index} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => handleRaceClick(race)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: '#ff9500', fontWeight: '600' }}>{race.race}</div>
                        <div style={{ color: '#3b82f6', fontSize: '1.1rem', fontWeight: '700', margin: '0.25rem 0' }}>
                          {race.division_place === 1 ? '1st' : race.division_place === 2 ? '2nd' : '3rd'} in {race.division}
                        </div>
                        <div style={{ color: '#888', fontSize: '0.9rem' }}>
                          {formatTime(race.time)} • {format(new Date(race.date), 'MMM dd, yyyy')}
                        </div>
                      </div>
                      <Medal size={20} style={{ color: '#3b82f6' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Complete Race History Table */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#ff9500', fontSize: '1.5rem', margin: 0, fontWeight: '600' }}>
            Complete Race History
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ color: '#ccc', fontSize: '0.9rem' }}>Filter by distance:</label>
            <select
              className="filter-select"
              value={raceFilter}
              onChange={(e) => setRaceFilter(e.target.value)}
              style={{ minWidth: '120px' }}
            >
              <option value="all">All Races</option>
              <option value="Marathon">Marathon</option>
              <option value="Half">Half Marathon</option>
              <option value="5K">5K</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#2a2a2a' }}>
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
                  const distanceCategory = race.distance === 26.2 ? 'Marathon' :
                                         race.distance === 13.1 ? 'Half Marathon' :
                                         race.distance === 3.1 ? '5K' :
                                         race.distance === 6.21371 ? '10K' :
                                         race.distance === 9.3 ? '15K' : `${race.distance} miles`;
                  
                  const isPersonalBest = raceStats.bestTimes[distanceCategory]?.timeSeconds === timeToSeconds(race.time);
                  
                  const isPodium = race.overall_place && race.overall_place <= 3;
                  const isAgGroupPodium = race.division_place && race.division_place <= 3;
                  
                  // Medal logic: If overall podium, assume 1st in age group (gold). Otherwise use actual age group place.
                  const getMedalEmoji = () => {
                    if (isPodium) return '🥇'; // Overall podium = gold medal
                    if (race.division_place === 1) return '🥇';
                    if (race.division_place === 2) return '🥈';
                    if (race.division_place === 3) return '🥉';
                    return null;
                  };
                  
                  return (
                    <tr 
                      key={index}
                      style={{ 
                        borderBottom: '1px solid #333',
                        backgroundColor: isPersonalBest ? 'rgba(255, 149, 0, 0.1)' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleRaceClick(race)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isPersonalBest ? 'rgba(255, 149, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isPersonalBest ? 'rgba(255, 149, 0, 0.1)' : 'transparent'}
                    >
                      <td style={{ padding: '0.75rem', color: '#ccc' }}>
                        {format(new Date(race.date), 'MMM dd, yyyy')}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#fff', fontWeight: '500' }}>
                        {race.race}
                        {isPersonalBest && <span style={{ color: '#ff9500', marginLeft: '0.5rem' }}>PR</span>}
                        {(isAgGroupPodium || isPodium) && <span style={{ marginLeft: '0.5rem' }}>{getMedalEmoji()}</span>}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: '#ccc' }}>
                        {race.distance === 26.2 ? 'Marathon' :
                         race.distance === 13.1 ? 'Half' :
                         race.distance === 3.1 ? '5K' :
                         race.distance === 6.21371 ? '10K' :
                         race.distance === 9.3 ? '15K' :
                         `${race.distance}mi`}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: '#fff', fontWeight: '600' }}>
                        {formatTime(race.time)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: '#ccc' }}>
                        {race.pace?.replace(/:00$/, '') || 'N/A'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: isPodium ? '#ffd700' : '#ccc', fontWeight: isPodium ? '600' : 'normal' }}>
                        {race.overall_place ? getPlacementDisplay(race) : 'N/A'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: isAgGroupPodium ? '#3b82f6' : '#ccc', fontWeight: isAgGroupPodium ? '600' : 'normal' }}>
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

      {/* Tooltip */}
      {hoveredTooltip && (
        <div
          style={{
            position: 'fixed',
            left: hoveredTooltip.x,
            top: hoveredTooltip.y,
            transform: 'translateX(-50%) translateY(-100%)',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '1rem',
            maxWidth: '400px',
            color: '#fff',
            fontSize: '0.9rem',
            zIndex: 10000,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none'
          }}
        >
          <div style={{ color: '#ff9500', fontWeight: '600', marginBottom: '0.5rem' }}>
            {hoveredTooltip.field}
          </div>
          <div style={{ lineHeight: '1.4' }}>
            {hoveredTooltip.content}
          </div>
        </div>
      )}

    </div>
  );
};

export default BibBook;
