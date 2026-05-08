/**
 * Anna.js Dev Server with Live Reload
 *
 * Serves a generated presentation with SSE-based live reload.
 * Watches the source Markdown file and rebuilds on changes.
 *
 * Usage:
 *   anna serve <file.md> [options]
 *
 * Options:
 *   --port, -p <number>   Port to listen on (default: 3000)
 *   --open, -o            Open browser automatically
 *   --help, -h            Show this help
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { exec } = require('child_process');
const { build } = require('./generate');

// --- Public API ---

function run(args) {
	if (args.includes('--help') || args.includes('-h') || args.length === 0) {
		console.log(`
  Anna.js Dev Server

  Usage:
    anna serve <input.md> [options]

  Options:
    --port, -p <number>   Port to listen on (default: 3000)
    --open, -o            Open browser automatically
    --help, -h            Show this help

  The server rebuilds on every Markdown change and
  reloads connected browsers automatically via SSE.
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
	const sseClients = [];
	let currentHTML = '';

	// --- Initial build ---

	try {
		currentHTML = buildWithReloadScript(inputFile);
		console.log('  \u2713 Initial build of ' + inputFile);
	} catch (e) {
		console.error('  Error during initial build: ' + e.message);
		process.exit(1);
	}

	// --- Express app ---

	const app = express();

	// SSE endpoint for live reload
	app.get('/__anna_sse', (req, res) => {
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
		});
		res.write('\n');

		sseClients.push(res);

		req.on('close', () => {
			const idx = sseClients.indexOf(res);
			if (idx !== -1) sseClients.splice(idx, 1);
		});
	});

	// Serve the generated presentation at /
	app.get('/', (_req, res) => {
		res.type('html').send(currentHTML);
	});

	// Serve static anna assets (css, js, lib, plugin)
	app.use('/css', express.static(path.join(annaRoot, 'css')));
	app.use('/js', express.static(path.join(annaRoot, 'js')));
	app.use('/lib', express.static(path.join(annaRoot, 'lib')));
	app.use('/plugin', express.static(path.join(annaRoot, 'plugin')));

	// Serve files relative to the Markdown file's directory (for local images, etc.)
	app.use(express.static(path.dirname(path.resolve(inputFile))));

	// --- Start server ---

	const server = app.listen(port, () => {
		const url = 'http://localhost:' + port;
		console.log('\n  Anna.js Dev Server');
		console.log('  \u2713 Serving on ' + url);
		console.log('  \u2713 Watching ' + inputFile + ' for changes');
		console.log('  \u2713 Live reload enabled (SSE)\n');

		if (shouldOpen) {
			exec('open ' + url);
		}
	});

	server.on('error', (err) => {
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
				currentHTML = buildWithReloadScript(inputFile);
				console.log('  \u2713 Rebuilt ' + inputFile);

				// Notify all connected browsers
				for (const client of sseClients) {
					client.write('data: reload\n\n');
				}
			} catch (e) {
				console.error('  Error: ' + e.message);
			}
		}, 150);
	});

	// --- Graceful shutdown ---

	process.on('SIGINT', () => {
		console.log('\n  Shutting down...');
		for (const client of sseClients) {
			client.end();
		}
		server.close();
		process.exit(0);
	});
}

// --- Helpers ---

/**
 * Build HTML and inject the SSE live-reload client script.
 */
function buildWithReloadScript(inputFile) {
	const html = build(inputFile, { annaRoot: '.' });
	return injectReloadScript(html);
}

/**
 * Inject a small SSE client script before </body> that triggers
 * a page reload whenever the server sends a reload event.
 */
function injectReloadScript(html) {
	const script = '\n\t\t<script>\n'
		+ '\t\t\t// Anna.js live reload\n'
		+ '\t\t\t(function() {\n'
		+ '\t\t\t\tvar source = new EventSource(\'/__anna_sse\');\n'
		+ '\t\t\t\tsource.onmessage = function(e) {\n'
		+ '\t\t\t\t\tif (e.data === \'reload\') location.reload();\n'
		+ '\t\t\t\t};\n'
		+ '\t\t\t\tsource.onerror = function() {\n'
		+ '\t\t\t\t\tsource.close();\n'
		+ '\t\t\t\t\tsetTimeout(function() { location.reload(); }, 1000);\n'
		+ '\t\t\t\t};\n'
		+ '\t\t\t})();\n'
		+ '\t\t</script>';

	if (html.includes('</body>')) {
		return html.replace('</body>', script + '\n\t</body>');
	}

	// Fallback: just append the script
	return html + script;
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
 * Parse --port / -p from args, defaulting to 3000.
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
	return 3000;
}

// --- Exports ---

module.exports = { run };
