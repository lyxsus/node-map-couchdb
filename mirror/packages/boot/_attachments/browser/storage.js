define (['fos!lodash', 'fos!boot/browser/libs/mixin.js', 'fos!boot/browser/libs/resources.js', 'fos!boot/browser/helpers/links.js'], function (_, mixin, resources, links) {
	var Storage = function () {
	};

	mixin (Storage);

	_.extend (Storage.prototype, {
		id: 'futurios/storage',
		resources: null,

		fetch: function () {
			return resources.ready ();
		},

		fetched: function (resources) {
			this.resources = resources;
		},

		get: function (id) {
			if (id.substring (0, 4) !== 'urn:') {
				id = links.link2urn (id);
			}

			return this.resources.get (id).ready ();
		},

		create: function (data, settings) {
			return this.resources.create (data)
				.then (_.bind (function (response) {
					return this.get (response._id);
				}, this))
				.fail (function (error) {
					if (settings && settings.error) {
						settings.error (error);
					} else {
						console.error (error);
					}
				})
				.then (function (resource) {
					if (settings && settings.success) {
						settings.success (resource);
					}
					return resource;
				});
		}
	});

	return new Storage;
});
