var parseUrl = require ('url').parse,
	cradle = require ('cradle'),
	_ = require ('lodash'),
	EventEmitter = require ('events').EventEmitter,
	fs = require ('./fs'),
	Promises = require ('vow'),
	mime = require ('mime'),
	syncDelay = 4000;


function parseRev (rev) {
	return parseInt (rev.split ('-') [0] || 0);
}


module.exports = function (connstr, folder) {
	var parsed = parseUrl (connstr),
		auth = parsed.auth.split (':'),
		database = decodeURIComponent (parsed.path.substring (1));

	this.connection = new (cradle.Connection) (parsed.protocol + '//' + parsed.hostname, parsed.port, {
		cache: false,
		auth: {
			username: auth [0],
			password: auth [1]
		}
	});

	this.database = this.connection.database (database);
	this.folder = folder;

	this.cache = {};
};

_.extend (module.exports.prototype, EventEmitter.prototype);

_.extend (module.exports.prototype, {
	pushing: false, pulling: false,

	pull: function () {
		if (this.pulling || this.pushing) {
			return;
		} else {
			this.pulling = true;
			console.log ('pull');
		}

		var self = this;

		return this.fetchDocs ()
			.then (function (result) {
				return Promises.all (
					_.map (result, function (row) {
						return self.pullDoc (row.doc);
					})
				)
			})
			.always (function () {
				_.delay (function () {
					self.pulling = false;
				}, syncDelay);
			});
	},

	push: function () {
		if (this.pulling || this.pushing) {
			return;
		} else {
			console.log ('push')
			this.pushing = true;
		}

		var folder = this.folder,
			self = this;

		// Find all document folders
		return fs.readdir (folder)
			.then (function (list) {

				// For each found fs node
				return Promises.all (
					_.map (list, self.pushFolder)
				);
			})
			.always (function () {
				_.delay (function () {
					self.pushing = false;
				}, syncDelay);
			});
	},

	pushFolder: function (name, is_field) {
		var path = this.folder + '/' + name,
			self = this,
			singlePush = false;

		if (!this.pushing) {
			if (this.pulling) {
				return;
			} else {
				this.pushing = true;
				singlePush = true;
			}
		}

		// Check, if it's a folder
		return fs.stat (path)
			.then (function (stat) {
				if (!stat.isDirectory ()) return;

				// Get attachments from local fs
				return fs.scanfiles (path + '/_attachments')
					.then (function (files) {
						return self.assembleDocument (path, is_field)
							.then (function (doc) {

								// if (doc._attachments) {
								// 	delete doc._attachments;
								// }

								delete doc._rev;

								return self.saveDoc (doc)
									.then (function () {
										// Save each attachment one-by-one
										var save = function () {
											if (files.length) {
												var name = files.pop ();
												return self.saveAttachment (doc._id, name, path + '/_attachments/' + name)
													.then (save);
											}
										}

										return save ();
									})
									.fail (function (error) {
										console.error ('Failed to save doc', doc._id, error);
									});
							});
					});
			})
			.always (function () {
				if (singlePush) {
					_.delay (function () {
						self.pushing = false;
					}, syncDelay);
				}
			});
	},

	assembleDocument : function (path, is_field) {		
		if (is_field) {
			return fs.scanfiles (path + '/_fields')
					.then (function (files) {
						var doc = {};

						return Promises.all (
							_.map (files, function (field_file) {
								return fs.readFile (path + '/_fields/' + field_file)
									.then (function (buffer) {
										var value = buffer.toString ('utf-8');

										try {
											value = JSON.parse (value);
										} catch (e) {}

										doc [field_file.replace (/\.js$/, '')] = value;
									});
							})
						)
						.then (function () {
							return doc;
						});

					});
		} else {
			return fs.readFile (path + '/index.js')
				.then (function (buffer) {
					return JSON.parse (buffer.toString ('utf-8'));
				});
		}
	},

	saveDoc: function (doc) {
		var promise = Promises.promise (),
			cache = this.cache;

		this.database.save (doc, function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				cache [result.id] = result.rev;
				promise.fulfill (result);
			}
		});

		return promise;
	},

	watch: function () {
		return Promises.all ([
			this.watchDB (),
			this.watchFS ()
		]);
	},

	watchDB: function () {
		var promise = Promises.promise (),
			database = this.database,
			self = this,
			cache = this.cache;

		database.info (function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				var feed = database.changes ({since: result.update_seq, include_docs: true});
				feed.on ('change', function (event) {
					if (!self.pulling && !self.pushing && self.cache [event.id]) {
						cache [event.id] = event.seq;
						
						var promise = self.pullDoc (event.doc);
						if (promise) {
							promise
								.fail (console.error)
								.done ();
						}
							
					}
				});

				promise.fulfill ();
			}
		});

		return promise;
	},

	watchFS: function () {
		var self = this;

		fs.watch (this.folder, function (event, path) {
			if (self.pushing || self.pulling) {
				return;
			}

			path = path.replace (/\\/g, '/');

			self.pushing = true;

			var is_field = Boolean(~ path.indexOf ('/_fields/'));

			var name = path.substring (self.folder.replace (/^\.\//, '').length + 1);
			name = name.substring (0, name.indexOf ('/'));

			self.pushFolder (name, is_field)
				.then (function () {
					console.log ('Pushed', name, 'because', path, 'has changed');
				}, function (error) {
					console.error ('Failed to push', path, error);
				})
				.always (function () {
					_.delay (function () {
						self.pushing = false;
					}, syncDelay);
				})
				.done ();
		});
	},

	pullDoc: function (doc) {
		var folder = this.folder + '/' + encodeURIComponent (doc._id.split ('/') [1]),
			file = folder + '/index.js',
			self = this,
			singlePull = false;

		if (!this.pulling) {
			if (this.pushing) {
				return false;
			} else {
				this.pulling = true;
				singlePull = true;
			}
		}

		console.log ('Pull', doc._id);

		delete this.cache [doc._id];

		var stringify = function (doc) {
			var data = _.extend ({}, doc);

			delete data._rev;
			delete data._attachments;

			return JSON.stringify (data, null, '\t');
		};

		this.cache [doc._id] = doc._rev;


		return fs.mkdir (folder)
			.then (function () {
				return fs.writeFile (file, stringify (doc), 'utf8');
			})
			.then (function () {
				return fs.mkdir (folder + '/_fields');
			})
			.then (function () {
				return fs.readFile (folder + '/index.js')
					.then (function (buffer) {
						var doc = JSON.parse (buffer.toString ('utf-8')),
							fields_folder = folder + '/_fields/';

						return Promises.all (
							_.map (_.keys (doc), function (field) {
								var value = doc [field];
								if (typeof value == 'object') {
									value = JSON.stringify (value);
								}

								return fs.writeFile (fields_folder + field + '.js', value, 'utf8');
							})
						);
					})
			})
			.then (function () {
				return fs.mkdir (folder + '/_attachments');
			})
			.then (function () {
				return fs.scanfiles (folder + '/_attachments');
			})
			.then (function (list) {
				var needed = _.keys (doc._attachments),
					needless = _.difference (list, needed);

				return Promises.all (
					_.union (
						_.map (needless, function (name) {
							return fs.unlink (folder + '/_attachments/' + name);
						}),

						_.map (needed, function (name) {
							var path = folder + '/_attachments/' + name

							return self.getAttachment (doc._id, name)
								.then (function (buffer) {
									return fs.writeBuffer (path, buffer);
								})
								.fail (function (error) {
									console.error ('Could not get attachment', doc._id, name, error);
								});
						})
					)
				);
			})
			.then (function () {
				return self.getCurrentRevision (doc._id);
			})
			.then (function (rev) {
				self.cache [doc._id] = rev;
			})
			.always (function () {
				if (singlePull) {
					_.delay (function () {
						self.pulling = false;
					}, syncDelay);
				}
			});
	},

	fetchDocs: function (callback) {
		var promise = Promises.promise ();
		
		this.database.all ({startkey: 'a', include_docs: true}, function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				promise.fulfill (result);
			}
		});
		
		return promise;
	},

	getAttachment: function (id, name) {
		var promise = Promises.promise ();

		this.database.getAttachment (id, name, function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				promise.fulfill (result.body);
			}
		});

		return promise;
	},

	getCurrentRevision: function (id) {
		var promise = Promises.promise ();

		this.database.get (id, function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				promise.fulfill (result._rev);
			}
		});

		return promise;
	},

	saveAttachment: function (id, name, path) {
		var promise = Promises.promise (),
			cache = this.cache;

		fs.createReadStream (path).pipe (
			this.database.saveAttachment ({
				_id: id,
				_rev: this.cache [id]
			}, {
				name: name,
				'Content-Type': mime.lookup (path)
			}, function (error, result) {
				if (error) {
					promise.reject (error);
				} else {
					cache [id] = result.rev;

					promise.fulfill (result);
				}
			})
		);

		return promise;
	}
});