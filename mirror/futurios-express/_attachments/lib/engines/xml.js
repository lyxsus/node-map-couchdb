define (['node!lodash', 'node!jstoxml'], function (_, jstoxml) {
	function EngineXML (resource, client) {
		this.resource = resource;
		this.client = client;
	};

	_.extend (EngineXML.prototype, {
		render: function (req, res, next) {
			this.headers (req, res);

			res.write (
				jstoxml.toXML (this.parse (this.resource.json ()))
			);
			res.end ();
		},

		// TODO: Reimplement: support "rows", format standart attributes, etc.
		parse: function (data) {
			var result = {};

			for (var index in data) {
				if (index.indexOf ('{') !== -1) {
					continue;
				}

				// result [index.replace (/^_/, '')] = data [index];
				result [index] = data [index];
			}
			
			return {
				result: result
			};
		},

		headers: function (req, res) {
			var resource = this.resource,
				meta = resource.get ('meta');

			res.header ('Content-Type', 'text/xml; charset=utf-8');
			res.header ('Vary', 'Accept, Accept-Encoding, Accept-Language, Cookie');
			res.header ('ETag', resource.get ('_rev'));

			if (meta) {
				if (meta.updated_at) {
					res.header ('Last-Modified', (new Date (meta.updated_at)).toGMTString ());
				}
			}
		}
	})


	EngineXML.contentTypes = [
		'text/xml',
		'application/xml'
	];

	return EngineXML;
});