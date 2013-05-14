define (['fos!lodash', 'fos!promises', 'fos!boot/browser/storage.js', 'fos!boot/browser/libs/mixin.js', 'futurios/settings'], function (_, Promises, storage, mixin, settings) {
	var Session = function () {
	};

	mixin (Session);

	_.extend (Session.prototype, {
		_userCtx: null, session: null, _account: null,

		fetch: function () {
			var userCtx = settings.userCtx;
			if (userCtx === undefined) {
				console.error ('Userctx fetch not defined yet');
			} else {
				return userCtx;
			}
		},

		fetched: function (userCtx) {
			return this._setCtx (userCtx);
		},

		roles: function (pattern) {
			var roles = this._userCtx.roles;
			
			if (pattern) {
				return _.filter (roles, function (role) {
					return role.match (pattern);
				});
			} else {
				return roles;
			}
		},

		_setCtx: function (userCtx) {
			this._userCtx = userCtx;

			this.session = {
				account: userCtx.account || (userCtx.name || (userCtx.name ? ('urn:accounts/' + userCtx.name) : null))
			};

			if (this.session.account && !this._account) {
				return Promises.when (storage.get (this.session.account))
					.then (_.bind (this._setAccount, this))
					.fail (function (error) {
						console.error ('Failed to load session account', error);
					});
			}
		},

		_setAccount: function (account) {
			// var firstTime = !this._account;
			this._account = account;

			// if (!firstTime) {
			// 	account.once ('change:roles', function () {
			// 		window.location.reload ();
			// 	});
			// }
		},

		getAccount: function () {
			var account = this.session.account;
			
			if (account) {
				return account;
			} else {
				$ ('div.theme').trigger ('popup:auth');
				return false;
			}
		},


		signIn: function (settings, _callbacks) {
          var callbacks = _callbacks || {};
			$.ajax ({
				type: 'POST',
				url: '/login',
                cache: false,

                headers: {
                	accept: 'application/json'
                },
				
				data: {
					username: settings.login,
					password: settings.password
				},
				
				success: _.bind (function () {
					this.check ({
						success: function () {
							if (typeof callbacks.success == 'function') {
								callbacks.success.apply (this, arguments);
							}
						},
						error: callbacks.error
					});
				}, this),

				error: function () {
					if (typeof callbacks.error == 'function') {
						callbacks.error (arguments [2]);
					}
				}
			});
		},

		signOff: function (settings) {
			window.location = '/logout';
		},

		signUp: function (settings) {
			settings = settings || {};

			var success = _.bind (function () {
                _.delay (_.bind (function () {
	            	settings.username = settings.name;
					this.signIn (settings, {
						success: function () {
							window.location.reload ();
						},

						error: function (error) {
							console.error ('Failed to login', error);
						}
					});
                }, this), 500);
			}, this);

			$.ajax ({
				beforeSend: function(req) {
					req.setRequestHeader ('Accept', 'application/json');
				},
				type: 'PUT',
				url: '/registrate',
				cache: false,

				contentType: 'application/json',

				data: JSON.stringify ({
					name: settings.login,
					email: settings.email || null,
					password: settings.password
				}),

				 success: function () {
					var args = arguments;

					_.delay (function () {
						success (args);
					}, 1500);
				},

				error: function () {
					if (typeof settings.error == 'function') {
						settings.error (arguments [2]);
					}
				}
			});
			/*
			this._uuid (function (salt) {
				require (['sha1'], function (sha1) {
					$.ajax ({
						type: 'PUT',
						url: '/_users/org.couchdb.user%3A' + settings.login,
                        cache: false,
						
						contentType: 'application/json',
						data: JSON.stringify ({
							_id: 'org.couchdb.user:' + settings.login,
							name: settings.login,
							email: settings.email || null,

							salt: salt,
							password_sha: sha1 (settings.password + salt),

							type: 'user',
							roles: []
						}),

                        success: function () {
                          var args = arguments;
                          
                          _.delay (function () {
                            success (args);
                          }, 1500);
                        },

						error: function () {
							if (typeof settings.error == 'function') {
								settings.error (arguments [2]);
							}
						}
					})
				});
			});
			*/
		},

		check: function (settings) {
			settings = settings || {};

			$.ajax ({
				type: 'GET',
				url: '/_session',
                dataType: 'text',
                cache: false,

				success: _.bind (function (result) {
					try {
						this._setCtx (this._parse (result));

						if (typeof settings.success == 'function') {
							settings.success (this._userCtx);
						}
					} catch (e) {
						if (typeof settings.error == 'function') {
							settings.error (e);
						} else {
							console.error ('Failed to parse session result', e);
						}
					}
				}, this),

				error: function (result) {
					if (typeof settings.error == 'function') {
						settings.error (result);
					} else {
						console.log ('Session error', error);
					}
				}
			})
		},

		_parse: function (json) {
			var data = JSON.parse (json);

			if (data.ok) {
				return data.userCtx;
			}
		}
	});

	return new Session;
});