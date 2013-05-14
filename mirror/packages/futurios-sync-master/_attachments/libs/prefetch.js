define (['node!vow', 'node!lodash'], function (Promises, _) {
	return function prefetch (client, resource) {
		var resources = client.resources,
			errors;

		if (errors = resource.errors ()) {
			Promises.reject (errors);
		}

		return Promises.when (resources.get (resource.get ('type')))
			// fetch type
			.then (function (type) {
				resource._type = type;

				return _.filter (type.get ('fields'), function (field) {
					return field.prefetch;
				});
			})

			// fetch prefetched fields
			.then (function (fields) {
				if (!fields.length) return resource;

				var prefetched = {};

				return Promises.all (
					_.map (fields, function (field) {
						var name = field.name,
							value = resource.get (name),
							set = function (value) {
								prefetched [name] = value;
							};

						if (value) {
							if (typeof value == 'string') {
								return Promises.when (resources.get (value))
									.then (function (resource) {
										return prefetch (client, resource);
									})
									.fail (console.error)
									.then (set);
							} else {
								return Promises.all (
									_.map (value, function (id) {
										return resources.get (id);
									})
								)
									.then (function (values) {
										return _.map (values, function (resource) {
											return prefetch (client, resource);
										});
									})
									.fail (console.error)
									.then (set)
							}
						} else {
							set (null);
						}
					})
				)
					.then (function () {
						resource._prefetch = prefetched;
						return resource;
					})
			});
	};

});