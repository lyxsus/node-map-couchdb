define (function () {
	return {
		getProperty: function(model, path){
			var result, model = model.toJSON ? model.toJSON() : model;

			if (!path.match(/[[.]/)){
				return model [path];
			} else {
				var p = (path.substring (0, 1) == '[') ? '' : '.';
				eval ('try { result = model' + p + path + '; } catch(e) { /*console.error("missing property", path, e);*/ }');

				return result;
			}
		},

		setProperty: function(model, name, value){
		// console.log('set property:', arguments);
			if (name.match (/[[.]/)){
				eval ('model.attributes.' + name + ' = value;');
			} else {
				var data = {};
				data [name] = value;
				model.set (data, {silent: true});
			}

			var error = model.validateField (name, value);
			
			if (error && typeof error == 'string') {	// TODO: Remove with non-fos fields
				var invalid = {};
				invalid [name] = error;
				model.set ({
					_invalid: invalid
				});
			} else {
				var invalid = model.get ('_invalid');
				if (invalid && invalid [name]) {
					delete invalid [name];
					model.set ('_invalid', invalid);
				}
			}

		}
	}
});