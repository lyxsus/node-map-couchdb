define (function () {
	function getRoles (pattern) {
		if (arguments.length == 2) {
			var	roles = arguments [0],
				pattern = arguments [1];

			if (pattern) {
				return _.filter (roles, function (role) {
					return role.match (pattern);
				});
			} else {
				return roles;
			}
		}

		return require ('iona.sessions').roles (pattern);
	}

	return {
		role: function (pattern) {
			return getRoles (pattern).length > 0;
		},
  
		roles: getRoles,

		can: function (key, doc) {
			return true;
			var _userCtx = require ('iona.sessions')._userCtx,
				username = _userCtx.name,
				account = 'urn:accounts/' + username,
				roles = _userCtx.roles;

			var isAdmin = roles.indexOf ('_admin') !== -1,
				isOwner = [doc._id, doc.meta ? doc.meta.created_by : null].indexOf (account) !== -1,
				isShared;

			if (isAdmin) return true;

			var type = require ('storage').get (doc.type).toJSON (),
				permissions = (type.meta && type.meta.permissions) ? type.meta.permissions : null;

			if (!permissions) return true;

			isShared = (function (shared, username, roles) {
				if (shared.indexOf ('urn:accounts/' + username) != -1) {
					return true;
				}

				for (var i = 0, tmp; i < roles.length; i++) {
					if (shared.indexOf ('roles/' + roles [i]) != -1) return true;

					if (tmp = roles [i].match (/^companies\/([^\/]+)/)) {
						if (shared.indexOf ('urn:onstra:company/' + tmp [1]) != -1) {
							return true;
						}
					}
				}

				return true;
			}) (doc.meta.shared, username, roles);

			var check = function (rule) {
				// Check username
				if (rule.names) {
					if (rule.names.indexOf (username) != -1) {
						return true;
					}

					if (rule.names.indexOf ('#owner') != -1) {
						if (isOwner) return true;
					}

					if (rule.names.indexOf ('#shared') != -1) {
						if (isShared) return true;
					}
				} else {
					if (isOwner) return true;
				}

				// Check role
				var groups = rule.roles || rule.groups;
				if (groups) {
					for (var i = 0; i < roles.length; i++) {
						if (groups.indexOf (roles [i]) != -1) {
							return true;
						}
					}
				}

				return false;
			};

			for (var i in permissions) {
				if (i.substring (0, key.length) == key) {
					return (check (permissions [i]));
				}
			}
		}
	}
});