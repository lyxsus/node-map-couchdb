define (['node!http', 'fos!futurios-pool', './config', 'node!vow', './libs/master'], function (http, Pool, config, Promises, SyncMaster) {
	function getClient (pool) {
		return pool.client (config.client);
	}

	function getMaster (client) {
		return new SyncMaster (client);
	}

	function bindServer (master) {
		var server = http.createServer (function (request, response) {
			response.writeHead (200, {'Content-Type': 'text/plain'});
			response.write ('master sync');
			response.end ();
		}).listen (8001);
		
		master.listen (server);
	}

	Promises.when ((new Pool (config.pool)).ready ())
		.then (getClient)
		.then (getMaster)
		.then (bindServer)
		.fail (console.error)
		.done ();
});
