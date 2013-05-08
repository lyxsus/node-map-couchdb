define (['fos!lodash'], function (_) {
	var router;

	require (['fos!boot/browser/router.js'], function () {
		router = arguments [0];
	});

	return {
		link2urn: function (link) {
			var routes = require ('fos!boot/browser/router.js').routes.get ('rows');

			var prefix = '', app;
			for (var i = 0, tmp; i < routes.length; i++) {
				tmp = routes [i].value;

				if (tmp == link.substring (0, tmp.length)) {
					if (tmp.length > prefix.length) {
						prefix = tmp;
						app = routes [i].key;
					}
				}
			}

			if (app) {
				return app + link.substring (prefix.length);
			} else {
				return null;
			}
		},
  
		urn2link: function (urn) {
			if (!urn || urn.substring (0, 4) != 'urn:') return urn;
			return '/' + urn.substring (4).replace (/:/g, '/');
		},
		
		makeUrn: function (uri, params){
			var urn = '', inner_params = {}, temp;

			if (uri.indexOf ('?') != -1) {
				urn  = uri.split ('?') [0];
				temp = uri.split ('?') [1];

				if (temp.indexOf ('&') != -1) {
					temp = temp.split ('&');
					_.each (temp, function (item){
						inner_params [item.split ('=') [0]] = decodeURIComponent (item.split('=') [1]);
					});
				} else {
					inner_params [temp.split('=') [0]] = decodeURIComponent (temp.split('=') [1]);
				}
			} else {
				urn = uri;
			}

			_.extend (inner_params, params);

			var tail = _.compact (
				_.map (inner_params, function (value, name) {
					if (value || value === 0) {
						return name + "=" + encodeURIComponent (value);
					}
				})
			).join ("&");

			return tail ? (urn + '?' + tail) : urn;
		}
	}
})