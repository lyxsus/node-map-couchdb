define (['node!lodash'], function (_) {
	function Logger (options, saveCallback) {
		this.options = options || {};
		this.save = saveCallback;
	};

	_.extend (Logger.prototype, {
		log: function () {
			this.report ({
				class: 'log',
				args: arguments
			});
		},

		warn: function () {
			this.report ({
				class: 'warn',
				args: arguments
			});
		},

		error: function () {
			this.report ({
				class: 'error',
				args: arguments
			});
		},

		report: function (data) {
			var related = _.clone (this.options.related);

			_.each (data.args, function (arg) {
				if (typeof arg != 'string') return;
				if (arg.match (/^urn:/) && !arg.match (/^urn:logs/)) {
					related.push (arg);
				}
			});

			var entry = {
				title: Array.prototype.join.call (data.args, ', '),
				class: data.class,
				related: related,
				data: data.args,
				type: 'urn:types/log'
			};

			this.save (entry);
		}
	});


	return Logger;
})