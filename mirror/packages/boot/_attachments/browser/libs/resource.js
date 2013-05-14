define (['fos!lodash', 'fos!promises', 'fos!boot/browser/connection.js', 'fos!boot/browser/libs/mixin.js', 'fos!boot/browser/libs/prefetch.js', 'fos!boot/browser/libs/helpers.js'], function (_, Promises, connection, mixin, prefetch, helpers) {
	function Resource (resources, id) {
		this.change = _.bind (this.change, this);

		this.resources = resources;
		this.collection = resources; // TODO: Remove
		this.id = id;

		this.setMaxListeners (0);
	}

	mixin (Resource);

	_.extend (Resource.prototype, {
		_events: null,
		id: null,
		attributes: null,
		_models: null,

		disposeDelay: 15 * 1000,	// * ~60 secs

		fetch: function () {
			if (this.attributes) {
				return this.attributes;
			} else {
				return connection.get (this.id);
			}
		},

		fetched: function (attrs) {
			if (!attrs) {
				console.log ('empty attrs', this.id, attrs);
				return;	// TODO: debug this
			}

			if (this.attributes) {
				_.extend (this.attributes, attrs);
			} else {
				this.attributes = attrs;
			}
			
			this.attributes._link = helpers.urn2link (this.id);

			return prefetch (this);
		},

		change: function () {
			if (this.get ('_deleted')) {
				this.release ();
			}

			this.emit ('change');
		},

		get: function (key) {
			if (key == '_prefetch') {
				return this._prefetch;
			}

			if (key == '_type') {
				return this._type;
			}

			if (this.attributes) {
				return this.attributes [key];
			} else if (!this.error) {
				console.error ('Getting property on unloaded resource', this);
			}
		},

		set: function (data, options) {
			if (typeof data == 'string') {
				throw new Error ('resource.set supports only hash (deprecated)');
			}

			if (this.attributes) {
				_.extend (this.attributes, data);
			} else {
				this.attributes = data;
			}
			
			if (!options || !options.silent) {
				prefetch (this)
					.fail (function (error) {
						console.error ('Failed to prefetch updated resource', error);
					})
					.then (prefetch (this))
					.always (this.change)
					.done ();
			} else if (options && options.silent) {
				this.emit ('silent');
			}
		},

		has: function (key) {
			return this.attributes [key] !== undefined;
		},

		unset: function (key, options) {
			if (this.attributes) {
				this.attributes [key] = undefined;

				if (!options || !options.silent) {
					prefetch (this)
						.always (_.bind (function () {
							this.change ();
						}, this))
						.done ();
				} else if (options && options.silent) {
					this.emit ('silent');
				}
			}
		},

		destroy: function () {
			return this.save ({_deleted: true});
		},

		save: function (data, settings) {
			if (data && _.size (data)) {
				this.set (data, settings);
			}

			return connection.save (this.attributes)
				.then (_.bind (this.returnNotReady, this))
				.then (_.bind (this.ready, this))
				.fail (function (error) {
					if (settings && settings.error) {
						settings.error (error);
					}
				})
				.then (function (resource) {
					if (settings && settings.success) {
						settings.success (resource);
					}
					return resource;
				});
		},

		toJSON: function () {
			var expandJSON = function (prefetched) {
				if (!prefetched) return prefetched;

				var result = {};

				for (var i in prefetched) {
					if (!prefetched [i]) continue;
					
					if (prefetched [i].toJSON) {
						result [i] = prefetched [i].toJSON ();
					} else {
						var val = [];
						for (var j = 0, resource; j < prefetched [i].length; j++) {
							if (!prefetched [i]) continue;
							
							resource = prefetched [i] [j];

							if (resource && resource.toJSON) {
								val.push (resource.toJSON ());
							}
						}

						result [i] = val;
					}
				}

				return result;
			};

			try {
				return _.extend ({
					_type: this._type.attributes,
					_prefetch: expandJSON (this._prefetch)
				}, this.attributes);
			} catch (e) {
				console.error ('Failed to expand', this.id, e.message, e.stack);
				throw e;
			}
			
		},

		models: function () {
			return this._models;
		},

		dispose: function () {
			this.resources.unset (this);

			_.each (this.models, function (model) {
				model.release (this);
			}, this);

			this._models = null;

			// TODO: Fix that
			_.each (this._prefetch, function (value) {
				if (!value) return;

				if (value.release) {
					value.release (this);
				} else {
					_.each (value, function (model) {
						model.release (this);
					}, this);
				}
			}, this);

			if (this._type) {
				this._type.release (this);
				this._type = null;
			}

			this._prefetch = null;

			this.resources = null;
			this.collection = null;
			this.attributes = null;

			this.change = null;
		},

		each: function (iterator) {
			return _.each (this.models (), iterator);
		},

		map: function (iterator) {
			return _.map (this.models (), iterator);
		},

		max: function (iterator) {
			return _.max (this.models (), iterator);
		},

		last: function (iterator) {
			return _.last (this.models (), iterator);
		},

		find: function (iterator) {
			return _.find (this.models (), iterator);
		},

		first: function (iterator) {
			return _.first (this.models (), iterator);
		},

		filter: function (iterator) {
			return _.filter (this.models (), iterator);
		},

		pluck: function (iterator) {
			return _.pluck (this.models (), iterator);
		},


		trigger: function () {
			return this.emit.apply (this, arguments);
		},

		validateField: function (name, value) {
			var prefetched = this.get ('_prefetch') || {};
			
			prefetched.type = this.get ('_type');

			var field = helpers.getField (this, name);

			if (!field || !field.validate) {
				return true;
			}

			try {
				// TODO: Use evaulator
				var fun = eval ('(' + field.validate + ')');

				if (typeof fun == 'function') {
					return fun (value, field, this.attributes);
				} else {
					console.warn ('field has no validate function', field);
					return true;
				}
			} catch (e) {
				console.error (e.message, e.stack);
			}
			return true;
		}
	});

	return Resource;
});
