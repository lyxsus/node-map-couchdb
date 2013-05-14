define (['node!connect-couchdb', 'node!connect-redis'], function (CouchStore, RedisStore) {
	return function sessions (express, config) {
		var Store;

		switch (config.store ? config.store.type : 'memory') {
			case 'couchdb':
				Store = CouchStore (express);
				break;

			case 'redis':
				Store = RedisStore (express);
				break;

			default:
				Store = express.session.MemoryStore;
		}

		config.instance = new Store (config.store ? config.store.options : null);
		
		return express.session ({
			secret: config.secret,
			key: config.key,
			store: config.instance
		});
	};
});