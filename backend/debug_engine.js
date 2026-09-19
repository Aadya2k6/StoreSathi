const engine = require('./src/engine/rulesEngine');
engine.runRules().then(console.log).catch(console.error);
