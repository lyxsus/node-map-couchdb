define (['node!lodash'], function (_) {
	function EngineJSON (resource, client) {
		this.resource = resource;
		this.client = client;
	};

	_.extend (EngineJSON.prototype, {
		render: function (req, res, next) {
			this.headers (req, res);

			res.write (
				JSON.stringify (this.resource.json ())
			);
			res.end ();
		},

		headers: function (req, res) {
			var resource = this.resource,
				meta = resource.get ('meta');

			res.header ('Content-Type', 'application/javascript; charset=utf-8');
			res.header ('Vary', 'Accept, Accept-Encoding, Accept-Language, Cookie');
			res.header ('ETag', resource.get ('_rev'));

			if (meta) {
				if (meta.updated_at) {
					res.header ('Last-Modified', (new Date (meta.updated_at)).toGMTString ());
				}
			}
		}
	})


	EngineJSON.contentTypes = [
		'text/javascript',
		'application/javascript'
	];

	return EngineJSON;
});