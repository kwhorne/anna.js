/**
 * Handles opening of and synchronization with the anna.js
 * notes window.
 *
 * Handshake process:
 * 1. This window posts 'connect' to notes window
 *    - Includes URL of presentation to show
 * 2. Notes window responds with 'connected' when it is available
 * 3. This window proceeds to send the current presentation state
 *    to the notes window
 */
var AnnaNotes = (function() {

    var notesPopup = null;

	function openNotes( notesFilePath ) {

        if (notesPopup && !notesPopup.closed) {
            notesPopup.focus();
            return;
        }

		if( !notesFilePath ) {
			var jsFileLocation = document.querySelector('script[src$="notes.js"]').src;  // this js file path
			jsFileLocation = jsFileLocation.replace(/notes\.js(\?.*)?$/, '');   // the js folder path
			notesFilePath = jsFileLocation + 'notes.html';
		}

		notesPopup = window.open( notesFilePath, 'anna.js - Notes', 'width=1100,height=700' );

		if( !notesPopup ) {
			alert( 'Speaker view popup failed to open. Please make sure popups are allowed and reopen the speaker view.' );
			return;
		}

		/**
		 * Connect to the notes window through a postmessage handshake.
		 * Using postmessage enables us to work in situations where the
		 * origins differ, such as a presentation being opened from the
		 * file system.
		 */
		function connect() {
			// Keep trying to connect until we get a 'connected' message back
			var connectInterval = setInterval( function() {
				notesPopup.postMessage( JSON.stringify( {
					namespace: 'anna-notes',
					type: 'connect',
					url: window.location.protocol + '//' + window.location.host + window.location.pathname + window.location.search,
					state: Anna.getState()
				} ), '*' );
			}, 500 );

			window.addEventListener( 'message', function( event ) {
				var data = JSON.parse( event.data );
				if( data && data.namespace === 'anna-notes' && data.type === 'connected' ) {
					clearInterval( connectInterval );
					onConnected();
				}
				if( data && data.namespace === 'anna-notes' && data.type === 'call' ) {
					callAnnaApi( data.methodName, data.arguments, data.callId );
				}
			} );
		}

		/**
		 * Calls the specified Anna.js method with the provided argument
		 * and then pushes the result to the notes frame.
		 */
		function callAnnaApi( methodName, methodArguments, callId ) {

			var result = Anna[methodName].apply( Anna, methodArguments );
			notesPopup.postMessage( JSON.stringify( {
				namespace: 'anna-notes',
				type: 'return',
				result: result,
				callId: callId
			} ), '*' );

		}

		/**
		 * Posts the current slide data to the notes window
		 */
		function post( event ) {

			var slideElement = Anna.getCurrentSlide(),
				notesElement = slideElement.querySelector( 'aside.notes' ),
				fragmentElement = slideElement.querySelector( '.current-fragment' );

			var messageData = {
				namespace: 'anna-notes',
				type: 'state',
				notes: '',
				markdown: false,
				whitespace: 'normal',
				state: Anna.getState()
			};

			// Look for notes defined in a slide attribute
			if( slideElement.hasAttribute( 'data-notes' ) ) {
				messageData.notes = slideElement.getAttribute( 'data-notes' );
				messageData.whitespace = 'pre-wrap';
			}

			// Look for notes defined in a fragment
			if( fragmentElement ) {
				var fragmentNotes = fragmentElement.querySelector( 'aside.notes' );
				if( fragmentNotes ) {
					notesElement = fragmentNotes;
				}
				else if( fragmentElement.hasAttribute( 'data-notes' ) ) {
					messageData.notes = fragmentElement.getAttribute( 'data-notes' );
					messageData.whitespace = 'pre-wrap';

					// In case there are slide notes
					notesElement = null;
				}
			}

			// Look for notes defined in an aside element
			if( notesElement ) {
				messageData.notes = notesElement.innerHTML;
				messageData.markdown = typeof notesElement.getAttribute( 'data-markdown' ) === 'string';
			}

			notesPopup.postMessage( JSON.stringify( messageData ), '*' );

		}

		/**
		 * Called once we have established a connection to the notes
		 * window.
		 */
		function onConnected() {

			// Monitor events that trigger a change in state
			Anna.addEventListener( 'slidechanged', post );
			Anna.addEventListener( 'fragmentshown', post );
			Anna.addEventListener( 'fragmenthidden', post );
			Anna.addEventListener( 'overviewhidden', post );
			Anna.addEventListener( 'overviewshown', post );
			Anna.addEventListener( 'paused', post );
			Anna.addEventListener( 'resumed', post );

			// Post the initial state
			post();

		}

		connect();

	}

	return {
		init: function() {

			if( !/receiver/i.test( window.location.search ) ) {

				// If the there's a 'notes' query set, open directly
				if( window.location.search.match( /(\?|\&)notes/gi ) !== null ) {
					openNotes();
				}

				// Open the notes when the 's' key is hit
				Anna.addKeyBinding({keyCode: 83, key: 'S', description: 'Speaker notes view'}, function() {
					openNotes();
				} );

			}

		},

		open: openNotes
	};

})();

Anna.registerPlugin( 'notes', AnnaNotes );
