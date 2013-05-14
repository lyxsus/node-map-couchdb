define (['fos!lodash', 'fos!promises', 'fos!boot/browser/libs/mixin.js', 'fos!boot/browser/storage.js', 'fos!boot/browser/render.js', 'futurios/settings', 'fos!boot/browser/helpers/links.js'], function (_, Promises, mixin, storage, render, settings, links) {
	function Router (vhost) {
		this.history = [];
		this.setMaxListeners (500);
	};

	mixin (Router);

	_.extend (Router.prototype, {
		vhost: null,
		history: null,

		fetch: function () {
			var self = this;

			return Promises.when (storage.ready ())
				.then (function () {
					return self.loadApps ();
				})
				.then (function () {
					return storage.get (settings.vhost);
				})
				.then (function (vhost) {
					self.vhost = vhost;

					return Promises.all (
						_.map (vhost.get ('theme'), storage.get, storage)
					);
				});
		},

		fetched: function (themes) {
			var syncUrl = _.bind (this.syncUrl, this);

			render.themes = themes;

			$ (window)
				.on ('popstate', syncUrl)
				.on ('hashchange', syncUrl);

			return Promises.when (syncUrl ())
				.then (render.ready ());
		},

		loadApps: function () {
			var self = this;

			return storage.get ('urn:applications?view=routes&limit=1000')
				.then (function (apps) {
					self.routes = apps;
				});
		},

		syncUrl: function () {
			var location = window.location,
				path = location.pathname + location.search,
				history = this.history,
				l = history.length;

			if (!l || history [l - 1] != path) {
				history [l] = path;
				return this.loadUrl (path);
			}
		},

		getHash: function () {
			return window.location.hash.substring (1);
		},

		navigate: function (url) {
			if (/^urn:/.test (url)) {
				url = links.urn2link (url);
			}

			history.pushState ({}, document.title, url);
			
			return Promises.when (this.syncUrl ());
		},

		loadUrl: function (url) {
			var i = url.indexOf ('#');
			if (i !== -1) {
				url = url.substring (0, i);
			}

			var urn = links.link2urn (url) || this.vhost.get ('entrypoint');

			if (settings.page_uri == urn) return;
			
			settings.page_uri = urn;

			return Promises.when (storage.get (urn))
				.then (_.bind (function (resource) {
					settings.page = resource;



					_.each (render.themes, function (theme) {
						theme.set ({
							_page_uri: urn,
							_history: [{
								'id': resource.id,
								'type': resource.get ('type'),
								'class': resource.get ('rows') ? 'collection' : 'document'
							}]
						}, {silent: true});
					});

					this.emit ('change');

					_.each (render.themes, function (theme) {
						theme.emit ('change');
					});
				}, this))

				.fail (function (error) {
					console.error (error);
				});
		}
	});

	return (new Router (settings.vhost));
});