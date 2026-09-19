const axios = require('axios');

async function testIntelligence() {
  try {
    console.log('1. Triggering Rules Engine...');
    const runRes = await axios.get('http://localhost:3000/api/intelligence/run');
    console.log('Response:', runRes.data);
    
    console.log('\n2. Fetching Generated Recommendations...');
    const recRes = await axios.get('http://localhost:3000/api/intelligence/recommendations');
    
    console.log(`Found ${recRes.data.count} recommendations:`);
    recRes.data.data.forEach((rec, idx) => {
      let evidence = {};
      try { evidence = JSON.parse(rec.evidence_data); } catch (e) {}
      console.log(`\n[${idx + 1}] Priority: ${evidence.priority || 'N/A'} | Type: ${rec.type}`);
      console.log(`Title: ${rec.title}`);
      console.log(`Description: ${rec.description}`);
    });
    
  } catch (error) {
    console.error('Test failed:', error.response ? error.response.data : error.message);
  }
}

testIntelligence();
