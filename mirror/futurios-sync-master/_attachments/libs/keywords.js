define (function () {
	return function (query, text) {
		text = text.toLowerCase ();
		query = query.toLowerCase ();

		var check = function (str) {
			return (str == 'true' || str == 'false') ? str
				: text.indexOf (str.replace (/"/g, '')) !== -1;
		};

		var parsed;

		try {
			return eval (
				parsed = query
					.replace (/ \t/g, ' ')
					.replace (/(\||&)/g, '$1$1')

					.replace (/("[^"]+")/g, check)
					.replace (/(\w|[А-я]+)/g, check)

					.replace (/(\)|e) (!|t|f|\()/g, '$1 && $2')
					.replace (/\-/g, '!')
			);
		} catch (e) {
			console.error (e.message, {
				query: query,
				parsed: parsed
			});
			return false;
		}
	};
});
