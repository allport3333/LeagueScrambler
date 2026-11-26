const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');

const origin = 'https://localhost:5001';

function get(path) {
    return execFileSync('curl.exe', ['--fail', '--silent', '--show-error', '--max-time', '10', origin + path], {
        encoding: 'utf8'
    });
}

try {
    assert.match(get('/'), /<app-root\b/i, 'Home did not serve the League Hub app');
    assert(JSON.parse(get('/api/pickup/catalog')).length > 0, 'Empty Pickup catalog');
    assert(Array.isArray(JSON.parse(get('/api/pickup/sessions')).sessions), 'Unexpected Pickup discovery response');
    console.log('League Hub Home and public Pickup discovery are available on port 5001.');
} catch (error) {
    console.error(`Development smoke check failed at ${origin}. Start the Allport_s_League_Scrambler profile and check the LeagueScramblerDev SQL connection and HTTPS certificate. ${error.cause?.message ?? error.message}`);
    process.exitCode = 1;
}
