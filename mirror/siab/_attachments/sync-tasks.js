define (['storage', 'fos!promises'], function (storage, Promises) {
	var e = encodeURIComponent;

	return function (url) {
		var host, tmp;

		url = url.replace (/#.*/, '');
		
		  if (tmp = url.match (/https?:\/\/[^\/]+/)) {
			  host = tmp [0];
		  }

		var getBridge = function (host) {
		  var promise = Promises.promise ();
		  
		  storage.get ('urn:fos:sync:bridge?limit=1&base-uri=' + e (host))
			.ready (function (bridges) {
			  var models = bridges.models ();
			  if (models.length) {
				promise.fulfill (models [0]);
			  } else {
				promise.reject ('Не удалось определить источник');
			  }
			});
		  
		  return promise;
		};
		
		var getTasks = function (url) {
		  var urn = 'urn:fos:sync:task?url=' + e (url) + '&limit=10';
		  return Promises.when (storage.get (urn));
		};
		
		var getFeatures = function (source, url) {
		  try {
			return eval ('(' + source + ')') (url);
		  } catch (e) {
			console.error ('getFeatures error', e.message);
		  }
		};
		
		var filterFeatures = function (features, tasks) {
		  return _.filter (features, function (feature) {
			return !_.any (tasks.models (), function (task) {
			  return task.get ('feature') === feature;
			});
		  });
		};
		
		var createMissingTasks = function (features, bridge) {
		  return Promises.all (
			_.map (features, function (feature) {
			  return storage.create ({
				'url': url,
				'feature': feature,
				'bridge': bridge,
				
				'status': 'urn:fos:sync:task-status/new',
				'public': true,
				
				'type': 'urn:types/futurios-sync-task'
			  });
			})
		  )
		};
		
		return Promises.all ([getTasks (url), getBridge (host)])
		  .then (function () {
			var tasks = arguments [0] [0],
				bridge = arguments [0] [1],
				features = getFeatures (bridge.get ('detect'), url);
			
			if (features) {
			  return createMissingTasks (filterFeatures (features, tasks), bridge.id);
			} else {
			  return Promises.reject ('Коннектор не поддерживает опеределение источника по URL');
			}
		  })
		  
		  .then (function () {
			return {
			  url: url
			};
		  });
	};
});