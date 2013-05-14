define (['futurios/settings'], function (settings) {
	var _toString = Object.prototype.toString;

	function localize (langs) {
		if (typeof langs == 'string') {
			langs = (langs == 'en') ? [langs] : [langs, 'en'];
		} else if (langs instanceof Array) {
			if (langs.indexOf ('en') == -1) {
				langs.push ('en');
			}
		} else {
			return false;
		}

		Object.prototype.toString = function () {
			for (var i = 0, l = langs.length, tmp; i < l; i++) {
				tmp = this [langs [i]] || this [langs [i].split ('/') [0]];
				if (tmp) return tmp;
			}
			return _toString.apply (this, arguments);
		};
	};

	localize (settings.locale);

	return localize;
});