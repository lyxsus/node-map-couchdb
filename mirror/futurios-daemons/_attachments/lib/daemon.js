define (['node!os', 'node!lodash', 'node!vow', './logger', 'node!q', './evaluate'], function (os, _, Promises, Logger, Q) {
	var e = encodeURIComponent;

	function Daemon (daemons, source) {
		this.source = source;

		this.logger = new Logger ({
				related: [source._id]
		}, _.bind (function (data) {
				var e = encodeURIComponent;

				data.type = 'urn:types/log';

				var options = {
						path: '/' + e ('sys/logs') +
								'/_design/' + e ('urn:logs') +
								'/_update/' + e (data.type),
						method: 'POST',
						data: data
				};
	
				this.request (null, options, function (error) {
						if (error) {
								console.error (error);
						}
				});
		}, this));

		this.hostname = os.hostname ();

		this._daemons = daemons;
		this._compile ();
	};

	_.extend (Daemon.prototype, {
			start: function () {
					console.log ('Start daemon', this.source._id);
			},

			stop: function () {
					console.log ('Stop daemon', this.source._id);
			},

			notify: function () {
					console.error ('Notify function not implemented in daemon', this.source._id);
			},
			
			filter: function () {
					return true;
			},

			request: function (consumer, options, callback) {
					return this._daemons._request (consumer, options, callback);
			},

			_compile: function () {
					var source = this.source,
							compile = source.compile || [];

					_.each (source, function (value, index) {
							if (['start', 'stop', 'notify', 'filter'].indexOf (index) == -1) {
									if (compile.indexOf (index) == -1) {
											return;
									}
							}

							try {
									var fun = eval ('(' + value + ')');
									this [index] = function () {
											try {
													return fun.apply (this, arguments);
											} catch (e) {
													console.error ('Failed to execute', source._id, index, e);
											}
									};
							} catch (e) {
									console.error ('Failed to compile', source._id, index, e.message);
							}
					}, this);
			},
			
			get: function (origin, id) {
					var path = _.map (['', origin, id], e).join ('/');

					var deferred = Q.defer ();

					this.request (null, {path: path}, deferred.makeNodeResolver ());

					return deferred.promise;
			},

			update: function (data) {
					var app = data._id.split ('/') [0],
							meta = data.meta,
							origin = meta.last_updated_origin || meta.origin;

					return this.save (origin, app, data);
			},

			save: function (origin, app, data) {
					var arr = ['', origin];

					if (app) {
							arr.push ('_design');
							arr.push (app);
							arr.push ('_update');
							arr.push (data.type);
					}

					if (data._id) {
							arr.push (data._id);
					}

					var options = {
							path: _.map (arr, e).join ('/'),
							method: data._id ? 'PUT' : 'POST',
							data: data
					};

					var deferred = Q.defer ();
					this.request (null, options, deferred.makeNodeResolver ());
					return deferred.promise;
			}
	});

	return Daemon;
});
