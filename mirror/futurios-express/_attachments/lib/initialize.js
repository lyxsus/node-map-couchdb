define (['node!lodash', 'node!express-device', './passport.js', './route.js', './render.js'], function (_, device, passport, route, render) {
	return function (app, pool) {

		passport (app, pool);

		app.use (device.capture ());

		return function (req, res, next) {
			pool.client (req.user ? {oauth: req.user} : null)
				.then (function (client) {
					if (client.errors) {
						throw client.errors;
					}
					return route (req, client)
						.then (function (routed) {
							return render (req, res, next, client, routed);
						})
						.fail (function (error) {
							res.statusCode = 500;
							res.write ('Internal Server Error ' + error);
							res.end ();
						})
						.always (function () {
							client.release ();
						});
				})

				.fail (function (error) {
					console.log ('failed to get user session', error);

					req.session.destroy ();

					res.cookie ('user_token', 'nobody', {
						maxAge: 3600000,
						path: '/'
					});

					res.writeHead (302, {
						'Location': '/'
					});

					res.write (JSON.stringify (error));
					res.end ();
				})

				.done ();
		};
	};
});