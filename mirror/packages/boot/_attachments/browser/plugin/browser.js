define (function () {
	var __browser = (function () {
		var N = navigator.appName, ua = navigator.userAgent, tem;
		var M = ua.match (/(opera|chrome|safari|firefox|msie)\/?\s*(\.?\d+(\.\d+)*)/i);
		if (M && (tem = ua.match (/version\/([\.\d]+)/i)) != null) M [2] = tem [1];
		return M ? { name: M [1], version: M [2], matched: true } : { name: N, version: navigator.appVersion, matched: false };
	})();

	__browser.compatible = !((__browser.name == 'MSIE' && (parseFloat(__browser.version) < '9')) || !__browser.matched );

	window.__browser = __browser;
});
