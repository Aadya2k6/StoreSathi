const fs = require('fs');
const path = require('path');

const archPath = path.join(__dirname, '../architecture (1).md');
const planPath = path.join(__dirname, '../plan (1).md');
const progPath = path.join(__dirname, '../progress (1).md');

// 1. Update Architecture
if (fs.existsSync(archPath)) {
  let content = fs.readFileSync(archPath, 'utf8');
  
  // Concept replacement
  content = content.replace(/AI Layer for Paytm Merchants/g, 'Intelligent E-commerce Plugin for Fashion Retailers');
  content = content.replace(/StoreSathi is a lightweight AI layer/g, 'StoreSathi is a lightweight AI plugin');
  content = content.replace(/React Web App/g, 'Store Plugin Widget');
  
  // Add Weather & Trend rules to section 10
  if (!content.includes('Weather API Integration')) {
    const ruleSection = '## 10.3 Growth Opportunities';
    const newRules = `## 10.3 Growth Opportunities

### 10.3.1 Weather API Integration
- **Trigger:** Temperature drops < 15°C next week OR heavy rain predicted.
- **Condition:** Winter/Rainwear stock is low (e.g., Jackets < 20).
- **Action:** Alert merchant to restock specific categories ahead of weather shift.

### 10.3.2 Trend Analysis
- **Trigger:** External mock API indicates a spike in social media trends (e.g., "Floral Summer Dresses").
- **Condition:** Current inventory lacks trending items.
- **Action:** Alert merchant about the new trend and suggest adding it to the catalogue.
`;
    content = content.replace(ruleSection, newRules);
  }

  // Add SMS fallback to communication
  if (!content.includes('SMS Fallback')) {
    const commSection = '## 27.5 Communication Provider';
    const newComm = `## 27.5 Communication Provider

### Primary: WhatsApp (Meta Graph API)
- Standard broadcast campaigns and rich media.

### Fallback: SMS (Twilio Mock)
- **Trigger:** Meta API token expires, or WhatsApp delivery fails.
- **Action:** System automatically falls back to sending a plain-text SMS via a mock SMS API. No manual intervention required.
`;
    content = content.replace(commSection, newComm);
  }
  
  fs.writeFileSync(archPath, content, 'utf8');
  console.log('Updated architecture (1).md');
}

// 2. Update Plan
if (fs.existsSync(planPath)) {
  let content = fs.readFileSync(planPath, 'utf8');
  
  content = content.replace(/Track D — Frontend Shell/g, 'Track D — Plugin UI');
  content = content.replace(/Command Center screens, dashboard, billing UI, copilot UI/g, 'Embeddable Plugin Widget, dashboard panel, billing module');
  
  // Update Track C in Block 3
  if (!content.includes('Weather & Trend rules')) {
    content = content.replace(
      /Deterministic rules engine first \(low stock, stockout risk, slow-moving,\n  anomaly, growth — arch §10\)/g, 
      'Deterministic rules engine first (low stock, stockout risk, slow-moving,\n  anomaly, growth, Weather & Trend rules — arch §10)'
    );
  }

  // Update Track D in Block 3
  content = content.replace(
    /- \*\*D \(parallel\):\*\* dashboard, billing screen, review screen wired to real APIs as they land./g,
    '- **D (parallel):** Embeddable Plugin Widget UI (dashboard, billing panel) wired to APIs.'
  );

  // Update Track E in Block 5
  if (!content.includes('SMS fallback')) {
    content = content.replace(
      /- WhatsApp: \*\*build the mock adapter only\*\*/g,
      '- WhatsApp & SMS fallback: **build the mock adapters only**'
    );
  }
  
  fs.writeFileSync(planPath, content, 'utf8');
  console.log('Updated plan (1).md');
}

// 3. Update Progress
if (fs.existsSync(progPath)) {
  let content = fs.readFileSync(progPath, 'utf8');
  
  content = content.replace(/Track D — Frontend Shell/g, 'Track D — Plugin UI');
  content = content.replace(/Dashboard screen wired to real analytics APIs/g, 'Plugin Dashboard widget wired to real analytics APIs');
  content = content.replace(/Billing \/ New Sale screen/g, 'Plugin Billing / POS widget');
  
  if (!content.includes('Weather API rule')) {
    const rulesTarget = '| 3.C5 | Growth opportunity rule | | ⬜ | |';
    const newRules = `| 3.C5 | Growth opportunity rule | | ⬜ | |
| 3.C6 | Weather API rule (temperature/stock alert) | | ⬜ | |
| 3.C7 | Trend Analysis rule | | ⬜ | |`;
    content = content.replace(rulesTarget, newRules);
    
    // Fix task numbers if needed, but simple append is fine for now
    content = content.replace(/\| 3\.C6 \| Forecasting:/g, '| 3.C8 | Forecasting:');
  }

  if (!content.includes('SMS Fallback')) {
    const smsTarget = '| 5.E3 | WhatsApp mock adapter | | ⬜ | |';
    const newSms = `| 5.E3 | WhatsApp mock adapter | | ⬜ | |
| 5.E4 | SMS Fallback adapter | | ⬜ | |`;
    content = content.replace(smsTarget, newSms);
  }
  
  fs.writeFileSync(progPath, content, 'utf8');
  console.log('Updated progress (1).md');
}
