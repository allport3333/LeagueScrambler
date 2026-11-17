const { verifyIsolation } = require('../helpers/isolation.cjs');
try { console.log(JSON.stringify(verifyIsolation(), null, 2)); }
catch (error) { console.error(error.message); process.exitCode = 1; }
