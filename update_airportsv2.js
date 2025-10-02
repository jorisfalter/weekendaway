const fs = require('fs');

// Read the current airportsv2.js file
const airportsV2 = require('./airportsv2.js');

// Read the CSV data
const csvContent = fs.readFileSync('./iata-icao.csv', 'utf8');
const lines = csvContent.split('\n');

// Parse CSV data
const csvAirports = [];
for (let i = 1; i < lines.length; i++) { // Skip header
  const line = lines[i].trim();
  if (line) {
    const parts = line.split(',');
    if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
      const iata = parts[0].trim();
      const icao = parts[1].trim();
      const name = parts[2].trim();
      
      // Clean up the name (remove quotes if present)
      const cleanName = name.replace(/"/g, '').replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, ' ');
      
      csvAirports.push([iata, cleanName]);
    }
  }
}

// Get existing IATA codes from airportsv2
const existingCodes = new Set(airportsV2.map(airport => airport[0]));

// Find airports from CSV that are not in airportsv2
const newAirports = csvAirports.filter(airport => 
  airport[0] && 
  !existingCodes.has(airport[0]) && 
  airport[0] !== ''
);

console.log(`Current airportsv2.js has ${airportsV2.length} airports`);
console.log(`Found ${newAirports.length} new airports from CSV to add`);

// Merge the data
const mergedAirports = [...airportsV2];

// Add new airports (without coordinates for now)
newAirports.forEach(airport => {
  mergedAirports.push([airport[0], airport[1], null, null]);
});

// Sort by IATA code for better organization
mergedAirports.sort((a, b) => a[0].localeCompare(b[0]));

// Generate the new file content
let content = 'airportsListV2 = [\n';
mergedAirports.forEach((airport, index) => {
  const isLast = index === mergedAirports.length - 1;
  const iata = airport[0];
  const name = airport[1];
  const lat = airport[2] !== null ? airport[2] : '';
  const lon = airport[3] !== null ? airport[3] : '';
  
  if (lat && lon) {
    content += `  ["${iata}", "${name}", ${lat}, ${lon}]${isLast ? '' : ','}\n`;
  } else {
    content += `  ["${iata}", "${name}", ,]${isLast ? '' : ','}\n`;
  }
});
content += '];\n';
content += 'module.exports = airportsListV2;\n';

// Write the updated file
fs.writeFileSync('airportsv2_updated.js', content);

console.log(`Created airportsv2_updated.js with ${mergedAirports.length} total airports`);
console.log(`Added ${newAirports.length} new airports from CSV data`);

// Show some examples of new airports
console.log('\nExamples of new airports added:');
newAirports.slice(0, 10).forEach(airport => {
  console.log(`  ${airport[0]} -> ${airport[1]}`);
});
