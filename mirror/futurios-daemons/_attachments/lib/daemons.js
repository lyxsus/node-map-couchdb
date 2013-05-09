define ([
	'node!lodash', './daemon', './http_request',
	'node!nodemailer', 'node!less'
], function (_, Daemon, http_request) {
	function Daemons (config) {
		this.config = config;

		this.host = config.couchdb.host;
		this.port = config.couchdb.port;

		this.consumer = config.couchdb.auth;

		this.dbs = {};

		this.reload ();
	};

	_.extend (Daemons.prototype, {
		// TODO: Pass this function to daemon
		_request: function (consumer, options, callback) {
			options = _.extend ({
				host: this.host,
				port: this.port,
				headers: {}
			}, options);

			consumer = consumer || this.consumer;

			return http_request (consumer, options, callback);
		},

		// Get domains list view
		_daemons: function (callback) {
			var path = '/' + 
				_.map ([
					'sys/daemons',
					'_design',
					'urn:daemons',
					'_view',
					'boot'
				], encodeURIComponent).join ('/') +
				'?include_docs=true';

			var options = {
				path: path
			};

			return this._request (null, options, callback);
		},

		// Reload daemons
		reload: function () {
			var _callback = _.bind (function (error, result) {
				if (error) {
					console.error ('Failed to reload daemons', error);
					return;
				}

				_.each (this.daemons, function (daemon) {
					daemon.stop ();
				});

				this.daemons = _.map (result.rows, function (row) {
					var daemon = new Daemon (this, row.doc);
					daemon.start ();
					return daemon;
				}, this);
			}, this);

			this._daemons (_callback);
		},

		// Notify daemons about 
		notify: function (event) {
			if (event.db) {
				var name = event.db;

				// deleted, created, updated
				if (event.type == 'created') {
					_.each (this.daemons, function (daemon) {
						if (typeof daemon.notifyDb == 'function') {
							daemon.notifyDb (event);
						}
					});
				}

				if (event.type == 'deleted') {
					if (this.dbs [name]) {
						delete this.dbs [name]
					}

					_.each (this.daemons, function (daemon) {
						if (typeof daemon.notifyDb == 'function') {
							daemon.notifyDb (event);
						}
					});

					return;
				}

				if (!this.dbs [name]) {
					this.dbs [name] = {
						name: name,
						info: null,
						streaming: false,
						fetching: false
					};
				}

				var db = this.dbs [name];
				if (!db.info) {
					this._info (db, _.bind (function () {
						this._stream (db, db.info.update_seq - 1);
					}, this));
				} else {
					this._stream (db, db.info.update_seq);
				}
			}
		},

		_info: function (db, callback) {
			var options = {
				path: '/' + encodeURIComponent (db.name)
			};

			db.fetching = true;

			this._request (null, options, function (error, result) {
				db.fetching = false;

				if (error) {
					console.error ('Failed fetching db', db.name, error);
					return;
				}

				db.info = result;

				callback ();
			});
		},

		_endStream: function (db) {
			db.streaming = false;

			if (db.streamMore) {
				db.streamMore = false;
				this._stream (db, db.info.update_seq);
			}
		},

		_stream: function (db, since) {
			if (db.streaming) {
				db.streamMore = true;
				return;
			}

			db.streaming = true;

			var callback = _.bind (function (error, result) {
				if (error) {
					console.error (error);
					this._endStream (db);
					return;
				}


				_.each (result.results, function (event) {
					this._dbEvent (db, event);
				}, this);


				this._endStream (db);
			}, this);

			var path = '/' + encodeURIComponent (db.name) +
					'/_changes?include_docs=true&since=' + since

			var options = {
				path: path
			};

			this._request (null, options, callback);
		},

		// Push event with udpated document to daemons
		_dbEvent: function (db, event) {
			db.info.update_seq = event.seq;
			event.db = db.name;
			event.host = this.host;
			event.port = this.port;

	//		console.log ('#', event.db, event.seq, this.daemons.length, 'daemons');

			_.each (this.daemons, function (daemon) {
	//			console.log ('[', daemon.source._id, ']');

				if (daemon.filter (event)) {
					console.log ('[', (new Date), ']', '[' + daemon.source._id + ']', event.db, event.id);
					
					try {
						daemon.notify (event);
					} catch (e) {
						console.error (daemon.source._id, e.message, e.stack);
					}
				}
			}, this);
		}
	});

	return Daemons;
});