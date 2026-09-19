const fs = require('fs');
const path = require('path');

const filesToClean = [
  path.join(__dirname, '../architecture (1).md'),
  path.join(__dirname, '../plan (1).md'),
  path.join(__dirname, '../progress (1).md')
];

filesToClean.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Split by lines and filter out lines containing OCR
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => !line.toLowerCase().includes('ocr'));
    
    // Write it back
    fs.writeFileSync(file, filteredLines.join('\n'), 'utf8');
    console.log(`Cleaned ${path.basename(file)}`);
  }
});
