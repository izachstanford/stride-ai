# 📧📅 Email & Calendar Integration Setup

Your AI Coach now supports **email delivery** and **Google Calendar integration**! Here's how to set it up:

## 📧 Email Setup (EmailJS)

1. **Create EmailJS Account**: Go to [emailjs.com](https://www.emailjs.com) and create a free account

2. **Create Email Service**:
   - Add a new service (Gmail, Outlook, etc.)
   - Note your `Service ID`

3. **Create Email Template**:
   - Create a new template with these variables:
   ```
   {{to_name}}, here's your personalized training plan!

   WEEK OVERVIEW:
   {{plan_overview}}

   DAILY SCHEDULE:
   {{daily_schedule}}

   KEY SESSIONS:
   • {{key_sessions}}

   RECOVERY EMPHASIS:
   {{recovery_emphasis}}

   INJURY PREVENTION:
   • {{injury_prevention}}

   COACH'S ANALYSIS:
   {{reasoning_summary}}

   TRAINING LOAD ASSESSMENT:
   {{training_load}}

   GOAL ALIGNMENT:
   {{goal_alignment}}

   Generated: {{generated_date}}
   View online: {{app_url}}

   Keep crushing those goals! 🏃‍♂️
   - Your StrideAI Coach
   ```
   - Note your `Template ID`

4. **Get Public Key**: Find your Public Key in EmailJS dashboard

## 📅 Google Calendar Setup

1. **Google Cloud Console**: Go to [console.cloud.google.com](https://console.cloud.google.com)

2. **Create/Select Project**: Create a new project or select existing one

3. **Enable Calendar API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

4. **Create OAuth Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add your domain to authorized origins (e.g., `http://localhost:3000` for development)
   - Note your `Client ID`

## 🔧 Environment Variables

Add these to your `.env.local` file:

```env
# Existing Strava & Anthropic variables...
REACT_APP_STRAVA_CLIENT_ID=your_strava_client_id
REACT_APP_STRAVA_CLIENT_SECRET=your_strava_client_secret
REACT_APP_ANTHROPIC_API_KEY=your_anthropic_api_key

# Email Integration (EmailJS)
REACT_APP_EMAILJS_SERVICE_ID=your_emailjs_service_id
REACT_APP_EMAILJS_TEMPLATE_ID=your_emailjs_template_id
REACT_APP_EMAILJS_PUBLIC_KEY=your_emailjs_public_key

# Calendar Integration (Google)
REACT_APP_GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Your email address
REACT_APP_ZACH_EMAIL=your_email@example.com
```

## 🚀 How It Works

### Email Delivery
- Click "📧 Email Plan" on any generated training plan
- Sends a beautifully formatted email with:
  - Complete 7-day schedule
  - Coach's reasoning and analysis
  - Key sessions and recovery tips
  - Injury prevention recommendations

### Google Calendar Integration
- Click "📅 Add to Calendar" on any generated training plan
- Automatically creates calendar events for each workout:
  - Scheduled for 7:00 AM by default
  - Duration based on planned workout time
  - Detailed descriptions with pace, distance, notes
  - Orange color coding for easy identification
  - Skips rest days automatically

## 🎯 Features

- **Smart Scheduling**: Workouts are added starting from the current week's Monday
- **Detailed Events**: Each calendar event includes full workout description, intensity, and notes
- **Professional Emails**: Clean, formatted email templates with all plan details
- **Error Handling**: Graceful fallbacks if services aren't configured
- **Security**: Only authenticated Zach can send emails and add calendar events

## 🛟 Troubleshooting

**Email not sending?**
- Check EmailJS service is active
- Verify template variables match exactly
- Ensure email service (Gmail) is properly connected

**Calendar not working?**
- Check Google Cloud Console OAuth setup
- Verify Calendar API is enabled
- Allow popups in your browser for Google authentication

**Missing buttons?**
- Email and calendar buttons only show for authenticated Zach
- Check that you're logged in with the correct Strava account

## 🎨 Demo Mode

Even without API keys configured, you can see the full functionality:
- Type "demo" in the chat to generate a sample plan
- All UI elements will be visible
- Actual email/calendar features require proper setup

---

Your AI Coach is now ready to deliver plans directly to your inbox and calendar! 🎉
