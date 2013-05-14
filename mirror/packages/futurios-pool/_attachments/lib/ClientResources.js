define (['node!lodash', 'node!vow', './ClientResource.js'], function (_, Promises, ClientResource) {
	function ClientResources (client) {
		this.client = client;
		this.pool = client.pool;

		this.cache = {};
	};

	_.extend (ClientResources.prototype, {
		client: null, cache: null,

		get: function (id) {
			if (!id) return false; // throw new Error ('Resource id could not be empty');
			if (typeof id != 'string') return false; // throw new Error ('Resource id must be a string', typeof id, 'given');
			
			var resource = this.cache [id];

			if (!resource) {
				resource = this.cache [id] = new ClientResource (this.client, id);
				resource.lock (this.client);
			}

			return resource.ready ();
		},

		unset: function (id) {
			if (this.has (id)) {
				var resource = this.cache [id],
					self = this;
				
				Promises.when (resource)
					.then (function (resource) {
						resource.release (self.client);
					})
					.always (function () {
						delete self.cache [id];
					})
					.done ();
			}
		},

		create: function (data) {
			var pool = this.pool,
				client = this.client,
				self = this,
				app;

			return Promises.when (pool.locateType (data.type))
				.then (function () {
					app = arguments [0];
					return pool.selectDb (client, pool.getAppDbs (app));
				})
				.then (function (db) {
					return pool.server.database (db);
				})
				.then (function (database) {
					return database.documents.create (app, data, client.sign ());
				})
				.then (function (document) {
					return self.get (document.id);
				});
		},

		has: function (id) {
			return this.cache [id] !== undefined;
		},
		
		
		list: function () {
			return this.cache;
		},

		ids: function () {
			return _.keys (this.cache);
		},

		dispose: function () {
			this.client = null;
			this.pool = null;
			this.cache = null;
		}
	});

	return ClientResources;
});