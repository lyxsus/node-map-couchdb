define (['fos!lodash', 'fos!boot/browser/helpers/links.js'], function (_, links) {
	return {
		attachments: function (doc) {
			if (!doc) return [];
			if (!doc._attachments) return [];

			return _.map (_.keys (doc._attachments), function (file) {
				var origin = doc.meta.last_updated_origin || doc.meta.origin;

				return links.urn2link (doc._id) + '/' + file;
			});
		},

		attachmentsPath: function (doc) {
			if (!doc) return;
			
			if (doc._id) {
				return links.urn2link (doc._id);
			} else if (doc.get) {
				return doc.get ('_link');
			}			
		},

		attachmentsGroup: function (hash) { 
			var data = {};

			_.each (_.clone (hash, true), function (item, key){ 
				(function (data, path) {
					var name = path.shift();

					if (name) {
						if (!data [name]) {
							data [name] = {};
						}

						arguments.callee (data [name], path);
					} else {
						item._fullname = key;
						_.extend(data, item);
					}
				}) (data, key.split ('/'));
			}); 

			return data;
		},

		uploadAttachments: function (model, eventFiles) {
			var meta = model.get ('meta'),
				origin = (meta.origin || meta.last_updated_origin),
				e = encodeURIComponent,
				baseUrl = '/' + _.map ([origin, model.id], e).join ('/');

			var files = _.map (eventFiles, function (file) {
				return file;
			});

			var _iterate = function () {
				var file;

				if (file = files.pop ()) {
					_uploadFile (file);
				} else {
					model.off ('change:_attachments', _iterate);
				}
			};

			var _contentType = function (file) {
				return file.type;
			};

			var _uploadFile = function (file) {
				var url = baseUrl + '/' + e (file.name) + '?rev=' + model.get ('_rev');

				var xhr = new XMLHttpRequest ();
				xhr.open ('PUT', url);

				// TODO: Add better content-type detection
				xhr.setRequestHeader ('Content-Type', _contentType (file));

				xhr.onreadystatechange = function (event) {
					console.log ('upload attachments result');
				};

				xhr.onerror = function () {
					console.error ('Failed to upload attachment', arguments);
				};

				xhr.onabort = function () {
					console.log ('Attachment upload aborted', arguments);
				};
				
				console.log (file);
				xhr.send (file);
			};

			model.on ('change:_attachments', _iterate);
			_iterate ();
		}
	};
});