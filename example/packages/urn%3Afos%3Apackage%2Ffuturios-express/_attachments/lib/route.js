define (['node!vow'], function (Promises) {
	var	e = encodeURIComponent;

	function virtualHost (host, client) {
		return Promises.when (client.resources.get ('urn:vhost?domain=' + e (host)))
			.then (function (hosts) {
				var rows = hosts.get ('rows');

				if (rows.length) {
					return client.resources.get (rows [0].id);
				} else {
					return client.resources.get ('urn:vhost/debug');
					// throw new Error ('virtual host not found');
				}
			})
	}

	function resolveUrl (url, host, routes) {
		var app, doc, type, ext,
			prefix, suffix, attach;

		for (var i in routes) {
			if (url.substring (0, i.length) == i) {
				if (!app || i.length > prefix.length) {
					app = routes [i];
					prefix = i;
				}
			}
		}

		if (app) {
			var q = url.substring (prefix.length, prefix.length + 1);

			if (q == '.') {
				ext = url.substring (prefix.length + 1);

				var i = ext.indexOf ('?');
				if (i !== -1) {
					app += ext.substring (i);
					ext = ext.substring (0, i);
				}
			} else if (q == '?') {
				app += url.substring (prefix.length);
			} else {
				suffix = url.substring (prefix.length + 1)

				if (suffix) {
					var i = suffix.indexOf ('/');

					if (i === -1) {
						doc = suffix;

						i = doc.indexOf ('.');
						if (i !== -1) {
							ext = doc.substring (i + 1);
							doc = doc.substring (0, i);
						}
					} else {
						doc = suffix.substring (0, i);
						attach = suffix.substring (i + 1);

						i = attach.indexOf ('?');
						if (i !== -1) {
							attach = attach.substring (0, i);
						}
					}
				}
			}
		}
		
		if (!app && !doc) {
			var entrypoint = host.get ('entrypoint') || 'urn:categories/root',	// TODO: Get rid off 'categories/root'
				i = entrypoint.indexOf ('/');

			if (i === -1) {
				app = entrypoint;
			} else {
				app = entrypoint.substring (0, i);
				doc = entrypoint.substring (i + 1);
			}
		}
		
		return {
			host: host,
			app: app,
			doc: doc,
			attach: attach,
			ext: ext
		};
	}

	return function (req, client) {
		return virtualHost (req.host, client)
			.then (function (host) {
				return resolveUrl (req.url, host, client.pool.appRoutes);
			});
	};
});