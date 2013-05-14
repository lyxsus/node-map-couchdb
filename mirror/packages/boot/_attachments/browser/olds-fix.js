define (['fos!promises', 'fos!boot/browser/storage.js', 'fos!boot/browser/router.js', 'fos!boot/browser/session.js', 'fos!boot/browser/libs/helpers.js'], function (Promises, storage, router, session, helpers) {
	var promises = [];

	_.each ({
		'storage': 'fos!boot/browser/storage.js',
		'iona.sessions': 'fos!boot/browser/session.js',
		'iona.router': 'fos!boot/browser/router.js',
		'futurios/router': 'fos!boot/browser/router.js',
		'iona.renderer.helpers': 'fos!boot/browser/libs/helpers.js',
		'iona.renderer': 'fos!boot/browser/render.js',
		'selected': 'fos!boot/browser/plugin/selected.js',
		'iona.geo': 'fos!boot/browser/plugin/geo.js',
		'codemirror': 'fos!boot/browser/plugin/codemirror.js',
		'serializeForm': 'fos!boot/browser/plugin/serialize-form.js',
		'ionaJquery': 'fos!boot/browser/plugin/iona-jquery.js',
		'swipe': 'fos!boot/browser/plugin/swipe.js',
		'moment': 'fos!boot/browser/plugin/moment.js',
		'browser': 'fos!boot/browser/plugin/browser.js',
		'wiky': 'fos!boot/browser/plugin/wiky.js',
		'selected': 'fos!boot/browser/plugin/selected.js',
		'alertify': 'fos!boot/browser/plugin/alertify.js',
		'jquery-form': 'fos!boot/browser/plugin/jquery-form.js',
		'jquery-touch-punch': 'fos!boot/browser/plugin/jquery-touch-punch.js'
	}, function (depency, name) {
		var promise = Promises.promise ();

		// TODO: Reject on timeout

		define (name, [depency], function (value) {
			return value;
		});

		require ([name], function () {
			promise.fulfill ();
		});

		return promise;
	}); 

	return Promises.all (promises);
});