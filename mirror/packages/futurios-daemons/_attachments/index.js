define ([
	'./lib/daemons', './config.json', 'node!lodash', 'node!fs',
	'node!less', 'node!nodemailer', 'node!iconv-lite'	// <- preloaded depencies
], function (Daemons, config, _, fs) {
	var stdin = process.stdin,
		PWD = process.env.PWD,
		stdo = fs.createWriteStream (PWD + '/daemons.log');


	// Catch uncatched exceptions
	process.addListener ('uncaughtException', function (error) {
			console.error ('Uncaught exception: ', error);
			console.error (error.stack);
	});

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


	_.delay (function () {
			// TODO: Extract these params from command line arguments
			var daemons = new Daemons (config);

			listen (daemons);
	}, 500);


	function listen (daemons) {
			// Listen stdin for dbupdate events
			process.stdin.resume ();
			process.stdin.on ('data', function (chunk) {
					var lines = chunk.toString ('utf-8').split ('\n');
					for (var i = 0; i < lines.length; i++) {
							var line = lines [i];

							if (line) {
									var event = JSON.parse (line);
									daemons.notify (event);
							}
					}

			});

			process.stdin.on ('end', function () {
					console.error ('Terminating: lost stdin');
					process.exit (0);
			});     
	}

	setInterval (function () {
			var usage = parseFloat (process.memoryUsage ().rss / Math.pow (1024, 2)).toFixed (2);
			console.log ('[memory usage]', usage, 'mb');
	}, 60 * 1000);
});