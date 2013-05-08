define (['node!lodash', 'node!vow'], function (_, Promises) {
	var	methods = ['get', 'create', 'update', 'sync', 'release'];

	function parseRev (rev) {
		return parseInt (rev.split ('-') [0] || 0);
	}


	function SocketIoClient (socket, client) {
		this.id = 'socket.io client #' + client.id;

		this.client = client.lock (this);
		this.resources = client.resources;

		this.prepare = _.bind (this.prepare, this);
		this.notify = _.bind (this.notify, this);

		(this.socket = socket)
			.on ('message', _.bind (this.handle, this))
			.on ('disconnect', _.bind (this.dispose, this))
			.on ('error', _.bind (this.dispose, this));
	};

	_.extend (SocketIoClient.prototype, {
		client: null, socket: null, resources: null,

		handle1: function (message) {
			var self = this;
			_.defer (function () {
				self.handle (message);
			});
		},

		handle: function (message) {
			var data = JSON.parse (message),
				method = data.method,
				self = this;
			
			if (methods.indexOf (method) === -1) {
				console.error ('Unkown method', method);
			} else {
				Promises.when (this [method] (data))
					.then (function (payload) {
						if (data.req_seq) {
							self.send ({
								req_seq: data.req_seq,
								payload: payload
							});
						}
					})
					.fail (function (error) {
						if (data.req_seq) {
							self.send ({
								req_seq: data.req_seq,
								error: error
							});
						}
					})
					.done ();
			}
		},

		get: function (data) {
			return Promises.when (this.resources.get (data.id))
				.then (this.prepare);
		},

		create: function (data) {
			return Promises.when (this.resources.create (data.data))
				.then (this.prepare);
		},

		update: function (data) {
			return Promises.when (this.resources.get (data.data._id))
				.then (function (resource) {
					return resource.save (data.data);
				})
				.then (this.prepare);
		},

		release: function (data) {
			var id = data.id,
				resources = this.resources;

			if (resources.has (id)) {
				Promises.when (resources.get (id))
					.then (function (resource) {
						resource.removeAllListeners ('change');
						resources.unset (id);
					})
					.done ();
			}
		},

		// TODO: Optimize this function
		sync: function (data) {
			var states = data.states,
				resources = this.resources,
				self = this;

			// Sync all resources for each given state
			_.each (states, function (rev, id) {
				if (resources.has (id)) {
					return;
				}
				
				Promises.when (resources.get (id))
					.then (function (resource) {
						var error = resource.getSource ().error;
						
						if (error) {
							return Promises.reject (error);
						} else if (parseRev (resource.get ('_rev')) > parseRev (rev)) {
							return self.prepare (resource)
								.then (function (data) {
									return self.send ({payload: data});
								});
						}
					})
					.fail (function (error) {
						if (error.reason == 'deleted') {
							self.send ({
								payload: {
									_id: id,
									_deleted: true
								}
							});
						} else {
							console.log ('sync failed', id, error);
						}
					})
					.done ();
			});
		},

		// Prepare type, models and other stuff
		prepare: function (resource) {
			if (!resource || this.disposing) {
				return;
			}

			var errors = resource.errors ();
			if (errors) {
				throw errors;
			}

			var resources = this.resources;

			resource.removeListener ('change', this.notify);
			resource.on ('change', this.notify);

			var type = resource.get ('type'),
				options = resource.get ('options'),
				ids = [],
				rows = resource.get ('rows');

			if ((!options || !options ['no-models']) && rows) {
				ids = _.clone (rows);
			}

			if (ids.length) {
				ids = _.difference (ids, resources.ids ());
			}

			if (!resources.has (type)) {
				ids.push (type);
			}

			return Promises.all (
				_.map (ids, this.satisfy, this)
			)
				.then (function () {
					return resource.json ();
				});
		},

		notify: function (resource) {
			this.send ({
				payload: resource.json ()
			});
		},

		satisfy: function (id) {
			if (this.resources.has (id)) {	// TODO: See line 132, _.difference (...)
				return;
			}

			var self = this;

			return Promises.when (this.resources.get (id))
				.then (function (resource) {
					return self.prepare (resource);
				})
				.then (function (data) {
					self.send ({
						payload: data
					});
				})
				.fail (function (error) {
					console.error ('Can not satisfy', id, error);
				});
		},

		send: function (data) {
			if (this.socket) {
				this.socket.send (JSON.stringify (data));
			}
		},

		dispose: function () {
			console.log ('[socket.io] client disconnected');

			this.client.release (this);

			this.socket.removeAllListeners ();
			this.socket = null;
			this.client = null;
			this.resources = null;
			this.prepare = null;
			this.notify = null;
		}
	});

	return SocketIoClient;
});
