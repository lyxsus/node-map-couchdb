define ([
	'fos!jquery',
	'iona.renderer.helpers'
], function ($, helpers) {
  require (['fos!jquery-ui'], function () {});

	$.formatArray = function (data) {
		var result = {};
		for (var i in data) {
			result [data [i].name] = data [i].value;
		}
		return result;
	};

  $ (function () {
    $ ('html head link').each (function () {
        var $link = $ (this),
            href = $link.attr ('href'),
            urn;
      
      $link.on ('load', function () {
        console.log ('link was loaded');
      });
    
        if (urn = href.match (/urn%3A[^\/]+/g)) {
            urn = decodeURIComponent (urn);
            
            require ('storage').get (urn).ready (function () {
                this.on ('change:_rev', function (model, rev) {
                    $link.attr ('href', href + '?rev=' + rev);
                });
            });
        }
    });
  });
  
    // In-place drag'n'drop
	$ (function () {
		var $body = $ (document.body);

		var uploadProgress = function (event) {
			console.log ('upload progress', Math.round (100 * event.loaded / event.total), '%');
		};

		$body.on ('dragleave .ui-droppable', function (event) {
			$ (event.target).removeClass ('ui-dragover');
		});

		$body.on ('dragover .ui-droppable', function (event) {
			$ (event.target).addClass ('ui-dragover');
		});		
		
		$body.on ('drop .ui-droppable', function (event) {
			event.preventDefault ();
          
            var $target = $ (event.target),
                  view = $.data ($target.closest (':binded') [0], 'view'),
                  model = view.resource;
          
            helpers.uploadAttachments (model, event.originalEvent.dataTransfer.files);
		});
	});
  
    $.fn.serializeJSON = function (iterator) {
       var data = {};

       function set (name, value) {
            var tmp, index;
            if (tmp = name.match (/\[([^\]]*)\]$/)) {
                name = name.substring (0, tmp.index);
                index = tmp [1];
        
                if (data [name] == undefined) {
                    data [name] = index ? {} : [];
                }
        
                if (index) {
                    data [name] [index] = value;
                } else {
                    if (data [name].indexOf (value) == -1) {
                      data [name].push (value);
                    }
                }
            } else {
                data [name] = value;
            }
        }
      
	   $ (this).find (':input[name]').each (function () {
			var $item = $ (this),
                name = $item.attr ('name');


         
            if (typeof iterator == 'function') {
              	var value = iterator.call (this);
              
              	if (typeof value != 'undefined') {
                	set (name, value);
              		return;
                }
            }
         
			switch (true) {
				case this.type == 'radio':
					if (this.checked) {
                		set (name, $item.val ());
					}
					break;

                case this.type == 'checkbox':
                		if ($item.val () == 'on') {
	                		set (name, this.checked);
                		} else {
                			if (this.checked) {
                				set (name, $item.val ());
                			}
                		}
					break;
					
				default:
						set (name, $item.val ());
			}
			
		});      
      
       return data;
    }  
});
