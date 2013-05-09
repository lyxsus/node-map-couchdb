define (function () {
	var toUrl = function (name, req, config) {
		var path = config.fos.url + name;

		if (!/\.js$/.test (path)) {
			if (name.indexOf ('/') !== -1) {
				path += '.js';
			} else {
				path += '/' + config.fos.main;
			}
		}


		path = path.replace (/\/\.\//g, '/')
					.replace (/\/([^\/+])\/\.\.\//g, '/$1/');

		return (config.fos.loader || '') + req.toUrl (path);
	};

	var cache = {};

	return {
		load: function (name, req, onload, config) {
			var url = toUrl (name, req, config)

			if (cache [url]) {
				onload (cache [url]);
			} else {
				req ([url], function (result) {
					cache [url] = result;
					onload (result);
				});
			}
			
		}
	};
});	
