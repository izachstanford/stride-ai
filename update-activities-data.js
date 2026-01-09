const fs = require('fs');
const path = require('path');

// Parse CSV line with proper quote handling
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Convert value to appropriate type
function convertValue(value) {
  if (value === '' || value === 'null' || value === null || value === undefined) {
    return null;
  }
  
  // Try to parse as number
  const num = parseFloat(value);
  if (!isNaN(num) && isFinite(num)) {
    return num;
  }
  
  return value;
}

// Main function
async function convertCSVToJSON() {
  // Get CSV path from command line argument or use default
  const csvPath = process.argv[2] || '/Users/zachstanford/Downloads/export_91375424 (2)/activities.csv';
  const outputPath = path.join(__dirname, 'public/data/activities_mapped.json');
  const buildOutputPath = path.join(__dirname, 'build/data/activities_mapped.json');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}\nUsage: node update-activities-data.js [path-to-activities.csv]`);
  }
  
  console.log('Reading CSV file...');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }
  
  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  console.log(`Found ${headers.length} columns in CSV`);
  
  // Map column indices to field names
  // Note: The CSV has duplicate column names, so we'll use indices
  // Based on the CSV structure:
  // - Column 0: Activity ID
  // - Column 1: Activity Date
  // - Column 2: Activity Name
  // - Column 3: Activity Type
  // - Column 5: Distance (first occurrence, in miles as string)
  // - Column 15: Elapsed Time (second occurrence)
  // - Column 16: Moving Time
  // - Column 17: Distance (second occurrence, in meters)
  // - Column 20: Elevation Gain
  // - Column 30: Max Heart Rate (second occurrence)
  // - Column 31: Average Heart Rate
  // - Column 34: Calories
  // - Column 81: Dirt Distance
  
  const activities = [];
  
  console.log(`Processing ${lines.length - 1} activity rows...`);
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line);
    
    // Create activity object with proper field mapping
    const activity = {
      'Activity ID': convertValue(values[0]) ? parseInt(values[0]) : null,
      'Activity Date': values[1] || null,
      'Activity Name': values[2] || null,
      'Activity Type': values[3] || null,
      'Distance': values[6] || null, // First Distance column (miles as string)
      'Elapsed Time': convertValue(values[15]), // Second Elapsed Time (seconds)
      'Moving Time': convertValue(values[16]), // Moving Time (seconds)
      'Distance.1': convertValue(values[17]), // Second Distance column (meters)
      'Max Heart Rate': convertValue(values[30]), // Second Max Heart Rate
      'Average Heart Rate': convertValue(values[31]),
      'Elevation Gain': convertValue(values[20]) ? convertValue(values[20]) * 3.28084 : null, // Elevation Gain (convert meters to feet)
      'Calories': convertValue(values[34]),
      'Dirt Distance': convertValue(values[81]), // Dirt Distance in meters
    };
    
    // Only add if we have at least an Activity ID and Date, and exclude 2026 (incomplete year)
    if (activity['Activity ID'] && activity['Activity Date']) {
      // Extract year from date string (format: "MMM dd, yyyy, h:mm:ss a")
      const dateMatch = activity['Activity Date'].match(/\b(20\d{2})\b/);
      const year = dateMatch ? parseInt(dateMatch[1]) : null;
      
      // Skip 2026 activities (incomplete year)
      if (year === 2026) {
        continue;
      }
      
      activities.push(activity);
    }
  }
  
  console.log(`Converted ${activities.length} activities`);
  
  // Write to public/data directory (components will sort as needed)
  console.log(`Writing to ${outputPath}...`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(activities, null, 2));
  console.log(`✓ Successfully wrote ${activities.length} activities to public/data/activities_mapped.json`);
  
  // Also write to build/data directory if it exists
  if (fs.existsSync(path.dirname(buildOutputPath))) {
    console.log(`Writing to ${buildOutputPath}...`);
    fs.writeFileSync(buildOutputPath, JSON.stringify(activities, null, 2));
    console.log(`✓ Successfully wrote ${activities.length} activities to build/data/activities_mapped.json`);
  } else {
    console.log('⚠ build/data directory does not exist (will be created on next build)');
  }
  
  // Print summary
  const runningActivities = activities.filter(a => 
    a['Activity Type'] && a['Activity Type'].toLowerCase().includes('run')
  );
  console.log(`\nSummary:`);
  console.log(`  Total activities: ${activities.length}`);
  console.log(`  Running activities: ${runningActivities.length}`);
  console.log(`  Date range: ${activities[activities.length - 1]?.['Activity Date']} to ${activities[0]?.['Activity Date']}`);
}

// Run the conversion
convertCSVToJSON()
  .then(() => {
    console.log('\n✅ Data update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });