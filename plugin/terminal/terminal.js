/**
 * Terminal plugin for Anna.js
 *
 * Renders terminal blocks with animated typing effect.
 * Commands (lines starting with $) are typed character by character.
 * Output appears after the command finishes typing.
 * Each command group is a fragment step.
 *
 * Usage in HTML:
 *   <div class="terminal" data-title="Terminal" data-typing-speed="40">
 *     $ npm install anna.js
 *     added 42 packages in 2.3s
 *
 *     $ anna generate slides.md
 *     ✓ slides.md → slides.html
 *   </div>
 *
 * Usage in Markdown (via generator):
 *   ```terminal
 *   $ npm install anna.js
 *   added 42 packages in 2.3s
 *
 *   $ anna generate slides.md
 *   ✓ slides.md → slides.html
 *   ```
 */
(function() {

	'use strict';

	var DEFAULT_SPEED = 40;  // ms per character
	var activeAnimations = [];

	// --- Setup ---

	function init() {
		var terminals = document.querySelectorAll('.terminal');
		for (var i = 0; i < terminals.length; i++) {
			setupTerminal(terminals[i]);
		}
	}

	function setupTerminal(el) {
		var speed = parseInt(el.getAttribute('data-typing-speed')) || DEFAULT_SPEED;
		var title = el.getAttribute('data-title') || 'Terminal';
		var content = el.textContent.trim();
		var groups = parseContent(content);

		if (groups.length === 0) return;

		// Build DOM
		el.textContent = '';
		el.classList.add('terminal-widget');

		// Header with traffic lights
		var header = document.createElement('div');
		header.className = 'terminal-header';
		header.innerHTML =
			'<span class="terminal-dot terminal-dot-red"></span>' +
			'<span class="terminal-dot terminal-dot-yellow"></span>' +
			'<span class="terminal-dot terminal-dot-green"></span>' +
			'<span class="terminal-title">' + escapeHtml(title) + '</span>';
		el.appendChild(header);

		// Body
		var body = document.createElement('div');
		body.className = 'terminal-body';
		el.appendChild(body);

		// Create each command group
		for (var i = 0; i < groups.length; i++) {
			var group = groups[i];
			var groupEl = document.createElement('div');
			groupEl.className = 'terminal-group';
			groupEl.setAttribute('data-command', group.command);
			groupEl.setAttribute('data-speed', speed);

			// Make all groups after the first a fragment
			if (i > 0) {
				groupEl.classList.add('fragment');
			}

			// Prompt line
			var line = document.createElement('div');
			line.className = 'terminal-line';

			var prompt = document.createElement('span');
			prompt.className = 'terminal-prompt';
			prompt.textContent = '$ ';
			line.appendChild(prompt);

			var text = document.createElement('span');
			text.className = 'terminal-text';
			line.appendChild(text);

			var cursor = document.createElement('span');
			cursor.className = 'terminal-cursor hidden';
			line.appendChild(cursor);

			groupEl.appendChild(line);

			// Output block
			if (group.output) {
				var output = document.createElement('pre');
				output.className = 'terminal-output';
				output.innerHTML = colorizeOutput(group.output);
				output.style.display = 'none';
				groupEl.appendChild(output);
			}

			body.appendChild(groupEl);
		}
	}

	// --- Parser ---

	function parseContent(content) {
		var lines = content.split('\n');
		var groups = [];
		var current = null;

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			var trimmed = line.trim();

			if (trimmed.indexOf('$ ') === 0) {
				if (current) groups.push(current);
				current = { command: trimmed.slice(2), outputLines: [] };
			} else if (trimmed.indexOf('> ') === 0) {
				if (current) groups.push(current);
				current = { command: trimmed.slice(2), outputLines: [] };
			} else if (current) {
				current.outputLines.push(line);
			}
		}

		if (current) groups.push(current);

		// Join output and trim trailing blank lines
		for (var j = 0; j < groups.length; j++) {
			var out = groups[j].outputLines.join('\n').replace(/^\n+|\n+$/g, '');
			groups[j].output = out;
		}

		return groups;
	}

	// --- Colorize output ---

	function colorizeOutput(text) {
		return escapeHtml(text)
			.replace(/^(.*✓.*)$/gm, '<span class="success">$1</span>')
			.replace(/^(.*error.*)$/gim, '<span class="error">$1</span>')
			.replace(/^(.*warning.*)$/gim, '<span class="warning">$1</span>')
			.replace(/^(.*→.*)$/gm, '<span class="info">$1</span>');
	}

	// --- Typing animation ---

	function typeCommand(groupEl, callback) {
		var command = groupEl.getAttribute('data-command');
		var speed = parseInt(groupEl.getAttribute('data-speed')) || DEFAULT_SPEED;
		var textEl = groupEl.querySelector('.terminal-text');
		var cursorEl = groupEl.querySelector('.terminal-cursor');
		var outputEl = groupEl.querySelector('.terminal-output');

		// Reset
		textEl.textContent = '';
		cursorEl.classList.remove('hidden');
		if (outputEl) outputEl.style.display = 'none';

		var charIndex = 0;

		var animId = setInterval(function() {
			if (charIndex < command.length) {
				textEl.textContent += command[charIndex];
				charIndex++;
			} else {
				clearInterval(animId);
				removeAnimation(animId);
				cursorEl.classList.add('hidden');
				if (outputEl) outputEl.style.display = '';
				if (callback) callback();
			}
		}, speed);

		activeAnimations.push(animId);
		return animId;
	}

	function cancelAnimations() {
		for (var i = 0; i < activeAnimations.length; i++) {
			clearInterval(activeAnimations[i]);
		}
		activeAnimations = [];
	}

	function removeAnimation(id) {
		var idx = activeAnimations.indexOf(id);
		if (idx > -1) activeAnimations.splice(idx, 1);
	}

	// --- Show command instantly (for backwards navigation) ---

	function showInstant(groupEl) {
		var command = groupEl.getAttribute('data-command');
		var textEl = groupEl.querySelector('.terminal-text');
		var cursorEl = groupEl.querySelector('.terminal-cursor');
		var outputEl = groupEl.querySelector('.terminal-output');

		textEl.textContent = command;
		cursorEl.classList.add('hidden');
		if (outputEl) outputEl.style.display = '';
		groupEl.setAttribute('data-typed', 'true');
	}

	// --- Reset a command group ---

	function resetGroup(groupEl) {
		var textEl = groupEl.querySelector('.terminal-text');
		var cursorEl = groupEl.querySelector('.terminal-cursor');
		var outputEl = groupEl.querySelector('.terminal-output');

		textEl.textContent = '';
		cursorEl.classList.add('hidden');
		if (outputEl) outputEl.style.display = 'none';
		groupEl.removeAttribute('data-typed');
	}

	// --- Anna.js integration ---

	function hookIntoAnna() {
		Anna.addEventListener('ready', function() {
			init();
		});

		// When a slide is shown, type the first command
		Anna.addEventListener('slidechanged', function(event) {
			cancelAnimations();

			var slide = event.currentSlide;
			var firstGroups = slide.querySelectorAll('.terminal-group:first-child');

			for (var i = 0; i < firstGroups.length; i++) {
				var group = firstGroups[i];
				if (!group.getAttribute('data-typed')) {
					group.setAttribute('data-typed', 'true');
					typeCommand(group);
				}
			}
		});

		// When a fragment is shown, type that command
		Anna.addEventListener('fragmentshown', function(event) {
			var group = event.fragment;
			if (group.classList.contains('terminal-group')) {
				// Show all previous groups instantly if not typed yet
				var parent = group.parentNode;
				var siblings = parent.querySelectorAll('.terminal-group');
				for (var i = 0; i < siblings.length; i++) {
					if (siblings[i] === group) break;
					if (!siblings[i].getAttribute('data-typed')) {
						showInstant(siblings[i]);
					}
				}

				group.setAttribute('data-typed', 'true');
				typeCommand(group);
			}
		});

		// When a fragment is hidden (backwards nav), reset it
		Anna.addEventListener('fragmenthidden', function(event) {
			var group = event.fragment;
			if (group.classList.contains('terminal-group')) {
				resetGroup(group);
			}
		});
	}

	// --- Utilities ---

	function escapeHtml(str) {
		var div = document.createElement('div');
		div.textContent = str;
		return div.innerHTML;
	}

	// --- Boot ---

	if (typeof Anna !== 'undefined') {
		hookIntoAnna();
	} else {
		// Wait for Anna to be available
		document.addEventListener('DOMContentLoaded', function() {
			if (typeof Anna !== 'undefined') {
				hookIntoAnna();
			}
		});
	}

})();
