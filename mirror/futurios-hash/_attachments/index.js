// define (['node!xxhash'], function (XXHash) {
// 	return function (str) {
// 		var hasher = new XXHash (0xCAFEBABE);
// 		hasher.update (new Buffer (str));
// 		return hasher.digest ();
// 	};
// });
define (function () {
	return function (str) {
		return str;
	};
});