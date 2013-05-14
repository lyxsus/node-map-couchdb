define (['storage', 'fos!promises', 'fos!siab/sync-message'], function (storage, Promises, syncMessage) {
	function getMessageType (data) {
		if (/^urn:accounts\//.test (data ['reply-as'])) {
			return 'issue-comment';
		}

		if (/^urn:siab:message\//.test (data ['reply-to'])) {
			return 'public-message';
		}

		if (/^urn:siab:account\//.test (data ['reply-to'])) {
			return 'private-message';
		}
	}

	function convertMessage (data) {
		switch (getMessageType (data)) {
			case 'issue-comment':
				return {
					content: data.content,
					issue: data.issue,
					type: 'urn:types/siab-issue-comment'
				};

			case 'public-message':
				return {
					content: data.content,
					issue: data.issue,
					author: data ['reply-as'],
					ancestor: data ['reply-to'],
					type: 'urn:types/siab-message'
				};

			case 'private-message':
				return {
					content: data.content,
					issue: data.issue,
					author: data ['reply-as'],
					recipient: data ['reply-to'],
					type: 'urn:types/siab-message',
					'entry-type': 'urn:fos:sync:entry-type/cf6681b2f294c4a7a648ed2bf1ea7f50'
				};

			default:
				throw new Error ('Unkown message type ' + type);
		}
	}

	function getToken (accountId) {
		if (!accountId) return null;

		return Promises.when (storage.get (accountId))
			.then (function (account) {
				var tokens = account.get ('tokens');

				if (tokens && tokens.length) {
					return storage.get (tokens [0]);
				}
			})
	}

	function getResponseFeature (bridgeId) {
		if (!bridgeId) return null;

		return Promises.when (storage.get (bridgeId))
			.then (function (bridge) {
				return storage.get (bridge.get ('connector'))
			})
			.then (function (connector) {
				return connector.get ('response');
			});
	}

	return function (data) {
		return Promises.when (storage.get (data ['reply-to'] || data ['issue']))
			.then (function (message) {
				return Promises.all ([
					getToken (data ['reply-as']),
					getResponseFeature (message.get ('bridge'))
				])
					.then (function (results) {
						var token = results [0],
							featureId = results [1];

						return {
							url: message.get ('url'),
							bridge: message.get ('bridge'),
							token: token ? token.id : null,
							feature: featureId,
							task: message.get ('task')
						};
					});

			})

			.then (function (options) {
				return storage.create (
					_.extend (convertMessage (data), {
						sync: {
							options: options,
							status: 'syncing'
						},
						bridge: options.bridge,
						task: options.task,
						created_at: Math.round (Date.now () * 1000)
					})
				);
			})

			.then (syncMessage);
	};
});