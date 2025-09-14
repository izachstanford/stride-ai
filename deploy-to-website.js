#!/usr/bin/env node

/**
 * StrideAI Deployment Script
 * Builds the React app and deploys it to website-ai-with-zach/public/stride-ai/
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

// Configuration
const CONFIG = {
  sourceRepo: __dirname,
  targetRepo: '/Users/zachstanford/Development/website-ai-with-zach',
  targetPath: '/Users/zachstanford/Development/website-ai-with-zach/public/stride-ai',
  buildDir: path.join(__dirname, 'build'),
  backupDir: path.join(__dirname, '.deployment-backup')
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️ ${message}`, 'yellow');
}

async function checkPrerequisites() {
  logStep('1', 'Checking prerequisites...');
  
  // Check if target repo exists
  if (!fs.existsSync(CONFIG.targetRepo)) {
    throw new Error(`Target repository not found: ${CONFIG.targetRepo}`);
  }
  
  // Check if we're in the right source directory
  if (!fs.existsSync(path.join(CONFIG.sourceRepo, 'package.json'))) {
    throw new Error('Not in a valid Node.js project directory');
  }
  
  const packageJson = fs.readJsonSync(path.join(CONFIG.sourceRepo, 'package.json'));
  if (packageJson.name !== 'stride-ai-app') {
    throw new Error('Not in the StrideAI project directory');
  }
  
  logSuccess('Prerequisites check passed');
}

async function buildApp() {
  logStep('2', 'Building StrideAI React app...');
  
  try {
    // Clean previous build
    if (fs.existsSync(CONFIG.buildDir)) {
      fs.removeSync(CONFIG.buildDir);
      log('Cleaned previous build directory', 'yellow');
    }
    
    // Build the app
    log('Running npm run build...', 'blue');
    execSync('npm run build', { 
      stdio: 'pipe',
      cwd: CONFIG.sourceRepo 
    });
    
    // Verify build was created
    if (!fs.existsSync(CONFIG.buildDir)) {
      throw new Error('Build directory was not created');
    }
    
    // Check if build has required files
    const indexHtml = path.join(CONFIG.buildDir, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      throw new Error('Build missing index.html file');
    }
    
    logSuccess('React app built successfully');
    
  } catch (error) {
    if (error.stdout) {
      log('Build output:', 'yellow');
      console.log(error.stdout.toString());
    }
    if (error.stderr) {
      log('Build errors:', 'red');
      console.log(error.stderr.toString());
    }
    throw new Error(`Build failed: ${error.message}`);
  }
}

async function createBackup() {
  logStep('3', 'Creating backup of existing deployment...');
  
  if (fs.existsSync(CONFIG.targetPath)) {
    // Create backup directory
    fs.ensureDirSync(CONFIG.backupDir);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(CONFIG.backupDir, `stride-ai-backup-${timestamp}`);
    
    fs.copySync(CONFIG.targetPath, backupPath);
    logSuccess(`Backup created: ${backupPath}`);
  } else {
    log('No existing deployment found - skipping backup', 'yellow');
  }
}

async function deployToWebsite() {
  logStep('4', 'Deploying to website...');
  
  try {
    // Ensure target directory exists (remove if exists)
    if (fs.existsSync(CONFIG.targetPath)) {
      fs.removeSync(CONFIG.targetPath);
      log('Removed existing deployment directory', 'yellow');
    }
    
    // Copy build files to target
    fs.copySync(CONFIG.buildDir, CONFIG.targetPath);
    logSuccess(`Deployed to: ${CONFIG.targetPath}`);
    
    // Verify deployment
    const deployedIndex = path.join(CONFIG.targetPath, 'index.html');
    if (!fs.existsSync(deployedIndex)) {
      throw new Error('Deployment verification failed - index.html not found');
    }
    
    logSuccess('Deployment verification passed');
    
  } catch (error) {
    throw new Error(`Deployment failed: ${error.message}`);
  }
}

async function generateDeploymentInfo() {
  logStep('5', 'Generating deployment info...');
  
  const deploymentInfo = {
    timestamp: new Date().toISOString(),
    sourceRepo: CONFIG.sourceRepo,
    targetPath: CONFIG.targetPath,
    buildHash: execSync('git rev-parse HEAD', { cwd: CONFIG.sourceRepo }).toString().trim(),
    branch: execSync('git rev-parse --abbrev-ref HEAD', { cwd: CONFIG.sourceRepo }).toString().trim(),
    deploymentUrl: 'https://aiwithzach.com/stride-ai/',
    localTestUrl: 'file://' + path.join(CONFIG.targetPath, 'index.html')
  };
  
  // Write deployment info
  const infoPath = path.join(CONFIG.targetPath, 'deployment-info.json');
  fs.writeJsonSync(infoPath, deploymentInfo, { spaces: 2 });
  
  logSuccess('Deployment info generated');
  return deploymentInfo;
}

async function showResults(deploymentInfo) {
  log('\n' + '='.repeat(60), 'green');
  log('🚀 DEPLOYMENT COMPLETED SUCCESSFULLY!', 'green');
  log('='.repeat(60), 'green');
  
  log(`\n📁 Deployment Details:`, 'bright');
  log(`   Source: ${deploymentInfo.branch} (${deploymentInfo.buildHash.substring(0, 8)})`, 'blue');
  log(`   Target: ${CONFIG.targetPath}`, 'blue');
  log(`   Time: ${new Date(deploymentInfo.timestamp).toLocaleString()}`, 'blue');
  
  log(`\n🌐 URLs:`, 'bright');
  log(`   Production: ${deploymentInfo.deploymentUrl}`, 'cyan');
  log(`   Local Test: ${deploymentInfo.localTestUrl}`, 'cyan');
  
  log(`\n📋 Next Steps:`, 'bright');
  log(`   1. Test locally: open ${deploymentInfo.localTestUrl}`, 'yellow');
  log(`   2. Commit & push website-ai-with-zach repository`, 'yellow');
  log(`   3. Netlify will auto-deploy to production`, 'yellow');
  
  log(`\n💾 Backup Location: ${CONFIG.backupDir}`, 'magenta');
  log('\n' + '='.repeat(60), 'green');
}

// Main deployment function
async function deploy() {
  const startTime = Date.now();
  
  try {
    log('🚀 Starting StrideAI Deployment Process...', 'bright');
    
    await checkPrerequisites();
    await buildApp();
    await createBackup();
    await deployToWebsite();
    const deploymentInfo = await generateDeploymentInfo();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    deploymentInfo.duration = `${duration}s`;
    
    await showResults(deploymentInfo);
    
  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    log('\n🔧 Troubleshooting Tips:', 'yellow');
    log('   • Ensure you are in the stride-ai directory', 'yellow');
    log('   • Check that website-ai-with-zach repository exists', 'yellow');
    log('   • Verify npm run build works locally', 'yellow');
    log('   • Check file permissions', 'yellow');
    
    process.exit(1);
  }
}

// Run deployment if called directly
if (require.main === module) {
  deploy();
}

module.exports = { deploy, CONFIG };
