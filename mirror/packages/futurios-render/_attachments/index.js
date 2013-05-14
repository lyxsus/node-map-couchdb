define (
	[
		'node!vow', 'node!lodash', 'node!dot', 'node!url', 'node!moment',
		'fos!futurios-localize',
		'./temp/iona.helpers.js', './html/tag-attrs.js', './html/decode.js', './temp/wiky.js'
	],
	function (Promises, _, doT, Url, moment, localize, helpers, attrs, decode_html, wiky) {
		global.Wiky = wiky;
		global.moment = moment;
		global.moment.lang ('ru');

		doT.templateSettings.varname = 'the';
		doT.templateSettings.strip 	 = true;

		function parse (el) {
			var _attrs = attrs (el);

			var parsed = {
				bind: _attrs ['data-bind'] ? decode_html (_attrs ['data-bind']) : null,
				tags: _attrs ['data-tags'] || null,
				use: _attrs ['data-use'] ? decode_html (_attrs ['data-use']) : null,
				replace: _attrs ['data-replace'] == 'true'
			};

			if (parsed.replace) {
				parsed.suffix = parsed.prefix = '';
			} else {
				parsed.prefix = el
								.replace (/data-[A-z]+=["']([^"']+)["']/g, '')
								.replace (/[ ]+/g, ' ')
								.replace (/ ?\/?>$/, '') + '>';
				
				parsed.suffix = '</' + parsed.prefix.match (/<([A-z0-9]+)/) [1] + '>';
			}

			return parsed;
		}


		function Renderer (engine) {
			this.engine = engine;
			this.client = engine.client;
			this.resources = engine.client.resources;
			this.themes = engine.host.get ('theme');
		};

		_.extend (Renderer.prototype, {
			html: function (options) {
				var html = '<html data-bind="' + this.engine.host.id + '" data-tags="boot" data-replace="true" />';

				return Promises.when (this.initialize (options))
					.then (_.bind (function () {
						return this.scan (html);
					}, this));
			},

			initialize: function (options) {
				var engine = this.engine,
					client = engine.client,
					name = client.user.get ('name'),
					account = client.user.get ('account') || (name == 'nobody' ? null : ('accounts/' + name)),
					database = client.user.get ('database') || ('users/' + client.name),
					roles = client.user.get ('roles'),
					userCtx;

				if (name == 'nobody') {
					userCtx = {
						name: null,
						roles: []
					};
				} else {
					userCtx = {
						name: name,
						account: account,
						database: database,
						roles: roles
					};
				}

				this.ctx = {
					page_uri: engine.resource.id,
					vhost: engine.host.id,

					session: {
						account: account,
						userCtx: userCtx
					},

					migrationFlag: 1
				};

				this.ctx = _.extend (this.ctx, options);

				this.initGlobals ();

				this.helpers = _.extend ({}, helpers);

				return Promises.when (this.serialize (this.engine.resource))
					.then (_.bind (function (data) {
						this.helpers = _.extend (this.helpers, {
							pageUri: function () {
								return engine.resource.id;
							},

							getPage: function () {
								return data;
							}
						});
					}, this));
			},

			initGlobals: function () {
				global._ = _;

				global.location = '';
			},

			scan: function (fragment) {
				var fragments = this.fragments (fragment);

				if (fragments.length == 0) {
					return fragment;
				}

				return Promises.all (
					_.map (fragments, this.render, this)
				)
					.fail (console.error)
					.then (function (outs) {
						var parsed;

						for (var i in outs) {
							parsed = outs [i];
							fragment = fragment.replace (fragments [i], parsed.prefix + parsed.html + parsed.suffix);
						}
						return fragment;
					})
					.then (_.bind (this.scan, this));
			},

			fragments: function (fragment) {
				return _.uniq (
					_.filter (fragment.match (/<[^>]+data-bind[^>]+>/g), function (fragment) {
						return fragment.substring (0, 4) != '<!--';
					})
				);
			},

			render: function (fragment) {
				var parsed = parse (fragment);

				return Promises.when (this.resource (parsed.bind))
					.then (_.bind (this.serialize, this))
					.then (_.bind (function (data) {
						return Promises.when (this.template (parsed, data))
							.then (_.bind (function (template) {
								if (template) {
									return this.compile (template, data, parsed);
								} else {
									return 'template not found';
								}
							}, this));
					}, this))
					.fail (console.error)
					.then (function (rendered) {
						return _.extend (parsed, {
							html: rendered
						});
					})
			},

			compile: function (template, data, parsed) {
				var source = template.get ('html'),
					result;

				try {
					var data = data;
					data.ctx = this.ctx;
					data._use = parsed.use || '';
					data._page_uri = this.engine.resource.id;
					data.makeUrn = this.helpers.makeUrn;
					data.helpers = this.helpers;

					// TODO: Localization hack

					return doT.template (source).call (this.helpers, data);
				} catch (e) {
					console.error (template.id, e.message);
					console.error (source);

					return '<span>[broken template]</span>';
				}
			},

			serialize: function (resource) {
				var data = _.extend ({
					_link: this.helpers.urn2link (resource.id)
				}, resource.getSource ().data);

				if (this.ctx.device.type == 'bot') {
					return Promises.when (this.fetchType (data))
						.then (function (type) {
							return _.extend (data, {
								_type: type
							});
						})
						.then (_.bind (this.fetchPrefetch, this))
						.then (function (prefetch) {
							return _.extend (data, {
								_prefetch: prefetch
							});
						});
				} else {
					return data;
				}
			},

			fetchType: function (data) {
				if (data.type == data._id) {
					return data;
				} else {
					return Promises.when (this.resources.get (data.type))
						.then (function (resource) {
							return resource.getSource ().data;
						});
				}
			},

			fetchPrefetch: function (data) {
				var fields = _.filter (data._type.fields, function (field) {
					return field.prefetch;
				});

				if (!fields || !fields.length) {
					return;
				}

				var fetch = _.bind (function (urn) {
					return Promises.when (this.resources.get (urn))
						.then (function (resource) {
							return resource.json ();
						})
				}, this);

				return Promises.all (
					_.map (fields, function (field) {
						var value = data [field.name];

						if (typeof value == 'string') {
							return fetch (value);
						} else if (value && value.length) {
							return Promises.all (_.map (value, fetch));
						}
					}, this)
				)
					.then (function (prefetched) {
						var result = {};

						for (var i in prefetched) {
							result [fields [i].name] = prefetched [i];
						}

						return result;
					})
			},

			resource: function (urn) {
				return this.resources.get (urn);
			},

			template: function (parsed, data) {
				var	urn = Url.format ({
					pathname: 'urn:templates',
					query: {
						theme: this.themes.join (','),
						target: data.rows ? 'collection' : 'document',
						type: data.type,
						role: parsed.tags
					}
				}),	resources = this.resources;

				return Promises.when (resources.get (urn))
					.then (function (templates) {
						var first = _.first (templates.get ('rows'));

						if (first) {
							return resources.get (first.id);
						} else {
							throw new Error ('Not found template for ' + urn);
						}
					});
			},

			dispose: function () {
				this.engine = null;
				this.client = null;
				this.resources = null;
				this.themes = null;
				this.ctx = null;
				this.helpers = null;
			}
		});

		return Renderer;
	}
);
