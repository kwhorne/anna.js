/**
 * Anna.js AI — generate, refine, and translate presentations
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

const REFINE_PROMPT = `You are a presentation coach reviewing and improving an Anna.js Markdown presentation.

The user will provide an existing presentation in Anna.js Markdown format. Your job is to return an IMPROVED version of the same presentation.

ANALYZE AND IMPROVE:
- Visual balance: split slides that have too much text; consolidate slides that are too thin
- Speaker notes: add Note: blocks to any slide that lacks them
- Fragment usage: add <!-- .fragments --> where revealing items one-by-one would improve pacing
- Theme & transition: if the current theme/transition feel wrong for the content, suggest better ones in the frontmatter
- Mermaid diagrams: simplify overly complex diagrams, fix syntax issues, improve layout direction
- Terminal blocks: ensure \`\`\`terminal blocks are realistic and well-formatted
- Slide flow: improve the narrative arc from intro to conclusion
- Emphasis & formatting: use bold, italic, and headings consistently
- Keep the same language as the original

RETURN the full improved Markdown file with YAML frontmatter. Nothing else.
DO NOT wrap the output in a code fence. Output ONLY the raw markdown.`;

const TRANSLATE_PROMPT = `You are a professional translator specializing in presentations. You translate Anna.js Markdown presentations while perfectly preserving their structure and formatting.

RULES:
- Translate ALL human-readable content (titles, bullets, speaker notes, paragraphs) to the target language
- KEEP all Markdown and Anna.js syntax exactly as-is:
	- YAML frontmatter keys (title, author, theme, transition) — translate the VALUES only
	- Slide separators (--- and --)
	- HTML comments (<!-- .fragments -->, <!-- .slide: ... -->)
	- Code block markers and their language tags (\`\`\`mermaid, \`\`\`terminal, etc.)
	- Note: prefix for speaker notes (keep "Note:" in English, translate the content after it)
- Inside Mermaid diagrams: translate node labels but keep Mermaid syntax (graph TD, -->, etc.)
- Inside terminal blocks: keep commands as-is, translate comments only
- Adapt cultural references, idioms, and examples to feel natural in the target language
- Keep technical terms untranslated where translation would be confusing (e.g. "Kubernetes", "Docker", "API")
- Preserve the EXACT same slide structure — same number of slides, same separators, same ordering

RETURN the full translated Markdown file with YAML frontmatter. Nothing else.
DO NOT wrap the output in a code fence. Output ONLY the raw markdown.`;

function run(args) {
	if (args.includes('--help') || args.includes('-h') || args.length === 0) {
		console.log(`
  Anna.js AI — Generate, refine, and translate presentations

  Usage:
    anna ai <outline.txt> [options]
    anna ai "Topic or description" [options]
    anna ai refine <file.md> [options]
    anna ai translate <file.md> --lang <target> [options]

  Subcommands:
    refine <file.md>      Improve an existing presentation (visual balance,
                          speaker notes, fragment pacing, theme fit, etc.)
    translate <file.md>   Translate a presentation to another language
                          (requires --lang)

  Options:
    -o, --output <file>   Output file (default depends on command)
    --theme <name>        Override theme selection
    --lang <code>         Language hint for generate, required for translate
    --help, -h            Show this help

  Environment:
    ANTHROPIC_API_KEY     Required. Your Anthropic API key.

  Examples:
    anna ai outline.txt
    anna ai "Introduction to Kubernetes" -o k8s.md
    anna ai notes.txt --theme moon --lang no
    anna ai refine slides.md
    anna ai refine slides.md -o slides-v2.md
    anna ai translate slides.md --lang en
    anna ai translate slides.md --lang ja -o slides-japanese.md
		`);
		process.exit(0);
	}

	// Route subcommands
	if (args[0] === 'refine') {
		const opts = parseArgs(args.slice(1));
		if (!opts.inputFile) {
			console.error('  Error: refine requires a markdown file as input.');
			process.exit(1);
		}
		if (!opts.output) {
			opts.output = opts.inputFile.replace(/\.md$/, '') + '-refined.md';
		}
		refinePresentation(opts).catch((err) => {
			console.error(`  Error: ${err.message}`);
			process.exit(1);
		});
		return;
	}

	if (args[0] === 'translate') {
		const opts = parseArgs(args.slice(1));
		if (!opts.inputFile) {
			console.error('  Error: translate requires a markdown file as input.');
			process.exit(1);
		}
		if (!opts.lang) {
			console.error(
				'  Error: translate requires --lang <target> (e.g. --lang en).',
			);
			process.exit(1);
		}
		if (!opts.output) {
			opts.output =
				opts.inputFile.replace(/\.md$/, '') + '-' + opts.lang + '.md';
		}
		translatePresentation(opts).catch((err) => {
			console.error(`  Error: ${err.message}`);
			process.exit(1);
		});
		return;
	}

	// Default: generate
	const opts = parseArgs(args);

	if (!opts.input) {
		console.error('  Error: No input provided. Pass a file or topic string.');
		process.exit(1);
	}

	generatePresentation(opts).catch((err) => {
		console.error(`  Error: ${err.message}`);
		process.exit(1);
	});
}

function parseArgs(args) {
	const opts = { input: null, output: null, theme: null, lang: null };
	const positional = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === '-o' || arg === '--output') {
			opts.output = args[++i];
		} else if (arg === '--theme') {
			opts.theme = args[++i];
		} else if (arg === '--lang') {
			opts.lang = args[++i];
		} else if (!arg.startsWith('-')) {
			positional.push(arg);
		}
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
				const slug = first
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.slice(0, 40);
				opts.output = slug + '.md';
			}
		}
	}

	if (!opts.output) opts.output = 'slides.md';
	return opts;
}

function loadAnthropicClient() {
	let Anthropic;
	try {
		Anthropic = require('@anthropic-ai/sdk');
	} catch {
		console.error(
			`  The Anthropic SDK is required for AI generation. Install it with:\n`,
		);
		console.error(`    npm install @anthropic-ai/sdk\n`);
		process.exit(1);
	}

	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		console.error(
			`  Error: ANTHROPIC_API_KEY environment variable is not set.\n`,
		);
		console.error(`  Get your key at https://console.anthropic.com/\n`);
		process.exit(1);
	}

	return new Anthropic();
}

function stripCodeFence(text) {
	let result = text.trim();
	if (result.startsWith('```')) {
		result = result.replace(/^```\w*\n/, '').replace(/\n```$/, '');
	}
	return result;
}

function writeOutputAndBuildHtml(markdown, outputPath) {
	fs.writeFileSync(outputPath, markdown, 'utf-8');
	console.log(`  \u2713 ${outputPath}`);

	const { build } = require('./generate');
	const htmlFile = outputPath.replace(/\.md$/, '.html');
	const html = build(outputPath, {
		annaRoot: path.relative(
			path.dirname(path.resolve(htmlFile)),
			path.resolve(__dirname, '..'),
		),
	});
	fs.writeFileSync(htmlFile, html, 'utf-8');
	console.log(`  \u2713 ${htmlFile}`);
	console.log(`\n  Open ${htmlFile} to preview your presentation.`);
}

async function generatePresentation(opts) {
	const client = loadAnthropicClient();

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

	const markdown = stripCodeFence(message.content[0].text);
	writeOutputAndBuildHtml(markdown, opts.output);
}

async function refinePresentation(opts) {
	const client = loadAnthropicClient();

	console.log(`  \u2192 Refining ${opts.inputFile}...`);

	const message = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 8192,
		system: REFINE_PROMPT,
		messages: [{ role: 'user', content: opts.input }],
	});

	const markdown = stripCodeFence(message.content[0].text);
	writeOutputAndBuildHtml(markdown, opts.output);
}

async function translatePresentation(opts) {
	const client = loadAnthropicClient();

	console.log(`  \u2192 Translating ${opts.inputFile} to "${opts.lang}"...`);

	const userPrompt = `Translate the following presentation to language: ${opts.lang}\n\n${opts.input}`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 8192,
		system: TRANSLATE_PROMPT,
		messages: [{ role: 'user', content: userPrompt }],
	});

	const markdown = stripCodeFence(message.content[0].text);
	writeOutputAndBuildHtml(markdown, opts.output);
}

module.exports = { run };
