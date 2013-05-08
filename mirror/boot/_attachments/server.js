define (
	[
		'node!vow', 'node!lodash',
		'node!http', 'node!https', 'node!express', 'node!express/node_modules/connect/lib/utils', 'node!gzippo',
		'fos!futurios-socket', 'fos!futurios-pool', 'fos!futurios-express',
		'./config.js'/*,
		'node!toobusy'*/
	],
	function (Promises, _, http, https, express, connectUtils, gzippo, SocketIO, Pool, futurios, config/* , toobusy */) {
		/* hello world */
		function startServer (pool) {
			var fosSocketIO = new SocketIO (pool, config.sessions),
				app = createApp (pool);

			fosSocketIO.connectUtils = connectUtils;

			if (config.http) {
				fosSocketIO.listen (
					http.createServer (app)
						.listen (config.http.port)
				);

				console.log ('listening http on port', config.http.port);
			}

			if (config.https) {
				fosSocketIO.listen (
					https.createServer (app)
						.listen (config.https.port)
				);
			}
		}

		function createApp (pool) {
			var app = express ();

			app
				// .use (function (req, res, next) {
				// 	if (toobusy ()) {
				// 		res.send (503, "I'm busy right now, sorry.");
				// 	} else {
				// 		next ();
				// 	}
				// })
				.use ('/login', express.bodyParser ())
				.use ('/registrate', express.bodyParser ())
				.use ('/auth', express.bodyParser ())

				.use (function (req, res, next) {
					req.pause ();
					next ();
				})
				
				.use (express.cookieParser ())
				.use (express.methodOverride ())

			oldStaticFiles (app);

			app
				.use ('/boot', gzippo.staticGzip ('/Users/lyxsus/GitHub/sample-package-user/boot'))
				.use (futurios.sessions (express, config.sessions))
				.use (futurios.initialize (app, pool));

			return app;
		}

		function oldStaticFiles (app) {
			// Proxy static files
			var request = require ('request');
			
			app.use (function (req, res, next) {
				var tmp;


				if (tmp = req.url.match (/^\/(app|sys|users)%2F.*/)) {
					var options = {
						headers: {}
					};

					if (req.user) {
						options.oauth = req.user.oauth;
					}

					var request = require ('request');

					options.url = 'http://' + config.pool.server.host + ':' + config.pool.server.port + tmp [0];
					options.method = req.method;

					options.headers ['if-none-match'] = req.headers ['if-none-match'];
					
					if (req.method == 'PUT' || req.method == 'POST') {
						if (req.body._rev && req.files && req.files._attachments) {
							var fileName = req.files._attachments.name;
							options.url += (req.body.folder ? ('/' + req.body.folder + '/') : '/') + fileName + '?rev=' + req.body._rev;
							options.headers ['content-type'] = mime.lookup (fileName);

							require ('fs').createReadStream (req.files._attachments.path).pipe (
								request.put (options, function (error, response, body) {
									if (error) {
										console.error (error);
									}
									res.write (body);
									res.end ();
								})
							);
						} else {
							if (!options.headers) {
								options.headers = {};
							}
							options.headers ['content-type'] = mime.lookup (options.url.split ('?') [0]);
							req.pipe (request (options.url, options));
						}
					} else {
						if (config ['cache-proxy']) {
							request (options).on ('response', function (proxy) {
								var headers = proxy.headers;

								// Modify http cache headers
								headers ['Vary'] = 'Accept, Accept-Encoding, Accept-Language, Cookie';
								headers ['cache-control'] = 'max-age=7200';

								res.writeHead (proxy.statusCode, headers);
								proxy.pipe (res);	// TODO: Add error handling
							});
						} else {
							request (options).pipe (res);
						}
					}
				} else {
					next ();
				}		
			});
		}

		var pool = new Pool (config.pool);
		// Init fos-pool
		Promises.when (pool.ready ())
			.fail (function (error) {
				console.error ('Failed to start pool', error);
			})

			.then (startServer)
			.fail (function (error) {
				if (error.stack) {
					console.log ('unkown error', error.message, error.stack);
				} else {
					console.log ('unkown error', error);
				}
			})
			.done ();

		setInterval (function () {
			var usage = parseFloat (process.memoryUsage ().rss / Math.pow (1024, 2)).toFixed (2);
			console.log ('[memory usage]', usage, 'mb');
		}, 5 * 1000);


	}
);