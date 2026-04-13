/**
 * Anna.js init — scaffold a new presentation project
 */

const fs = require('fs');
const path = require('path');

const ANNA_ROOT = path.resolve(__dirname, '..');

const STARTER_MD = `---
title: Min presentasjon
author:
theme: league
transition: slide
---

# Velkommen

Skriv presentasjonen din her.

Trykk **piltaster** for å navigere.

---

## Slides i Markdown

Separer slides med \`---\`

<!-- .fragments -->
- Enkelt å skrive
- Vakre temaer
- Fungerer overalt

---

## Kode

\`\`\`javascript
Anna.initialize({
    theme: 'league',
    transition: 'slide'
});
\`\`\`

---

## Bilder

![Placeholder](https://via.placeholder.com/600x400)

Bilder skaleres automatisk til sliden.

---

<!-- .slide: data-background="#4d7e65" -->

## Bakgrunnsfarger

Bruk slide-attributter for tilpassede bakgrunner.

---

## Vertikale slides

Trykk ned!

--

### Sub-slide

Bruk \`--\` for vertikale slides.

Perfekt for detaljer og tilleggsinformasjon.

---

## Speaker Notes

Trykk **S** for å åpne speaker notes.

Note:
Her er notatene som bare du ser.
Skriv stikkord, påminnelser og talking points her.

---

# Takk!

Generert med [Anna.js](https://github.com/kwhorne/anna.js)
`;

// Directories to copy from anna.js package
const ASSET_DIRS = ['css', 'js', 'lib', 'plugin'];

function run(args) {
	if (args.includes('--help') || args.includes('-h')) {
		console.log(`
  Anna.js Init — Create a new presentation

  Usage:
    anna init [name]

  Creates a presentation project with all necessary files.
  If [name] is given, creates a subdirectory. Otherwise uses
  the current directory.

  Options:
    --help, -h    Show this help
		`);
		process.exit(0);
	}

	const name = args.filter(a => !a.startsWith('-'))[0];
	const targetDir = name ? path.resolve(process.cwd(), name) : process.cwd();
	const slidesFile = path.join(targetDir, 'slides.md');

	// Create target directory if needed
	if (name) {
		if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
			console.error(`  Error: Directory "${name}" already exists and is not empty.`);
			process.exit(1);
		}
		fs.mkdirSync(targetDir, { recursive: true });
	}

	// Check if anna assets already exist
	const hasAssets = ASSET_DIRS.some(dir => fs.existsSync(path.join(targetDir, dir)));

	if (!hasAssets) {
		console.log('  Copying Anna.js assets...');
		for (const dir of ASSET_DIRS) {
			const src = path.join(ANNA_ROOT, dir);
			const dest = path.join(targetDir, dir);
			fs.cpSync(src, dest, { recursive: true });
		}
		// Copy reset.css
		const resetSrc = path.join(ANNA_ROOT, 'css', 'reset.css');
		const resetDest = path.join(targetDir, 'css', 'reset.css');
		if (!fs.existsSync(resetDest) && fs.existsSync(resetSrc)) {
			fs.cpSync(resetSrc, resetDest);
		}
	}

	// Create starter markdown
	if (fs.existsSync(slidesFile)) {
		console.log(`  slides.md already exists, skipping.`);
	} else {
		fs.writeFileSync(slidesFile, STARTER_MD, 'utf-8');
		console.log(`  \u2713 Created slides.md`);
	}

	// Generate HTML
	const { build } = require('./generate');
	const htmlFile = path.join(targetDir, 'slides.html');
	const annaRoot = '.';
	const html = build(slidesFile, { annaRoot });
	fs.writeFileSync(htmlFile, html, 'utf-8');
	console.log(`  \u2713 Generated slides.html`);

	console.log(`
  Done! Your presentation is ready.

  Edit:     ${name ? name + '/' : ''}slides.md
  Preview:  open ${name ? name + '/' : ''}slides.html
  Rebuild:  anna generate ${name ? name + '/' : ''}slides.md
  Watch:    anna generate ${name ? name + '/' : ''}slides.md --watch
	`);
}

module.exports = { run };
