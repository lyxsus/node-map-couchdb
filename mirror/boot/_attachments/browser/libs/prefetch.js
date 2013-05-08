define (['fos!promises'], function (Promises) {
	var fetch = function (resource, id) {
		return resource.resources.get (id).ready ();
	};

	function prefetchType (resource) {
		var type = resource.get ('type');

		if (resource.id == type) {
			resource._type = resource;
			return resource;
		} else {
			return Promises.when (fetch (resource, type))
				.then (function (type) {
					type.removeListener ('change', resource.change);
					type.on ('change', resource.change);

					type.lock (resource);
					resource._type = type;

					return resource;
				});
		}
	}

	function prefetchModels (resource) {
		var rows = resource.get ('rows'),
			options = resource.get ('options');

		if (!rows || (options && options ['no-models'])) {
			return;
		}

		return Promises.all (
			_.map (rows, function (row) {
				return fetch (resource, row.id);
			})
		)
			.then (function (models) {
				_.each (models, function (model) {
					model.lock (resource);
				});

				resource._models = models;
			})
			.fail (function (error) {
				console.error ('Could not prefetch some models in collection', resource.id, error.message, error.stack);
			});
	}

	function prefetchReferences (resource) {
		var fields = _.filter (resource._type.get ('fields'), function (field) {
			return field.prefetch;
		});

		resource._prefetch = {};

		if (!fields || !fields.length) {
			return;
		}

		var prefetch = _.bind (function (urn) {
			return Promises.when (fetch (resource, urn))
				.then (function (fetched) {
					fetched.removeListener ('change', resource.change);
					fetched.on ('change', resource.change);

					return fetched.lock (resource);
				})
				.fail (function (error) {
					console.warn ('Failed to prefetch', urn, 'in', resource.id);
				});
		}, this);

		return Promises.all (
			_.map (fields, function (field) {
				var value = resource.get (field.name);

				if (typeof value == 'string') {
					return prefetch (value);
				} else if (value && value.length) {
					return Promises.all (_.map (value, prefetch));
				}
			}, this)
		)
			.then (function (prefetched) {
				var result = {};

				for (var i in prefetched) {
					result [fields [i].name] = prefetched [i];
				}

				resource._prefetch = result;
			})
			.fail (function (error) {
				console.error ('Could not prefetch some models in document', resource.id);
			});
	}


	return function (resource) {
		return Promises.when (prefetchType (resource))
			.then (function () {
				return Promises.all ([prefetchModels (resource), prefetchReferences (resource)]);
			})
			.then (function () {
				return resource;
			});
	}
});