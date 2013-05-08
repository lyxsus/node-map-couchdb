define (['fos!boot/browser/libs/view.js'], function (View) {
	var views = {};

	return {
		get: function (resource, role, use) {
			var key = [resource.id, resource.has ('rows'), role, use].join (',');

			if (views [key] === undefined) {
				views [key] = new View (this, key, resource, role, use);
			}

			return views [key].ready ();
		},

		unset: function (view) {
			views [view.id] = undefined;
			delete views [view.id];
		},

		views: views
	}
})