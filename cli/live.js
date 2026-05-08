/**
 * Anna.js Live Server for Real-Time Audience Interaction
 *
 * Starts a presenter + audience server powered by Express and Socket.IO.
 * The presenter sees the full presentation; the audience gets a simplified
 * view with polls, Q&A, and reactions that update in real time.
 *
 * Usage:
 *   anna live <file.md> [options]
 *
 * Options:
 *   --port, -p <number>   Port to listen on (default: 4000)
 *   --open, -o            Open browser automatically
 *   --help, -h            Show this help
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { exec } = require('child_process');
const { build } = require('./generate');

// --- Public API ---

function run(args) {
	if (args.includes('--help') || args.includes('-h') || args.length === 0) {
		console.log(`
  Anna.js Live Server

  Usage:
    anna live <input.md> [options]

  Options:
    --port, -p <number>   Port to listen on (default: 4000)
    --open, -o            Open browser automatically
    --help, -h            Show this help

  Routes:
    /           Presenter view (full presentation + live plugin)
    /audience   Audience view (polls, Q&A, reactions)
    /qr         QR code page for the audience URL

  The server watches the Markdown file for changes and
  rebuilds the presenter view automatically.
		`);
		process.exit(0);
	}

	const port = parsePort(args);
	const shouldOpen = args.includes('--open') || args.includes('-o');
	const inputFile = parseInputFile(args);

	if (!inputFile) {
		console.error('  Error: No input file specified');
		process.exit(1);
	}

	if (!fs.existsSync(inputFile)) {
		console.error('  Error: File not found: ' + inputFile);
		process.exit(1);
	}

	const annaRoot = path.resolve(__dirname, '..');
	const baseURL = 'http://localhost:' + port;

	// --- Server-side state ---

	const state = {
		polls: {},        // { pollId: { results: { option: count }, voters: Set } }
		questions: {},    // { qaId: [{ id, text, votes, voterIds: Set, timestamp }] }
		currentSlide: { h: 0, v: 0 }
	};

	// Reaction aggregation buffer
	let reactionBuffer = {};
	let reactionTimer = null;

	// --- Initial build ---

	let presenterHTML = '';

	try {
		presenterHTML = buildPresenterHTML(inputFile, port);
		console.log('  \u2713 Initial build of ' + inputFile);
	} catch (e) {
		console.error('  Error during initial build: ' + e.message);
		process.exit(1);
	}

	// --- Express + Socket.IO setup ---

	const app = express();
	const httpServer = createServer(app);
	const io = new Server(httpServer, {
		cors: { origin: '*' }
	});

	// Presenter view
	app.get('/', (_req, res) => {
		res.type('html').send(presenterHTML);
	});

	// Audience view
	app.get('/audience', (_req, res) => {
		res.type('html').send(generateAudienceHTML(port));
	});

	// QR code page
	app.get('/qr', (_req, res) => {
		const audienceURL = baseURL + '/audience';
		res.type('html').send(generateQRPage(audienceURL));
	});

	// API endpoint: current state (for audience page initial load)
	app.get('/api/state', (_req, res) => {
		const sanitized = {
			currentSlide: state.currentSlide,
			polls: {},
			questions: {}
		};

		// Serialize polls (Sets are not JSON-serializable)
		for (const [id, poll] of Object.entries(state.polls)) {
			sanitized.polls[id] = { results: poll.results };
		}

		// Serialize questions (strip voter Sets)
		for (const [id, qList] of Object.entries(state.questions)) {
			sanitized.questions[id] = qList.map(function(q) {
				return { id: q.id, text: q.text, votes: q.votes, timestamp: q.timestamp };
			});
		}

		res.json(sanitized);
	});

	// Static anna assets
	app.use('/css', express.static(path.join(annaRoot, 'css')));
	app.use('/js', express.static(path.join(annaRoot, 'js')));
	app.use('/lib', express.static(path.join(annaRoot, 'lib')));
	app.use('/plugin', express.static(path.join(annaRoot, 'plugin')));

	// Serve files relative to the Markdown file's directory (for local images, etc.)
	app.use(express.static(path.dirname(path.resolve(inputFile))));

	// --- Socket.IO event handlers ---

	io.on('connection', (socket) => {

		// Send current state on connect
		socket.emit('slide-changed', state.currentSlide);

		// --- Poll vote ---
		socket.on('poll-vote', (data) => {
			const { pollId, option, sessionId } = data;
			if (!pollId || !option || !sessionId) return;

			if (!state.polls[pollId]) {
				state.polls[pollId] = { results: {}, voters: new Set() };
			}

			const poll = state.polls[pollId];

			// One vote per session per poll
			if (poll.voters.has(sessionId)) return;

			poll.voters.add(sessionId);
			poll.results[option] = (poll.results[option] || 0) + 1;

			io.emit('poll-results', {
				pollId: pollId,
				results: poll.results
			});
		});

		// --- Q&A question ---
		socket.on('qa-question', (data) => {
			const { qaId, text, sessionId } = data;
			if (!qaId || !text || !sessionId) return;

			if (!state.questions[qaId]) {
				state.questions[qaId] = [];
			}

			const question = {
				id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
				text: text,
				votes: 0,
				voterIds: new Set(),
				timestamp: Date.now()
			};

			state.questions[qaId].push(question);

			io.emit('qa-questions', {
				qaId: qaId,
				questions: serializeQuestions(state.questions[qaId])
			});
		});

		// --- Q&A upvote ---
		socket.on('qa-upvote', (data) => {
			const { qaId, questionId, sessionId } = data;
			if (!qaId || !questionId || !sessionId) return;

			const qList = state.questions[qaId];
			if (!qList) return;

			const question = qList.find(function(q) { return q.id === questionId; });
			if (!question) return;

			// One upvote per session per question
			if (question.voterIds.has(sessionId)) return;

			question.voterIds.add(sessionId);
			question.votes++;

			io.emit('qa-questions', {
				qaId: qaId,
				questions: serializeQuestions(qList)
			});
		});

		// --- Reaction ---
		socket.on('reaction', (data) => {
			const { type } = data;
			if (!type) return;

			reactionBuffer[type] = (reactionBuffer[type] || 0) + 1;

			// Aggregate reactions in a 500ms window
			if (!reactionTimer) {
				reactionTimer = setTimeout(function() {
					io.emit('reaction-burst', reactionBuffer);
					reactionBuffer = {};
					reactionTimer = null;
				}, 500);
			}
		});

		// --- Slide changed (from presenter) ---
		socket.on('slide-changed', (data) => {
			if (data && typeof data.h === 'number' && typeof data.v === 'number') {
				state.currentSlide = { h: data.h, v: data.v };
				socket.broadcast.emit('slide-changed', state.currentSlide);
			}
		});
	});

	// --- Start server ---

	httpServer.listen(port, () => {
		console.log('\n  Anna.js Live Server\n');
		console.log('  \u2713 Presenter:  ' + baseURL);
		console.log('  \u2713 Audience:   ' + baseURL + '/audience');
		console.log('  \u2713 QR Code:    ' + baseURL + '/qr');
		console.log('  \u2713 Watching ' + inputFile + ' for changes\n');
		console.log('  Share the audience URL with your audience!\n');

		if (shouldOpen) {
			exec('open ' + baseURL);
		}
	});

	httpServer.on('error', (err) => {
		if (err.code === 'EADDRINUSE') {
			console.error('  Error: Port ' + port + ' is already in use');
		} else {
			console.error('  Error: ' + err.message);
		}
		process.exit(1);
	});

	// --- Watch for changes ---

	let debounceTimer;
	fs.watch(inputFile, () => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			try {
				presenterHTML = buildPresenterHTML(inputFile, port);
				console.log('  \u2713 Rebuilt ' + inputFile);
			} catch (e) {
				console.error('  Error: ' + e.message);
			}
		}, 150);
	});

	// --- Graceful shutdown ---

	process.on('SIGINT', () => {
		console.log('\n  Shutting down...');
		if (reactionTimer) clearTimeout(reactionTimer);
		io.close();
		httpServer.close();
		process.exit(0);
	});
}

// --- Helpers ---

/**
 * Build the presenter HTML from markdown with the live plugin injected.
 */
function buildPresenterHTML(inputFile, port) {
	let html = build(inputFile, { annaRoot: '.' });

	// Inject live plugin CSS and JS before </head>
	const liveAssets = '\t\t<link rel="stylesheet" href="/plugin/live/live.css">\n'
		+ '\t\t<script src="/socket.io/socket.io.js"></script>\n'
		+ '\t\t<script src="/plugin/live/live.js"></script>\n';

	if (html.includes('</head>')) {
		html = html.replace('</head>', liveAssets + '\t</head>');
	}

	// Inject live config into Anna.initialize() call
	const liveConfig = 'live: { url: \'http://localhost:' + port + '\', mode: \'presenter\' },\n\t\t\t\t';
	html = html.replace('Anna.initialize({', 'Anna.initialize({\n\t\t\t\t' + liveConfig);

	return html;
}

/**
 * Serialize a questions array, stripping the voterIds Set for JSON output.
 */
function serializeQuestions(questions) {
	return questions.map(function(q) {
		return { id: q.id, text: q.text, votes: q.votes, timestamp: q.timestamp };
	});
}

/**
 * Generate the audience HTML page.
 */
function generateAudienceHTML(port) {
	const baseURL = 'http://localhost:' + port;

	return '<!doctype html>\n'
		+ '<html>\n'
		+ '\t<head>\n'
		+ '\t\t<meta charset="utf-8">\n'
		+ '\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">\n'
		+ '\t\t<title>Anna.js — Audience View</title>\n'
		+ '\t\t<link rel="stylesheet" href="/css/reset.css">\n'
		+ '\t\t<link rel="stylesheet" href="/css/anna.css">\n'
		+ '\t\t<link rel="stylesheet" href="/css/theme/league.css">\n'
		+ '\t\t<link rel="stylesheet" href="/plugin/live/live.css">\n'
		+ '\t\t<style>\n'
		+ '\t\t\t*, *::before, *::after { box-sizing: border-box; }\n'
		+ '\t\t\thtml, body {\n'
		+ '\t\t\t\tmargin: 0; padding: 0;\n'
		+ '\t\t\t\theight: 100%;\n'
		+ '\t\t\t\tfont-family: "Source Sans Pro", Helvetica, sans-serif;\n'
		+ '\t\t\t\tbackground: #1c1e20;\n'
		+ '\t\t\t\tcolor: #eee;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.audience-container {\n'
		+ '\t\t\t\tmax-width: 640px;\n'
		+ '\t\t\t\tmargin: 0 auto;\n'
		+ '\t\t\t\tpadding: 24px 16px;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.audience-header {\n'
		+ '\t\t\t\ttext-align: center;\n'
		+ '\t\t\t\tpadding-bottom: 16px;\n'
		+ '\t\t\t\tborder-bottom: 1px solid rgba(255,255,255,0.1);\n'
		+ '\t\t\t\tmargin-bottom: 24px;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.audience-header h1 {\n'
		+ '\t\t\t\tfont-size: 1.4em;\n'
		+ '\t\t\t\tmargin: 0 0 8px 0;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.connection-status {\n'
		+ '\t\t\t\tdisplay: inline-flex;\n'
		+ '\t\t\t\talign-items: center;\n'
		+ '\t\t\t\tgap: 6px;\n'
		+ '\t\t\t\tfont-size: 0.85em;\n'
		+ '\t\t\t\tcolor: #999;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.connection-dot {\n'
		+ '\t\t\t\twidth: 8px; height: 8px;\n'
		+ '\t\t\t\tborder-radius: 50%;\n'
		+ '\t\t\t\tbackground: #e74c3c;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.connection-dot.connected { background: #2ecc71; }\n'
		+ '\t\t\t.slide-indicator {\n'
		+ '\t\t\t\ttext-align: center;\n'
		+ '\t\t\t\tfont-size: 0.85em;\n'
		+ '\t\t\t\tcolor: #666;\n'
		+ '\t\t\t\tmargin-bottom: 24px;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t#interactive-content {\n'
		+ '\t\t\t\tmin-height: 200px;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.empty-state {\n'
		+ '\t\t\t\ttext-align: center;\n'
		+ '\t\t\t\tpadding: 60px 20px;\n'
		+ '\t\t\t\tcolor: #666;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.empty-state .emoji { font-size: 2em; margin-bottom: 12px; }\n'
		+ '\t\t\t/* Poll styles */\n'
		+ '\t\t\t.audience-poll { margin-bottom: 24px; }\n'
		+ '\t\t\t.audience-poll h3 { margin: 0 0 12px 0; font-size: 1.1em; }\n'
		+ '\t\t\t.poll-option {\n'
		+ '\t\t\t\tdisplay: block; width: 100%;\n'
		+ '\t\t\t\tpadding: 12px 16px;\n'
		+ '\t\t\t\tmargin-bottom: 8px;\n'
		+ '\t\t\t\tbackground: rgba(255,255,255,0.08);\n'
		+ '\t\t\t\tborder: 1px solid rgba(255,255,255,0.15);\n'
		+ '\t\t\t\tborder-radius: 8px;\n'
		+ '\t\t\t\tcolor: #eee;\n'
		+ '\t\t\t\tfont-size: 1em;\n'
		+ '\t\t\t\tcursor: pointer;\n'
		+ '\t\t\t\ttransition: background 0.2s;\n'
		+ '\t\t\t\ttext-align: left;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.poll-option:hover { background: rgba(255,255,255,0.15); }\n'
		+ '\t\t\t.poll-option.voted {\n'
		+ '\t\t\t\tbackground: rgba(46,204,113,0.2);\n'
		+ '\t\t\t\tborder-color: #2ecc71;\n'
		+ '\t\t\t\tcursor: default;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.poll-result-bar {\n'
		+ '\t\t\t\theight: 4px; margin-top: 8px;\n'
		+ '\t\t\t\tbackground: rgba(255,255,255,0.1);\n'
		+ '\t\t\t\tborder-radius: 2px;\n'
		+ '\t\t\t\toverflow: hidden;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.poll-result-fill {\n'
		+ '\t\t\t\theight: 100%;\n'
		+ '\t\t\t\tbackground: #42affa;\n'
		+ '\t\t\t\ttransition: width 0.3s;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t/* Q&A styles */\n'
		+ '\t\t\t.audience-qa { margin-bottom: 24px; }\n'
		+ '\t\t\t.audience-qa h3 { margin: 0 0 12px 0; font-size: 1.1em; }\n'
		+ '\t\t\t.qa-input-row {\n'
		+ '\t\t\t\tdisplay: flex; gap: 8px;\n'
		+ '\t\t\t\tmargin-bottom: 16px;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.qa-input-row input {\n'
		+ '\t\t\t\tflex: 1;\n'
		+ '\t\t\t\tpadding: 10px 14px;\n'
		+ '\t\t\t\tbackground: rgba(255,255,255,0.08);\n'
		+ '\t\t\t\tborder: 1px solid rgba(255,255,255,0.15);\n'
		+ '\t\t\t\tborder-radius: 8px;\n'
		+ '\t\t\t\tcolor: #eee;\n'
		+ '\t\t\t\tfont-size: 0.95em;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.qa-input-row button {\n'
		+ '\t\t\t\tpadding: 10px 18px;\n'
		+ '\t\t\t\tbackground: #42affa;\n'
		+ '\t\t\t\tborder: none;\n'
		+ '\t\t\t\tborder-radius: 8px;\n'
		+ '\t\t\t\tcolor: #fff;\n'
		+ '\t\t\t\tfont-size: 0.95em;\n'
		+ '\t\t\t\tcursor: pointer;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.qa-question {\n'
		+ '\t\t\t\tdisplay: flex; align-items: flex-start; gap: 12px;\n'
		+ '\t\t\t\tpadding: 12px;\n'
		+ '\t\t\t\tmargin-bottom: 8px;\n'
		+ '\t\t\t\tbackground: rgba(255,255,255,0.05);\n'
		+ '\t\t\t\tborder-radius: 8px;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.qa-upvote {\n'
		+ '\t\t\t\tbackground: none; border: 1px solid rgba(255,255,255,0.2);\n'
		+ '\t\t\t\tborder-radius: 6px;\n'
		+ '\t\t\t\tcolor: #aaa; padding: 4px 10px;\n'
		+ '\t\t\t\tcursor: pointer; font-size: 0.85em;\n'
		+ '\t\t\t\twhite-space: nowrap;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.qa-upvote.voted { color: #42affa; border-color: #42affa; }\n'
		+ '\t\t\t.qa-question-text { flex: 1; line-height: 1.4; }\n'
		+ '\t\t\t/* Reaction bar */\n'
		+ '\t\t\t.reaction-bar {\n'
		+ '\t\t\t\tposition: fixed; bottom: 0; left: 0; right: 0;\n'
		+ '\t\t\t\tbackground: rgba(0,0,0,0.85);\n'
		+ '\t\t\t\tpadding: 12px;\n'
		+ '\t\t\t\tdisplay: flex;\n'
		+ '\t\t\t\tjustify-content: center;\n'
		+ '\t\t\t\tgap: 16px;\n'
		+ '\t\t\t\tborder-top: 1px solid rgba(255,255,255,0.1);\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.reaction-btn {\n'
		+ '\t\t\t\tfont-size: 1.6em;\n'
		+ '\t\t\t\tbackground: none;\n'
		+ '\t\t\t\tborder: none;\n'
		+ '\t\t\t\tcursor: pointer;\n'
		+ '\t\t\t\ttransition: transform 0.15s;\n'
		+ '\t\t\t\tpadding: 4px 8px;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t.reaction-btn:active { transform: scale(1.3); }\n'
		+ '\t\t\t/* Floating reactions */\n'
		+ '\t\t\t.reaction-float {\n'
		+ '\t\t\t\tposition: fixed;\n'
		+ '\t\t\t\tbottom: 80px;\n'
		+ '\t\t\t\tfont-size: 1.8em;\n'
		+ '\t\t\t\tpointer-events: none;\n'
		+ '\t\t\t\tanimation: floatUp 1.5s ease-out forwards;\n'
		+ '\t\t\t}\n'
		+ '\t\t\t@keyframes floatUp {\n'
		+ '\t\t\t\t0% { opacity: 1; transform: translateY(0) scale(1); }\n'
		+ '\t\t\t\t100% { opacity: 0; transform: translateY(-120px) scale(0.5); }\n'
		+ '\t\t\t}\n'
		+ '\t\t</style>\n'
		+ '\t</head>\n'
		+ '\t<body>\n'
		+ '\t\t<div class="audience-container">\n'
		+ '\t\t\t<div class="audience-header">\n'
		+ '\t\t\t\t<h1>Anna.js Live</h1>\n'
		+ '\t\t\t\t<div class="connection-status">\n'
		+ '\t\t\t\t\t<span class="connection-dot" id="conn-dot"></span>\n'
		+ '\t\t\t\t\t<span id="conn-text">Connecting...</span>\n'
		+ '\t\t\t\t</div>\n'
		+ '\t\t\t</div>\n'
		+ '\t\t\t<div class="slide-indicator" id="slide-indicator">Slide 1</div>\n'
		+ '\t\t\t<div id="interactive-content">\n'
		+ '\t\t\t\t<div class="empty-state">\n'
		+ '\t\t\t\t\t<div class="emoji">\u{1F3AC}</div>\n'
		+ '\t\t\t\t\t<p>Waiting for the presentation to begin...</p>\n'
		+ '\t\t\t\t</div>\n'
		+ '\t\t\t</div>\n'
		+ '\t\t</div>\n'
		+ '\n'
		+ '\t\t<div class="reaction-bar">\n'
		+ '\t\t\t<button class="reaction-btn" data-reaction="thumbsup">\u{1F44D}</button>\n'
		+ '\t\t\t<button class="reaction-btn" data-reaction="clap">\u{1F44F}</button>\n'
		+ '\t\t\t<button class="reaction-btn" data-reaction="heart">\u{2764}\uFE0F</button>\n'
		+ '\t\t\t<button class="reaction-btn" data-reaction="laugh">\u{1F602}</button>\n'
		+ '\t\t\t<button class="reaction-btn" data-reaction="think">\u{1F914}</button>\n'
		+ '\t\t\t<button class="reaction-btn" data-reaction="surprise">\u{1F62E}</button>\n'
		+ '\t\t</div>\n'
		+ '\n'
		+ '\t\t<script src="/socket.io/socket.io.js"></script>\n'
		+ '\t\t<script>\n'
		+ '\t\t\t(function() {\n'
		+ '\t\t\t\t// Session ID for vote deduplication\n'
		+ '\t\t\t\tvar sessionId = sessionStorage.getItem("anna-session-id");\n'
		+ '\t\t\t\tif (!sessionId) {\n'
		+ '\t\t\t\t\tsessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);\n'
		+ '\t\t\t\t\tsessionStorage.setItem("anna-session-id", sessionId);\n'
		+ '\t\t\t\t}\n'
		+ '\n'
		+ '\t\t\t\tvar socket = io("' + baseURL + '");\n'
		+ '\t\t\t\tvar connDot = document.getElementById("conn-dot");\n'
		+ '\t\t\t\tvar connText = document.getElementById("conn-text");\n'
		+ '\t\t\t\tvar slideIndicator = document.getElementById("slide-indicator");\n'
		+ '\t\t\t\tvar content = document.getElementById("interactive-content");\n'
		+ '\t\t\t\tvar votedPolls = {};\n'
		+ '\t\t\t\tvar votedQuestions = {};\n'
		+ '\n'
		+ '\t\t\t\t// --- Connection status ---\n'
		+ '\t\t\t\tsocket.on("connect", function() {\n'
		+ '\t\t\t\t\tconnDot.classList.add("connected");\n'
		+ '\t\t\t\t\tconnText.textContent = "Connected";\n'
		+ '\t\t\t\t});\n'
		+ '\t\t\t\tsocket.on("disconnect", function() {\n'
		+ '\t\t\t\t\tconnDot.classList.remove("connected");\n'
		+ '\t\t\t\t\tconnText.textContent = "Disconnected";\n'
		+ '\t\t\t\t});\n'
		+ '\n'
		+ '\t\t\t\t// --- Slide changed ---\n'
		+ '\t\t\t\tsocket.on("slide-changed", function(data) {\n'
		+ '\t\t\t\t\tslideIndicator.textContent = "Slide " + (data.h + 1) + (data.v > 0 ? "." + (data.v + 1) : "");\n'
		+ '\t\t\t\t});\n'
		+ '\n'
		+ '\t\t\t\t// --- Poll results ---\n'
		+ '\t\t\t\tsocket.on("poll-results", function(data) {\n'
		+ '\t\t\t\t\tvar pollEl = document.querySelector(\'[data-poll-id="\' + data.pollId + \'\"]\');\n'
		+ '\t\t\t\t\tif (!pollEl) return;\n'
		+ '\t\t\t\t\tvar total = 0;\n'
		+ '\t\t\t\t\tfor (var k in data.results) total += data.results[k];\n'
		+ '\t\t\t\t\tvar bars = pollEl.querySelectorAll(".poll-result-fill");\n'
		+ '\t\t\t\t\tbars.forEach(function(bar) {\n'
		+ '\t\t\t\t\t\tvar opt = bar.getAttribute("data-option");\n'
		+ '\t\t\t\t\t\tvar count = data.results[opt] || 0;\n'
		+ '\t\t\t\t\t\tvar pct = total > 0 ? (count / total * 100) : 0;\n'
		+ '\t\t\t\t\t\tbar.style.width = pct + "%";\n'
		+ '\t\t\t\t\t});\n'
		+ '\t\t\t\t});\n'
		+ '\n'
		+ '\t\t\t\t// --- Q&A questions ---\n'
		+ '\t\t\t\tsocket.on("qa-questions", function(data) {\n'
		+ '\t\t\t\t\tvar qaEl = document.querySelector(\'[data-qa-id="\' + data.qaId + \'\"]\');\n'
		+ '\t\t\t\t\tif (!qaEl) return;\n'
		+ '\t\t\t\t\tvar listEl = qaEl.querySelector(".qa-list");\n'
		+ '\t\t\t\t\tif (!listEl) return;\n'
		+ '\t\t\t\t\tvar sorted = data.questions.slice().sort(function(a, b) { return b.votes - a.votes; });\n'
		+ '\t\t\t\t\tlistEl.innerHTML = sorted.map(function(q) {\n'
		+ '\t\t\t\t\t\tvar votedClass = votedQuestions[q.id] ? " voted" : "";\n'
		+ '\t\t\t\t\t\treturn \'<div class="qa-question">\'\n'
		+ '\t\t\t\t\t\t\t+ \'<button class="qa-upvote\' + votedClass + \'" data-question-id="\' + q.id + \'" data-qa-id="\' + data.qaId + \'">\\u25B2 \' + q.votes + \'</button>\'\n'
		+ '\t\t\t\t\t\t\t+ \'<span class="qa-question-text">\' + escapeHTML(q.text) + \'</span>\'\n'
		+ '\t\t\t\t\t\t\t+ \'</div>\';\n'
		+ '\t\t\t\t\t}).join("");\n'
		+ '\t\t\t\t});\n'
		+ '\n'
		+ '\t\t\t\t// --- Reaction burst ---\n'
		+ '\t\t\t\tvar reactionEmojis = {\n'
		+ '\t\t\t\t\tthumbsup: "\\uD83D\\uDC4D", clap: "\\uD83D\\uDC4F",\n'
		+ '\t\t\t\t\theart: "\\u2764\\uFE0F", laugh: "\\uD83D\\uDE02",\n'
		+ '\t\t\t\t\tthink: "\\uD83E\\uDD14", surprise: "\\uD83D\\uDE2E"\n'
		+ '\t\t\t\t};\n'
		+ '\n'
		+ '\t\t\t\tsocket.on("reaction-burst", function(data) {\n'
		+ '\t\t\t\t\tfor (var type in data) {\n'
		+ '\t\t\t\t\t\tfor (var i = 0; i < Math.min(data[type], 10); i++) {\n'
		+ '\t\t\t\t\t\t\tshowFloatingReaction(reactionEmojis[type] || type);\n'
		+ '\t\t\t\t\t\t}\n'
		+ '\t\t\t\t\t}\n'
		+ '\t\t\t\t});\n'
		+ '\n'
		+ '\t\t\t\tfunction showFloatingReaction(emoji) {\n'
		+ '\t\t\t\t\tvar el = document.createElement("div");\n'
		+ '\t\t\t\t\tel.className = "reaction-float";\n'
		+ '\t\t\t\t\tel.textContent = emoji;\n'
		+ '\t\t\t\t\tel.style.left = (20 + Math.random() * 60) + "%";\n'
		+ '\t\t\t\t\tdocument.body.appendChild(el);\n'
		+ '\t\t\t\t\tsetTimeout(function() { el.remove(); }, 1500);\n'
		+ '\t\t\t\t}\n'
		+ '\n'
		+ '\t\t\t\t// --- Reactions ---\n'
		+ '\t\t\t\tdocument.querySelector(".reaction-bar").addEventListener("click", function(e) {\n'
		+ '\t\t\t\t\tvar btn = e.target.closest(".reaction-btn");\n'
		+ '\t\t\t\t\tif (!btn) return;\n'
		+ '\t\t\t\t\tvar type = btn.getAttribute("data-reaction");\n'
		+ '\t\t\t\t\tsocket.emit("reaction", { type: type });\n'
		+ '\t\t\t\t\tshowFloatingReaction(btn.textContent);\n'
		+ '\t\t\t\t});\n'
		+ '\n'
		+ '\t\t\t\t// --- Delegated click handlers for polls & Q&A ---\n'
		+ '\t\t\t\tcontent.addEventListener("click", function(e) {\n'
		+ '\t\t\t\t\t// Poll vote\n'
		+ '\t\t\t\t\tvar optBtn = e.target.closest(".poll-option");\n'
		+ '\t\t\t\t\tif (optBtn && !optBtn.classList.contains("voted")) {\n'
		+ '\t\t\t\t\t\tvar pollId = optBtn.getAttribute("data-poll-id");\n'
		+ '\t\t\t\t\t\tvar option = optBtn.getAttribute("data-option");\n'
		+ '\t\t\t\t\t\tif (!votedPolls[pollId]) {\n'
		+ '\t\t\t\t\t\t\tvotedPolls[pollId] = true;\n'
		+ '\t\t\t\t\t\t\tsocket.emit("poll-vote", { pollId: pollId, option: option, sessionId: sessionId });\n'
		+ '\t\t\t\t\t\t\tvar siblings = optBtn.parentElement.querySelectorAll(".poll-option");\n'
		+ '\t\t\t\t\t\t\tsiblings.forEach(function(s) { s.classList.add("voted"); });\n'
		+ '\t\t\t\t\t\t}\n'
		+ '\t\t\t\t\t}\n'
		+ '\n'
		+ '\t\t\t\t\t// Q&A upvote\n'
		+ '\t\t\t\t\tvar upBtn = e.target.closest(".qa-upvote");\n'
		+ '\t\t\t\t\tif (upBtn && !upBtn.classList.contains("voted")) {\n'
		+ '\t\t\t\t\t\tvar questionId = upBtn.getAttribute("data-question-id");\n'
		+ '\t\t\t\t\t\tvar qaId = upBtn.getAttribute("data-qa-id");\n'
		+ '\t\t\t\t\t\tif (!votedQuestions[questionId]) {\n'
		+ '\t\t\t\t\t\t\tvotedQuestions[questionId] = true;\n'
		+ '\t\t\t\t\t\t\tsocket.emit("qa-upvote", { qaId: qaId, questionId: questionId, sessionId: sessionId });\n'
		+ '\t\t\t\t\t\t\tupBtn.classList.add("voted");\n'
		+ '\t\t\t\t\t\t}\n'
		+ '\t\t\t\t\t}\n'
		+ '\t\t\t\t});\n'
		+ '\n'
		+ '\t\t\t\t// --- Q&A submit ---\n'
		+ '\t\t\t\tcontent.addEventListener("keydown", function(e) {\n'
		+ '\t\t\t\t\tif (e.key === "Enter" && e.target.classList.contains("qa-input")) {\n'
		+ '\t\t\t\t\t\tsubmitQuestion(e.target);\n'
		+ '\t\t\t\t\t}\n'
		+ '\t\t\t\t});\n'
		+ '\t\t\t\tcontent.addEventListener("click", function(e) {\n'
		+ '\t\t\t\t\tvar submitBtn = e.target.closest(".qa-submit");\n'
		+ '\t\t\t\t\tif (submitBtn) {\n'
		+ '\t\t\t\t\t\tvar input = submitBtn.parentElement.querySelector(".qa-input");\n'
		+ '\t\t\t\t\t\tif (input) submitQuestion(input);\n'
		+ '\t\t\t\t\t}\n'
		+ '\t\t\t\t});\n'
		+ '\n'
		+ '\t\t\t\tfunction submitQuestion(input) {\n'
		+ '\t\t\t\t\tvar text = input.value.trim();\n'
		+ '\t\t\t\t\tvar qaId = input.getAttribute("data-qa-id");\n'
		+ '\t\t\t\t\tif (!text || !qaId) return;\n'
		+ '\t\t\t\t\tsocket.emit("qa-question", { qaId: qaId, text: text, sessionId: sessionId });\n'
		+ '\t\t\t\t\tinput.value = "";\n'
		+ '\t\t\t\t}\n'
		+ '\n'
		+ '\t\t\t\tfunction escapeHTML(str) {\n'
		+ '\t\t\t\t\tvar div = document.createElement("div");\n'
		+ '\t\t\t\t\tdiv.textContent = str;\n'
		+ '\t\t\t\t\treturn div.innerHTML;\n'
		+ '\t\t\t\t}\n'
		+ '\t\t\t})();\n'
		+ '\t\t</script>\n'
		+ '\t</body>\n'
		+ '</html>\n';
}

/**
 * Generate the QR code page for the audience URL.
 */
function generateQRPage(audienceURL) {
	var qrAPIURL = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(audienceURL);

	return '<!doctype html>\n'
		+ '<html>\n'
		+ '\t<head>\n'
		+ '\t\t<meta charset="utf-8">\n'
		+ '\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
		+ '\t\t<title>Anna.js Live — Join</title>\n'
		+ '\t\t<style>\n'
		+ '\t\t\t* { margin: 0; padding: 0; box-sizing: border-box; }\n'
		+ '\t\t\tbody {\n'
		+ '\t\t\t\tmin-height: 100vh;\n'
		+ '\t\t\t\tdisplay: flex; flex-direction: column;\n'
		+ '\t\t\t\talign-items: center; justify-content: center;\n'
		+ '\t\t\t\tbackground: #1c1e20;\n'
		+ '\t\t\t\tcolor: #eee;\n'
		+ '\t\t\t\tfont-family: "Source Sans Pro", Helvetica, sans-serif;\n'
		+ '\t\t\t}\n'
		+ '\t\t\th1 { font-size: 2em; margin-bottom: 8px; }\n'
		+ '\t\t\tp { color: #999; margin-bottom: 32px; font-size: 1.1em; }\n'
		+ '\t\t\timg { border-radius: 12px; background: #fff; padding: 16px; }\n'
		+ '\t\t\t.url {\n'
		+ '\t\t\t\tmargin-top: 24px;\n'
		+ '\t\t\t\tpadding: 12px 24px;\n'
		+ '\t\t\t\tbackground: rgba(255,255,255,0.08);\n'
		+ '\t\t\t\tborder-radius: 8px;\n'
		+ '\t\t\t\tfont-family: monospace;\n'
		+ '\t\t\t\tfont-size: 1.1em;\n'
		+ '\t\t\t\tcolor: #42affa;\n'
		+ '\t\t\t}\n'
		+ '\t\t</style>\n'
		+ '\t</head>\n'
		+ '\t<body>\n'
		+ '\t\t<h1>Join the Presentation</h1>\n'
		+ '\t\t<p>Scan the QR code or visit the URL below</p>\n'
		+ '\t\t<img src="' + qrAPIURL + '" alt="QR Code" width="300" height="300">\n'
		+ '\t\t<div class="url">' + audienceURL + '</div>\n'
		+ '\t</body>\n'
		+ '</html>\n';
}

/**
 * Parse the input .md file from args, skipping flags and their values.
 */
function parseInputFile(args) {
	const skipNext = new Set();
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--port' || args[i] === '-p') {
			skipNext.add(i);
			skipNext.add(i + 1);
		}
	}

	for (let i = 0; i < args.length; i++) {
		if (!skipNext.has(i) && !args[i].startsWith('-')) {
			return args[i];
		}
	}
	return null;
}

/**
 * Parse --port / -p from args, defaulting to 4000.
 */
function parsePort(args) {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--port' || args[i] === '-p') {
			const val = parseInt(args[i + 1], 10);
			if (isNaN(val) || val < 1 || val > 65535) {
				console.error('  Error: Invalid port: ' + args[i + 1]);
				process.exit(1);
			}
			return val;
		}
	}
	return 4000;
}

// --- Exports ---

module.exports = { run };
