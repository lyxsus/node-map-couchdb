define (['node!request', 'node!url', 'node!vow'], function (request, URL, Promises) {
	function promiseRequest (options) {
		var deferred = Promises.promise ();
		
		var callback = function (error, response) {
			if (error) {
				deferred.reject (error);
			} else {
				deferred.fulfill (response);
			}
		};

		if (options.auth) {
			var parsedUrl = URL.parse (options.url);
			parsedUrl.auth = options.auth.username + ':' + options.auth.password;
			
			options.url = URL.format (parsedUrl);
			delete options.auth;
		}

		options.timeout = 60 * 1000;

		if (!options.method) {
			options.method = 'get';
		}

		if (options.sessionId && (options.method == 'PUT' || options.method == 'POST')) {
			if (options.url.indexOf ('?') == -1) {
				options.url += '?sessid=' + options.sessionId;
			} else {
				options.url += '&sessid=' + options.sessionId;
			}
		}

		if (options.body && options.body.pipe) {
			var stream = options.body;

			delete options.body;

			stream.pause ();

			stream.pipe (
				request (options, callback)
			);

			stream.resume ();
		} else {
			if (options.returnRequest) {
				return request (options);
			} else {
				request (options, callback);
			}
		}

		return deferred;
	}

	return function (options) {
		var request = promiseRequest (options);

		if (options.returnRequest) {
			return request;
		}
		return request
			.then (function (response) {
				if (options.returnResponse) return response;

				var contentType;

				if (response.headers ['content-type'] && !options.accept) {
					contentType = response.headers ['content-type'].split (';') [0];
				} else {
					contentType = options.accept || 'application/json';
				}

				if (response.body && (contentType == 'application/json' || contentType == 'text/json')) {
					var body;
					try {
						body = JSON.parse (response.body);
					} catch (e) {
						console.error ('Failed to parse http response body', e.message, options, response.body);
						throw e;
					}

					if (body.error) {
						throw body;
					} else {
						return body;
					}
				} else {
					return response.body;
				}
			});
	};
});