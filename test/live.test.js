const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const CLI = path.join(__dirname, '..', 'cli', 'anna.js');
const PORT = 40000 + Math.floor(Math.random() * 20000);
const URL = 'http://localhost:' + PORT;

function connect() {
	return new Promise((resolve, reject) => {
		const socket = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false, timeout: 2000 });
		socket.once('connect', () => resolve(socket));
		socket.once('connect_error', reject);
	});
}

function nextEvent(socket, event, timeout = 1000) {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(null), timeout);
		socket.once(event, (data) => {
			clearTimeout(timer);
			resolve(data);
		});
	});
}

describe('anna live', { timeout: 15000 }, () => {
	let dir;
	let server;

	before(async () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anna-live-'));
		const md = path.join(dir, 'slides.md');
		fs.writeFileSync(md, '---\ntitle: Live\n---\n# Hello\n', 'utf-8');

		server = spawn('node', [CLI, 'live', md, '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
		await new Promise((resolve, reject) => {
			server.stdout.on('data', (chunk) => {
				if (chunk.toString().includes('Presenter:')) resolve();
			});
			server.once('exit', (code) => reject(new Error('live server exited with ' + code)));
		});
	});

	after(() => {
		server.kill();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it('audience view connects to the same origin, not localhost', async () => {
		const html = await (await fetch(URL + '/audience')).text();
		assert.match(html, /io\(\)/);
		assert.doesNotMatch(html, /io\("http:\/\/localhost/);
	});

	it('survives malicious and malformed messages', async () => {
		const socket = await connect();
		socket.emit('poll-vote', { pollId: '__proto__', option: 'x', sessionId: 'a' });
		socket.emit('poll-vote', { pollId: 'p1', option: '__proto__', sessionId: 'a' });
		socket.emit('qa-question', { qaId: 'constructor', text: 'hi', sessionId: 'a' });
		socket.emit('qa-question', { qaId: '"><img src=x onerror=alert(1)>', text: 'hi', sessionId: 'a' });
		socket.emit('qa-upvote', { qaId: 'toString', questionId: 'x', sessionId: 'a' });
		socket.emit('reaction', { type: '__proto__' });
		socket.emit('poll-vote', null);
		socket.emit('poll-vote', 'nope');
		await new Promise((r) => setTimeout(r, 200));
		socket.close();

		const res = await fetch(URL + '/api/state');
		assert.equal(res.status, 200);
		const state = await res.json();
		assert.deepEqual(Object.keys(state.questions), ['constructor']);
	});

	it('counts one poll vote per session', async () => {
		const socket = await connect();
		const first = nextEvent(socket, 'poll-results');
		socket.emit('poll-vote', { pollId: 'favorite', option: 'Vue', sessionId: 's1' });
		assert.deepEqual((await first).results, { Vue: 1 });

		const second = nextEvent(socket, 'poll-results', 300);
		socket.emit('poll-vote', { pollId: 'favorite', option: 'React', sessionId: 's1' });
		assert.equal(await second, null);
		socket.close();
	});

	it('aggregates reactions by emoji', async () => {
		const socket = await connect();
		const burst = nextEvent(socket, 'reaction-burst');
		socket.emit('reaction', { type: 'clap' });
		socket.emit('reaction', { type: 'clap' });
		socket.emit('reaction', { emoji: '\u{1F44F}' });
		assert.deepEqual({ ...(await burst) }, { '\u{1F44F}': 3 });
		socket.close();
	});

	it('ignores slide changes without the presenter token', async () => {
		const audience = await connect();
		const attacker = await connect();
		const changed = nextEvent(audience, 'slide-changed', 300);
		attacker.emit('slide-changed', { h: 5, v: 0 });
		assert.equal(await changed, null);
		audience.close();
		attacker.close();
	});
});
