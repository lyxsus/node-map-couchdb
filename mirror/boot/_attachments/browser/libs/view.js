define (['fos!doT', 'fos!promises', 'fos!boot/browser/libs/mixin.js', 'fos!boot/browser/libs/helpers.js', 'fos!boot/browser/storage.js', 'fos!boot/browser/libs/evaluate.js', 'fos!lru-cache'], function (doT, Promises, mixin, helpers, storage, evaluate, LRU) {
	doT.templateSettings.varname = 'the';
	doT.templateSettings.strip 	 = false;

	var REUSE_DETACHED = true;	// TODO: Disabled for a while

	var eventSplitter = /^(\S+)\s*(.*)$/;

	var ctx = {
		session: {
			account: (userCtx.account == 'urn:accounts/nobody') ? null : userCtx.account
		}
	};

	var cache = LRU ({
		max: 50
	});

	function compileDot (template) {
		var key = template.get ('_rev'),
			result = cache.get (key);

		if (!result) {
			result = doT.compile (template.get ('html'));
			cache.set (key, result);
		}

		return result;
	}

	function nodeNS ($node) {
		var ns = $node.attr ('xmlns'),
			attrs;

		if (ns) {
			attrs = {};

			$.each ($node.prop ('attributes'), function () {
				if (this.specified && this.name != 'xmlns') {
					attrs [this.name] = this.value;
				}
			});

			return $ (document.createElementNS (ns, $node.prop ('tagName').toLowerCase ()))
				.attr (attrs);
		} else {
			return $node;
		}
	}

	function View (views, id, resource, role, use) {
		this.id = id;

		this.views = views;
		this.resource = resource.lock (this);
		this.role = role;
		this.use = use;

		// TODO: Remove this (only for workspaces v.3)
		this.options = {
			resource: resource
		};

		this.attached = [];
		this.detached = [];
		this.deps = [];

		// this.onChangeTemplates = _.throttle (_.bind (this.onChangeTemplates, this), 75, true);
		// this.onChangeTemplate = _.throttle (_.bind (this.onChangeTemplate, this), 75, true);
		// this.onChangeResource = _.throttle (_.bind (this.onChangeResource, this), 75, true);

		this.onChangeTemplates = _.bind (this.onChangeTemplates, this);
		this.onChangeTemplate = _.bind (this.onChangeTemplate, this);
		this.onChangeResource = _.bind (this.onChangeResource, this);

		this.onSilentChangeResource = _.bind (this.onSilentChangeResource, this);

		this.releaseDetached = _.debounce (_.bind (this.releaseDetached, this), 500);
	};

	mixin (View);

	_.extend (View.prototype, {
		id: null,
		templates: null, template: null,
		events: null,

		compiled: null,
		frag: null,
		events: null,

		views: null, resource: null, role: null, use: null,
		deps: null, attached: null, detached: null,

		releasingDetached: null,

		iteration: 0,

		onChangeTemplates: function () {
			if (this.template) {
				this.template.removeListener ('change', this.onChangeTemplates);
				this.template = null;
			}
			
			this.onChangeTemplate ();
		},

		onChangeTemplate: function () {
			this.removeNodes (this.detached);
			this.compile (true);
		},

		onChangeResource: function () {
			if (this.frag) {
				this.removeNode (this.frag, true);
				this.frag = null;

				this.removeNodes (this.detached);
			}

			if (this.attached.length > 0) {
				this.render (true);
			}
		},

		removeNodes: function (arr) {
			var el;
			while (el = arr.pop ()) {
				this.removeNode (el);
			}
		},
		
		removeNode: function (el, noDetach) {
			if (!noDetach) {
				this.detachNodes (el);
			}

			$.data (el, 'view', null);
			$ (el).remove ();
		},

		detachNodes: function (el) {
			var queue = $ (el).children ().toArray ();

			while (el = queue.pop ()) {
				var view = $.data (el, 'view');
				if ((view === undefined) || (view === this)) {
					queue = queue.concat ($ (el).children ().toArray ());
				} else {
					view.detach (el);
				}
			}
		},

		disposeDelay: 60 * 1000,

		fetch: function () {
			var resource = this.resource;

			var	urn = helpers.makeUrn ('urn:templates', {
				theme: this.views.themes,
				target: resource.get ('rows') ? 'collection' : 'document',
				type: resource.get ('type'),
				role: this.role
			});

			return storage.get (urn);
		},

		fetched: function (templates) {
			this.templates = templates.lock (this);

			// monitor template changes
			templates.on ('change', this.onChangeTemplates);

			// monitor resource changes
			this.resource.on ('change', this.onChangeResource);
			this.resource.on ('silent', this.onSilentChangeResource);

			this.compile ();
		},

		compile: function (render) {
			if (this.disposing) {
				return false;
			}

			var template = this.getTemplate ();

			try {
				if (template) {
					this.compiled = compileDot (template);
				} else {
					this.compiled = doT.compile ('<div>template not found</div>');
				}

			} catch (e) {
				console.error (e.message);
			}

			this.events = this.compileEvents (template ? template.get ('events') : null);

			if (render) {
				return this.render (true);
			}
		},

		getTemplate: function () {
			if (this.template) {
				return this.template;
			}

			var template = this.bestTemplate ();
			
			if (template) {
				template.on ('change', this.onChangeTemplate);
				this.template = template;
			}

			return template;
		},

		bestTemplate: function () {
			if (this.template) {
				return this.template;
			}

			var rows = this.templates.get ('rows'),
				models = this.templates.models (),
				template;

			if (rows.length <= 1) {
				return models [0];
			}

			// Find best match
			var index = 0;

			for (var i = 0, p = 0, c; i < rows.length; i++) {
				c = rows [i].value;
				if (c >= p) {
					p = c;
					index = i;
				}
			}

			return models [index];
		},

		compileEvents: function (events) {
			if (!events || _.size (events) == 0) {
				return null;
			}

			var compiled = {},
				view = this,
				resource = this.resource,
				templatesId = this.templates.id;

			_.each (events, function (source, index) {
				compiled [index] = function (e, el) {
					try {
						return evaluate (source, {
							Promises: Promises
						}).call (this, e, view, resource, el);
					} catch (e) {
						console.error ('Failed execute event', e.message, resource.id, templatesId, e.stack);
						throw e;
					}
				}
			});

			return compiled;
		},

		render: function (repopulate) {
			if (this.resource.disposing || this.resource.get ('_deleted')) {
				if (!this.disposing) {
					this.release (true);
				}
				return;
			}

			var data = _.extend ({
				helpers: helpers,
				makeUrn: helpers.makeUrn,
				_use: this.use,
				ctx: ctx
			}, this.resource.toJSON ()), rendered;

			data.ctx.page_uri = require ('futurios/settings').page_uri;
			data.ctx.page = require ('futurios/settings').page;

			try {
				rendered = this.compiled (data)
					.replace (/(^[ \t\r\n]+|[ \t\r\n]+$)/, '');
			} catch (e) {
				console.error (this.resource.id, this.templates.id, e.message, e.stack);
				rendered = '<span>[broken template]</span>';
			}

			try {
				var $rendered = nodeNS ($ (rendered));

				if ($rendered.size () == 1) {
					this.frag = $rendered;
				} else {
					var frag = document.createDocumentFragment ();

					$rendered.each (function () {
						frag.appendChild (this);
					});

					this.frag = frag;
				}
			} catch (e) {
				console.error ('Failed to compile template', e.message, e.stack);
			}

			this.iteration += 1;

			if (repopulate) {
				return this.repopulate ();
			}
		},

		delegateEvents: function ($el) {
			if (!this.events) return;

			_.each (this.events, function (callback, index) {
				var match = index.match (eventSplitter),
					listener = function (e) {
						return callback (e, $el [0]);
					};

				if (match [2]) {
					$el.on (match [1], match [2], listener);
				} else {
					$el.bind (match [1], listener);
				}
			}, this);
		},

		attach: function (el) {
			this.lock (true);

			if (this.attached.indexOf (el) === -1) {
				this.attached.push (el);
				$.data (el, 'view', this);

				return this.populate (el);
			} else {
				console.log ('already attached');
				return el;
			}
			
		},

		detach: function (el) {
			var i = this.attached.indexOf (el);

			if (i === -1) {
				console.warn ('Could not find element to detach');
			} else {
				this.attached.splice (i, 1);
			}

			if (REUSE_DETACHED) {
				$ (el).detach ().unbind ();
				this.detached.push (el);

				if (!this.releasingDetached) {
					this.releasingDetached = true;
					this.releaseDetached ();
				}
			} else {
				this.removeNode (el);
			}
			

			if (this.attached.length === 0) {
				this.release (true);
			}
		},

		releaseDetached: function () {
			this.releaseDetached = false;
			this.removeNodes (this.detached);
		},

		populate: function (el) {
			if (this.attached.indexOf (el) === -1) {
				console.warn ('Trying to populate unattached element');
				return;
			}

			var $frag;

			if (this.detached.length) {
				$frag = $ (this.detached.pop ());
				this.delegateEvents ($frag);
				return this.replace (el, $frag);
			} else {
				$frag = this.fragment ();
				
				if (!$frag) return null;

				var self = this,
					iteration = this.iteration;

				return this.views.render.scan ($frag)
					.always (function () {
						if (self.iteration > iteration || self.disposing) {
							self.detachNodes ($frag [0]);
							return el;
						} else {
							return self.replace (el, $frag);
						}
					})
					.fail (function (error) {
						if (error.message) {
							console.log ('some render problems', error.message, error.stack);
						} else {
							console.log ('some render problems', error);
						}						
					});
			}
		},

		repopulate: function () {
			_.each (this.attached, this.populate, this);
		},

		replace: function (el, $frag) {
			var $el = $ (el),
				i = this.attached.indexOf (el);

			if (i === -1) {
				this.detached.push ($frag [0]); 
				return el;
			} else {
				this.attached [i] = $frag [0];
			}

			this.detachNodes (el);

			if (this.events && this.events ['before:populate']) {
				$frag.trigger ($.Event ('before:populate', {
					previousNode: $el
				}));
			}

			$el.replaceWith ($frag);
			
			this.removeNode ($el [0], true);

			$el = null;
			el = null;

			if ($.contains (document.documentElement, $frag [0])) {
				this.populated ($frag);
			}

			return $frag;
		},

		populated: function ($el) {
			$el.trigger ($.Event ('after:populate'));

			$el.find (':binded').each (function (index, el) {
				$ (el).trigger ($.Event ('after:populate'));
			});
		},

		fragment: function () {
			if (!this.frag) {
				this.render ();
			}

			if (!this.frag) {
				return;
			}

			var $clone;

			if (this.frag.nodeType == 11) {
				throw new Error ('TODO: DOMDocumentFragment');
			} else {
				$clone = this.frag.clone (true, true);
				$.data ($clone [0], 'view', this);
			}

			this.delegateEvents ($clone);

			return $clone;
		},

		sideEffect: function (dep) {
			if (dep) {
				if (dep.once) {
					this.addDepency (dep);
				} else if (typeof dep == 'string') {
					Promises.when (storage.get (dep))
						.then (_.bind (function (dep) {
							this.addDepency (dep);
						}, this))
						.done ();
				}
			}
		},

		addDepency: function (dep) {
			if (this.deps.indexOf (dep) === -1) {
				this.deps.push (dep);
				
				dep.removeListener ('change', this.onChangeResource);
				dep.on ('change', this.onChangeResource);
			}
		},

		isFree: function () {
			return this.attached.length === 0;
		},

		onSilentChangeResource: function () {
			this.removeNodes (this.detached);

			this.compile ();
		},

		dispose: function () {
			this.views.unset (this);

			if (this.resource) {
				this.resource.release (this);
				this.resource.removeListener ('change', this.onChangeResource);
				this.resource = null;
			}
			

			if (this.templates) {
				this.templates.release (this);
				this.templates.removeListener ('change', this.onChangeTemplates);
				this.templates = null;
			}

			if (this.template) {
				this.template.removeListener ('change', this.onChangeTemplate);
				this.template = null;
			}
			
			this.events = null;

			this.removeNodes (this.attached);
			this.removeNodes (this.detached);

			if (this.frag) {
				this.removeNode (this.frag, true);
				this.frag = null;
			}

			_.each (this.deps, function (dep) {
				dep.removeListener ('change', this.onChangeResource);
				this.deps = null;
			}, this);

			this.views = null;

			this.compiled = null;
			this.options = null;

			this.events = null;

			this.onChangeTemplates = null;
			this.onChangeTemplate = null;
			this.onChangeResource = null;
			this.onSilentChangeResource = null;

			this.releaseDetached = null;
		}
	});

	return View;
});