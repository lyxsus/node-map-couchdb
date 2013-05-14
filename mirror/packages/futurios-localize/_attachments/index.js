define (function () {
	var _toString = Object.prototype.toString,
		prevLangs;

	return function localize (langs) {
		if (langs == prevLangs) {
			return;
		} else {
			prevLangs = langs;
		}

		if (typeof langs == 'string') {
			langs = (langs == 'en') ? [langs] : [langs, 'en'];
		} else if (langs instanceof Array) {
			if (langs.indexOf ('en') == -1) {
				langs.push ('en');
			}
		} else {
			Object.prototype.toString = _toString;
			return;
		}

		Object.prototype.toString = function () {
			for (var i = 0, l = langs.length, tmp; i < l; i++) {
				tmp = this [langs [i]] || this [langs [i].split ('-') [0]];
				if (tmp) return tmp;
			}
			return _toString.apply (this, arguments);
		};
	};
});