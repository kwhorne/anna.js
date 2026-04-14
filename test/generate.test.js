const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'cli', 'anna.js');
const TMP = path.join(__dirname, 'tmp');

function generate(inputFile, outputFile) {
	execFileSync('node', [CLI, 'generate', inputFile, outputFile], { encoding: 'utf-8' });
	return fs.readFileSync(outputFile, 'utf-8');
}

function writeMd(name, content) {
	const file = path.join(TMP, name);
	fs.writeFileSync(file, content, 'utf-8');
	return file;
}

describe('anna generate', () => {
	before(() => {
		fs.mkdirSync(TMP, { recursive: true });
	});

	after(() => {
		fs.rmSync(TMP, { recursive: true, force: true });
	});

	it('generates valid HTML with default config', () => {
		const input = writeMd('basic.md', '---\ntitle: Test\n---\n\n# Hello\n');
		const html = generate(input, path.join(TMP, 'basic.html'));

		assert.match(html, /<!doctype html>/);
		assert.match(html, /<title>Test<\/title>/);
		assert.match(html, /<h1>Hello<\/h1>/);
		assert.match(html, /css\/theme\/league\.css/);
		assert.match(html, /Anna\.initialize/);
	});

	it('applies frontmatter theme and transition', () => {
		const input = writeMd('theme.md', '---\ntheme: moon\ntransition: fade\n---\n\n# Slide\n');
		const html = generate(input, path.join(TMP, 'theme.html'));

		assert.match(html, /css\/theme\/moon\.css/);
		assert.match(html, /transition: "fade"/);
	});

	it('splits horizontal slides on ---', () => {
		const md = '---\ntitle: Split\n---\n\n# One\n\n---\n\n# Two\n\n---\n\n# Three\n';
		const input = writeMd('split.md', md);
		const html = generate(input, path.join(TMP, 'split.html'));

		const sections = html.match(/<section>/g);
		assert.equal(sections.length, 3);
	});

	it('creates vertical slides on --', () => {
		const md = '---\ntitle: Vertical\n---\n\n# Main\n\n--\n\n## Sub 1\n\n--\n\n## Sub 2\n';
		const input = writeMd('vertical.md', md);
		const html = generate(input, path.join(TMP, 'vertical.html'));

		assert.match(html, /<section>\n\t+<section>/);
		assert.match(html, /<h2>Sub 1<\/h2>/);
		assert.match(html, /<h2>Sub 2<\/h2>/);
	});

	it('does not split code blocks containing ---', () => {
		const md = '---\ntitle: Code\n---\n\n# Code\n\n```yaml\n---\nkey: value\n---\n```\n';
		const input = writeMd('codeblock.md', md);
		const html = generate(input, path.join(TMP, 'codeblock.html'));

		const sections = html.match(/<section>/g);
		assert.equal(sections.length, 1);
		assert.match(html, /key: value/);
	});

	it('creates fragment list items with <!-- .fragments -->', () => {
		const md = '---\ntitle: Frag\n---\n\n<!-- .fragments -->\n- One\n- Two\n- Three\n';
		const input = writeMd('fragments.md', md);
		const html = generate(input, path.join(TMP, 'fragments.html'));

		assert.match(html, /<li class="fragment">One<\/li>/);
		assert.match(html, /<li class="fragment">Two<\/li>/);
		assert.match(html, /<li class="fragment">Three<\/li>/);
	});

	it('extracts speaker notes from Note: blocks', () => {
		const md = '---\ntitle: Notes\n---\n\n# Slide\n\nNote:\nThese are my notes\n';
		const input = writeMd('notes.md', md);
		const html = generate(input, path.join(TMP, 'notes.html'));

		assert.match(html, /<aside class="notes">/);
		assert.match(html, /These are my notes/);
	});

	it('applies slide attributes from <!-- .slide: -->', () => {
		const md = '---\ntitle: BG\n---\n\n<!-- .slide: data-background="#ff0000" -->\n\n# Red\n';
		const input = writeMd('slideattr.md', md);
		const html = generate(input, path.join(TMP, 'slideattr.html'));

		assert.match(html, /data-background="#ff0000"/);
	});

	it('converts ```terminal blocks to terminal widgets', () => {
		const md = '---\ntitle: Term\n---\n\n```terminal\n$ echo hello\nhello world\n\n$ ls\nfile.txt\n```\n';
		const input = writeMd('terminal.md', md);
		const html = generate(input, path.join(TMP, 'terminal.html'));

		assert.match(html, /class="terminal"/);
		assert.match(html, /\$ echo hello/);
		assert.match(html, /hello world/);
		assert.match(html, /plugin\/terminal\/terminal\.css/);
		assert.match(html, /plugin\/terminal\/terminal\.js/);
	});

	it('converts ```mermaid blocks to mermaid diagrams', () => {
		const md = '---\ntitle: Merm\n---\n\n```mermaid\ngraph LR\n    A --> B\n```\n';
		const input = writeMd('mermaid.md', md);
		const html = generate(input, path.join(TMP, 'mermaid.html'));

		assert.match(html, /<pre class="mermaid">/);
		assert.match(html, /A --> B/);
		assert.match(html, /mermaid\.esm\.min\.mjs/);
		assert.match(html, /plugin\/mermaid\/mermaid\.css/);
	});

	it('uses dark mermaid theme for dark anna themes', () => {
		const md = '---\ntheme: black\n---\n\n```mermaid\ngraph LR\n    A --> B\n```\n';
		const input = writeMd('merm-dark.md', md);
		const html = generate(input, path.join(TMP, 'merm-dark.html'));

		assert.match(html, /theme: 'dark'/);
	});

	it('uses default mermaid theme for light anna themes', () => {
		const md = '---\ntheme: white\n---\n\n```mermaid\ngraph LR\n    A --> B\n```\n';
		const input = writeMd('merm-light.md', md);
		const html = generate(input, path.join(TMP, 'merm-light.html'));

		assert.match(html, /theme: 'default'/);
	});

	it('omits mermaid when no mermaid blocks exist', () => {
		const md = '---\ntitle: NoMerm\n---\n\n# Just text\n';
		const input = writeMd('nomerm.md', md);
		const html = generate(input, path.join(TMP, 'nomerm.html'));

		assert.doesNotMatch(html, /mermaid/);
	});

	it('omits terminal plugin when no terminal blocks exist', () => {
		const md = '---\ntitle: NoTerm\n---\n\n# Just text\n';
		const input = writeMd('noterm.md', md);
		const html = generate(input, path.join(TMP, 'noterm.html'));

		assert.doesNotMatch(html, /terminal\.css/);
		assert.doesNotMatch(html, /terminal\.js/);
	});

	it('supports background images via slide attributes', () => {
		const md = '---\ntitle: BG\n---\n\n<!-- .slide: data-background-image="photo.jpg" -->\n\n# Photo\n';
		const input = writeMd('bgimg.md', md);
		const html = generate(input, path.join(TMP, 'bgimg.html'));

		assert.match(html, /data-background-image="photo.jpg"/);
	});

	it('renders markdown images', () => {
		const md = '---\ntitle: Img\n---\n\n![Alt text](image.png)\n';
		const input = writeMd('image.md', md);
		const html = generate(input, path.join(TMP, 'image.html'));

		assert.match(html, /<img src="image.png" alt="Alt text">/);
	});

	it('sets author meta tag when provided', () => {
		const md = '---\ntitle: Auth\nauthor: Knut\n---\n\n# Hi\n';
		const input = writeMd('author.md', md);
		const html = generate(input, path.join(TMP, 'author.html'));

		assert.match(html, /<meta name="author" content="Knut">/);
	});

	it('omits author meta tag when not provided', () => {
		const md = '---\ntitle: NoAuth\n---\n\n# Hi\n';
		const input = writeMd('noauthor.md', md);
		const html = generate(input, path.join(TMP, 'noauthor.html'));

		assert.doesNotMatch(html, /meta name="author"/);
	});

	it('shows help with --help flag', () => {
		const output = execFileSync('node', [CLI, 'generate', '--help'], { encoding: 'utf-8' });
		assert.match(output, /Anna\.js Markdown Generator/);
		assert.match(output, /--watch/);
	});

	it('exits with error for missing file', () => {
		assert.throws(() => {
			execFileSync('node', [CLI, 'generate', '/nonexistent/file.md'], {
				encoding: 'utf-8',
				stdio: 'pipe'
			});
		});
	});
});

describe('anna cli', () => {
	it('shows help with --help', () => {
		const output = execFileSync('node', [CLI, '--help'], { encoding: 'utf-8' });
		assert.match(output, /Anna\.js/);
		assert.match(output, /init/);
		assert.match(output, /generate/);
		assert.match(output, /export/);
	});

	it('shows version with --version', () => {
		const output = execFileSync('node', [CLI, '--version'], { encoding: 'utf-8' });
		assert.match(output, /\d+\.\d+\.\d+/);
	});

	it('treats .md file as generate shorthand', () => {
		const tmpDir = path.join(__dirname, 'tmp-shorthand');
		fs.mkdirSync(tmpDir, { recursive: true });
		const input = path.join(tmpDir, 'test.md');
		fs.writeFileSync(input, '---\ntitle: Short\n---\n\n# Test\n');

		execFileSync('node', [CLI, input], { encoding: 'utf-8' });
		const html = fs.readFileSync(path.join(tmpDir, 'test.html'), 'utf-8');

		assert.match(html, /<title>Short<\/title>/);
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});
});

describe('anna ai', () => {
	it('shows help with --help', () => {
		const output = execFileSync('node', [CLI, 'ai', '--help'], { encoding: 'utf-8' });
		assert.match(output, /Anna\.js AI/);
		assert.match(output, /ANTHROPIC_API_KEY/);
		assert.match(output, /--theme/);
	});

	it('shows help when no input given', () => {
		const output = execFileSync('node', [CLI, 'ai'], { encoding: 'utf-8' });
		assert.match(output, /Anna\.js AI/);
	});

	it('errors without API key', () => {
		assert.throws(() => {
			execFileSync('node', [CLI, 'ai', 'Test topic'], {
				encoding: 'utf-8',
				stdio: 'pipe',
				env: { ...process.env, ANTHROPIC_API_KEY: '' }
			});
		});
	});
});

describe('anna init', () => {
	const INIT_DIR = path.join(__dirname, 'tmp-init');

	after(() => {
		fs.rmSync(INIT_DIR, { recursive: true, force: true });
	});

	it('scaffolds a new project directory', () => {
		execFileSync('node', [CLI, 'init', INIT_DIR], { encoding: 'utf-8' });

		assert.ok(fs.existsSync(path.join(INIT_DIR, 'slides.md')));
		assert.ok(fs.existsSync(path.join(INIT_DIR, 'slides.html')));
		assert.ok(fs.existsSync(path.join(INIT_DIR, 'css', 'anna.css')));
		assert.ok(fs.existsSync(path.join(INIT_DIR, 'js', 'anna.js')));
		assert.ok(fs.existsSync(path.join(INIT_DIR, 'plugin', 'highlight', 'highlight.js')));

		const html = fs.readFileSync(path.join(INIT_DIR, 'slides.html'), 'utf-8');
		assert.match(html, /Anna\.initialize/);
	});
});
