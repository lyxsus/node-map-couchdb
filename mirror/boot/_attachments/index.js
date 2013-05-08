define ([(typeof process == 'object') ? './server.js' : './browser/boot.js'], function (boot) {
	return boot;
});
