define (function () {
	return {
		declination: function (i) {
			return arguments [1 +
				((i % 100 > 4 && i % 100 < 20)
				? 2
				: [2, 0, 1, 1, 1, 2] [(i % 10 < 5) ? i % 10 : 5])
			]; 
		},

		stringify: function (obj) {
			return JSON.stringify (obj, null, '\t');
		},

		getLanguageId: function () {
			return navigator.languageId;
		},

		pageUri: function (){
			return require ('futurios/settings').page_uri;
		},
    
		getPage: function () {
			return require ('futurios/settings').page;  
		},

		modifiersData: function (model, modifier, collectionId) {
			var data = {}, 
				model = model.toJSON ? model.toJSON () : model,
				modifier = modifier.toJSON ? modifier.toJSON () : modifier;

			// external widget settings set by collection container widget
			var fields = modifier.groups && modifier.groups ['source-settings'] && modifier.groups ['source-settings'].fields;
				_.each (fields, function (field) { 
				data [field.name] = model [field.name];
			});

			// console.log('modifier:', modifier.title, modifier._modifier);

			// current widget modifiers
			_.extend (data, modifier._modifier && modifier._modifier [collectionId]);

			// console.log(model.title, 'modifier data:', data);*/

			return data;
		},

		matchLayout: function(theme, pageStamp){
			var theme = theme.toJSON ? theme.toJSON() : theme;

			var layout = theme.defaultLayout;

			_.find(theme ['additional-layouts'], function(layoutId){
				var idHash = layoutId.split('urn:fos:layout/') [1],
					idsField = theme ['ids-' + idHash],
					typesField = theme [pageStamp.class + '-types-' + idHash];

				if (idsField && idsField.indexOf(pageStamp.id) != -1) {
					return layout = layoutId;
				}

				if (typesField && typesField.indexOf(pageStamp.type) != -1){
					layout = layoutId;
				}
			});

			return layout; 
		}
	};
});