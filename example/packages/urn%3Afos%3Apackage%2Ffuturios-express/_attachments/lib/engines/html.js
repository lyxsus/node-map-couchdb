define (['node!lodash', 'fos!futurios-render'], function (_, Renderer) {
	function EngineHTML (resource, client, host) {
		this.resource = resource;
		this.client = client;
		this.host = host;
	};

	_.extend (EngineHTML.prototype, {
		render: function (req, res, next) {
			if (this.headers (req, res)) {
				return;
			}

			var renderer = new Renderer (this);

			return renderer.html ({
				device: req.device
			})
				.then (function (html) {
					renderer.dispose ();
					res.write (html);
				})
				.fail (function (error) {
					console.error ('Failed to render html', req.url, error);
					res.write (error);
				})
				.always (function () {
					res.end ();
				})
				.done ();
		},

		headers: function (req, res) {
			var resource = this.resource,
				meta = resource.get ('meta'),
				etag = resource.get ('_rev') + '-' + this.client.user.get ('_rev'),
				checkETag = req.headers ['if-none-match'];

			// TODO: Check "account" cookie
			if (checkETag == etag) {
				res.statusCode = 304;
				res.end ();
				return true;
			}

			res.header ('Content-Type', 'text/html; charset=utf-8');
			res.header ('Vary', 'Accept, Accept-Encoding, Accept-Language, Cookie');
			res.header ('ETag', etag);

			if (meta) {
				if (meta.updated_at) {
					res.header ('Last-Modified', (new Date (meta.updated_at)).toGMTString ());
				}
			}
		}
	})

	EngineHTML.contentTypes = [
		'text/html',
		'application/xml'
	];

	return EngineHTML;
});
