define ({
	sessions: {
		secret: '87rxth4t637',
		key: 'sid',

		store: {
			type: 'redis',
			options: {}
		}
	},

	nobody: {/* ... */},

	pool: {
		server: {
			// host: 'localhost',
			// host: '192.168.1.42',
			port: 5984,
			// host: '89.179.119.16',
			// host: 'futurios.org',
			host: '127.0.0.1',

			auth: {
				// username: 'lyxsus@gmail.com',
				username: 'lyxsus',
				password: 'letmein'
			},
			
			notifications: {
				port: 5983
			}
		}
	},

	http: {
		port: 80
	}
});