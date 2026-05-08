/**
 * Live plugin for Anna.js
 *
 * Real-time audience interaction for presentations.
 * Supports polls, Q&A, and emoji reactions via Socket.IO.
 *
 * Usage in HTML:
 *   <!-- Poll -->
 *   <div class="live-poll" data-poll-id="poll-1" data-question="What framework do you prefer?">
 *     <div class="live-poll-option" data-option="React">React</div>
 *     <div class="live-poll-option" data-option="Vue">Vue</div>
 *     <div class="live-poll-option" data-option="Angular">Angular</div>
 *   </div>
 *
 *   <!-- Q&A -->
 *   <div class="live-qa" data-qa-id="qa-1"></div>
 *
 * Configuration (in Anna.js config):
 *   Anna.initialize({
 *     live: {
 *       url: 'https://your-socket-server.example.com'
 *     }
 *   });
 */
(function() {

	'use strict';

	var socket = null;
	var sessionId = null;
	var ACCENT_COLORS = ['#7aa2f7', '#9ece6a', '#bb9af7', '#ff9e64', '#f7768e'];
	var REACTION_EMOJIS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83C\uDF89', '\uD83E\uDD14'];
	var SOCKETIO_CDN = 'https://cdn.socket.io/4.7.5/socket.io.min.js';

	// --- Session ID ---

	function getSessionId() {
		if (sessionId) return sessionId;

		var key = 'anna-live-session-id';
		sessionId = sessionStorage.getItem(key);
		if (!sessionId) {
			sessionId = 'sess-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
			sessionStorage.setItem(key, sessionId);
		}
		return sessionId;
	}

	// --- Socket.IO lazy loader ---

	function loadSocketIO(callback) {
		if (typeof io !== 'undefined') {
			callback(null);
			return;
		}

		var script = document.createElement('script');
		script.src = SOCKETIO_CDN;
		script.async = true;

		script.onload = function() {
			callback(null);
		};

		script.onerror = function() {
			console.warn('[Anna Live] Failed to load Socket.IO from CDN. Live features will be disabled.');
			callback(new Error('Socket.IO failed to load'));
		};

		document.head.appendChild(script);
	}

	// --- Socket connection ---

	function connectSocket(url) {
		try {
			socket = io(url, {
				reconnection: true,
				reconnectionAttempts: 5,
				reconnectionDelay: 2000,
				timeout: 10000
			});

			socket.on('connect', function() {
				console.log('[Anna Live] Connected to server');
			});

			socket.on('connect_error', function(err) {
				console.warn('[Anna Live] Connection error:', err.message);
			});

			socket.on('disconnect', function(reason) {
				console.log('[Anna Live] Disconnected:', reason);
			});

			// Bind incoming events
			socket.on('poll-results', handlePollResults);
			socket.on('qa-questions', handleQAQuestions);
			socket.on('reaction-burst', handleReactionBurst);
		} catch (e) {
			console.warn('[Anna Live] Could not connect to server:', e.message);
			socket = null;
		}
	}

	// --- Initialization ---

	function init() {
		var config = Anna.getConfig().live;
		if (!config || !config.url) return;

		getSessionId();

		loadSocketIO(function(err) {
			if (err) return;

			connectSocket(config.url);
			setupPolls();
			setupQA();
			injectReactionBar();
		});
	}

	// =========================================================
	//  POLLS
	// =========================================================

	function setupPolls() {
		var polls = document.querySelectorAll('.live-poll');
		for (var i = 0; i < polls.length; i++) {
			buildPoll(polls[i]);
		}
	}

	function buildPoll(el) {
		var pollId = el.getAttribute('data-poll-id');
		var question = el.getAttribute('data-question') || 'Poll';
		var optionEls = el.querySelectorAll('.live-poll-option');
		var options = [];

		for (var i = 0; i < optionEls.length; i++) {
			options.push(optionEls[i].getAttribute('data-option') || optionEls[i].textContent.trim());
		}

		if (options.length === 0) return;

		// Clear original content
		el.innerHTML = '';
		el.setAttribute('data-poll-id', pollId);

		// Question heading
		var heading = document.createElement('div');
		heading.className = 'live-poll-question';
		heading.textContent = question;
		el.appendChild(heading);

		// Options container
		var optionsContainer = document.createElement('div');
		optionsContainer.className = 'live-poll-options';

		for (var j = 0; j < options.length; j++) {
			var optionWrapper = document.createElement('div');
			optionWrapper.className = 'live-poll-option-row';
			optionWrapper.setAttribute('data-option', options[j]);

			// Vote button
			var btn = document.createElement('button');
			btn.className = 'live-poll-btn';
			btn.textContent = options[j];
			btn.setAttribute('data-option', options[j]);
			btn.setAttribute('data-poll-id', pollId);
			btn.addEventListener('click', onPollVote);
			optionWrapper.appendChild(btn);

			// Bar chart (hidden until voted / results received)
			var bar = document.createElement('div');
			bar.className = 'live-poll-bar';

			var fill = document.createElement('div');
			fill.className = 'live-poll-bar-fill';
			fill.style.backgroundColor = ACCENT_COLORS[j % ACCENT_COLORS.length];
			fill.style.width = '0%';
			bar.appendChild(fill);

			var count = document.createElement('span');
			count.className = 'live-poll-count';
			count.textContent = '0 votes (0%)';
			bar.appendChild(count);

			optionWrapper.appendChild(bar);
			optionsContainer.appendChild(optionWrapper);
		}

		el.appendChild(optionsContainer);

		// Check if already voted
		if (hasVoted(pollId)) {
			el.classList.add('live-poll-voted');
		}
	}

	function onPollVote(e) {
		e.stopPropagation();
		var btn = e.currentTarget;
		var option = btn.getAttribute('data-option');
		var pollId = btn.getAttribute('data-poll-id');

		if (hasVoted(pollId)) return;

		markVoted(pollId, option);

		// Update UI to voted state
		var pollEl = document.querySelector('.live-poll[data-poll-id="' + pollId + '"]');
		if (pollEl) {
			pollEl.classList.add('live-poll-voted');
		}

		// Emit vote
		if (socket && socket.connected) {
			socket.emit('poll-vote', {
				pollId: pollId,
				option: option,
				sessionId: getSessionId()
			});
		}
	}

	function hasVoted(pollId) {
		return sessionStorage.getItem('anna-live-voted-' + pollId) !== null;
	}

	function markVoted(pollId, option) {
		sessionStorage.setItem('anna-live-voted-' + pollId, option);
	}

	function handlePollResults(data) {
		var pollId = data.pollId;
		var results = data.results || {};
		var totalVotes = data.totalVotes || 0;

		var pollEl = document.querySelector('.live-poll[data-poll-id="' + pollId + '"]');
		if (!pollEl) return;

		var rows = pollEl.querySelectorAll('.live-poll-option-row');
		for (var i = 0; i < rows.length; i++) {
			var option = rows[i].getAttribute('data-option');
			var votes = results[option] || 0;
			var pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

			var fill = rows[i].querySelector('.live-poll-bar-fill');
			var count = rows[i].querySelector('.live-poll-count');

			if (fill) {
				fill.style.width = pct + '%';
			}
			if (count) {
				count.textContent = votes + ' vote' + (votes !== 1 ? 's' : '') + ' (' + pct + '%)';
			}
		}
	}

	// =========================================================
	//  Q&A
	// =========================================================

	function setupQA() {
		var qas = document.querySelectorAll('.live-qa');
		for (var i = 0; i < qas.length; i++) {
			buildQA(qas[i]);
		}
	}

	function buildQA(el) {
		var qaId = el.getAttribute('data-qa-id');

		el.innerHTML = '';
		el.setAttribute('data-qa-id', qaId);

		// Input area
		var inputRow = document.createElement('div');
		inputRow.className = 'live-qa-input-row';

		var input = document.createElement('input');
		input.type = 'text';
		input.className = 'live-qa-input';
		input.placeholder = 'Ask a question\u2026';
		input.setAttribute('maxlength', '280');
		input.addEventListener('keydown', function(e) {
			e.stopPropagation();
			if (e.key === 'Enter') {
				submitQuestion(qaId, input);
			}
		});
		input.addEventListener('click', function(e) { e.stopPropagation(); });
		input.addEventListener('focus', function(e) { e.stopPropagation(); });
		inputRow.appendChild(input);

		var submitBtn = document.createElement('button');
		submitBtn.className = 'live-qa-submit';
		submitBtn.textContent = 'Ask';
		submitBtn.addEventListener('click', function(e) {
			e.stopPropagation();
			submitQuestion(qaId, input);
		});
		inputRow.appendChild(submitBtn);

		el.appendChild(inputRow);

		// Questions list
		var list = document.createElement('div');
		list.className = 'live-qa-list';
		el.appendChild(list);
	}

	function submitQuestion(qaId, inputEl) {
		var text = inputEl.value.trim();
		if (!text) return;

		inputEl.value = '';

		if (socket && socket.connected) {
			socket.emit('qa-question', {
				qaId: qaId,
				text: text,
				sessionId: getSessionId()
			});
		}
	}

	function handleQAQuestions(data) {
		var qaId = data.qaId;
		var questions = data.questions || [];

		var qaEl = document.querySelector('.live-qa[data-qa-id="' + qaId + '"]');
		if (!qaEl) return;

		var list = qaEl.querySelector('.live-qa-list');
		if (!list) return;

		// Sort by votes descending
		questions.sort(function(a, b) {
			return (b.votes || 0) - (a.votes || 0);
		});

		list.innerHTML = '';

		for (var i = 0; i < questions.length; i++) {
			var q = questions[i];
			list.appendChild(createQuestionItem(qaId, q));
		}
	}

	function createQuestionItem(qaId, q) {
		var item = document.createElement('div');
		item.className = 'live-qa-item';
		item.setAttribute('data-question-id', q.id);

		// Upvote button
		var upvoteBtn = document.createElement('button');
		upvoteBtn.className = 'live-qa-upvote';
		if (hasUpvoted(qaId, q.id)) {
			upvoteBtn.classList.add('live-qa-upvoted');
		}

		var arrow = document.createElement('span');
		arrow.className = 'live-qa-upvote-arrow';
		arrow.textContent = '\u25B2';
		upvoteBtn.appendChild(arrow);

		var voteCount = document.createElement('span');
		voteCount.className = 'live-qa-upvote-count';
		voteCount.textContent = q.votes || 0;
		upvoteBtn.appendChild(voteCount);

		upvoteBtn.addEventListener('click', function(e) {
			e.stopPropagation();
			if (hasUpvoted(qaId, q.id)) return;

			markUpvoted(qaId, q.id);
			upvoteBtn.classList.add('live-qa-upvoted');

			if (socket && socket.connected) {
				socket.emit('qa-upvote', {
					qaId: qaId,
					questionId: q.id,
					sessionId: getSessionId()
				});
			}
		});
		item.appendChild(upvoteBtn);

		// Question body
		var body = document.createElement('div');
		body.className = 'live-qa-body';

		var text = document.createElement('div');
		text.className = 'live-qa-text';
		text.textContent = q.text;
		body.appendChild(text);

		var time = document.createElement('div');
		time.className = 'live-qa-time';
		time.textContent = formatRelativeTime(q.timestamp);
		body.appendChild(time);

		item.appendChild(body);

		return item;
	}

	function hasUpvoted(qaId, questionId) {
		return sessionStorage.getItem('anna-live-upvoted-' + qaId + '-' + questionId) !== null;
	}

	function markUpvoted(qaId, questionId) {
		sessionStorage.setItem('anna-live-upvoted-' + qaId + '-' + questionId, '1');
	}

	function formatRelativeTime(timestamp) {
		if (!timestamp) return '';

		var now = Date.now();
		var ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
		var diff = Math.floor((now - ts) / 1000);

		if (diff < 5) return 'just now';
		if (diff < 60) return diff + 's ago';
		if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
		if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
		return Math.floor(diff / 86400) + 'd ago';
	}

	// =========================================================
	//  EMOJI REACTIONS
	// =========================================================

	function injectReactionBar() {
		// Don't inject twice
		if (document.querySelector('.live-reactions')) return;

		var bar = document.createElement('div');
		bar.className = 'live-reactions';

		for (var i = 0; i < REACTION_EMOJIS.length; i++) {
			var btn = document.createElement('button');
			btn.className = 'live-reaction-btn';
			btn.textContent = REACTION_EMOJIS[i];
			btn.setAttribute('data-emoji', REACTION_EMOJIS[i]);
			btn.addEventListener('click', onReactionClick);
			bar.appendChild(btn);
		}

		document.body.appendChild(bar);
	}

	function onReactionClick(e) {
		e.stopPropagation();
		var emoji = e.currentTarget.getAttribute('data-emoji');
		var slideIndex = 0;

		// Try to get the current slide index from Anna
		try {
			var indices = Anna.getIndices();
			slideIndex = indices.h || 0;
		} catch (err) {
			// Ignore
		}

		if (socket && socket.connected) {
			socket.emit('reaction', {
				emoji: emoji,
				slideIndex: slideIndex
			});
		}

		// Show a local float for immediate feedback
		spawnFloatingEmoji(emoji);
	}

	function handleReactionBurst(data) {
		var emoji = data.emoji;
		var count = data.count || 1;

		for (var i = 0; i < count; i++) {
			// Stagger slightly for visual effect
			(function(delay) {
				setTimeout(function() {
					spawnFloatingEmoji(emoji);
				}, delay);
			})(i * 120);
		}
	}

	function spawnFloatingEmoji(emoji) {
		var el = document.createElement('div');
		el.className = 'live-emoji-float';
		el.textContent = emoji;

		// Randomize horizontal position near the reaction bar
		var rightOffset = 20 + Math.random() * 100;
		el.style.right = rightOffset + 'px';
		el.style.bottom = '80px';

		document.body.appendChild(el);

		// Remove after animation completes
		setTimeout(function() {
			if (el.parentNode) {
				el.parentNode.removeChild(el);
			}
		}, 2100);
	}

	// =========================================================
	//  ANNA.JS INTEGRATION
	// =========================================================

	function hookIntoAnna() {
		Anna.addEventListener('ready', function() {
			init();
		});
	}

	// --- Boot ---

	if (typeof Anna !== 'undefined') {
		hookIntoAnna();
	} else {
		document.addEventListener('DOMContentLoaded', function() {
			if (typeof Anna !== 'undefined') {
				hookIntoAnna();
			}
		});
	}

})();
