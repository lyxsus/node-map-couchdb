define (['node!fs', 'node!http'], function (fs, http) {
	var PWD = process.env.PWD,
		stdo = fs.createWriteStream (PWD + '/changes.log'),
		port = process.argv [2] ? parseInt (process.argv [2]) : 5983;

	process.stdout.write = (function (write) {
		return function (string, encoding, fd) {
			stdo.write (string);
		}
	}) (process.stdout.write);

	process.stderr.write = (function (write) {
		return function (string, encoding, fd) {
			stdo.write ('[error] ' + string);
		}
	}) (process.stderr.write);

	process.stdin.on ('end', function () {
		console.error ('Terminating: lost stdin');
		process.exit (0);
	});

	console.log ('Started');

	http.createServer (function (request, response) {
		request.connection.setTimeout (1000 * 60 * 60 * 24);

		console.log ('Client connected');

		response.writeHead (200, {
			'Content-Type': 'text/plain'
		});
		
		response.write ("\n");

		var interval = setInterval (function () {
			response.write ("\n");
		}, 1000 * 10);
		
		var onData = function (data) {
			response.write (data);
		};
		
		var onEnd = function () {
			clearInterval (interval);
			process.exit ();
		};

		process.stdin.on ('data', onData);
		process.stdin.on ('end', onEnd);
	}).listen (port);

	process.stdin.resume ();
});