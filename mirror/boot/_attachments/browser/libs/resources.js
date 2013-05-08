define (['fos!lodash', 'fos!boot/browser/libs/mixin.js', 'fos!boot/browser/libs/resource.js', 'fos!boot/browser/connection.js'], function (_, mixin, Resource, connection) {
	function Resources () {
		this.resources = {};
	}

	mixin (Resources);

	function parseRev (rev) {
		if (!rev) return 0;
		return parseInt (rev.split ('-') [0] || 0);
	}


	_.extend (Resources.prototype, {
		id: 'futurios/resources',
		connection: null,
		resources: null,

		fetch: function () {
			return connection.ready ();
		},

		fetched: function (connection) {
			this.connection = connection;

			connection.on ('connect', _.bind (this.sync, this));

			connection.on ('data', _.bind (this.update, this));
		},

		sync: function () {
			var states = {};

			_.each (this.resources, function (resource, index) {
				if (resource) {
					states [index] = resource.get ('_rev');
				}
			});

			connection.sync (states);
		},

		get: function (id) {
			var resources = this.resources;

			if (resources [id] == undefined) {
				resources [id] = new Resource (this, id);
			}

			return resources [id];
		},

		unset: function (resource) {
			delete this.resources [resource.id];
			connection.release (resource.id);
		},

		create: function (data) {
			return connection.create (data);
		},

		update: function (data) {
			this.get (data._id).set (data);
		}
	});

	return new Resources;
});
