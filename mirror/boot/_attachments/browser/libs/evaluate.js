define (['fos!lru-cache'], function (LRU) {
	var cache = LRU ({
		max: 50
	});

	return function compile (source, scope) {
		return (function () {
			var result = cache.get (source);

			if (result) {
				return result;
			}

			if (typeof scope == 'object') {
				for (var i in scope) {
					eval ('var ' + i + ' = scope.' + i + ';');
				}
			}

			if (window.__browser && window.__browser.name == 'MSIE' && window.__browser.version == '8.0') {
				result = eval ('(function () { return ' + source + '; }) ()');
			} else {
				result = eval ('(' + source + ')');
			}

			cache.set (result);

			return result;
		}) (source);
	};
});