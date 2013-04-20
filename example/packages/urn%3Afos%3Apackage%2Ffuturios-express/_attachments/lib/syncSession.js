define (['node!vow', 'node!lodash'], function (Promises, _) {
	return function syncSession (sessionId, database, pool) {
		if (!sessionId || !database || /\/nobody^/.test (database)) return false;

		return Promises.when (pool.server.database ('users/nobody'))
			.then (function (source) {
				// Get view results
				return Promises.when (source.views.get ('replicate', 'sessid'))
					.then (function (view) {
						return view.get ({
							key: sessionId
						})
					})
					.then (function (fragment) {
						var rows = fragment.get ('rows');

						if (rows.length) {
							var ids = _.map (rows, function (row) {
								return row.id;
							});

							// Replicate docs
							return source.replicate ({
								target: database,
								doc_ids: ids
							}, {auth: pool.server.settings.auth});
						}
					});
			});		
	};
});
