import React, { useState, useEffect } from 'react';
import './App.css';
// import logo from './assets/StrideGuideAI.png'; // Removed from header, kept as favicon
import AICoach from './components/AICoach';
import ThePulse from './components/ThePulse';
import SeasonStats from './components/SeasonStats';
import BibBook from './components/BibBook';
import PerformanceLab from './components/PerformanceLab';

interface Activity {
  'Activity ID': number;
  'Activity Date': string;
  'Activity Name'?: string;
  'Activity Type': string;
  'Distance': string;
  'Elapsed Time': number;
  'Moving Time': number;
  'Distance.1': number;
  'Max Heart Rate'?: number;
  'Average Heart Rate'?: number;
  'Elevation Gain'?: number;
  'Calories'?: number;
  // Add other fields as needed
}

interface Race {
  date: string;
  date_iso: string;
  age: number;
  distance: number;
  race: string;
  race_location: string;
  time: string;
  pace: string;
  overall_place?: number;
  gender_place?: number;
  division_place?: number;
  division?: string;
  finish_time_seconds?: number;
  pace_seconds_per_mile: number;
  percentile?: number;
  key_learnings?: string;
  nutrition?: string;
  strategy_pacing_mantras?: string;
  overall_notes?: string;
  limiting_factor?: string;
  strava_activity_id?: number;
  course_5?: number;
  effort_5?: number;
  satisfaction_5?: number;
  strava?: string;
}

export interface AppData {
  activities: Activity[];
  races: Race[];
}

function App() {
  const [activeTab, setActiveTab] = useState('aicoach');
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [activitiesResponse, racesResponse] = await Promise.all([
          fetch(`${process.env.PUBLIC_URL}/data/activities_mapped.json`),
          fetch(`${process.env.PUBLIC_URL}/data/races_normalized.json`)
        ]);

        const activities = await activitiesResponse.json();
        const races = await racesResponse.json();

        setData({ activities, races });
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const renderContent = () => {
    if (loading) {
      return <div className="loading">Loading your running data...</div>;
    }

    if (!data) {
      return <div className="loading">Error loading data</div>;
    }

    switch (activeTab) {
      case 'aicoach':
        return <AICoach data={data} />;
      case 'pulse':
        return <ThePulse data={data} />;
      case 'season':
        return <SeasonStats data={data} />;
      case 'performance':
        return <PerformanceLab data={data} />;
      case 'bib':
        return <BibBook data={data} />;
      default:
        return <AICoach data={data} />;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="brand-section">
            <h1 className="app-title">StrideAI</h1>
            <span className="app-tagline">AI-Powered Running Analytics</span>
          </div>
          
          <nav className="tab-nav">
            <button
              className={`tab-button ${activeTab === 'aicoach' ? 'active' : ''}`}
              onClick={() => setActiveTab('aicoach')}
            >
              AI Coach
            </button>
            <button
              className={`tab-button ${activeTab === 'pulse' ? 'active' : ''}`}
              onClick={() => setActiveTab('pulse')}
            >
              Lifetime Stats
            </button>
            <button
              className={`tab-button ${activeTab === 'season' ? 'active' : ''}`}
              onClick={() => setActiveTab('season')}
            >
              Season Stats
            </button>
            <button
              className={`tab-button ${activeTab === 'bib' ? 'active' : ''}`}
              onClick={() => setActiveTab('bib')}
            >
              Bib Book
            </button>
            <button
              className={`tab-button ${activeTab === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveTab('performance')}
            >
              Performance Lab
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
