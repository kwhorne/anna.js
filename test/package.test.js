const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const ROOT = path.join(__dirname, '..');
const pkg = require('../package.json');

// Loaded lazily with an install hint when missing
const OPTIONAL_AT_RUNTIME = new Set(['puppeteer']);

describe('package.json', () => {
	it('declares every module the CLI requires as a runtime dependency', () => {
		const declared = new Set([
			...Object.keys(pkg.dependencies || {}),
			...Object.keys(pkg.optionalDependencies || {}),
		]);
		const cliDir = path.join(ROOT, 'cli');
		const missing = [];

		for (const file of fs.readdirSync(cliDir).filter((f) => f.endsWith('.js'))) {
			const source = fs.readFileSync(path.join(cliDir, file), 'utf-8');
			for (const [, name] of source.matchAll(/require\(\s*['"]([^'".][^'"]*)['"]\s*\)/g)) {
				const pkgName = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
				if (pkgName.startsWith('node:') || builtinModules.includes(pkgName)) continue;
				if (OPTIONAL_AT_RUNTIME.has(pkgName) || declared.has(pkgName)) continue;
				missing.push(`${pkgName} (cli/${file})`);
			}
		}

		assert.deepEqual(missing, [], 'Move these to dependencies: ' + missing.join(', '));
	});
});
