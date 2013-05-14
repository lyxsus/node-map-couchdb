define (['fos!lodash', 'fos!promises', 'fos!socket-io', 'fos!boot/browser/libs/mixin.js'], function (_, Promises, SocketIO, mixin) {
	function Connection (host) {
		this.host = host;
		this.seq = 0;
		this.deffereds = [];

		this.ready ();
	}

	mixin (Connection);

	var allowed = ['_id', '_rev', '_deleted', '_attachments'];
	function filterData (data) {
		var result = {};
		for (var i in data) {
			if ((i.substring (0, 1) != '_') || (allowed.indexOf (i) !== -1)) {
				result [i] = data [i];
			}
		}

		return result;
	};

	_.extend (Connection.prototype, {
		socket: null, seq: null, deffereds: null,

		fetch: function () {
			var deferred = Promises.promise (),
				socket = SocketIO.connect (this.host, {
					'try multiple transports': false,
					'reconnect': true,
					'max reconnection attempts': Infinity,
					'sync disconnect on unload': true
				});

			socket.on ('connect', function () {
				deferred.fulfill (socket);
			});

			return deferred;
		},

		fetched: function (socket) {
			console.log ('connection is ready');

			(this.socket = socket)
				.on ('message', _.bind (this.handle, this))
				.on ('connect', _.bind (function () {
					this.emit ('connect');
				}, this));
		},

		get: function (id) {
			return this.request ({
				method: 'get',
				id: id
			});
		},

		create: function (data) {
			return this.request ({
				method: 'create',
				data: filterData (data)
			});
		},

		save: function (data) {
			return this.request ({
				method: 'update',
				data: filterData (data)
			});
		},

		release: function (id) {
			return this.request ({
				method: 'release',
				id: id
			});
		},

		sync: function (states) {
			return this.request ({
				method: 'sync',
				states: states
			});
		},

		// Send request to socket and return deferred object, wich will be resolved when server replies
		request: function (data) {
			var deferred = Promises.promise (),
				seq = ++this.seq;

			data.req_seq = seq;
			this.deffereds [seq] = deferred;

			// console.log ('send data', data);
			this.send (data);

			return deferred;
		},

		handle: function (message) {
			var data = JSON.parse (message);

			// console.log ('handle', message);

			if (data.req_seq) {
				this.resolveDeferreds (data);
			}

			if (data.payload && data.payload._id) {
				this.emit ('data', data.payload);
			}
		},

		resolveDeferreds: function (data) {
			var seq = data.req_seq,
				deferred = this.deffereds [seq];

			if (deferred != undefined) {
				deferred [data.error ? 'reject' : 'fulfill'] (data.error || data.payload);
				this.deffereds [seq] = null;
			} else {
				console.warn ('Not found promise to resolve for seq', seq);
			}
		},

		// Send data to socket
		send: function (data) {
			this.socket.send (
				JSON.stringify (data)
			);
		}
	});

	return new Connection ();
});