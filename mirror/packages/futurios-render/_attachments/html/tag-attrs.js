define (function () {
	function end (str, quote) {
		var c, p, l = str.length;
		do {
			p = str.indexOf (quote, p + 1);
			c = str [p - 1];
		} while (c == '\\' && p != -1);

		return p;
	}

	function iter (str, attrs) {
		str = str.replace (/^[ \t\r\n]+/, '');

		if (str.substring (0, 1) == '<') {
			return str.substring (str.indexOf (' ') + 1);
		}

		var p1 = str.indexOf (' '),
			p2 = str.indexOf ('='),
			name, value;

		if (p1 == p2) {
			return false;
		} else if (p1 < p2 && p1 != -1) { // short attribute
			if (p1) {
				name = str.substring (0, p1);

				attrs [name] = name;

				return str.substring (p1 + 1);
			} else {
				return str.substring (1);
			}
		} else if (p1 > p2 && p2 != -1) { // full attribute
			name = str.substring (0, p2);

			// no quotes case
			var quote = str.substring (p2 + 1, p2 + 2), pos;
			if (quote != '"' && quote != "'") {
				pos = str.indexOf (' ', p2 + 2);
				value = str.substring (p2 + 1, pos);

				attrs [name] = value;

				return str.substring (pos + 1);
			}

			// parse value
			str = str.substring (p2 + 2);

			var p = end (str, quote);

			value = str.substring (0, p);

			attrs [name] = value;

			return str.substring (p + 1);
		}
	}

	return function attrs (str) {
		var attrs = {};

		str = str.replace (/\/?>$/, ' ');
		
		while (str = iter (str, attrs)) {}

		return attrs;
	}
});