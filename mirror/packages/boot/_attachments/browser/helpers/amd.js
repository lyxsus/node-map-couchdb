define (['fos!promises'], function (Promises) {
	return {
		require: function (modules) {
			var deferred = Promises.promise ();

			require (modules, _.bind (deferred.fulfill, deferred));

			return deferred;
		}
	};
});