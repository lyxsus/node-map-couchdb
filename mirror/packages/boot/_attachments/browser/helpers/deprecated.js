define (function () {
	return {
		hosts: {
			static: null
		},

		groupMultiple: function (the) {
			var rows = [];

			_.each (the.rows, function (row) {
				var id = row.id;

				if (the.ctx.page_uri == id) {
					return;
				}

				if (!_.any (rows, function (row) { return row.id == id; })) {
					rows.push (row);
				}

				if (the.options.group_limit) {
					rows = rows.slice (0, parseInt (the.options.group_limit));
				}
			});

			the.rows = rows;
			the.total_rows = rows.length;
		}
	};
})