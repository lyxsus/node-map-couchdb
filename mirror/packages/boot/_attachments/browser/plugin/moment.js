define (['fos!moment', 'futurios/settings'], function (moment, settings) {
	var locale = settings.locale.toLowerCase ();

	if (locale != 'en-us') {
		require (['fos!moment/lang/' + locale + '.js'], function () {
			moment.lang (locale);
		});
	}
	
	return window.moment = moment;
});