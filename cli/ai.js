/**
 * Anna.js AI — generate a presentation from an outline or topic
 *
 * Uses the Claude API to transform text into a complete Anna.js
 * markdown presentation. Requires ANTHROPIC_API_KEY env var.
 *
 * The Anthropic SDK is not bundled — install when needed:
 *   npm install @anthropic-ai/sdk
 */

const fs = require('fs');
const path = require('path');

const SYSTEM_PROMPT = `You are a presentation designer creating slides for Anna.js, a Markdown-based presentation framework.

OUTPUT FORMAT — produce a single Markdown file with YAML frontmatter. Nothing else.

RULES:
- Start with YAML frontmatter between --- lines (title, author, theme, transition)
- Separate horizontal slides with --- on its own line
- Separate vertical sub-slides with -- on its own line
- Use <!-- .fragments --> before a list to reveal items one by one
- Use \`\`\`mermaid for diagrams (flowchart, sequence, etc.) when they add clarity
- Use \`\`\`terminal for CLI command demos when relevant
- Use <!-- .slide: data-background="#hex" --> for accent/section-divider slides
- Add Note: blocks with speaker notes on key slides
- Keep each slide focused — one idea, minimal text
- Use a mix of headings, bullets, code blocks, and emphasis
- First slide: title + subtitle + author
- Last slide: summary or thank you
- Pick a theme that fits the topic (league, moon, black, white, night, solarized, blood, sky, beige, serif, simple)
- Aim for 8-15 slides depending on content depth
- Write in the same language as the input

DO NOT wrap the output in a code fence. Output ONLY the raw markdown.`;

function run(args) {
	if (args.includes('--help') || args.includes('-h') || args.length === 0) {
		console.log(`
  Anna.js AI — Generate presentations from outlines

  Usage:
    anna ai <outline.txt> [options]
    anna ai "Topic or description" [options]

  Options:
    -o, --output <file>   Output file (default: slides.md)
    --theme <name>        Override theme selection
    --lang <code>         Language hint (e.g. no, en)
    --help, -h            Show this help

  Environment:
    ANTHROPIC_API_KEY     Required. Your Anthropic API key.

  Examples:
    anna ai outline.txt
    anna ai "Introduction to Kubernetes" -o k8s.md
    anna ai notes.txt --theme moon --lang no
		`);
		process.exit(0);
	}

	// Parse args
	const opts = parseArgs(args);

	if (!opts.input) {
		console.error('  Error: No input provided. Pass a file or topic string.');
		process.exit(1);
	}

	generatePresentation(opts).catch(err => {
		console.error(`  Error: ${err.message}`);
		process.exit(1);
	});
}

function parseArgs(args) {
	const opts = { input: null, output: null, theme: null, lang: null };
	const positional = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === '-o' || arg === '--output') { opts.output = args[++i]; }
		else if (arg === '--theme') { opts.theme = args[++i]; }
		else if (arg === '--lang') { opts.lang = args[++i]; }
		else if (!arg.startsWith('-')) { positional.push(arg); }
	}

	if (positional.length > 0) {
		const first = positional[0];
		// If it's an existing file, read it
		if (fs.existsSync(first)) {
			opts.input = fs.readFileSync(first, 'utf-8');
			opts.inputFile = first;
			if (!opts.output) {
				opts.output = first.replace(/\.(txt|md|org|rst)$/, '') + '-slides.md';
			}
		} else {
			// Treat as a topic string
			opts.input = first;
			if (!opts.output) {
				const slug = first.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
				opts.output = slug + '.md';
			}
		}
	}

	if (!opts.output) opts.output = 'slides.md';
	return opts;
}

async function generatePresentation(opts) {
	// Load Anthropic SDK
	let Anthropic;
	try {
		Anthropic = require('@anthropic-ai/sdk');
	} catch {
		console.error(`  The Anthropic SDK is required for AI generation. Install it with:\n`);
		console.error(`    npm install @anthropic-ai/sdk\n`);
		process.exit(1);
	}

	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		console.error(`  Error: ANTHROPIC_API_KEY environment variable is not set.\n`);
		console.error(`  Get your key at https://console.anthropic.com/\n`);
		process.exit(1);
	}

	const client = new Anthropic();

	// Build the user prompt
	let userPrompt = opts.input;

	if (opts.theme) {
		userPrompt += `\n\nUse the "${opts.theme}" theme.`;
	}
	if (opts.lang) {
		userPrompt += `\n\nWrite the presentation in language: ${opts.lang}`;
	}

	console.log('  Generating presentation...');

	const message = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 4096,
		system: SYSTEM_PROMPT,
		messages: [{ role: 'user', content: userPrompt }],
	});

	let markdown = message.content[0].text.trim();

	// Strip code fence if the model wrapped it anyway
	if (markdown.startsWith('```')) {
		markdown = markdown.replace(/^```\w*\n/, '').replace(/\n```$/, '');
	}

	fs.writeFileSync(opts.output, markdown, 'utf-8');
	console.log(`  \u2713 ${opts.output}`);

	// Also generate HTML
	const { build } = require('./generate');
	const htmlFile = opts.output.replace(/\.md$/, '.html');
	const html = build(opts.output, {
		annaRoot: path.relative(path.dirname(path.resolve(htmlFile)), path.resolve(__dirname, '..'))
	});
	fs.writeFileSync(htmlFile, html, 'utf-8');
	console.log(`  \u2713 ${htmlFile}`);
	console.log(`\n  Open ${htmlFile} to preview your presentation.`);
}

module.exports = { run };
