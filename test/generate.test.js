const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'cli', 'generate.js');
const TMP = path.join(__dirname, 'tmp');

function generate(inputFile, outputFile) {
	execFileSync('node', [CLI, inputFile, outputFile], { encoding: 'utf-8' });
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

		// Outer section wrapping vertical stack
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
		const output = execFileSync('node', [CLI, '--help'], { encoding: 'utf-8' });
		assert.match(output, /Anna\.js Markdown Generator/);
		assert.match(output, /--watch/);
	});

	it('exits with error for missing file', () => {
		assert.throws(() => {
			execFileSync('node', [CLI, '/nonexistent/file.md'], {
				encoding: 'utf-8',
				stdio: 'pipe'
			});
		});
	});
});
