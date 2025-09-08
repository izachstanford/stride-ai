import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppData } from '../App';
import emailjs from '@emailjs/browser';
import { format, addDays, startOfWeek } from 'date-fns';

// TypeScript declarations for Google API
declare global {
  interface Window {
    gapi: any;
  }
}

interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
}

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

interface TrainingPlan {
  id: string;
  timestamp: string;
  athlete_id: number;
  plan: {
    week_overview: string;
    daily_schedule: DailyWorkout[];
    key_sessions: string[];
    recovery_emphasis: string;
    injury_prevention: string[];
  };
  reasoning: {
    analysis_summary: string;
    training_load_assessment: string;
    goal_alignment: string;
    risk_factors: string[];
    scientific_principles: string[];
    adaptation_strategy: string;
  };
  input_data: {
    recent_activities: StravaActivity[];
    user_goals: string;
    constraints: string;
  };
}

interface DailyWorkout {
  day: string;
  workout_type: string;
  description: string;
  duration_minutes?: number;
  distance_miles?: number;
  intensity: string;
  notes: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'plan';
  content: string;
  timestamp: string;
  plan?: TrainingPlan;
}

interface AICoachProps {
  data: AppData;
}

const AICoach: React.FC<AICoachProps> = ({ data }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<TrainingPlan | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [recentActivities, setRecentActivities] = useState<StravaActivity[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const ZACH_ATHLETE_ID = 91375424;
  const STRAVA_CLIENT_ID = process.env.REACT_APP_STRAVA_CLIENT_ID;
  const STRAVA_CLIENT_SECRET = process.env.REACT_APP_STRAVA_CLIENT_SECRET;
  const ANTHROPIC_API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY;
  
  // EmailJS and Google Calendar configuration
  const EMAILJS_SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID;
  const EMAILJS_TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID;
  const EMAILJS_PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;
  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const ZACH_EMAIL = process.env.REACT_APP_ZACH_EMAIL || 'zachstanford@strideai.app';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = useCallback((type: 'user' | 'system' | 'plan', content: string, plan?: TrainingPlan) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date().toISOString(),
      plan
    };
    setMessages(prev => [...prev, message]);
  }, []);

  const handleStravaCallback = useCallback(async (code: string) => {
    try {
      addMessage('system', 'Authenticating with Strava...');
      
      // Exchange code for access token
      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code'
        })
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.access_token) {
        // Get athlete info
        const athleteResponse = await fetch('https://www.strava.com/api/v3/athlete', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`
          }
        });
        
        const athleteData = await athleteResponse.json();
        setAthlete(athleteData);
        setIsAuthenticated(true);
        
        // Check if this is Zach
        if (athleteData.id === ZACH_ATHLETE_ID) {
          setIsAuthorized(true);
          addMessage('system', `Welcome back, ${athleteData.firstname}! You're authorized to generate new training plans.`);
        } else {
          setIsAuthorized(false);
          addMessage('system', `AI Coaching updates are restricted. Only Zach can run this. You can still read previously published plans.`);
        }

        // Store token for API calls
        sessionStorage.setItem('strava_token', tokenData.access_token);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      addMessage('system', 'Error authenticating with Strava. Please try again.');
      console.error('Strava auth error:', error);
    }
  }, [addMessage, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET]);

  const initiateStravaAuth = () => {
    if (!STRAVA_CLIENT_ID) {
      addMessage('system', 'Strava integration is not configured. Please contact the developer.');
      return;
    }
    
    const scope = 'read,activity:read';
    const redirectUri = encodeURIComponent(window.location.origin);
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=${scope}`;
    window.location.href = authUrl;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load any existing plans from localStorage
    const savedPlans = localStorage.getItem('stride_ai_plans');
    if (savedPlans) {
      const plans = JSON.parse(savedPlans);
      if (plans.length > 0) {
        const latestPlan = plans[plans.length - 1];
        setCurrentPlan(latestPlan);
        addMessage('system', `🏃‍♂️ Welcome to StrideAI Coach! Previous training plan loaded from ${new Date(latestPlan.timestamp).toLocaleDateString()}. Tell me about your current goals or click the button to generate a fresh plan based on your latest Strava data.`);
      } else {
        addMessage('system', `🏃‍♂️ Welcome to StrideAI Coach! I'm your AI running coach, ready to analyze your recent training and create personalized 7-day plans. Connect with Strava to get started, or tell me about your goals and constraints.`);
      }
    } else {
      addMessage('system', `🏃‍♂️ Welcome to StrideAI Coach! I'm your AI running coach, ready to analyze your recent training and create personalized 7-day plans. Connect with Strava to get started, or tell me about your goals and constraints.`);
    }
  }, [addMessage]);

  // Check for OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleStravaCallback(code);
    }
  }, [handleStravaCallback]);

  const fetchRecentActivities = async () => {
    const token = sessionStorage.getItem('strava_token');
    if (!token) return [];

    try {
      // Get activities from last 4 weeks
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const afterTimestamp = Math.floor(fourWeeksAgo.getTime() / 1000);

      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${afterTimestamp}&per_page=200`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const activities = await response.json();
      
      // Filter for running activities
      const runningActivities = activities.filter((activity: StravaActivity) => 
        activity.type === 'Run' || activity.type === 'TrailRun'
      );

      setRecentActivities(runningActivities);
      return runningActivities;
    } catch (error) {
      console.error('Error fetching activities:', error);
      return [];
    }
  };

  const generateTrainingPlan = async (userGoals: string = '', constraints: string = '') => {
    if (!isAuthorized) {
      addMessage('system', 'Only Zach can generate new training plans.');
      return;
    }

    setIsAnalyzing(true);
    addMessage('system', 'Analyzing your recent training data and generating a personalized 7-day plan...');

    try {
      // Fetch recent Strava data
      const recentData = await fetchRecentActivities();
      
      // Prepare comprehensive data for AI analysis
      const analysisData = {
        recent_activities: recentData,
        historical_races: data.races,
        historical_activities: data.activities,
        user_goals: userGoals,
        constraints: constraints,
        athlete_profile: athlete
      };

      // Generate plan using Anthropic API
      const plan = await callAnthropicAPI(analysisData);
      
      if (plan) {
        // Save plan
        const savedPlans = JSON.parse(localStorage.getItem('stride_ai_plans') || '[]');
        savedPlans.push(plan);
        localStorage.setItem('stride_ai_plans', JSON.stringify(savedPlans));
        
        setCurrentPlan(plan);
        addMessage('plan', 'New training plan generated!', plan);
      } else {
        addMessage('system', '⚠️ AI plan generation failed. Generating personalized fallback plan...');
        const fallbackPlan = createPersonalizedFallbackPlan(userGoals, constraints, analysisData.recent_activities);
        setCurrentPlan(fallbackPlan);
        addMessage('plan', 'Personalized fallback training plan generated!', fallbackPlan);
      }
    } catch (error) {
      addMessage('system', 'Error generating training plan. Please try again.');
      console.error('Plan generation error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const callAnthropicAPI = async (analysisData: any): Promise<TrainingPlan | null> => {
    try {
      addMessage('system', '🤖 Calling AI to analyze your data...');
      
      const prompt = `You are a world-class marathon coach analyzing training data to create a 7-day training plan. You are research-driven, cite current best practices, balance injury prevention with performance, are conservative when recent load or injury risk is high, and are friendly, direct, and prescriptive.

ATHLETE DATA:
- Recent 4-week activities: ${JSON.stringify(analysisData.recent_activities.slice(0, 20))}
- Historical race performances: ${JSON.stringify(analysisData.historical_races.slice(-10))}
- User goals: ${analysisData.user_goals || 'No specific goals mentioned'}
- Constraints: ${analysisData.constraints || 'No constraints mentioned'}

ANALYSIS REQUIREMENTS:
1. Calculate recent training load, weekly mileage trends, and intensity distribution
2. Assess injury risk factors from recent activity patterns
3. Identify strengths and limiters from race history
4. Create a balanced 7-day plan that progresses appropriately

RESPONSE FORMAT (JSON):
{
  "plan": {
    "week_overview": "2-3 sentence summary of the week's focus",
    "daily_schedule": [
      {
        "day": "Monday",
        "workout_type": "Easy Run / Rest / Workout / Long Run",
        "description": "Detailed workout description with paces/effort",
        "duration_minutes": 45,
        "distance_miles": 6,
        "intensity": "Easy / Moderate / Hard",
        "notes": "Additional guidance or form cues"
      }
      // ... 7 days total
    ],
    "key_sessions": ["Most important 2-3 workouts of the week"],
    "recovery_emphasis": "Recovery strategies for this week",
    "injury_prevention": ["2-3 specific injury prevention recommendations"]
  },
  "reasoning": {
    "analysis_summary": "Key insights from recent training data",
    "training_load_assessment": "Assessment of current fitness and fatigue",
    "goal_alignment": "How this plan aligns with stated goals",
    "risk_factors": ["Identified injury or overtraining risks"],
    "scientific_principles": ["Training principles being applied"],
    "adaptation_strategy": "How this week fits into longer-term development"
  }
}

Focus on practical, actionable guidance. Be specific with paces when possible but provide effort-based alternatives.`;

      addMessage('system', '📡 Sending request to AI...');

      // Note: Direct browser calls to Anthropic API are blocked by CORS
      // This is a limitation of client-side only applications
      addMessage('system', '⚠️ Direct API calls from browser are blocked by CORS policy. Using fallback plan...');
      
      // For now, we'll use a fallback plan since direct API calls don't work
      // In production, you'd need a backend proxy server
      return null;
    } catch (error) {
      console.error('Anthropic API error:', error);
      addMessage('system', `❌ Error calling AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    addMessage('user', inputValue);
    
    // Simple keyword-based responses for now
    if (inputValue.toLowerCase().includes('help')) {
      addMessage('system', 'I can analyze your recent Strava data and create personalized training plans. Click "Analyze Last 4 Weeks" to get started, or tell me about your goals and constraints. Type "demo" to see a sample plan!');
    } else if (inputValue.toLowerCase().includes('demo')) {
      // Demo mode - create a sample plan
      addMessage('system', '🎯 Generating demo training plan...');
      const demoplan = createDemoPlan();
      setCurrentPlan(demoplan);
      addMessage('plan', 'Demo training plan generated! (This is a sample plan for demonstration purposes)', demoplan);
    } else {
      addMessage('system', `Thanks for sharing: "${inputValue}". This will be considered when generating your next training plan.`);
    }
    
    setInputValue('');
  };

  const createPersonalizedFallbackPlan = (userGoals: string, constraints: string, recentActivities: StravaActivity[]): TrainingPlan => {
    // Analyze recent activities for basic insights
    const totalMiles = recentActivities.reduce((sum, activity) => sum + (activity.distance / 1609.34), 0);
    const avgWeeklyMiles = totalMiles / 4;
    const hasRecentLongRun = recentActivities.some(activity => (activity.distance / 1609.34) > 10);
    const hasRecentSpeedWork = recentActivities.some(activity => activity.type === 'Run' && activity.average_speed > 8);
    
    // Determine plan focus based on user input and recent activity
    let weekFocus = "A balanced week focusing on aerobic base building";
    let intensity = "moderate";
    
    if (constraints.toLowerCase().includes('sore') || constraints.toLowerCase().includes('tired')) {
      weekFocus = "A recovery-focused week with light activity and cross-training";
      intensity = "easy";
    } else if (userGoals.toLowerCase().includes('speed') || userGoals.toLowerCase().includes('fast')) {
      weekFocus = "A speed-focused week with structured intervals and tempo work";
      intensity = "hard";
    } else if (userGoals.toLowerCase().includes('endurance') || userGoals.toLowerCase().includes('long')) {
      weekFocus = "An endurance-focused week building aerobic capacity";
      intensity = "moderate";
    }

    return {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      athlete_id: athlete?.id || 0,
      plan: {
        week_overview: `${weekFocus}. Based on your recent ${Math.round(avgWeeklyMiles)} miles/week average, this plan balances training load with recovery.`,
        daily_schedule: [
          {
            day: "Monday",
            workout_type: intensity === "easy" ? "Rest" : "Easy Run",
            description: intensity === "easy" ? "Complete rest day to allow full recovery" : "Easy-paced recovery run focusing on form and breathing",
            duration_minutes: intensity === "easy" ? 0 : 45,
            distance_miles: intensity === "easy" ? 0 : 5,
            intensity: "Easy",
            notes: intensity === "easy" ? "Listen to your body - rest is when adaptation happens" : "Keep effort conversational throughout"
          },
          {
            day: "Tuesday",
            workout_type: intensity === "easy" ? "Cross Training" : intensity === "hard" ? "Speed Work" : "Easy Run",
            description: intensity === "easy" ? "30 minutes of swimming, cycling, or yoga" : 
                        intensity === "hard" ? "Track workout: 6 x 800m at 5K pace with 400m recovery" :
                        "Medium-length easy run with optional strides",
            duration_minutes: 30,
            distance_miles: intensity === "easy" ? 0 : intensity === "hard" ? 6 : 6,
            intensity: intensity === "easy" ? "Easy" : intensity === "hard" ? "Hard" : "Easy",
            notes: intensity === "hard" ? "Warm up 15 minutes, cool down 15 minutes" : "Add 4 x 20 second strides at the end"
          },
          {
            day: "Wednesday",
            workout_type: intensity === "easy" ? "Rest" : "Easy Run",
            description: intensity === "easy" ? "Another rest day or gentle stretching" : "Easy run with focus on relaxed cadence",
            duration_minutes: intensity === "easy" ? 0 : 40,
            distance_miles: intensity === "easy" ? 0 : 5,
            intensity: "Easy",
            notes: "Focus on form and breathing rhythm"
          },
          {
            day: "Thursday",
            workout_type: intensity === "easy" ? "Cross Training" : intensity === "hard" ? "Tempo Run" : "Easy Run",
            description: intensity === "easy" ? "Light cross-training or walking" :
                        intensity === "hard" ? "20-minute tempo run at half marathon pace" :
                        "Easy run with optional pickups",
            duration_minutes: intensity === "easy" ? 30 : intensity === "hard" ? 50 : 45,
            distance_miles: intensity === "easy" ? 0 : intensity === "hard" ? 6 : 5,
            intensity: intensity === "easy" ? "Easy" : intensity === "hard" ? "Moderate" : "Easy",
            notes: intensity === "hard" ? "15 min easy warmup, 20 min tempo, 15 min easy cooldown" : "Add 3 x 30 second pickups"
          },
          {
            day: "Friday",
            workout_type: "Rest",
            description: "Complete rest or 20 minutes of gentle stretching/yoga",
            duration_minutes: 20,
            intensity: "Easy",
            notes: "Recovery is crucial for adaptation"
          },
          {
            day: "Saturday",
            workout_type: intensity === "easy" ? "Easy Run" : "Long Run",
            description: intensity === "easy" ? "Very easy 30-minute run or walk" : 
                        "Progressive long run starting easy and building to moderate effort",
            duration_minutes: intensity === "easy" ? 30 : 75,
            distance_miles: intensity === "easy" ? 3 : 8,
            intensity: "Easy",
            notes: intensity === "easy" ? "Should feel very comfortable" : "Practice race day nutrition and hydration"
          },
          {
            day: "Sunday",
            workout_type: intensity === "easy" ? "Rest" : "Recovery Run",
            description: intensity === "easy" ? "Complete rest or light stretching" : "Very easy shakeout run or walk",
            duration_minutes: intensity === "easy" ? 0 : 25,
            distance_miles: intensity === "easy" ? 0 : 3,
            intensity: "Easy",
            notes: "Active recovery to promote blood flow"
          }
        ],
        key_sessions: intensity === "hard" ? 
          ["Tuesday speed work for VO2 max development", "Thursday tempo run for lactate threshold"] :
          intensity === "easy" ?
          ["Focus on recovery and gentle movement", "Listen to your body and rest when needed"] :
          ["Saturday long run for aerobic capacity", "Consistent easy running for base building"],
        recovery_emphasis: intensity === "easy" ? 
          "Prioritize sleep (8+ hours), gentle stretching, and light cross-training. Listen to your body and rest when needed." :
          "Prioritize sleep (8+ hours), stay hydrated, and include dynamic warm-ups before hard sessions.",
        injury_prevention: [
          "Include glute activation exercises 3x per week",
          "Perform calf raises and ankle mobility daily",
          intensity === "easy" ? "Focus on gentle movement and recovery" : "Schedule one full rest day per week"
        ]
      },
      reasoning: {
        analysis_summary: `Based on your recent training (${Math.round(avgWeeklyMiles)} miles/week average) and stated goals: "${userGoals || 'general fitness'}", this plan focuses on ${intensity} intensity training.`,
        training_load_assessment: `Recent activity shows ${hasRecentLongRun ? 'good endurance base' : 'need for longer runs'} and ${hasRecentSpeedWork ? 'recent speed work' : 'opportunity for speed development'}.`,
        goal_alignment: `This plan aligns with your goals by ${intensity === 'easy' ? 'prioritizing recovery and gentle progression' : intensity === 'hard' ? 'incorporating structured speed work and tempo runs' : 'building aerobic base with consistent easy running'}.`,
        risk_factors: intensity === "easy" ? 
          ["Monitor for excessive fatigue", "Ensure adequate recovery between sessions"] :
          ["Monitor for excessive fatigue", "Watch for any knee or calf tightness", "Ensure adequate recovery between hard sessions"],
        scientific_principles: [
          intensity === "easy" ? "Recovery-first approach with gentle progression" : "80/20 rule - 80% easy running, 20% moderate to hard",
          "Progressive overload through consistent weekly structure",
          "Specificity principle with race-pace intervals"
        ],
        adaptation_strategy: intensity === "easy" ?
          "Focus on recovery and gentle progression to rebuild fitness safely" :
          "Build aerobic base while maintaining neuromuscular power through weekly speed work and tempo efforts."
      },
      input_data: {
        recent_activities: recentActivities,
        user_goals: userGoals,
        constraints: constraints
      }
    };
  };

  const createDemoPlan = (): TrainingPlan => {
    return {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      athlete_id: 0,
      plan: {
        week_overview: "A balanced week focusing on aerobic base building with structured speed work and adequate recovery. This plan emphasizes consistency while building toward your next race goal.",
        daily_schedule: [
          {
            day: "Monday",
            workout_type: "Easy Run",
            description: "Easy-paced recovery run on flat terrain. Focus on form and breathing rhythm.",
            duration_minutes: 45,
            distance_miles: 6,
            intensity: "Easy",
            notes: "Keep effort conversational throughout"
          },
          {
            day: "Tuesday",
            workout_type: "Speed Work",
            description: "Track workout: 6 x 800m at 5K pace with 400m easy recovery jogs between intervals",
            duration_minutes: 60,
            distance_miles: 7,
            intensity: "Hard",
            notes: "Warm up 15 minutes, cool down 15 minutes"
          },
          {
            day: "Wednesday",
            workout_type: "Easy Run",
            description: "Medium-length easy run with optional strides. Focus on relaxed cadence.",
            duration_minutes: 50,
            distance_miles: 7,
            intensity: "Easy",
            notes: "Add 4 x 20 second strides at the end"
          },
          {
            day: "Thursday",
            workout_type: "Tempo Run",
            description: "20-minute tempo run at comfortably hard effort (half marathon pace)",
            duration_minutes: 55,
            distance_miles: 7,
            intensity: "Moderate",
            notes: "15 min easy warmup, 20 min tempo, 15 min easy cooldown"
          },
          {
            day: "Friday",
            workout_type: "Rest",
            description: "Complete rest or 30 minutes of gentle cross-training (swimming, cycling, yoga)",
            duration_minutes: 30,
            intensity: "Easy",
            notes: "Listen to your body - rest is when adaptation happens"
          },
          {
            day: "Saturday",
            workout_type: "Long Run",
            description: "Progressive long run starting easy and building to moderate effort in final third",
            duration_minutes: 90,
            distance_miles: 12,
            intensity: "Easy",
            notes: "Practice race day nutrition and hydration"
          },
          {
            day: "Sunday",
            workout_type: "Recovery Run",
            description: "Very easy shakeout run or walk. Focus on active recovery.",
            duration_minutes: 30,
            distance_miles: 4,
            intensity: "Easy",
            notes: "Should feel easier than your easy run pace"
          }
        ],
        key_sessions: [
          "Tuesday speed work for VO2 max development",
          "Thursday tempo run for lactate threshold",
          "Saturday long run for aerobic capacity"
        ],
        recovery_emphasis: "Prioritize sleep (8+ hours nightly), stay hydrated, and include dynamic warm-ups before hard sessions. Consider foam rolling or massage on rest days.",
        injury_prevention: [
          "Include glute activation exercises 3x per week",
          "Perform calf raises and ankle mobility daily",
          "Schedule one full rest day per week"
        ]
      },
      reasoning: {
        analysis_summary: "Demo analysis shows balanced training approach needed with focus on aerobic development while maintaining speed elements.",
        training_load_assessment: "Current fitness allows for moderate intensity progression with careful recovery monitoring.",
        goal_alignment: "Plan supports general fitness and race preparation goals with sustainable weekly structure.",
        risk_factors: ["Monitor for excessive fatigue", "Watch for any knee or calf tightness"],
        scientific_principles: [
          "80/20 rule - 80% easy running, 20% moderate to hard",
          "Progressive overload through consistent weekly structure",
          "Specificity principle with race-pace intervals"
        ],
        adaptation_strategy: "Build aerobic base while maintaining neuromuscular power through weekly speed work and tempo efforts."
      },
      input_data: {
        recent_activities: [],
        user_goals: "Demo mode - general fitness and performance",
        constraints: "None specified"
      }
    };
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const sendEmailPlan = async (plan: TrainingPlan) => {
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
      addMessage('system', 'Email service is not configured. Please contact the developer.');
      return;
    }

    try {
      addMessage('system', '📧 Sending training plan to your email...');

      // Initialize EmailJS
      emailjs.init(EMAILJS_PUBLIC_KEY);

      // Create email content
      const emailContent = createEmailContent(plan);

      const templateParams = {
        to_email: ZACH_EMAIL,
        to_name: athlete?.firstname || 'Zach',
        subject: `Your StrideAI Training Plan - Week of ${format(new Date(), 'MMM dd, yyyy')}`,
        plan_overview: plan.plan.week_overview,
        daily_schedule: emailContent.dailyScheduleText,
        key_sessions: plan.plan.key_sessions.join('\n• '),
        recovery_emphasis: plan.plan.recovery_emphasis,
        injury_prevention: plan.plan.injury_prevention.join('\n• '),
        reasoning_summary: plan.reasoning.analysis_summary,
        training_load: plan.reasoning.training_load_assessment,
        goal_alignment: plan.reasoning.goal_alignment,
        generated_date: format(new Date(plan.timestamp), 'PPP'),
        app_url: window.location.origin
      };

      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      addMessage('system', '✅ Training plan successfully sent to your email!');
    } catch (error) {
      console.error('Email sending error:', error);
      addMessage('system', '❌ Failed to send email. Please try again later.');
    }
  };

  const createEmailContent = (plan: TrainingPlan) => {
    const dailyScheduleText = plan.plan.daily_schedule.map(workout => {
      return `${workout.day}: ${workout.workout_type}
Description: ${workout.description}
${workout.duration_minutes ? `Duration: ${formatDuration(workout.duration_minutes)}` : ''}
${workout.distance_miles ? `Distance: ${workout.distance_miles} miles` : ''}
Intensity: ${workout.intensity}
${workout.notes ? `Notes: ${workout.notes}` : ''}
`;
    }).join('\n');

    return { dailyScheduleText };
  };

  const addToGoogleCalendar = async (plan: TrainingPlan) => {
    if (!GOOGLE_CLIENT_ID) {
      addMessage('system', 'Google Calendar integration is not configured. Please contact the developer.');
      return;
    }

    try {
      addMessage('system', '📅 Adding workouts to your Google Calendar...');

      // Load Google API
      await loadGoogleAPI();

      // Initialize the API
      await new Promise<void>((resolve) => {
        window.gapi.load('auth2', () => {
          window.gapi.auth2.init({
            client_id: GOOGLE_CLIENT_ID,
          });
          resolve();
        });
      });

      // Authenticate user
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signIn({
        scope: 'https://www.googleapis.com/auth/calendar'
      });

      // Get start of this week (Monday)
      const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });

      // Create calendar events for each workout
      const calendarPromises = plan.plan.daily_schedule.map(async (workout, index) => {
        const workoutDate = addDays(startDate, index);
        
        // Skip rest days for calendar events
        if (workout.workout_type.toLowerCase() === 'rest') {
          return null;
        }

        const startTime = new Date(workoutDate);
        // Set default workout time to 7:00 AM
        startTime.setHours(7, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + (workout.duration_minutes || 60));

        const event = {
          summary: `🏃‍♂️ ${workout.workout_type}`,
          description: `${workout.description}\n\nIntensity: ${workout.intensity}\n${workout.distance_miles ? `Distance: ${workout.distance_miles} miles\n` : ''}${workout.notes ? `Notes: ${workout.notes}\n` : ''}\n\nGenerated by StrideAI Coach`,
          start: {
            dateTime: startTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          colorId: '4', // Orange color for running events
        };

        return window.gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: event,
        });
      });

      const results = await Promise.all(calendarPromises.filter(p => p !== null));
      const successCount = results.filter(r => r.status === 200).length;
      
      addMessage('system', `✅ Successfully added ${successCount} workouts to your Google Calendar!`);
    } catch (error) {
      console.error('Calendar integration error:', error);
      if (error instanceof Error && (error as any).error === 'popup_blocked_by_browser') {
        addMessage('system', '❌ Please allow popups for Google Calendar authentication and try again.');
      } else {
        addMessage('system', '❌ Failed to add events to calendar. Please try again.');
      }
    }
  };

  const loadGoogleAPI = (): Promise<void> => {
    return new Promise((resolve) => {
      if (window.gapi) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('client:auth2', resolve);
      };
      document.head.appendChild(script);
    });
  };

  const renderPlan = (plan: TrainingPlan) => {
    return (
      <div className="training-plan">
        <div className="plan-header">
          <div className="plan-title-section">
            <h3>7-Day Training Plan</h3>
            <span className="plan-date">Generated {new Date(plan.timestamp).toLocaleDateString()}</span>
          </div>
          
          {isAuthorized && (
            <div className="plan-actions">
              <button 
                onClick={() => sendEmailPlan(plan)}
                className="action-button email-button"
                title="Email this plan"
              >
                📧 Email Plan
              </button>
              <button 
                onClick={() => addToGoogleCalendar(plan)}
                className="action-button calendar-button"
                title="Add workouts to Google Calendar"
              >
                📅 Add to Calendar
              </button>
            </div>
          )}
        </div>
        
        <div className="plan-overview">
          <h4>Week Overview</h4>
          <p>{plan.plan.week_overview}</p>
        </div>

        <div className="daily-schedule">
          <h4>Daily Schedule</h4>
          {plan.plan.daily_schedule.map((workout, index) => (
            <div key={index} className="workout-card">
              <div className="workout-header">
                <span className="day">{workout.day}</span>
                <span className={`intensity ${workout.intensity.toLowerCase().replace(' ', '-')}`}>
                  {workout.intensity}
                </span>
              </div>
              <div className="workout-title">{workout.workout_type}</div>
              <div className="workout-description">{workout.description}</div>
              <div className="workout-details">
                {workout.duration_minutes && (
                  <span>⏱️ {formatDuration(workout.duration_minutes)}</span>
                )}
                {workout.distance_miles && (
                  <span>📏 {workout.distance_miles} miles</span>
                )}
              </div>
              {workout.notes && (
                <div className="workout-notes">💡 {workout.notes}</div>
              )}
            </div>
          ))}
        </div>

        <div className="plan-details">
          <div className="key-sessions">
            <h4>Key Sessions</h4>
            <ul>
              {plan.plan.key_sessions.map((session, index) => (
                <li key={index}>{session}</li>
              ))}
            </ul>
          </div>

          <div className="recovery">
            <h4>Recovery Focus</h4>
            <p>{plan.plan.recovery_emphasis}</p>
          </div>

          <div className="injury-prevention">
            <h4>Injury Prevention</h4>
            <ul>
              {plan.plan.injury_prevention.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

        <details className="reasoning-details">
          <summary>Coach's Reasoning & Analysis</summary>
          <div className="reasoning-content">
            <div className="reasoning-section">
              <h5>Analysis Summary</h5>
              <p>{plan.reasoning.analysis_summary}</p>
            </div>
            
            <div className="reasoning-section">
              <h5>Training Load Assessment</h5>
              <p>{plan.reasoning.training_load_assessment}</p>
            </div>
            
            <div className="reasoning-section">
              <h5>Goal Alignment</h5>
              <p>{plan.reasoning.goal_alignment}</p>
            </div>
            
            {plan.reasoning.risk_factors.length > 0 && (
              <div className="reasoning-section">
                <h5>Risk Factors</h5>
                <ul>
                  {plan.reasoning.risk_factors.map((risk, index) => (
                    <li key={index}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="reasoning-section">
              <h5>Scientific Principles Applied</h5>
              <ul>
                {plan.reasoning.scientific_principles.map((principle, index) => (
                  <li key={index}>{principle}</li>
                ))}
              </ul>
            </div>
            
            <div className="reasoning-section">
              <h5>Adaptation Strategy</h5>
              <p>{plan.reasoning.adaptation_strategy}</p>
            </div>
          </div>
        </details>
      </div>
    );
  };

  return (
    <div className="ai-coach">
      <div className="coach-header">
        <h2>🏃‍♂️ AI Coach</h2>
        <p>Get personalized training plans based on your recent Strava data</p>
      </div>

      <div className="chat-container">
        <div className="messages">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.type}`}>
              <div className="message-content">
                {message.type === 'plan' && message.plan ? (
                  renderPlan(message.plan)
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
              <div className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-controls">
          <div className="input-row">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Tell me about your goals, constraints, or questions..."
              className="chat-input"
            />
            <button onClick={handleSendMessage} className="send-button">
              Send
            </button>
          </div>
          
          <div className="action-row">
            {!isAuthenticated ? (
            <button onClick={initiateStravaAuth} className="strava-button">
              Connect with Strava to Analyze Last 4 Weeks
            </button>
            ) : (
              <button 
                onClick={() => generateTrainingPlan(inputValue)} 
                disabled={isAnalyzing}
                className="analyze-button"
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Last 4 Weeks & Generate Plan'}
              </button>
            )}
            
            <button 
              onClick={() => {
                addMessage('system', 'Generating demo training plan...');
                const demoplan = createDemoPlan();
                setCurrentPlan(demoplan);
                addMessage('plan', 'Demo training plan generated! (This is a sample plan for demonstration purposes)', demoplan);
              }}
              className="demo-button"
            >
              See Demo Plan
            </button>
          </div>
          
          <div className="demo-notice">
            💡 Only Zach is authorized to connect to Strava and chat with this coach but type "demo" to see a sample training plan.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICoach;
