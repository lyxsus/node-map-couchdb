define (
	[
		'node!vow', 'node!lodash', 'node!passport',
		'./authorize.js', './registrate.js', './syncSession.js',

		'node!passport-local'
	],

	function (Promises, _, passport, authorize, registrate, syncSession, passportLocal) {
		function userCtx (user) {
			if (user && (user.get ('name') != 'nobody')) {
				return {
					name: user.get ('name'),
					roles: user.get ('roles'),
					account: user.get ('account'),
					database: user.get ('database')
				};
			} else {
				return {
					name: null,
					roles: []
				};
			}
		}

		var parseUserOAuth = function (req, accessToken, refreshToken, profile, done) {
			var params = {
				oauth: {
					accessToken: accessToken,
					refreshToken: refreshToken,
					profile: profile
				}
			};

			switch (profile.provider) {
				case 'facebook':
					profile.link = 'https://facebook.com/' + profile.id;
					break;

				case 'vkontakte':
					profile.link = 'https://vk.com/' + profile.username;
					break;
			}

			return params;
		};

		var parseUserOpenId = function (req, token, profile, done) {
			var params = {
				openid: {
					token: token,
					profile: profile
				}
			};

			profile.provider = 'openid';
			profile.link = token;

			return params;
		};

		var LocalStrategy = passportLocal.Strategy;

		return function (app, pool) {
			passport.serializeUser (function (user, done) {
				var oauth = user.get ('oauth'),
					consumer_key = _.first (_.keys (oauth.consumer_keys)),
					token = _.first (_.keys (oauth.tokens));

				done (null, {
					consumer_key: consumer_key,
					consumer_secret: oauth.consumer_keys [consumer_key],
					token: token,
					token_secret: oauth.tokens [token]
				});
			});

			passport.deserializeUser (function (user, done) {
				done (null, user);
			});

			passport.use (new LocalStrategy ({
				usernameField: 'username',
				passwordField: 'password'
			}, function (username, password, done) {
				authorize (pool, {
					username: username,
					password: password
				})
					.then (function (user) {
						done (null, user);
					})
					.fail (done)
					.done ();
			}));

			// passport.use (new BasicStrategy (
			// 	function (username, password, done) {
			// 		authorize (pool, {
			// 			username: username,
			// 			password: password
			// 		})
			// 			.then (function (user) {
			// 				done (null, user);
			// 			})
			// 			.fail (done)
			// 			.done ();
			// 	})
			// );

			return app
				.use (passport.initialize ())
				.use (passport.session ())

				.post ('/login', passport.authenticate ('local'), function (req, res) {
					var database = req.user.get ('database');


					syncSession (req.session.id, database, pool)
						.fail (function (error) {
							console.error ('Failed to sync session', error);
						})
						.always (function () {
							if (req.headers.accept == 'application/json') {
								res.setHeader ('content-type', 'application/json; charset=utf-8');

								res.write (
									JSON.stringify ({
										ok: true,
										userCtx: userCtx (req.user)
									})
								);
								res.end ();
							} else {
								res.redirect ('/');
							}
						})
						.done ();
				})

				.use ('/_session', function (req, res) {
					res.setHeader ('content-type', 'application/json; charset=utf-8');

					Promises.when (pool.client (req.user ? {oauth: req.user} : null))
						.then (function (client) {
							res.write (
								JSON.stringify ({
									ok: true,
									userCtx: userCtx (client.user)
								})
							);
							res.end ();
						})
						.fail (console.error)
						.done ();
				})

				.use ('/logout', function (req, res) {
					// req.logout ();
					req.session.destroy ();
					
					res.cookie ('user_token', '', {
						maxAge: 3600000,
						path: '/'
					});
					
					res.writeHead (302, {
						'Location': '/'
					});
					
					res.end ();
				})

				.use ('/auth' , function (req, res, next) {
					if (req.url.indexOf ('.') !== -1) {
						next ();
						return;
					}

					var args = arguments;

					pool.client (req.user ? {oauth: req.user} : null)
						.then (function (client) {
							return client.resources.get ('urn:auth:provider/' + req.path.split ('/') [1]);
						})
						.then (function (provider) {
							console.log ('require', 'passport-' + provider.get ('provider'));

							var Strategy = require ('passport-' + provider.get ('provider')).Strategy,
								params = provider.json (),
								parser;

							params.passReqToCallback = true;

							if (params.provider == 'openid') {
								params.profile = true;
								parser = parseUserOpenId;
							} else {
								parser = parseUserOAuth;
							}

							var strategy = new Strategy (params, function (req, accessToken, refreshToken, profile, done) {
								var params = parser.apply (null, arguments);

								if (req.user) {
									params.user = req.user;
								}
								
								authorize (pool, params)
									.fail (done)
									.then (function (user) {
										var database = user.get ('database');
										return syncSession (req.session.id, database, pool)
											.fail (function (error) {
												console.log ('Failed to sync', error);
												return user;
											})
											.always (function () {
												done (null, user);
											})
									})
									
									.done ();
							});

							passport.use (params._id, strategy);
							passport.authenticate (params._id).apply (null, args);
						})
						.fail (function (error) {
							console.error ('oauth failed', error);
						})
						.done ();
				})
				
				.use ('/auth', function (req, res, next) {
					if (req.url.indexOf ('.') !== -1) {
						next ();
						return;
					}
					
					res.writeHead (302, {'Location': '/'});
					res.end ();
				})

				.use ('/registrate', function (req, res, next) {
					var data = {
						name: req.body.email,
						email: req.body.email,
						password: req.body.password
					};

					registrate (data, pool)
						.then (function (user) {
							return syncSession (req.session.id, user.get ('database'), pool)
								.then (function () {
									if (req.headers.accept == 'application/json') {
										res.setHeader ('content-type', 'application/json; charset=utf-8');

										res.write (
											JSON.stringify ({
												ok: true,
												userCtx: userCtx (req.user)
											})
										);
										res.end ();
									} else {
										res.redirect ('/');
									}
								});
						})
						.fail (function (error) {
							res.write (
								JSON.stringify ({
									error: error
								})
							);
							res.end ();
						})
						.done ();

					// TODO: Create user
					// TODO: Sync session
					// TODO: Authorize (req.login)
					// TODO: Reply json, if json requested, or redirect to main
				});
		};

	}
)

