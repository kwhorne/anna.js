/**
 * Anna.js export — export presentation to PDF
 *
 * Uses Puppeteer to render the presentation with Anna.js print-pdf mode
 * and save as PDF. Puppeteer is not bundled — install it when needed:
 *
 *   npm install puppeteer
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

function run(args) {
	if (args.includes('--help') || args.includes('-h') || args.length === 0) {
		console.log(`
  Anna.js Export — Export presentation to PDF

  Usage:
    anna export <input.md> [output.pdf]
    anna export <input.html> [output.pdf]

  Options:
    --help, -h    Show this help

  Requirements:
    npm install puppeteer

  The presentation is rendered using Anna.js print-pdf mode
  and exported as a multi-page PDF.
		`);
		process.exit(0);
	}

	const fileArgs = args.filter(a => !a.startsWith('-'));
	const inputFile = path.resolve(fileArgs[0]);
	const outputPdf = fileArgs[1]
		? path.resolve(fileArgs[1])
		: inputFile.replace(/\.(md|html)$/, '.pdf');

	if (!fs.existsSync(inputFile)) {
		console.error(`  Error: File not found: ${inputFile}`);
		process.exit(1);
	}

	exportPdf(inputFile, outputPdf).catch(err => {
		console.error(`  Error: ${err.message}`);
		process.exit(1);
	});
}

async function exportPdf(inputFile, outputPdf) {
	// Load puppeteer
	let puppeteer;
	try {
		puppeteer = require('puppeteer');
	} catch {
		console.error(`  Puppeteer is required for PDF export. Install it with:\n`);
		console.error(`    npm install puppeteer\n`);
		process.exit(1);
	}

	// If input is markdown, generate HTML first
	let htmlFile = inputFile;
	let tempHtml = false;

	if (inputFile.endsWith('.md')) {
		const { build } = require('./generate');
		htmlFile = inputFile.replace(/\.md$/, '.tmp.html');
		const html = build(inputFile, {
			annaRoot: path.relative(path.dirname(htmlFile), path.resolve(__dirname, '..'))
		});
		fs.writeFileSync(htmlFile, html, 'utf-8');
		tempHtml = true;
	}

	// Serve the HTML via a local HTTP server (file:// has CORS issues with plugins)
	const rootDir = path.dirname(htmlFile);
	const server = http.createServer((req, res) => {
		let filePath = path.join(rootDir, decodeURIComponent(req.url.split('?')[0]));
		if (!fs.existsSync(filePath)) {
			res.writeHead(404);
			res.end();
			return;
		}
		if (fs.statSync(filePath).isDirectory()) {
			filePath = path.join(filePath, 'index.html');
		}
		const ext = path.extname(filePath).toLowerCase();
		const types = {
			'.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
			'.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
			'.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
			'.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
		};
		res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
		fs.createReadStream(filePath).pipe(res);
	});

	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	const port = server.address().port;
	const fileName = path.basename(htmlFile);
	const url = `http://127.0.0.1:${port}/${fileName}?print-pdf`;

	console.log(`  Rendering presentation...`);

	const browser = await puppeteer.launch({ headless: true });
	const page = await browser.newPage();

	await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

	// Wait for Anna.js to initialize and layout print-pdf slides
	await page.waitForSelector('.slides', { timeout: 10000 });
	await new Promise(r => setTimeout(r, 1000));

	await page.pdf({
		path: outputPdf,
		printBackground: true,
		width: '960px',
		height: '700px',
		margin: { top: 0, right: 0, bottom: 0, left: 0 },
	});

	await browser.close();
	server.close();

	if (tempHtml) {
		fs.unlinkSync(htmlFile);
	}

	console.log(`  \u2713 ${path.basename(outputPdf)}`);
}

module.exports = { run };
