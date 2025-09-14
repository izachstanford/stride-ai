# StrideAI

AI-powered running analytics dashboard that transforms your Strava data into actionable insights and personalized coaching.

## What It Does

**StrideAI** analyzes your running data to provide intelligent training insights through five core modules:

- **🏃 The Pulse** - Real-time running metrics and lifetime statistics
- **📊 Season Stats** - Year-by-year training analysis with interactive visualizations  
- **🏆 Bib Book** - Complete race history with performance tracking and insights
- **🔬 Performance Lab** - Advanced analytics and progress visualization
- **🤖 AI Coach** - Personalized training recommendations with email/calendar integration

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Charts**: Recharts for data visualization
- **APIs**: Strava API, Anthropic Claude, Google Calendar, EmailJS
- **Styling**: Modern CSS with Inter font

## Local Development

### Prerequisites
- Node.js (v16+)
- Strava Developer Account
- API keys (see setup below)

### Configuration

Create `.env.local` with:
```bash
REACT_APP_STRAVA_CLIENT_ID=your_strava_client_id
REACT_APP_STRAVA_CLIENT_SECRET=your_strava_client_secret
REACT_APP_ANTHROPIC_API_KEY=your_anthropic_api_key
```

See [`EMAIL_CALENDAR_SETUP.md`](EMAIL_CALENDAR_SETUP.md) for email and calendar integration.

### Quick Start
```bash
# Install dependencies
npm install

# Start development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) - the app will auto-reload on changes.

### Testing APIs
```bash
# Test your API configurations
node test-apis.js
```

## Build & Deploy
```bash
npm run build    # Creates optimized production build
npm test         # Runs test suite
```

### Deploy to aiwithzach.com
```bash
npm run deploy        # Build and deploy to website-ai-with-zach/public/stride-ai/
npm run deploy:dry    # Test build without deploying
```

The deployment script automatically:
- ✅ Builds the React app with correct `/stride-ai/` subdirectory paths
- ✅ Creates backups of existing deployments (in `.deployment-backup/`)
- ✅ Copies built files to `website-ai-with-zach/public/stride-ai/`
- ✅ Configures asset paths for subdirectory hosting
- ✅ Provides local and production test URLs
- ✅ Generates deployment tracking with git commit info

**Production Deployment Workflow:**
1. `npm run deploy` (in stride-ai repo)
2. Commit and push `website-ai-with-zach` repo
3. Netlify auto-deploys to `https://aiwithzach.com/stride-ai/`

**Key Configuration:**
- `"homepage": "/stride-ai"` in package.json ensures proper asset paths
- `process.env.PUBLIC_URL` resolves data file URLs correctly
- Works seamlessly in both development and production environments

## 🤖 AI Integration

StrideAI uses Claude (Anthropic) for personalized training plans. The AI Coach will use fallback plans when the Anthropic API is not available or encounters CORS issues in development.

## 🔧 Troubleshooting

### Deployment Issues
- **Blank white screen**: Ensure `"homepage": "/stride-ai"` is set in package.json
- **JSON loading errors**: Verify data files are in `public/data/` and using `process.env.PUBLIC_URL`
- **Asset 404 errors**: Run `npm run deploy` to rebuild with correct paths

### Development Issues  
- **Webpack warnings**: These are normal deprecation warnings, app still works
- **API CORS errors**: Expected in development, use demo plans or wait for Phase 2 Netlify Functions
- **Build fails**: Check Node.js version (requires v16+) and run `npm install`