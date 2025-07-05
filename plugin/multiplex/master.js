(function() {

	// Don't emit events from inside of notes windows
	if ( window.location.search.match( /receiver/gi ) ) { return; }

	var multiplex = Anna.getConfig().multiplex;

	var socket = io.connect( multiplex.url );

	function post() {

		var messageData = {
			state: Anna.getState(),
			secret: multiplex.secret,
			socketId: multiplex.id
		};

		socket.emit( 'multiplex-statechanged', messageData );

	};

	// post once the page is loaded, so the client follows also on "open URL".
	window.addEventListener( 'load', post );

	// Monitor events that trigger a change in state
	Anna.addEventListener( 'slidechanged', post );
	Anna.addEventListener( 'fragmentshown', post );
	Anna.addEventListener( 'fragmenthidden', post );
	Anna.addEventListener( 'overviewhidden', post );
	Anna.addEventListener( 'overviewshown', post );
	Anna.addEventListener( 'paused', post );
	Anna.addEventListener( 'resumed', post );

}());
