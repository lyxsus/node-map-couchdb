define (function () {
	var _ = require ('lodash')._;

	var hash = {
		"&": /&#38;/g,
		"<": /&#60;/g,
		">": /&#62;/g,
		'"': /&#34;/g,
		"'": /&#39;/g,
		"/": /&#47;/g
	};

	return function (str) {
		if (typeof str != 'string') return str;

		_.each (hash, function (e, d) {
			str = str.replace (e, d);
		});

		return str;
	};
});