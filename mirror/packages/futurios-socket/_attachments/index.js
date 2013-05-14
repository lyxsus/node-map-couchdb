define (
	[
		'node!lodash', 'node!vow', 'node!socket.io', 'node!cookie',
		'./client.js'
	],

	function (_, Promises, SocketIO, cookie, Client) {
		function SocketIoServer (pool, session) {
			this.pool = pool;
			this.session = session;
		};

		_.extend (SocketIoServer.prototype, {
			connectUtils: null,

			transports: [
				'websocket',
				'jsonp-polling',
				'xhr-polling',
				'htmlfile',
				'flashsocket'
			],
			
			listen: function (server) {
				SocketIO.listen (server)
					.set ('log level', 0)
					.set ('transports', this.transports)
					.set ('authorization', _.bind (this.authorization, this))
					.enable ('browser client minification')
					.enable ('browser client etag')
					.enable ('browser client gzip')
					.sockets.on ('connection', _.bind (this.connected, this));
			},

			authorization: function (handshakeData, accept) {
				var key = this.session.key,
					secret = this.session.secret,
					parseSignedCookie = this.connectUtils.parseSignedCookie;

				if (handshakeData.headers.cookie) {
					handshakeData.cookie = cookie.parse (handshakeData.headers.cookie);
					handshakeData.sessionID = parseSignedCookie (handshakeData.cookie [key], secret);

					if (handshakeData.cookie ['express.sid'] == handshakeData.sessionID) {
						return accept ('Cookie is invalid.', false);
					} else {
						return this.session.instance.get (handshakeData.sessionID, function (error, result) {
							if (error) {
								accept (error);
							} else {
								if (result && result.passport && result.passport.user) {
									handshakeData.user = result.passport.user;
								}
								accept (null, true);
							}
						});
					}
				} else {
					return accept ('No cookie transmitted.', false);
				}

				accept (null, true);
			},

			connected: function (socket) {
				console.log ('[socket.io] client connected');

				var queue = [], fillPromisesQueue = function (message) {
					queue.push (message);
				};

				socket.on ('message', fillPromisesQueue);

				var sessionId = socket.handshake.sessionID;

				Promises.when (this.authenticate (socket))
					.then (function (client) {
						socket.removeListener ('message', fillPromisesQueue);

						client.sessionId = sessionId;

						return new Client (socket, client);
					})
					.then (function (socketClient) {
						var message;
						while (message = queue.pop ()) {
							socketClient.handle (message);
						}
					})
					.fail (console.error)
					.done ();
			},

			// TODO: Extract client params from session, if possible
			authenticate: function (socket) {
				var token = socket.handshake.user;
				return this.pool.client (token ? {oauth: token} : null);
			}
		});

		return SocketIoServer;
	}
);