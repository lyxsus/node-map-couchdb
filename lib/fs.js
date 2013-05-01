var _ = require ('lodash'),
	fs = require ('fs'),
	Promises = require ('vow'),
	Path = require ('path'),
	watch = require ('watch'),
	bw = require ('buffered-writer');


module.exports = {
	stat: function (path) {
		var promise = Promises.promise ();

		fs.stat (path, function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				promise.fulfill (result);
			}
		});

		return promise;
	},

	mkdir: function (path, mode) {
		var promise = Promises.promise ();

		fs.mkdir (path, mode, function (error, result) {
			if (error) {
				if (error.code == 'EEXIST') {
					promise.fulfill ();
				} else {
					promise.reject (error);
				}
			} else {
				promise.fulfill (result);
			}
		});

		return promise;
	},

	rmkdir: function (path, mode) {
		var self = this,
			parent = Path.dirname (path);

		return this.stat (parent)
			.fail (function (error) {
				if (error.code == 'ENOENT') {
					return self.rmkdir (parent);
				} else {
					return Promises.reject (error);
				}
			})
			.then (function () {
				return self.mkdir (path, mode);
			})
	},

	rmdir: function (path) {
		var promise = Promises.promise ();

		fs.rmdir (path, function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				promise.fulfill (result);
			}
		});

		return promise;
	},

	writeFile: function (path, body, encoding) {
		var promise = Promises.promise ();

		fs.writeFile (path, body, encoding, function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				promise.fulfill (result);
			}
		});

		return promise;
	},

	readdir: function (path) {
		var promise = Promises.promise ();

		fs.readdir (path, function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				promise.fulfill (result);
			}
		});

		return promise;
	},

	unlink: function (path) {
		var promise = Promises.promise ();

		fs.unlink (path, function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				promise.fulfill (result);
			}
		});

		return promise;
	},

	scanfiles: function (path) {
		var promise = Promises.promise (),
			self = this,
			paths = [];

		var scan = function (path) {
			return self.readdir (path)
				.then (function (list) {
					return Promises.all (
						_.map (list, function (name) {
							var item = path + '/' + name;

							return self.stat (item)
								.then (function (stat) {
									if (stat.isFile ()) { // file
										paths.push (item);
									}

									if (stat.isDirectory ()) { // folder
										return scan (item);
									}
								})
						})
					);
				});
		};

		return scan (path)
			.always (function () {
				var l = path.length + 1;

				return _.map (paths, function (i) {
					return i.substring (l);
				});
			});
	},

	writeBuffer: function (path, buffer) {
		return this.rmkdir (Path.dirname (path))
			.then (function () {
				var promise = Promises.promise ();

				bw.open (path)
					.on ('error', _.bind (promise.reject, promise))
					.write (buffer)
					.close (_.bind (promise.fulfill, promise));

				return promise;
			});
	},

	readFile: function (path) {
		var promise = Promises.promise ();

		fs.readFile (path, function (error, result) {
			if (error) {
				promise.reject (error);
			} else {
				promise.fulfill (result);
			}
		})

		return promise;
	},

	watch: function (path, callback) {
		watch.createMonitor (path, function (monitor) {
			['created', 'changed', 'removed'].forEach (function (event) {
				monitor.on (event, _.partial (callback, event));
			});
		});
		// watch.watchTree (path, callback);
	},

	createReadStream: fs.createReadStream
}