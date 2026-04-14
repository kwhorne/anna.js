/**
 * Anna.js Embed — Lightweight web components for embedding slides
 *
 * Usage:
 *   <script src="anna-embed.js"></script>
 *
 *   <!-- Single slide -->
 *   <anna-slide theme="moon">
 *     ## Hello World
 *     - Point one
 *     - Point two
 *   </anna-slide>
 *
 *   <!-- Multi-slide deck -->
 *   <anna-deck theme="moon">
 *     <anna-slide>
 *       # First Slide
 *     </anna-slide>
 *     <anna-slide>
 *       # Second Slide
 *       - Item 1
 *       - Item 2
 *     </anna-slide>
 *   </anna-deck>
 */
(function() {
	'use strict';

	// --- Minimal Markdown Parser ---

	function md(text) {
		var lines = text.split('\n');
		var html = '';
		var inList = false;
		var inCode = false;
		var codeLang = '';
		var codeLines = [];

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];

			// Fenced code blocks
			if (line.trim().indexOf('```') === 0) {
				if (!inCode) {
					inCode = true;
					codeLang = line.trim().slice(3);
					codeLines = [];
				} else {
					html += '<pre><code' + (codeLang ? ' class="language-' + codeLang + '"' : '') + '>' +
						esc(codeLines.join('\n')) + '</code></pre>';
					inCode = false;
					codeLang = '';
				}
				continue;
			}
			if (inCode) { codeLines.push(line); continue; }

			var trimmed = line.trim();

			// Empty line
			if (trimmed === '') {
				if (inList) { html += '</ul>'; inList = false; }
				continue;
			}

			// Headers
			var hMatch = trimmed.match(/^(#{1,4})\s+(.+)/);
			if (hMatch) {
				if (inList) { html += '</ul>'; inList = false; }
				var level = hMatch[1].length;
				html += '<h' + level + '>' + inline(hMatch[2]) + '</h' + level + '>';
				continue;
			}

			// Unordered list
			if (trimmed.indexOf('- ') === 0 || trimmed.indexOf('* ') === 0) {
				if (!inList) { html += '<ul>'; inList = true; }
				var cls = trimmed.indexOf('{.fragment}') > -1 ? ' class="fragment"' : '';
				var content = trimmed.slice(2).replace(/\{\.fragment\}/g, '').trim();
				html += '<li' + cls + '>' + inline(content) + '</li>';
				continue;
			}

			// Ordered list
			var olMatch = trimmed.match(/^\d+\.\s+(.+)/);
			if (olMatch) {
				if (!inList) { html += '<ol>'; inList = true; }
				html += '<li>' + inline(olMatch[1]) + '</li>';
				continue;
			}

			// Paragraph
			if (inList) { html += '</ul>'; inList = false; }
			html += '<p>' + inline(trimmed) + '</p>';
		}

		if (inList) html += '</ul>';
		if (inCode) html += '<pre><code>' + esc(codeLines.join('\n')) + '</code></pre>';

		return html;
	}

	function inline(text) {
		return text
			// Images
			.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
			// Links
			.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
			// Bold
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			// Italic
			.replace(/\*(.+?)\*/g, '<em>$1</em>')
			// Inline code
			.replace(/`([^`]+)`/g, '<code>$1</code>');
	}

	function esc(s) {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	// --- Theme Colors ---

	var THEMES = {
		league:    { bg: '#2b2b2b', fg: '#eee',    heading: '#eee',    accent: '#13DAEC', font: "'League Gothic', Impact, sans-serif" },
		black:     { bg: '#191919', fg: '#fff',     heading: '#fff',    accent: '#42affa', font: "'Source Sans Pro', Helvetica, sans-serif" },
		white:     { bg: '#fff',    fg: '#222',     heading: '#222',    accent: '#2a76dd', font: "'Source Sans Pro', Helvetica, sans-serif" },
		moon:      { bg: '#002b36', fg: '#93a1a1',  heading: '#eee8d5', accent: '#268bd2', font: "'Lato', sans-serif" },
		night:     { bg: '#111',    fg: '#eee',     heading: '#eee',    accent: '#e7ad52', font: "'Open Sans', sans-serif" },
		solarized: { bg: '#fdf6e3', fg: '#657b83',  heading: '#586e75', accent: '#268bd2', font: "'Lato', sans-serif" },
		blood:     { bg: '#222',    fg: '#eee',     heading: '#eee',    accent: '#a23',    font: "'Ubuntu', sans-serif" },
		sky:       { bg: '#f7fbfc', fg: '#333',     heading: '#333',    accent: '#3b759e', font: "'Open Sans', sans-serif" },
		beige:     { bg: '#f7f3de', fg: '#333',     heading: '#333',    accent: '#8b743d', font: "'Lato', sans-serif" },
		serif:     { bg: '#F0F1EB', fg: '#000',     heading: '#383D3D', accent: '#51483D', font: "'Palatino Linotype', Palatino, serif" },
		simple:    { bg: '#fff',    fg: '#000',     heading: '#000',    accent: '#00008B', font: "'Lato', sans-serif" },
	};

	function getTheme(name) {
		return THEMES[name] || THEMES.league;
	}

	// --- Styles ---

	function buildStyles(theme, isInDeck) {
		var t = getTheme(theme);
		return '\
			:host { display: block; }\
			.slide {\
				background: ' + t.bg + ';\
				color: ' + t.fg + ';\
				font-family: ' + t.font + ';\
				padding: 40px;\
				border-radius: 8px;\
				overflow: hidden;\
				text-align: center;\
				display: flex;\
				flex-direction: column;\
				align-items: center;\
				justify-content: center;\
				min-height: ' + (isInDeck ? '100%' : '300px') + ';\
				line-height: 1.5;\
				position: relative;\
			}\
			h1, h2, h3, h4 { color: ' + t.heading + '; margin: 0 0 16px; font-weight: 700; }\
			h1 { font-size: 2em; }\
			h2 { font-size: 1.5em; }\
			h3 { font-size: 1.2em; }\
			p { margin: 8px 0; }\
			ul, ol { text-align: left; display: inline-block; margin: 12px 0; padding-left: 24px; }\
			li { margin: 6px 0; }\
			a { color: ' + t.accent + '; text-decoration: none; }\
			a:hover { text-decoration: underline; }\
			code { background: rgba(128,128,128,0.15); padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }\
			pre { text-align: left; width: 90%; margin: 12px auto; }\
			pre code {\
				display: block; padding: 16px; border-radius: 6px;\
				background: rgba(0,0,0,0.2); overflow-x: auto;\
				font-size: 0.8em; line-height: 1.5;\
			}\
			img { max-width: 80%; max-height: 60%; border-radius: 4px; }\
			strong { font-weight: 700; }\
			em { font-style: italic; }\
			.fragment { visibility: hidden; }\
			.fragment.visible { visibility: visible; }\
		';
	}

	function deckStyles(theme) {
		var t = getTheme(theme);
		return '\
			:host {\
				display: block;\
				position: relative;\
				background: ' + t.bg + ';\
				border-radius: 8px;\
				overflow: hidden;\
			}\
			.deck-container {\
				position: relative;\
				min-height: 300px;\
			}\
			::slotted(anna-slide) {\
				display: none !important;\
			}\
			::slotted(anna-slide.active) {\
				display: block !important;\
			}\
			.deck-nav {\
				display: flex;\
				align-items: center;\
				justify-content: space-between;\
				padding: 8px 12px;\
				background: rgba(0,0,0,0.15);\
			}\
			.deck-nav button {\
				background: none; border: none;\
				color: ' + t.fg + ';\
				opacity: 0.5; cursor: pointer;\
				font-size: 18px; padding: 4px 12px;\
				border-radius: 4px;\
			}\
			.deck-nav button:hover { opacity: 1; background: rgba(128,128,128,0.15); }\
			.deck-nav button:disabled { opacity: 0.15; cursor: default; }\
			.deck-dots {\
				display: flex; gap: 6px;\
			}\
			.deck-dot {\
				width: 8px; height: 8px;\
				border-radius: 50%;\
				background: ' + t.fg + ';\
				opacity: 0.25; cursor: pointer;\
				border: none; padding: 0;\
			}\
			.deck-dot.active { opacity: 0.8; }\
			.deck-counter {\
				font-size: 12px;\
				color: ' + t.fg + ';\
				opacity: 0.4;\
				font-family: system-ui, sans-serif;\
			}\
		';
	}

	// --- <anna-slide> ---

	class AnnaSlide extends HTMLElement {
		constructor() {
			super();
			this._fragments = [];
			this._fragmentIndex = -1;
		}

		connectedCallback() {
			// Don't render if inside a deck (the deck manages rendering)
			if (this.parentElement && this.parentElement.tagName === 'ANNA-DECK') {
				this._inDeck = true;
				this._setupInDeck();
				return;
			}
			this._render();
		}

		_setupInDeck() {
			var raw = this._getRawContent();
			var shadow = this.attachShadow({ mode: 'open' });
			var theme = this.getAttribute('theme') ||
				(this.parentElement && this.parentElement.getAttribute('theme')) || 'league';

			var style = document.createElement('style');
			style.textContent = buildStyles(theme, true);
			shadow.appendChild(style);

			var div = document.createElement('div');
			div.className = 'slide';
			div.innerHTML = md(raw);
			shadow.appendChild(div);

			this._initFragments(div);
		}

		_render() {
			var raw = this._getRawContent();
			var theme = this.getAttribute('theme') || 'league';

			var shadow = this.attachShadow({ mode: 'open' });

			var style = document.createElement('style');
			style.textContent = buildStyles(theme, false);
			shadow.appendChild(style);

			var div = document.createElement('div');
			div.className = 'slide';
			div.innerHTML = md(raw);
			shadow.appendChild(div);

			this._initFragments(div);

			// Click to advance fragments
			div.addEventListener('click', function() {
				this._advanceFragment();
			}.bind(this));
		}

		_getRawContent() {
			// Use a template if present, otherwise textContent
			var tpl = this.querySelector('template');
			if (tpl) return tpl.innerHTML;
			return this.textContent;
		}

		_initFragments(root) {
			this._fragments = Array.from(root.querySelectorAll('.fragment'));
			this._fragmentIndex = -1;
		}

		_advanceFragment() {
			if (this._fragmentIndex < this._fragments.length - 1) {
				this._fragmentIndex++;
				this._fragments[this._fragmentIndex].classList.add('visible');
				return true;
			}
			return false;
		}

		_retreatFragment() {
			if (this._fragmentIndex >= 0) {
				this._fragments[this._fragmentIndex].classList.remove('visible');
				this._fragmentIndex--;
				return true;
			}
			return false;
		}

		_resetFragments() {
			this._fragments.forEach(function(f) { f.classList.remove('visible'); });
			this._fragmentIndex = -1;
		}

		_showAllFragments() {
			this._fragments.forEach(function(f) { f.classList.add('visible'); });
			this._fragmentIndex = this._fragments.length - 1;
		}
	}

	// --- <anna-deck> ---

	class AnnaDeck extends HTMLElement {
		constructor() {
			super();
			this._currentIndex = 0;
			this._slides = [];
		}

		connectedCallback() {
			var theme = this.getAttribute('theme') || 'league';
			var shadow = this.attachShadow({ mode: 'open' });

			var style = document.createElement('style');
			style.textContent = deckStyles(theme);
			shadow.appendChild(style);

			// Container for slides
			var container = document.createElement('div');
			container.className = 'deck-container';
			var slot = document.createElement('slot');
			container.appendChild(slot);
			shadow.appendChild(container);

			// Navigation bar
			var nav = document.createElement('div');
			nav.className = 'deck-nav';

			this._prevBtn = document.createElement('button');
			this._prevBtn.textContent = '\u2190';
			this._prevBtn.title = 'Previous';
			nav.appendChild(this._prevBtn);

			this._dotsContainer = document.createElement('div');
			this._dotsContainer.className = 'deck-dots';
			nav.appendChild(this._dotsContainer);

			this._counter = document.createElement('span');
			this._counter.className = 'deck-counter';
			nav.appendChild(this._counter);

			this._nextBtn = document.createElement('button');
			this._nextBtn.textContent = '\u2192';
			this._nextBtn.title = 'Next';
			nav.appendChild(this._nextBtn);

			shadow.appendChild(nav);

			// Bind navigation
			this._prevBtn.addEventListener('click', this._prev.bind(this));
			this._nextBtn.addEventListener('click', this._next.bind(this));

			// Keyboard navigation
			this.setAttribute('tabindex', '0');
			this.addEventListener('keydown', function(e) {
				if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); this._next(); }
				if (e.key === 'ArrowLeft') { e.preventDefault(); this._prev(); }
			}.bind(this));

			// Wait for child slides to be defined
			requestAnimationFrame(this._init.bind(this));
		}

		_init() {
			this._slides = Array.from(this.querySelectorAll('anna-slide'));

			// Build dots
			this._dotsContainer.innerHTML = '';
			for (var i = 0; i < this._slides.length; i++) {
				var dot = document.createElement('button');
				dot.className = 'deck-dot';
				dot.setAttribute('data-index', i);
				dot.addEventListener('click', function(e) {
					this._goTo(parseInt(e.target.getAttribute('data-index')));
				}.bind(this));
				this._dotsContainer.appendChild(dot);
			}

			this._goTo(0);
		}

		_goTo(index) {
			if (index < 0 || index >= this._slides.length) return;

			this._slides.forEach(function(s, i) {
				s.classList.toggle('active', i === index);
				if (i === index) s._resetFragments && s._resetFragments();
			});

			// If going backwards, show all fragments on previous slides
			if (index < this._currentIndex && this._slides[index]._showAllFragments) {
				this._slides[index]._showAllFragments();
			}

			this._currentIndex = index;
			this._updateNav();
		}

		_next() {
			var current = this._slides[this._currentIndex];
			// Try advancing fragments first
			if (current._advanceFragment && current._advanceFragment()) {
				return;
			}
			// Otherwise go to next slide
			if (this._currentIndex < this._slides.length - 1) {
				this._goTo(this._currentIndex + 1);
			}
		}

		_prev() {
			var current = this._slides[this._currentIndex];
			// Try retreating fragments first
			if (current._retreatFragment && current._retreatFragment()) {
				return;
			}
			// Otherwise go to previous slide
			if (this._currentIndex > 0) {
				this._goTo(this._currentIndex - 1);
			}
		}

		_updateNav() {
			this._prevBtn.disabled = this._currentIndex === 0;
			this._nextBtn.disabled = this._currentIndex === this._slides.length - 1;
			this._counter.textContent = (this._currentIndex + 1) + ' / ' + this._slides.length;

			var dots = this._dotsContainer.querySelectorAll('.deck-dot');
			dots.forEach(function(d, i) {
				d.classList.toggle('active', i === this._currentIndex);
			}.bind(this));
		}
	}

	// --- Register ---

	customElements.define('anna-slide', AnnaSlide);
	customElements.define('anna-deck', AnnaDeck);

})();
