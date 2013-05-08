define([
	"fos!jquery",
	"fos!lodash"
], function($, _){

	$.fn.serialize_form = function () {
		var $form = $(this);
		var data = {};
		
		_ ($form.find(':input[name]')).each(function(item){
			var $item = $(item);
			
			switch (true) {
				case $item.is('[type=radio]'): 
					if ($item.is(':checked')) {
						data [$item.attr('name')] = $item.val();
					};

					break;
				case $item.is('[data-hashed]'): 
					var hash_name = $item.attr('data-hashed');
					
					if (!data [hash_name]) { data [hash_name] = {}; }
					data [hash_name] [$item.attr('name')] = $item.val();
				
					break;
					
				default:
				
					data [$item.attr('name')] = $item.val();	
			}
			
		});
		
		return data;	
	}

});