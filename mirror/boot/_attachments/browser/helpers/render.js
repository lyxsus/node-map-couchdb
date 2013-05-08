define (function () {
	return {
		groupFields: function(_fields, _groups) {
			var fields = _.clone (_fields, true);
			var groups = _.defaults (_groups ? _.clone (_groups, true) : {}, {'default': {title: 'default'} } );

			var fields_grouped = {'default': {} };

			_.each (fields, function (field, index){ 
				var group_id = 'default';

				var group =_.find (groups, function (group, id) {
					var position = 0;

					var fieldInfo = _.find (group.fields, function (itemInfo, pos){
						var info = _.isString (itemInfo) ? {name: itemInfo, index: pos} : itemInfo;

						if (info.name == index) {
							position = info.index;
							return true;
						}
					});

					if (fieldInfo) {
						field._index = position;
						return group_id = id;
					}
				});

				if (!fields_grouped [group_id]) {
					fields_grouped [group_id] = {};
				}
				
				fields_grouped [group_id] [index] = field;
			});

			return _.sortBy (groups, function (item, index){ 
				item._key = index;
				item.fields = _.sortBy (fields_grouped [index], function(field, name){
					field._key = name;
					return parseInt(field._index);
				});
				return item.index ? parseInt (item.index) : -1;
			});
		},

		// fields helpers
		getGroup: function(model, groupName){
			var model = model.toJSON ? model.toJSON() : model;
			var group = model._type.groups && model._type.groups [groupName];

			if (!group) {
				var schema = _.find (model._prefetch, function (schema){
					var schema = schema.toJSON ? schema.toJSON() : schema;
					return schema.groups && schema.groups [groupName];
				});

				group = schema.toJSON ? schema.get('groups') [groupName] : schema.groups [groupName];
			}

			return group;
		},

		getField: function (model, fieldName){
			var fieldName = fieldName.match(/[[.]/) ? _.last(fieldName.match(/[A-Za-z0-9-_]+/g)) : fieldName;

			var model = model.attributes ? model.attributes : model;
			if (!model._type) {
				// TODO: Debug that
				// throw new Error ('Can not get field without type');
				return;
			}

			var type  = model._type.attributes ? model._type.attributes : model._type;
			var field = type.fields [fieldName];

			if (!field) {
				var schema; 

				_.find(model._prefetch, function(entry){
					var _schema;

					// multiple prefetch field
					if (_.isArray(entry)) {
						_schema = _.find(entry, function(item){
							var _item = item.attributes ? item.attributes : item;
							return item.fields && item.fields [fieldName]
						});

						if (_schema) {
							schema = _schema;
							return true;
						}

						// single prefetch field
					} else {
						_schema = entry.attributes ? entry.attributes : entry;
						if (_schema.fields && _schema.fields [fieldName]){
							schema = entry;
							return true;
						}
					}
				});

				field = schema && (schema.attributes ? schema.attributes.fields [fieldName] : schema.fields [fieldName]);
			}

			if (!field) { 
				console.warn('missing field', fieldName, 'in schemas for', model._id); 
				field = {type: '', templateRole: {} };
			}

			return field;
		},

		fieldTag: function(model, fieldName, prefix) {
			var field = this.getField(model, fieldName),
				prefix = prefix ? prefix + '-' : '',
				templateRole = field.templateRole;

			if (!templateRole) {
				throw new Error('templateRole is missing for ' + fieldName + ' in ' + model._id); 
			}

			return templateRole [prefix + 'view'] || templateRole ['view'];
		},

		fieldTagEdit: function (model, fieldName, prefix) {
			var field = this.getField (model, fieldName),
			prefix = prefix ? prefix + '-' : '',
			templateRole = field.templateRole;

			if (!templateRole) {
				throw new Error('templateRole is missing for ' + fieldName + ' in ' + model._id); 
			}

			return templateRole [prefix + 'edit'] || templateRole ['edit'];
		},

		render: function(){
			var args = Array().slice.call (arguments),
				model = args[0], fieldName, options, tag, role, tagName, classes, replace, prefix;

			if (!model) return;

			model = model.toJSON ? model.toJSON() : model;

			switch (true) {
				// 1 argument -> document full view (no params)
				case args.length == 1: 
					return '<div data-bind="' + model._id + '" data-tags="default-view-full"/>';

				case (args.length == 2) && (typeof args [1] == 'object'):
					options = args [1];
					tagName	= options.tag || 'div';
					classes = (options.classes && !options.replace) ? ' class="' + options.classes + '"' : '';
					replace = options.replace ? ' data-replace="true"': '';

					// 2 arguments -> scheme/group view with params
					if (options.scheme || options.group) {
						role  = options.edit ? 'default-edit-' : 'default-view-';
						role += options.scheme ? 'scheme' : 'group';
						return '<'+ tagName + classes + ' data-bind="' + model._id + '" data-tags="' + role + '" data-use=\'' + (options.scheme || options.group) + '\'' + replace + '/>';

						// 2 arguments -> document full edit/view with params
					} else {
						role  = options.edit ? 'default-edit-full' : 'default-view-full';
						return '<'+ tagName + classes + ' data-bind="' + model._id + '" data-tags="' + role + '"' + replace + '/>';
					}

				// 2 arguments -> field view (no params) 
				case (args.length == 2) && (typeof args [1] == 'string'):
					fieldName = args [1];
					return '<div data-bind="' + model._id + '" data-tags="' + this.fieldTag(model, fieldName) + '" data-use=\'' + fieldName + '\'/>';

				// 3 arguments -> field view with params
				default:
					fieldName = args [1];
					options   = args [2];
					prefix    = options.prefix || '';
					tagName	  = options.tag || 'div';
					classes   = (options.classes && !options.replace) ? ' class="' + options.classes + '"' : '';
					replace   = options.replace ? ' data-replace="true"': '';

					var fieldTag = options.edit ? this.fieldTagEdit(model, fieldName, prefix) : this.fieldTag(model, fieldName, prefix),
					tag = '<'+ tagName + classes + ' data-bind="' + model._id + '" data-tags="' + fieldTag + '" data-use=\'' + fieldName + '\'' + replace + '/>';

					return tag;
			}
		}
	};
});