define (['node!lodash', 'node!vow', 'node!socket.io', 'node!lru-cache', 'fos!futurios-hash', './keywords', './prefetch'], function (_, Promises, SocketIO, LRU, hash, checkKeywords, prefetch) {
	function SyncMaster (client) {
		this.client = client;
		this.resources = client.resources;
		this.slaves = [];	// <- [{socket, features}]

		this.subTasksCache = LRU (1000);
		this.entriesCache = LRU (1000);


		this.resources.get (this.source)
			.then (_.bind (this.initialize, this))
			.fail (function (error) {
				console.log ('Could not get tasks queue', error);
			})
			.done ();
	};


	function compact (obj) {
		var result = {};

		for (var i in obj) {
			if (i == 'id') continue;
			if (obj [i] === undefined) continue;

			result [i] = obj [i];
		}

		return result;
	}

	function strip_tags (input, allowed) {
		if (typeof input != 'string') {
			return input;
		}

	    allowed = (((allowed || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
	    var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
	        commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
	    return input.replace(commentsAndPhpTags, '').replace(tags, function ($0, $1) {
	        return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
	    }).replace (/<(\w+)[^>]+>/g, '<$1>');
	}


	_.extend (SyncMaster.prototype, {
		source: 'urn:fos:sync:task?status=urn%3Afos%3Async%3Atask-status%2Fpending&limit=1',
		client: null,
		tasks: null,
		slaves: null,

		initialize: function (tasks) {
			this.tasks = tasks;

			this.fetch = _.throttle (_.bind (this.fetch, this), 1500, true);
			// this.fetch = _.bind (this.fetch, this);

			tasks.on ('change', this.fetch);
			this.fetch ();
		},

		fetch: function () {
			var rows = this.tasks.get ('rows'),
				client = this.client;

			_.each (rows, function (row) {
				Promises.when (this.resources.get (row.id))
					.then (function (resource) {
						return prefetch (client, resource);
					})
					.then (_.bind (this.delegate, this))
					.fail (function (error) {
						console.log ('Could not delegate task to slave', error);
					})
					.done ();
			}, this);
		},

		delegate: function (task) {
			var feature = task.get ('feature');

			var slave = _.find (this.slaves, function (slave) {
				var settings = slave.settings;

				return settings && (settings.status == 'free' || settings.status == 'ready') && (settings.features.indexOf (feature) !== -1);
			});

			if (!slave) {
				console.error ('No slave to delegate task', task.id, 'with feature', feature);
				return false;
			};

			console.log ('delegate task', task.id, 'to slave');

			var self = this,
				promises = [];

			return task.save ({
				status: 'urn:fos:sync:task-status/running'
			})
				.then (function () {
					if (slave.tasks.indexOf (task) === -1) {
						slave.tasks.push (task);

						var removeTask = function () {
							slave.tasks = _.without (slave.tasks, task);
						};

						// TODO: Add error/entry namespace prefix to event name, if required
						slave.socket.on (task.id, function (data) {
							if (data.entry) {
								promises.push (
									self.handleEntry (task, data.entry)
								);
							}

							if (data.error) {
								slave.socket.removeAllListeners (task.id);
								removeTask ();

								task.save ({
									status: 'urn:fos:sync:task-status/failed',
									errors: data.error
								});
							}

							if (data.status) {
								slave.socket.removeAllListeners (task.id);
								removeTask ();

								Promises.all (promises)
									.then (function () {
										task.save ({
											status: 'urn:fos:sync:task-status/ready',
											errors: null
										});
									});
							}
						});

						slave.socket.emit ('task', task.json ());
					} else {
						console.error ('Task was already delegated to this slave');
					}
				})
				.fail (function (error) {
					console.log ('Could not change task status', error);
				});
		},

		listen: function (server) {
			SocketIO.listen (server)
				.set ('log level', 0)
				.enable ('browser client minification')
				.enable ('browser client etag')
				.enable ('browser client gzip')
				.sockets
					.on ('connection', _.bind (this.handle, this));
		},

		handle: function (socket) {
			var	fetch = _.bind (this.fetch, this),
				slaves = this.slaves,
				desc;

			slaves.push (desc = {
				socket: socket,
				settings: null,
				tasks: []
			});

			console.log ('Slave connected');

			socket
				.on ('settings', function (settings) {
					desc.settings = settings;
					fetch ();
				})

				.on ('disconnect', function () {
					console.log ('Slave disconnected');
					slaves.splice (slaves.indexOf (desc), 1);
				});
		},

		handleEntry: function (task, entry) {
			entry = _.extend (entry, {
				task: task.id,
				bridge: task.get ('bridge')
			});

			if (task.has ('parent-task')) {
				entry.task = task.get ('parent-task');
			}

			entry.content = strip_tags (entry.content, '<blockquote>');

			var self = this;

			var keywords = task.get ('keywords'),
				content = _.compact ([entry.title, entry.content]).join ('\n');

			if (task.get ('scrape-start')) {
				entry.matched = parseInt (task.get ('scrape-start')) <= (entry.created_at * 1000);
			} else {
				entry.matched = true;
			}
			if (keywords && !checkKeywords (keywords, content)) {
				entry.matched = false;
			}

			if (entry.matched === false && !task.has ('parent-task')) {
				return Promises.fulfill (null);
			}

			if (entry.private) {
				entry.matched = false;
			}

			return Promises.when (this.resolveEntry (entry, task))
				.then (function (entry) {
					return self.tagEntry (entry);
				})
				.then (function (entry) {
					return self.saveEntry (entry);
				});
		},

		resolveEntry: function (entry, task) {
			return Promises.all ([
					this.fulfill ('author', entry, task),
					this.fulfill ('recipient', entry, task),
					this.fulfill ('ancestor', entry, task)
				])
				.then (function () {
					return entry;
				});
		},

		tagEntry: function (entry) {
			var resources = this.resources,
				fields = ['tags-task', 'tags-account', 'tags-message', 'tags-issue'];

			function getTags (id) {
				return Promises.when (resources.get (id))
					.then (function (resource) {
						return _.compact (
							_.uniq (
								_.flatten (
									_.map (fields, function (field) {
										return resource.get (field);
									}
								)
							)
						));
					})
					.fail (function (error) {
						if (error) {
							console.error ('Could not get tags from', id, error);
						}
						return null;
					});
			}

			var promises = [];

			if (entry.author) {
				promises.push (
					getTags (entry.author)
						.then (function (tags) {
							entry ['tags-account'] = tags;
						})
				);
			}

			if (entry.task) {
				promises.push (
					getTags (entry.task)
						.then (function (tags) {
							entry ['tags-task'] = tags;
						})
				);
			}

			return Promises.all (promises)
				.always (function () {
					return entry;
				});
		},

		fulfill: function (field, entry, task) {
			var url = entry [field];

			if (url) {
				if (/^urn:/.test (url)) {
					return;
				}

				var cached;
				if (cached = this.entriesCache.get (url)) {
					entry [field] = cached;
					return;
				}

				var self = this;

				return Promises.when (this.explainEntry (url, task))
					.fail (function (error) {
						console.error ('failed to fulfill', error);
						entry [field] = null;
					})
					.then (function (urn) {
						self.entriesCache.set (url, urn);
						entry [field] = urn;
					});
			}
		},

		explainEntry: function (url, task) {
			var self = this;

			return this.lookupSyncId (url)
				.then (function (id) {
					if (id) {
						return id;
					} else {
						return self.subTask (url, task);
					}
				});
		},

		subTask: function (url, task) {
			var promise;

			if (promise = this.subTasksCache.get (url)) {
				return promise;
			} else {
				promise = Promises.promise ();
				this.subTasksCache.set (url, promise);
			}

			var resources = this.resources,
				bridge = task._prefetch.bridge,
				connector = bridge._prefetch.connector,
				subTask = {
					'title': 'explain ' + url,
					'url': url,
					'parent-task': task.id,
					'feature': connector.get ('explain'),
					'status': 'urn:fos:sync:task-status/pending',
					'bridge': task.get ('bridge'),
					'token': task.get ('token'),
					'type': task.get ('type'),

					'keywords': task.get ('keywords'),
					'scrape-start': task.get ('scrape-start')
				},
				self = this;

			// Create new subtask for #task with #feature for @url
			Promises.when (resources.create (subTask))
				.then (function (resource) {
					return self.taskCompleted (resource)
						.always (function () {
							return resource.remove ()
								.fail (function (error) {
									console.error ('failed to remove subtask', error);
								});
						});
				})
				.then (function () {
					return self.lookupSyncId (url);
				})
				.then (function (entry) {
					promise.fulfill (entry);
				})
				.fail (function (error) {
					promise.reject (error);
					console.error ('subtask error', error);
				});

			return promise;
		},

		taskCompleted: function (task) {
			var deferred = Promises.promise ();

			var checkIfCompleted = function () {
				var status = task.get ('status'),
					errors = task.get ('errors');

				if (status == 'urn:fos:sync:task-status/running' || status == 'urn:fos:sync:task-status/pending') {
					return false;
				}

				task.removeListener ('change', checkIfCompleted);

				if (status == 'urn:fos:sync:task-status/ready') {
					console.log ('subttask is ready', task.id);
					deferred.fulfill (task);
				} else {
					deferred.reject (errors);
				}

				return true;
			};

			if (!checkIfCompleted ()) {
				task.on ('change', checkIfCompleted);
			}

			return deferred;
		},

		saveEntry: function (entry) {
			var self = this;

			return this.lookupSyncId (entry.url)
				.then (function (id) {
					if (id) {
						return Promises.when (self.resources.get (id))
							.then (function (resource) {
								var left = compact (_.pick (resource.json (), _.keys (entry))),
									right = compact (entry);

								return _.isEqual (left, right) ? resource : resource.save (entry);
							});
					} else {
						return self.createEntry (entry);
					}
				})
				.fail (function (error) {
					console.log ('Could not save entry', error, entry);
				});
		},

		createEntry: function (entry) {
			if (!entry ['entry-type']) {
				throw new Error ('Emptry entry-type for entry', entry.id);
			}

			var self = this;

			return this.entryTypeAlias (entry ['entry-type'])
				.then (function (type) {
					return self.resources.create (_.extend ({
						type: type
					}, entry));
				})
				.then (function (resource) {
					return self.saveSyncId (resource.get ('url'), resource.id)
						.then (function () {
							return resource;
						});
				});
		},

		lookupSyncId: function (url) {
			var urn = 'urn:fos:sync:entry/' + encodeURIComponent (url);

			return Promises.when (this.resources.get (urn))
				.then (function (entry) {
					return entry.get ('urn');
				})
				.fail (function () {
					return false;
				});
		},

		saveSyncId: function (url, id) {
			return Promises.when (this.resources.create ({
				id: encodeURIComponent (url),
				urn: id,
				type: 'urn:types/futurios-sync-entry'
			}));
		},

		entryTypeAlias: function (entryType) {
			return Promises.when (this.resources.get (entryType))
				.then (function (entryType) {
					return entryType.get ('alias');
				});
		}
	});

	return SyncMaster;
});
