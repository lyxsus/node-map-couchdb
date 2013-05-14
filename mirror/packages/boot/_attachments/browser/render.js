define (['fos!jquery', 'fos!promises', 'fos!lodash', 'fos!boot/browser/storage.js', 'fos!boot/browser/session.js', 'futurios/settings', 'fos!boot/browser/libs/mixin.js', 'fos!boot/browser/libs/views.js'], function ($, Promises, lodash, storage, session, settings, mixin, views) {
	$.fn.attrs = function() {
		var attributes = {}; 

		if (this.length) {
			$.each (this [0].attributes, function (index, attr) {
				attributes [attr.name] = attr.value;
			}); 
		}

		return attributes;
	};

	function Render () {
		this.render = _.bind (this.render, this);
	}

	mixin (Render);

	_.extend (Render.prototype, {
		themes: null,

		fetch: function () {
			return session.ready ();
		},

		fetched: function () {
			views.render = this;
			views.themes = _.pluck (this.themes, 'id').join (',');

			$.expr [':'].binded = function (elem, i, match, array) {
				return $.data (elem, 'view') !== undefined;
			};

			var self = this;

			$.fn.scan = function () {
				return self.scan (this);
			};

			$.fn.render = function () {
				return self.render (this);
			};

			$ (document).ready (_.bind (this.start, this));
			this.monitorCSS ();
		},

		start: function () {
			var start = Date.now (), $body = $ ('<body />');

			$body
				.append (
					_.map (this.themes, function (theme) {
						theme.set ({
							_page_uri: settings.page_uri
						});

						return $ ('<div />', {
							'data-bind': theme.id,
							'data-tags': theme.id.split('urn:themes/') [1],
							'data-replace': true
						});
					})
				)
				.scan ()
					.always (function () {
						$body.attr (
							$ ('body').attrs ()
						);

						$ ('body').replaceWith ($body);

						$body.find (':binded').each (function (index, el) {
							$ (el).trigger ($.Event ('after:populate'));
						});

						
						
						console.log ('initial render', (Date.now () - start) / 1000);
					})
					.fail (function (error) {
						console.error ('Initial render failed', error);
					})
					.done ();
		},

		scan: function ($el) {
			var render = this.render,
				$nodes = $ ('[data-bind]', $el);

			return Promises.all (
				$nodes.map (function (index, el) {
					return render (el);
				})
			);
		},

		render: function (el) {
			var $el = $ (el),
				id = $el.attr ('data-bind'),
				tags = $el.attr ('data-tags'),
				use = $el.attr ('data-use'),
				replace = $el.attr ('data-replace');

			if (!id || id == 'undefined' || id == 'null') {
				console.warn ('illegal data-bind attribute', id, el);
				return;
			}

			$el.attr ({
				'data-bind': null,
				'data-tags': null,
				'data-use': null,
				'data-replace': null
			});

			return Promises.when (storage.get (id))
				.then (function (resource) {
					// Get view
					return Promises.when (views.get (resource, tags, use))
						.then (function (view) {
							if (replace) {
								return view.attach ($el [0]);
							} else {
								var $mount = $ ('<div />');
								$el.append ($mount);

								try {
									return view.attach ($mount [0]);
								} catch (e) {
									console.error (e.message, view.templates ? view.templates.id : view);
									throw e;
								}
							}
						});
				})
				.fail (function (error) {
					var info = {
							bind: id,
							tags: tags || null,
							use: use || null,
							el: el,
							error: error,
							message: error.message,
							stack: error.stack
					};
					
					console.error ('not rendered', info);

					return el;
				});
		},

		monitorCSS: function () {
			_.each (this.themes, function (theme) {
				var rev = theme.get ('_rev');

				theme.on ('change', _.throttle (function updateCss () {
					if (rev == this.get ('_rev')) {
						return;
					} else {
						rev = this.get ('_rev');
					}

					var link = this.get ('_link') + '/styles.css',
						attachments = this.get ('_attachments');

					if (!attachments || !attachments ['styles.css']) {
						return;
					}

					$ ('link[rel=stylesheet]').each (function () {
						var $this = $ (this)

						if ($this.attr ('href').substring (0, link.length) == link) {
							var $link = $this.clone ().attr ('href', link + '?rev=' + rev);

							$link.insertAfter ($this);
							$link.on ('load', function () {
								$this.remove ();
							})
						}
					});
				}, 1000, true));
			}, this);
		}
	});

	return new Render;
});