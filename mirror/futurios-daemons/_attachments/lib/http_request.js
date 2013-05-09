define (['node!request'], function (request) {
	return function http_request (consumer, options, callback) {
		if (!options.headers) {
			options.headers = {};
		}

		if (!options.method) {
			options.method = 'get';
		}

		if (consumer.oauth) {
			options.oauth = consumer.oauth;
		} else {
			if (consumer.username) {
				if (consumer.password) {
					var AuthHeader = 'Basic ' + new Buffer (consumer.username + ':' + consumer.password).toString ('base64')	
					options.headers ['Authorization'] = AuthHeader;
				}

				if (consumer.cookie) {
					options.headers ['Cookie'] = consumer.cookie;
				}
			}
		}

		if (!options.headers ['Content-Type']) {
			if (['POST', 'PUT'].indexOf (options.method) !== -1) {
				options.headers ['Content-Type'] = 'application/json';
			}
		}

		if (!options.headers ['Accept']) {
			options.headers ['Accept'] = 'application/json,application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5';
		}

		options.headers ['Connection'] = 'keep-alive';

		options.url = 'http://' + options.host + ':' + options.port + options.path;
		delete options.host, options.port, options.path;

		if (options.data) {
			// Pass sessionid to meta.sessid thru couchdb update handler
			if (consumer.sessid && (options.method == 'PUT' || options.method == 'POST')) {
				if (options.url.indexOf ('?') == -1) {
					options.url += '?sessid=' + consumer.sessid;
				} else {
					options.url += '&sessid=' + consumer.sessid;
				}
			}

			if (typeof options.data == 'string') {
				options.body = options.data;
			} else {
				options.body = JSON.stringify (options.data);
			}
			delete options.data;
		}

		// console.log ('->', options.method, options.url);
		options.timeout = 5000;

		var req = request (options, function (error, response, body) {
			var contentType, result;
			
			if (error) {
				return callback (error);
			}

			if (response.headers ['content-type']) {
				contentType = response.headers ['content-type'].split (';') [0];
			} else {
				contentType = options.expect || 'application/json';
			}
			
			if (contentType == 'application/json' || contentType == 'text/json') {
				try {
					result = JSON.parse (body);
				} catch (e) {
					callback ([e.message, options.path, response.headers, body]);
					return;
				}
			} else {
				result = body;
			}

			if (result.error) {
				error = result.error;
			}

			// console.log ('<-', options.method, options.url);

			callback (error, result);
		});
		
		req.on ('error', function (error) {
			console.error ('HTTP error while working with db', error, options.url, options.method);
		});
		
		return req;
	};
});
