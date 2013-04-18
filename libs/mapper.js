var parseUrl = require ('url').parse,
	cradle = require ('cradle'),
	_ = require ('lodash'),
	EventEmitter = require ('events').EventEmitter,
	fs = require ('./fs'),
	Promises = require ('vow'),
	mime = require ('mime');


function parseRev (rev) {
	return parseInt (rev.split ('-') [0] || 0);
}


module.exports = function (connstr, folder) {
	var parsed = parseUrl (connstr),
		auth = parsed.auth.split (':'),
		database = decodeURIComponent (parsed.path.substring (1));

	this.connection = new (cradle.Connection) (parsed.protocol + '//' + parsed.hostname, parsed.port, {
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
				}, 100);
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
					_.map (list, function (name) {
						var path = folder + '/' + name;

						// Check, if it's a folder
						return fs.stat (path)
							.then (function (stat) {
								if (!stat.isDirectory ()) return;

								var id = decodeURIComponent (name);

								// Get attachments from local fs
								return fs.scanfiles (path + '/_attachments')
									.then (function (files) {
										// Get document json from fs
										return fs.readFile (path + '/index.js')
											// Remove deleted attachments and save update doc to database
											.then (function (buffer) {
												var doc = JSON.parse (buffer.toString ('utf-8'));

												if (doc._attachments) {
													delete doc._attachments;
												}

												return self.saveDoc (doc)
													.fail (console.error)
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
													});
											});
									});
							})
					})
				);
			})
			.always (function () {
				_.delay (function () {
					self.pushing = false;
				}, 100);
			});
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
			self = this;

		database.info (function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				var feed = database.changes ({since: result.update_seq});
				feed.on ('change', function (event) {
					if (!self.pulling && self.cache [event.id]) {
						var promise = self.pull ();
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

		fs.watch (this.folder, function () {
			var promise = self.push ();
			if (promise) {
				promise
					.fail (console.error)
					.done ();
			}
		});
	},

	pullDoc: function (doc) {
		var folder = this.folder + '/' + encodeURIComponent (doc._id),
			file = folder + '/index.js',
			self = this;

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
								});
						})
					)
				);
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