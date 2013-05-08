define (
	[
		'node!vow', 'node!lodash', 'node!negotiator', 'node!express', 'node!formidable', 'node!fs',
		'./engines/html.js', './engines/json.js', './engines/xml.js'
	],

	function (Promises, _, Negotiator, express, formidable, fs, EngineHTML, EngineJSON, EngineXML) {
		var bodyParser = require ('express').bodyParser ();

		function getResource (client, routed) {
			return client.resources.get (
				routed.doc ? routed.app + '/' + routed.doc : routed.app
			);
		}

		var engines = {
			html: EngineHTML,
			json: EngineJSON,
			xml: EngineXML
		};

		var contentTypes = _.uniq (_.flatten (
			_.map (engines, function (engine) {
				return engine.contentTypes;
			})
		));

		function getEngine (ext, contentType) {
			if (engines [ext]) {
				return engines [ext];
			} else {
				return _.find (engines, function (engine) {
					return engine.contentTypes.indexOf (contentType) !== -1;
				});
			}
		}

		function checkUserCookie (req, res, client) {
			var account = client.user.get ('account') || '',
				key = 'user_token';

			if (account != req.cookies [key]) {
				res.cookie (key, account, {
					maxAge: 3600000,
					path: '/'
				});
			}
		}

		return function (req, res, next, client, routed) {
			var negotiator = new Negotiator (req),
				desiredContentType = negotiator.preferredMediaType (contentTypes),
				desiredLanguages = negotiator.preferredLanguages ();

			res.header ('X-Powered-By', 'Futurios');
			res.header ('Vary', 'Cookie, ETag, User-Agent, Accept, Accept-Language');

			checkUserCookie (req, res, client);	

			switch (req.method) {
				case 'GET':
					return Promises.when (getResource (client, routed))
						.then (function (resource) {
							if (routed.attach) {
								return resource
									.getAttachment (routed.attach)
										// .on ('error', console.error)
										.pipe (res);
							} else {
								try {
									var Engine = getEngine (routed.ext, desiredContentType),
										engine = new Engine (resource, client, routed.host);

									/*
										undefined is not a function TypeError: undefined is not a function
									    at /Users/lyxsus/GitHub/express-futrios/libs/render.js:68:18
									    at /Users/lyxsus/GitHub/fos-mixin/node_modules/vow/lib/vow.js:169:31
									    at process._tickCallback (node.js:427:13)
									    at process._makeCallback (node.js:345:15)
								    */

									
									return engine.render (req, res, next);
								} catch (e) {
									console.error (e.message, e.stack);

									res.redirect ('/');
								}
								

							}
						});

				case 'POST': {
					if (routed.app) {
						if (routed.doc) {
							return Promises.when (getResource (client, routed))
								.then (function (resource) {
									var contentType = req.headers ['content-type'];

									if (/^multipart\/form-data/.test (contentType)) {
										// Upload attachment from multipart/form-data request
										var form = new formidable.IncomingForm (),
											promise = Promises.promise ();

										form.uploadDir = '/tmp';

										form.parse (req, function (error, fields, files) {
											if (error) {
												promise.reject (error);
											} else {
												var file = files._attachments,
													folder = fields.folder ? fields.folder + '/' : '';

												resource
													.saveAttachment ({
														name: folder + file.name,
														contentType: file.type,
														body: fs.createReadStream (file.path)
													}, client.sign ())

													.then (function () {
														return resource.getAttachment (routed.attach, client.sign ())
															.pipe (res);
													})

													.then (promise.fulfill, promise.reject);
											}
										});

										req.resume ();

										return promise;
									} else {
										// Upload regular attachment
										return resource
											.saveAttachment ({
												name: routed.attach,
												contentType: contentType,
												body: req
											}, client.sign ())

											.then (function () {
												return resource.getAttachment (routed.attach, client.sign ())
													.pipe (res);
											});
									}
								});
						} else {
							// TODO: Create new element in collection
						}
					} else {
						throw new Error ('Not supported');
					}
				}

				case 'PUT':	{
					return Promises.when (getResource (client, routed))
						.then (function (resource) {
							if (routed.attach) {
								return resource
									
									.saveAttachment ({
										name: routed.attach,
										contentType: 'text/plain',	// TODO: Detect content-type
										body: req
									}, client.sign ())

									.then (function () {
										return resource.getAttachment (routed.attach, client.sign ())
											.pipe (res);
									});
							} else {
								// TODO: Update element in collection
								throw new Error ('Not implemented');
							}
						});
				}
				case 'DELETE': {
					return Promises.when (getResource (client, routed))
						.then (function (resource) {
							if (routed.attach) {
								return resource
									.removeAttachment (routed.attach, client.sign ())
									.then (function () {
										res.statusCode = 204;
										res.write ('204 No Content');
										res.end ();
									});
							} else {
								// TODO: Delete document
								throw new Error ('Not implemented');
							}
						});
				}

				default:
					res.writeHead (415);
					res.write ('<h1>415 - method not allowed</h1>');
					res.end ();
			}
		};
	}
);