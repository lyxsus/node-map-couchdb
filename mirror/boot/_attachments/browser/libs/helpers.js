define (
	[
		'fos!boot/browser/helpers/deprecated.js',
		'fos!boot/browser/helpers/links.js',
		'fos!boot/browser/helpers/attachments.js',
		'fos!boot/browser/helpers/permissions.js',
		'fos!boot/browser/helpers/render.js',
		'fos!boot/browser/helpers/props.js',
		'fos!boot/browser/helpers/others.js'
	], function () {
	var helpers = {};

	for (var i = 0; i < arguments.length; i++) {
		for (var j in arguments [i]) {
			helpers [j] = arguments [i] [j];
		}
	}

	return helpers;
});