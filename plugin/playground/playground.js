/**
 * Playground plugin for Anna.js
 *
 * Renders live code editors with real-time output.
 * Supports JavaScript, HTML, and CSS.
 *
 * Usage in HTML:
 *   <div class="playground" data-lang="javascript">
 *     const x = 42;
 *     console.log("Answer:", x);
 *   </div>
 *
 * Usage in Markdown (via generator):
 *   ```playground
 *   const x = 42;
 *   console.log("Answer:", x);
 *   ```
 *
 *   ```playground html
 *   <h1 style="color: coral">Hello!</h1>
 *   <p>Edit me and click Run.</p>
 *   ```
 */
(function() {

	'use strict';

	// --- Setup ---

	function init() {
		var playgrounds = document.querySelectorAll('.playground');
		for (var i = 0; i < playgrounds.length; i++) {
			setupPlayground(playgrounds[i], i);
		}
	}

	function setupPlayground(el, index) {
		var lang = (el.getAttribute('data-lang') || 'javascript').toLowerCase();
		var code = el.textContent.trim();
		var autorun = el.getAttribute('data-autorun') !== 'false';

		el.textContent = '';
		el.classList.add('playground-widget');
		el.setAttribute('data-lang', lang);

		// Header
		var header = document.createElement('div');
		header.className = 'playground-header';
		header.innerHTML =
			'<span class="playground-dot playground-dot-red"></span>' +
			'<span class="playground-dot playground-dot-yellow"></span>' +
			'<span class="playground-dot playground-dot-green"></span>';

		// Language tab
		var tabs = document.createElement('div');
		tabs.className = 'playground-tabs';
		var tab = document.createElement('button');
		tab.className = 'playground-tab active';
		tab.textContent = lang === 'html' ? 'HTML' : lang === 'css' ? 'CSS' : 'JavaScript';
		tabs.appendChild(tab);
		header.appendChild(tabs);

		// Run button
		var runBtn = document.createElement('button');
		runBtn.className = 'playground-run';
		runBtn.textContent = '\u25B6 Run';
		header.appendChild(runBtn);

		el.appendChild(header);

		// Editor
		var editorWrap = document.createElement('div');
		editorWrap.className = 'playground-editor';

		var textarea = document.createElement('textarea');
		textarea.value = code;
		textarea.spellcheck = false;
		textarea.setAttribute('autocorrect', 'off');
		textarea.setAttribute('autocapitalize', 'off');
		editorWrap.appendChild(textarea);

		el.appendChild(editorWrap);

		// Output area
		var outputWrap = document.createElement('div');
		outputWrap.className = 'playground-output';

		var outputLabel = document.createElement('span');
		outputLabel.className = 'playground-output-label';
		outputLabel.textContent = 'Output';
		outputWrap.appendChild(outputLabel);

		var outputEl;
		if (lang === 'html' || lang === 'css') {
			outputEl = document.createElement('iframe');
			outputEl.className = 'playground-iframe';
			outputEl.setAttribute('sandbox', 'allow-scripts');
		} else {
			outputEl = document.createElement('pre');
			outputEl.className = 'playground-console';
		}
		outputWrap.appendChild(outputEl);

		el.appendChild(outputWrap);

		// Status bar
		var status = document.createElement('div');
		status.className = 'playground-status';
		status.innerHTML = '<span>Ctrl+Enter to run</span><span class="playground-time"></span>';
		el.appendChild(status);

		var timeEl = status.querySelector('.playground-time');

		// --- Run logic ---

		function run() {
			var src = textarea.value;
			var start = performance.now();

			if (lang === 'html') {
				runHTML(outputEl, src);
			} else if (lang === 'css') {
				runCSS(outputEl, src);
			} else {
				runJS(outputEl, src);
			}

			var elapsed = (performance.now() - start).toFixed(1);
			timeEl.textContent = elapsed + ' ms';
		}

		// Bind run button
		runBtn.addEventListener('click', function(e) {
			e.stopPropagation();
			run();
		});

		// Ctrl+Enter / Cmd+Enter to run
		textarea.addEventListener('keydown', function(e) {
			// Run
			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
				e.preventDefault();
				e.stopPropagation();
				run();
			}

			// Tab to indent
			if (e.key === 'Tab') {
				e.preventDefault();
				var start = this.selectionStart;
				var end = this.selectionEnd;
				this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
				this.selectionStart = this.selectionEnd = start + 2;
			}

			// Stop keyboard events from reaching Anna.js
			e.stopPropagation();
		});

		// Prevent Anna.js navigation when clicking in editor
		textarea.addEventListener('click', function(e) { e.stopPropagation(); });
		textarea.addEventListener('focus', function(e) { e.stopPropagation(); });

		// Auto-run on load
		if (autorun) {
			setTimeout(run, 100);
		}
	}

	// --- Runners ---

	function runJS(consoleEl, code) {
		consoleEl.innerHTML = '';

		// Build a sandbox with captured console
		var logs = [];
		var sandboxCode =
			'var __logs = [];\n' +
			'var console = {\n' +
			'  log: function() { __logs.push({ type: "log", args: Array.prototype.slice.call(arguments) }); },\n' +
			'  error: function() { __logs.push({ type: "error", args: Array.prototype.slice.call(arguments) }); },\n' +
			'  warn: function() { __logs.push({ type: "warn", args: Array.prototype.slice.call(arguments) }); },\n' +
			'  info: function() { __logs.push({ type: "info", args: Array.prototype.slice.call(arguments) }); }\n' +
			'};\n' +
			'try {\n' + code + '\n} catch(e) { __logs.push({ type: "error", args: [e.toString()] }); }\n' +
			'__logs;';

		try {
			logs = new Function(sandboxCode)();
		} catch(e) {
			logs = [{ type: 'error', args: [e.toString()] }];
		}

		for (var i = 0; i < logs.length; i++) {
			var entry = logs[i];
			var line = document.createElement('div');
			line.className = entry.type;
			line.textContent = entry.args.map(function(a) {
				if (typeof a === 'object') {
					try { return JSON.stringify(a, null, 2); } catch(e) { return String(a); }
				}
				return String(a);
			}).join(' ');
			consoleEl.appendChild(line);
		}

		if (logs.length === 0) {
			var empty = document.createElement('div');
			empty.className = 'info';
			empty.textContent = '(no output)';
			consoleEl.appendChild(empty);
		}
	}

	function runHTML(iframe, code) {
		var doc = iframe.contentDocument || iframe.contentWindow.document;
		doc.open();
		doc.write('<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:16px;}</style></head><body>' + code + '</body></html>');
		doc.close();
	}

	function runCSS(iframe, code) {
		var html =
			'<!doctype html><html><head><meta charset="utf-8"><style>' + code + '</style></head>' +
			'<body>' +
			'<h1>Heading</h1>' +
			'<p>Paragraph with <a href="#">a link</a> and <strong>bold text</strong>.</p>' +
			'<ul><li>Item one</li><li>Item two</li><li>Item three</li></ul>' +
			'<button>Button</button>' +
			'</body></html>';
		var doc = iframe.contentDocument || iframe.contentWindow.document;
		doc.open();
		doc.write(html);
		doc.close();
	}

	// --- Anna.js integration ---

	if (typeof Anna !== 'undefined') {
		Anna.addEventListener('ready', function() {
			init();
		});
	} else {
		document.addEventListener('DOMContentLoaded', function() {
			if (typeof Anna !== 'undefined') {
				Anna.addEventListener('ready', init);
			} else {
				init();
			}
		});
	}

})();
