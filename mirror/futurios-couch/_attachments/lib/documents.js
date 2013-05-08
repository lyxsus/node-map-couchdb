define (
	[
		'node!lodash',
		'fos!futurios-request', 'fos!futurios-mixin',
		'./document.js'
	],

	function (_, request, mixin, Document) {
		function Documents (database) {
			this.id = 'documents #' + database.name;
			this.database = database;
			this.docs = {};
		};

		mixin (Documents);

		_.extend (Documents.prototype, {
			get: function (id) {
				if (!this.has (id)) {
					// console.log ('get', this.database.name, id);
					this.docs [id] = new Document (this, id);
				}

				return this.docs [id].ready ();
			},

			unset: function (id) {
				// console.log ('delete doc', id, 'from docs');
				delete this.docs [id];
			},

			create: function (designDocId, data, sign) {
				var url = this.database.url,
					self = this;

				if (designDocId) {
					url +=	'_design/' + encodeURIComponent (arguments [0]) +
						'/_update/' + encodeURIComponent (data.type);
				}

				return request (_.extend ({
					url: url,
					method: 'POST',
					body: JSON.stringify (data),
					accept: 'application/json',
					headers: {
						'content-type': 'application/json',
						'accept-encoding': 'gzip, deflate'
					}
				}, sign))
					.then (function (resp) {
						return self.get (resp.id);
					})
			},

			has: function (id) {
				return this.docs [id] != undefined;
			},

			dispose: function () {
				this.database = null;
				this.docs = null;
			}
		});

		return Documents;
	}
);