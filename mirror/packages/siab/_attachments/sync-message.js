define (['storage'], function (storage) {
	return function (message) {
		var options = message.get ('sync').options;
		if (!options.token) return;

		// Create sync task
		return storage.create ({
			'content': message.get ('content'),
			'url': options.url,
			'bridge': message.get ('bridge'),
			'feature': options.feature,
			'status': null,
			'parent-task': message.get ('task'),
			'title': 'sync out message ' + message.id,
			'token': options.token,
			'type': 'urn:types/futurios-sync-task',
			'status': 'urn:fos:sync:task-status/pending',
			'related': message.id
		});
	}
});