const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {existsSync} = require('node:fs');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');
const {setTimeout: delay} = require('node:timers/promises');

const origin = 'https://localhost:5003';
const project = path.resolve(__dirname, "../../../Allport's League Scrambler");
const assembly = path.join(project, 'bin', 'Release', 'net10.0', 'ASP.NET Core 2.2 with Angular 7.dll');

function isListening(host) {
    return new Promise((resolve, reject) => {
        const connection = net.connect({host, port: 5003});
        connection.once('connect', () => { connection.destroy(); resolve(true); });
        connection.once('error', error => {
            if (['ECONNREFUSED', 'EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) resolve(false);
            else reject(error);
        });
        connection.setTimeout(1000, () => { connection.destroy(); reject(new Error('Port 5003 could not be checked.')); });
    });
}

function catalogReady() {
    return new Promise(resolve => {
        const request = https.get(origin + '/api/pickup/catalog', {rejectUnauthorized: false, timeout: 1000}, response => {
            response.resume();
            resolve(response.statusCode === 200 && response.headers['x-pickup-test-database'] === 'LeagueScramblerPickupTest');
        });
        request.once('timeout', () => { request.destroy(); resolve(false); });
        request.once('error', () => resolve(false));
    });
}

async function withPickupTestHost(run, testAssembly = assembly) {
    if ((await Promise.all(['127.0.0.1', '::1'].map(isListening))).some(Boolean))
        throw new Error('Port 5003 is already in use. The test did not start or stop any host.');

    assert(existsSync(assembly), 'Build the Pickup web project in Release before running the browser test.');
    assert(existsSync(path.join(project, 'ClientApp', 'dist', 'browser', 'index.html')), 'Build the Pickup Angular frontend before running the browser test.');

    const env = {...process.env};
    for (const key of Object.keys(env)) {
        if (/^(?:ASPNETCORE_|DOTNET_)?(?:URLS|HTTP_PORTS|HTTPS_PORTS|ENVIRONMENT|KESTREL__.*)$/i.test(key) ||
            /^LEAGUE_HUB_PICKUP_/i.test(key)) delete env[key];
    }
    Object.assign(env, {
        ASPNETCORE_ENVIRONMENT: 'Development',
        LEAGUE_HUB_PICKUP_DISPOSABLE_TEST: '1',
        ASPNETCORE_URLS: origin,
        Logging__LogLevel__Default: 'Warning',
        'Logging__LogLevel__Microsoft.Hosting.Lifetime': 'Information'
    });

    assert(existsSync(testAssembly), "Build the selected disposable test host first.");
    let owned;
    function launch(entry, ...args) {
        // Run the app directly so the child PID is Kestrel, without a dotnet run wrapper.
        const child = spawn('dotnet', [entry, ...args], {cwd: project, env, windowsHide: true});
        const host = {child, output: '', exit: null, listening: false};
        owned = host;
        host.done = new Promise(resolve => {
            child.once('error', error => { host.exit = {error}; resolve(host.exit); });
            child.once('exit', (code, signal) => { host.exit = {code, signal}; resolve(host.exit); });
        });
        const record = data => {
            host.output = (host.output + data).slice(-12000);
            host.listening ||= host.output.includes('Now listening on: ' + origin);
        };
        child.stdout.on('data', record);
        child.stderr.on('data', record);
        return host;
    }

    function stop() {
        if (owned?.child.pid && !owned.exit) owned.child.kill();
    }
    async function stopAndWait() {
        stop();
        if (owned) {
            const closed = await Promise.race([owned.done, delay(5000, null, {ref: false})]);
            if (!closed) throw new Error('The owned Pickup process did not exit.');
        }
    }

    const interrupt = () => { stop(); process.exit(130); };
    const terminate = () => { stop(); process.exit(143); };
    process.once('exit', stop);
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', terminate);
    try {
        const initializer = launch(assembly, '--initialize-pickup');
        const initialized = await Promise.race([initializer.done, delay(30000, null, {ref: false})]);
        if (initialized?.code !== 0)
            throw new Error('Disposable Pickup database initialization failed.\n' + (initialized?.error ?? initializer.output));

        async function startHost() {
            const host = launch(testAssembly);
            const deadline = Date.now() + 30000;
            while (!host.exit && Date.now() < deadline) {
                if (host.listening && await catalogReady() && !host.exit) return;
                await delay(150);
            }
            throw new Error('The owned Pickup test host did not start on port 5003.\n' + (host.exit?.error ?? host.output));
        }

        await startHost();
        return await run(origin, async () => {
            await stopAndWait();
            await startHost();
        });
    } finally {
        try { await stopAndWait(); }
        finally {
            process.removeListener('exit', stop);
            process.removeListener('SIGINT', interrupt);
            process.removeListener('SIGTERM', terminate);
        }
    }
}

module.exports = {withPickupTestHost};
