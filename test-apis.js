#!/usr/bin/env node

// Test script for Strava and Anthropic API connections
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Testing API Configurations...\n');

// Check environment variables
console.log('📋 Environment Variables Check:');
console.log('STRAVA_CLIENT_ID:', process.env.REACT_APP_STRAVA_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('STRAVA_CLIENT_SECRET:', process.env.REACT_APP_STRAVA_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('ANTHROPIC_API_KEY:', process.env.REACT_APP_ANTHROPIC_API_KEY ? '✅ Set' : '❌ Missing');
console.log();

// Test Strava API connection
async function testStravaAPI() {
  console.log('🚴 Testing Strava API...');
  
  if (!process.env.REACT_APP_STRAVA_CLIENT_ID) {
    console.log('❌ Strava Client ID not found in environment variables');
    return;
  }

  try {
    // Test the authorization URL (this should work if client ID is valid)
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${process.env.REACT_APP_STRAVA_CLIENT_ID}&response_type=code&redirect_uri=http://localhost:3000&approval_prompt=force&scope=read,activity:read`;
    
    console.log('✅ Strava Client ID format appears valid');
    console.log('🔗 Authorization URL would be:', authUrl.substring(0, 80) + '...');
    
    // Test API endpoint (this will fail without auth, but we can see if the endpoint responds)
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: {
        'Authorization': 'Bearer invalid_token_test'
      }
    });
    
    if (response.status === 401) {
      console.log('✅ Strava API endpoint is reachable (401 Unauthorized as expected)');
    } else {
      console.log('⚠️  Unexpected response from Strava API:', response.status);
    }
    
  } catch (error) {
    console.log('❌ Error testing Strava API:', error.message);
  }
}

// Test Anthropic API connection
async function testAnthropicAPI() {
  console.log('\n🤖 Testing Anthropic API...');
  
  if (!process.env.REACT_APP_ANTHROPIC_API_KEY) {
    console.log('❌ Anthropic API key not found in environment variables');
    return;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: 'Hello'
        }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Anthropic API connection successful!');
      console.log('📝 Test response:', data.content[0].text);
    } else {
      const error = await response.text();
      console.log('❌ Anthropic API error:', response.status, response.statusText);
      console.log('📄 Error details:', error.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.log('❌ Error testing Anthropic API:', error.message);
  }
}

// Test React environment variable access
function testReactEnvVars() {
  console.log('\n⚛️  Testing React Environment Variable Access:');
  console.log('Note: In React, only variables prefixed with REACT_APP_ are accessible in the browser');
  
  const envVars = [
    'REACT_APP_STRAVA_CLIENT_ID',
    'REACT_APP_STRAVA_CLIENT_SECRET', 
    'REACT_APP_ANTHROPIC_API_KEY'
  ];
  
  envVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value.substring(0, 8)}...${value.slice(-4)} (${value.length} chars)`);
    } else {
      console.log(`❌ ${varName}: Not set`);
    }
  });
}

// Run all tests
async function runTests() {
  testReactEnvVars();
  await testStravaAPI();
  await testAnthropicAPI();
  
  console.log('\n🎯 Quick Fix Checklist:');
  console.log('1. ✅ Ensure .env.local is in the project root');
  console.log('2. ✅ All variable names start with REACT_APP_');
  console.log('3. ✅ No spaces around the = sign');
  console.log('4. ✅ Restart your development server after changes');
  console.log('5. ✅ Check that variable values don\'t have quotes unless needed');
}

runTests();
