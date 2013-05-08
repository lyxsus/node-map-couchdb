define (['node!vow', 'node!sha1'], function (Promises, sha1) {
	function createDatabase () {
		return server.create ()
	}

	function generateToken () {
		var version = '1';
		return sha1 (Math.random ().toString ()).substring (0, 20) + '-' + version;
	}

	return function (data, pool) {
		var server = pool.server,
			sign = {auth: server.settings.auth};

		var createAccount = function (data) {
			return Promises.when (server.database ('app/accounts'))
				.then (function (database) {
					data.type = 'urn:types/account';

					return database.documents.create ('urn:accounts', data, sign)
						.fail (function () {
							return database.documents.get ('urn:accounts/' + data.id);
						});
				});
		};

		return pool.server.uuid ()
			.then (function (uuid) {
				return Promises.all ([
					createAccount ({id: uuid}),
					server.create ('users/' + uuid, sign)
				]);
			})

			.then (function (fulfilled) {
				var account = fulfilled [0],
					database = fulfilled [1];

				return Promises.when (server.database ('_users'))
					.then (function (users) {
						if (!data.roles) {
							data.roles = [];
						}

						if (data.roles.indexOf ('user') === -1) {
							data.roles.push ('user');
						}

						if (data.roles.indexOf (account.id) === -1) {
							data.roles.push (account.id);
						}

						data._id = 'org.couchdb.user:' + data.name;

						data.account = account.id;
						data.database = database.name;
						data.type = 'user';

						// Generate oauth tokens
						data.oauth = {
							consumer_keys: {},
							tokens: {}
						};

						data.oauth.consumer_keys [generateToken ()] = generateToken ();
						data.oauth.tokens ['personal-' + generateToken ()] = generateToken ();

						return users.documents.create (null, data, sign);
					});
			})

			.fail (function (error) {
				console.log ('Failed to register user', error);
			});
	};
});