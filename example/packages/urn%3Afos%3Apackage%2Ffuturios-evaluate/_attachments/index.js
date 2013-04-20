define (['node!lru-cache'], function (LRU) {
	var cache = LRU ({
			max: 1000,
			maxAge: 1000 * 60 * 5
		});

	function compile (source, scope) {
		return (function () {
			if (typeof scope == 'object') {
				for (var i in scope) {
					eval ('var ' + i + ' = scope.' + i + ';');
				}
			}

			return eval ('(' + source + ')');
		}) (source);
		
	}

	return function evaluate (source, scope) {
		var compiled = cache.get (source);

		if (!compiled) {
			try {
				return compiled = compile (source, scope);
			} catch (e) {
				console.error ('evaluation error', e.message, e.stack);
				throw e;
			}
			cache.set (source, compiled);
		}

		return compiled;
	};
});
