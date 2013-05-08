define (['fos!promises', 'fos!lodash', 'fos!jquery', 'fos!boot/browser/router.js', 'futurios/settings', 'fos!boot/browser/helpers/amd.js'], function (Promises, _, $, router, settings, amd) {
	return function initialize () {
		return settings.depencies
			? Promises.all ([amd.require (settings.depencies)])
				.then (function () {
					return router.ready ();
				})
			: Promises.when (router.ready ());
	}
});
