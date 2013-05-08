define (function () {
	// http://remysharp.com/downloads/wiki2html.js
	(function (global) {
		global.wiki2html = wiki2html;
		global.iswiki = iswiki;

		// utility function to check whether it's worth running through the wiki2html
		function iswiki(s) {
			return !!(s.match(/^[\s{2} `#\*='{2}]/m));
		}

		var encodeHTMLSource = (function () {
			var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': '&#34;', "'": '&#39;', "/": '&#47;' },
				matchHTML = /&(?!#?\w+;)|<|>|"|'|\//g;
			return function() {
				return this ? this.replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : this;
			};
		}) ();

		// the regex beast...
		function wiki2html(s) {
			if (typeof s == 'object') {
				s = s.toString ();
			}

			if (!s) return s;

			// lists need to be done using a function to allow for recusive calls
			function list(str) {
				

				return str.replace(/(?:(?:(?:^|\n)[\*#].*)+)/g, function (m) {  // (?=[\*#])
					var type = m.match(/(^|\n)#/) ? 'OL' : 'UL';
					// strip first layer of list
					m = m.replace(/(^|\n)[\*#][ ]{0,1}/g, "$1");
					m = list(m);
					return '<' + type + '><li>' + m.replace(/^\n/, '').split(/\n/).join('</li><li>') + '</li></' + type + '>';
				});
			}

			s = encodeHTMLSource.apply (s);

			return list(s
					/* BLOCK ELEMENTS */
					.replace(/(?:^|\n+)([^# =\*<].+)(?:\n+|$)/gm, function (m, l) {
						if (l.match(/^\^+$/)) return l;
						return "\n<p>" + l + "</p>\n";
					})

					.replace(/(?:^|\n)[ ]{2}(.*)+/g, function (m, l) { // blockquotes
						if (l.match(/^\s+$/)) return m;
						return '<blockquote>' + l + '</pre>';
					})

					.replace(/((?:^|\n)[ ]+.*)+/g, function (m) { // code
						if (m.match(/^\s+$/)) return m;
						return '<pre>' + m.replace(/(^|\n)[ ]+/g, "$1") + '</pre>';
					})

					.replace(/(?:^|\n)([=]+)(.*)\1/g, function (m, l, t) { // headings
						return '<h' + l.length + '>' + t + '</h' + l.length + '>';
					})

					/* INLINE ELEMENTS */
					.replace(/'''(.*?)'''/g, function (m, l) { // bold
						return '<strong>' + l + '</strong>';
					})

					.replace(/''(.*?)''/g, function (m, l) { // italic
						return '<em>' + l + '</em>';
					})

					.replace(/[\[](http.*)[!\]]/g, function (m, l) { // external link
						var p = l.replace(/[\[\]]/g, '').split(/ /);
						var link = p.shift();
						
						if (link.match(/^Image:(.*)/)) {
							return '<img src="' + link.replace (/^Image:/, '') + '" />';
						} else {
							return '<a href="' + link + '">' + (p.length ? p.join(' ') : link) + '</a>';
						}
					})

					.replace(/\[\[(.*?)\]\]/g, function (m, l) { // internal link or image
						var p = l.split(/\|/);
						var link = p.shift();

						console.log ('w3', link);

						if (link.match(/^Image:(.*)/)) {
							return '<img src="' + link.replace (/^Image:/, '') + '" />';
						} else {
							return '<a href="' + link + '">' + (p.length ? p.join('|') : link) + '</a>';
						}
					})
			); 
		}

		global.Wiky = {
			toHtml: wiki2html
		};
	}) (window);

	return window.wiki2html;
});