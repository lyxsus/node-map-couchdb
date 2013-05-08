define (['fos!jquery', 'fos!lodash', 'fos!boot/browser/libs/helpers.js'], function ($, _, helpers) {
  (function () {
	var pluginName = 'selected',
		defaults = {
			placeholder : 'выберите из списка',
			no_results  : 'ничего не найдено',

	       	sort        : false,
          
          	sortable	: false,
          	onSort		: function(){},
          
          	emptyAllowed: false,
          	emptyElement: 'не выбрано',

			addable		: false,
			addnewtext  : 'добавить',
			onAddItem	: function(){},

			onOpen		: function(){},
			onClose     : function(){},

			onSelect    : function(){},
          
          	onItemClick : function(){},
          
          	source		: null,

			getDataParse: function(data){ return data; },
          	getData     : null
		};

	var containerTpl = '<div class="sel-container <%= data.multiple ? "sel-container-multi" : "sel-container-single" %>" style="width:<%= data.width %>px;"/>';

	var chosenTpl = '' + 
		'<% var selected = _.filter(data.items, function(item){ return item.selected; });  %>' +
		'<% if (data.multiple) { %>' +
			'<ul class="sel-choices">' +

				'<% _.each(selected, function(item) { %>' +
					'<li rel="<%= item.value %>" class="search-choice">' +
						'<span><%= item.title || item.value %></span>' +
						'<a href="#" class="search-choice-close" rel="<%= item.value %>"/>' +
					'</li>' +
				'<% }); %>' +

				'<li class="search-field">' +
					'<% if (!selected.length) { %>' +
						'<input class="do-not-style default" type="text" autocomplete="off" placeholder="<%= data.placeholder %>"/>' +	
					'<% } else { %>' +
						'<input class="do-not-style" type="text" autocomplete="off"/>' +	
					'<% }%>' +
				'</li>' +
			'</ul>' +

		'<% } else { %>' +
			'<a href="#" class="sel-single">' + 
        		'<span><%= selected [0] && !(data.emptyAllowed && !selected [0].value) ? (selected [0].title || selected [0].value) : data.placeholder %></span>' + 
        	'</a>' +
		'<% }  %>';

	var dropdownTpl = '' +
		'<div class="sel-drop" style="width:<%= data.width %>px;">' +
	    '<% if (!data.multiple) { %>' +
			'<div class="sel-search"><input class="do-not-style" type="text" autocomplete="off"/></div>' +
	    '<% }  %>' +
	   	'</div>';

	var resultsTpl = '' +
		'<% if (data.items && data.items.length) { %>' +
			'<% if (data.multiple) { %>' +
				'<ul class="sel-results">' +
					'<% _.each(data.items, function(item, index) { %>' +
						'<% if (!item.selected && !!item.value ) { %>' +
						'<% var title = data.outsideData ? "<span data-bind=\'" + item.value + "\' data-tags=\'title\' data-replace=\'true\' />" : item.title; %>' +
						'<li rel="<%= item.value %>" class="<%= item.disabled ? "disabled" : "" %><%= index == 0 ? " highlighted" : "" %>"><%= title %></li>' +
						'<% } %>' +
					'<% }); %>' +
				'</ul>' +
			'<% } else { %>' +
				'<ul class="sel-results">' +
					'<% _.each(data.items, function(item, index) { %>' +
						'<% var title = data.outsideData ? "<span data-bind=\'" + item.value + "\' data-tags=\'title\' data-replace=\'true\' />" : item.title; %>' +
        				'<li rel="<%= item.value %>" class="' +
        				  '<%= item.disabled ? "disabled" : "" %><%= item.selected ? " selected" : "" %>' + 
        				  '<%= (data.outsideData && (index == 0) && item.value) || item.selected ? " highlighted" : "" %>">' + 
                          '<%= (data.emptyAllowed && (index == 0) && !item.value) ? data.emptyElement : title %>' +
        			  	'</li>' +
					'<% }); %>' +
				'</ul>' +
			'<% } %>' +	
			'<% if (data.addable) { %>' +
			'<div class="sel-add-new"><a href="#"><%= data.addnewtext %></a></div>' +
			'<% } %>' +			
		'<% } else if (data.search) { %>' +
			'<% if (!data.outsideData) { %>' +		
			'<div class="no-results"><%= data.no_results %></div>' +
			'<% } %>' +
		'<% } %>';

	function Plugin (element, options) {
      	var searchMode = {};
		
      	this.element = element;
      	this._defaults = defaults;
      
      	// outside search data mod
        if (options && options.source) {
          searchMode = {
            getData: function(value, render){
              var $select = $(this),
                  source = helpers.makeUrn(options.source, {search: value, limit: 20, include_docs: true});
              
              //console.log ('selected search', source);
              
              require ('storage').get (source).ready (function () { 
                render(_.reject(this.models (), function(item){ 
                  return $select.val() && $select [0].multiple ? $select.val().indexOf(item.id) != -1 : $select.val() == item.id;
                })); 
              }); 
            },
            getDataParse: function(data){
              return data.map(function(item){
                return {
                  title: item.get('title'),
                  value: item.id
                };
              });
            },
            onSelect: function(data){
              var $select = $(this);
              if (!$select.find('option[value="' + data.value + '"]').length) {
                //var $option = $('<option data-bind="' + data.value + '" data-use="' + data.value + '" data-tags="option" data-replace="true" value="' + data.value + '" selected/>');
                //$select.append($option).scan();
                var $option = $('<option value="' + data.value + '" selected/>');
                $select.append($option);
              } else {
                $select.val(this.multiple ? ($select.val() || []).push(data.value) : data.value);
              }        
            }
          };
        }
      
      	this.options = $.extend ({}, defaults, searchMode, options);

		this.init();
	}

	Plugin.prototype.containerTpl = _.template(containerTpl);
	Plugin.prototype.chosenTpl 	  = _.template(chosenTpl);
	Plugin.prototype.dropdownTpl  = _.template(dropdownTpl);
	Plugin.prototype.resultsTpl   = _.template(resultsTpl);

	Plugin.prototype.scan_select = function(){
		var $select = $(this.element),
            selector = !this.element.multiple && this.options.emptyAllowed ? 'option' : 'option[value]';
      
      	var items = $select.find(selector).map(function(){
			return {
				title	: $(this).text(),
				value	: this.value,
				selected: this.selected,
				disabled: this.disabled
			};
		});

		if (this.options.sort) {
			return _.sortBy(items, function(item){
				return item.title || item.value;
			});	
		} else {
			return items;
		}
	};

	Plugin.prototype.movedown_handler = function ($dropdown){
		var $current = $dropdown.find('.highlighted'),
			$first = $dropdown.find('.sel-results li:not(.disabled)').first(),
			$next = !!$current.length ? $current.nextAll(':not(.disabled)').first() : $first;

		$next = !!$next.length ? $next : $first;

		$current.removeClass('highlighted');
		$next.addClass('highlighted');
	}

	Plugin.prototype.moveup_handler = function ($dropdown){
		var $current = $dropdown.find('.highlighted'),
			$last = $dropdown.find('.sel-results li:not(.disabled)').last(),
			$prev = !!$current.length ? $current.prevAll(':not(.disabled)').first() : $last;

		$prev = !!$prev.length ? $prev : $last;

		$current.removeClass('highlighted');
		$prev.addClass('highlighted');
	}

	Plugin.prototype.choose_result = function ($dropdown){
		var $select = $(this.element);
		var $this = $dropdown.find('.highlighted');

		var value;

		if ($select[0].multiple){
			value = $this.attr('rel') 
				? _.union($select.val() || [], $this.attr('rel'))
				: $select.val();
		} else {
			value = $this.attr('rel');
		}

      	this.options.onSelect.apply($select[0], [{
			value: $this.attr('rel'),
			title: $this.text()
		}]);

		$select.val(value).trigger('change');
	}	

	Plugin.prototype.results_search = function (data, value){
		var regExp = new RegExp(value, 'i');
		return _.filter(data, function(item){
			return !item.selected && !item.disabled && item.title.match(regExp);
		});
	};

	Plugin.prototype.init = function () {
		var containerTpl = this.containerTpl;
		var chosenTpl    = this.chosenTpl;
		var dropdownTpl  = this.dropdownTpl;
		var resultsTpl   = this.resultsTpl;

		var self = this,
			$select = $(this.element),
			$holder = $select.parent();

		var _plugin = {
			width 		: $select.outerWidth(),
			multiple	: $select[0].multiple,
			placeholder : $select.attr('data-placeholder') || this._defaults.placeholder,

			no_results  : $select.attr('data-no-results') || this._defaults.no_results,
          
          	emptyAllowed: $select.attr('data-empty-allowed') || this._defaults.emptyAllowed,
          	emptyElement: $select.attr('data-empty-element') || this._defaults.emptyElement,
			
			addable 	: this.options.addable,
			addnewtext	: $select.attr('data-add-new-text') || this._defaults.addnewtext,

			outsideData : typeof self.options.getData == 'function'
		}			

		$select.addClass('sel-selected-done').hide();

		// first render 

		_plugin.items = self.scan_select($select);

		var $container = $( containerTpl({data: _plugin}) );
		var $chosen    = $('<div/>').html( chosenTpl({data: _plugin}) );
		var $dropdown  = $( dropdownTpl({data: _plugin}) );
		var $results   = $('<div/>').html( resultsTpl({data: _plugin}) );

		$dropdown.append($results);
		$container.append($chosen).append($dropdown);

		$.data($container[0], 'selected.js', this);

		$select.after($container);

		if (_plugin.outsideData) $results.scan ();
      
        var applySortable = function($container){
          if ($.fn.sortable){
            var $choises = $container.find('.sel-choices');
            $choises.sortable({
              //containment: $container[0],
              stop: function(){ self.options.onSort($choises) }
            });
          } else {
            console.warn('selected.js: jQuery UI not found, cannot apply sortable');
          }
        };

        if (self.options.sortable) { applySortable($container); }


		var set_closed = function(){
			$select.removeClass('sel-active');
			$container.removeClass('sel-container-active');

			$container
              .find('.search-field input, .sel-search input')
              	.removeAttr('style').val('').trigger('blur');

			//$results.html(resultsTpl({data: _plugin}));
			//if (_plugin.outsideData) $results.scan ();

			self.options.onClose();
		};

		var select_changed = _.debounce(function(){
			_plugin.items = self.scan_select($select);
			$chosen.html(chosenTpl({data: _plugin}));
			$results.html(resultsTpl({data: _plugin}));
			if (_plugin.outsideData) $results.scan ();
          
			$container.removeClass('sel-container-active');
			$container.find('.search-field input, .sel-search input').val('');
          
          	if (self.options.sortable) { applySortable($container); }

			self.options.onClose();			
		}, navigator.userAgent.indexOf('WebKit') == -1 ? 35 : 25);

      
      	var processKeyupValue = _.debounce(function(value){
          var data = {};
          if (_plugin.outsideData){
            self.options.getData.apply($select [0], [value, function (result) {
              data = _.extend($.extend(true, {}, _plugin), {
                items: self.options.getDataParse(result),
                search: value
              });
              
              $results.html( resultsTpl({data: data}) );
              $container.addClass('sel-container-active');
              if (_plugin.outsideData) $results.scan ();
              
            }]);
          } else {
            data = _.extend($.extend(true, {}, _plugin), {
              items: self.results_search(_plugin.items, value),
              search: value
            });
            
            $results.html( resultsTpl({data: data}) );
            $container.addClass('sel-container-active');
            if (_plugin.outsideData) $results.scan ();
            
          }
      	}, 220);
      
      	var keyupHandler = _.debounce(function(event){
		  if ($container.hasClass('sel-container-active')) {
		      var $field = $(this), stroke, _ref, 
		      	  value = $field.val() && $field.val().trim();

		      stroke = (_ref = event.which) != null ? _ref : event.keyCode;

		      switch (stroke) {
		      	// enter
		      	case 13: break;
		      	// arrows
		      	case 37: break;
		      	case 38: break;
		      	case 39: break;
		      	case 40: break;
                  
		      	// other: display search results
		        default:
                  
                  // input size issues
                  if (_plugin.multiple) {
                    if (value) {
                        $field.width(value.length*12);
                    } else {
                        $field.removeAttr('style');
                    }
                  }
                  
				  if (value) processKeyupValue.apply(this, [value]);
		      }		  	
		  }

		}, 50);      

		// events: container
      
		$container.on('click', '.sel-single, .sel-choices', function(){
			if ($container.hasClass('sel-container-active')){
				$select.trigger('list:close');
			} else {

				$('select.sel-active').trigger('list:close');

				$select.addClass('sel-active');
				$container.addClass('sel-container-active');
				$container.find('.search-field input, .sel-search input').trigger('focus');

				self.options.onOpen();
			}

			return false;

		}).on('mouseenter', '.sel-results li:not(:selected)', function(){
			var $this = $(this).addClass('highlighted');
			$this.siblings().removeClass('highlighted');

			return false;
		}).on('click', '.sel-results li:not(:selected)', function(){
			var $this = $(this), value;

			if (_plugin.multiple){
				value = $this.attr('rel') 
					? _.union($select.val() || [], $this.attr('rel'))
					: $select.val();
			} else {
				value = $this.attr('rel');
			}

            self.options.onSelect.apply($select [0], [{
                value: $this.attr('rel'),
                title: $this.text()
            }]);

			$select.val(value).trigger('change');

			return false;

		}).on('click', '.search-choice-close', function(){
			var values = _.without($select.val(), $(this).attr('rel'));
			
			$select.val(values).trigger('change');

			return false;

		}).on('mousedown', '.search-choice', function(e){
   			if( e.which == 2 ) {
      			e.preventDefault();
				var values = _.without($select.val(), $(this).attr('rel'));
			
				$select.val(values).trigger('change');

				return false;
            }
        }).on('click', '.search-choice', function(){
			self.options.onItemClick($(this));
			return false;
		}).on('click', '.search-field input, .sel-search input', function(){
			if ($container.hasClass('sel-container-active')) {
				return false;
			}
		}).on('keydown', '.search-field input, .sel-search input', function(event){
	      var $field = $(this), stroke, _ref;
	      var $dropdown = $container.find('.sel-drop');

	      stroke = (_ref = event.which) != null ? _ref : event.keyCode;

	      switch (stroke) {
	      	// escape
	      	case 27: 
	      		event.preventDefault();
	      		$select.trigger('list:close');
	      		break;
            // backspace
	        case 8:
		      	if (_plugin.multiple) {
		      		$field.width($field.val().length*12);
		      	}
	          	break;
	        // tab

	        // enter
	        case 13:
	          	event.preventDefault();
	          	self.choose_result($dropdown, $select);
	          	break;
	        // up arrow 
	        case 38:
	          	event.preventDefault();
	          	self.moveup_handler($dropdown);
	          	break;
	        // down arrow
	        case 40:
	        	self.movedown_handler($dropdown);
	          	break;
	      }
		}).on('keyup', '.search-field input, .sel-search input', keyupHandler);       

		
		// events: select

		var eventsList = {
			'change' 	  : function(){ select_changed(); },
			'list:updated': function(){ select_changed(); return false; },
			'list:close'  : function(){ set_closed(); return false; }
		};

		var holderEvents = $.data ($holder [0], 'events');
      
		_.each(eventsList, function (handler, eventName) {
			if (holderEvents && holderEvents [eventName] && holderEvents [eventName].handler ) {
				var event = _.find(holderEvents [eventName], function(event) {
					return event.selector == 'select.sel-selected-done';
				});
				event.handler = handler;
			} else {
				$holder.on(eventName, 'select.sel-selected-done', handler);
			}
		});


		// events: document

		var documentEvents = $.data(document, 'events') || {};
		var alreadyBinded = _.any(documentEvents.click, function(event){
			return event.selector == ":not(.sel-container)";
		});

		if (!alreadyBinded) {
			$(document).on('click', ':not(.sel-container)', function(event){
				$('.sel-active').trigger('list:close');
			});
		}
	};


	// plugin wrapper

	$.fn[pluginName] = function (options)  {
		var i = 0;

		var initialize = function () {
			if (!$ (this).parents ('body').size () && (++i < 25)) {
				_.delay (_.bind (initialize, this), 500);
				return;
			}

			if (this.nodeName == 'SELECT') {
				if (!$.data (this, 'plugin_JS' + pluginName)) {

					// TODO: reassign insead of remove
					var $another = $(this).siblings('.sel-container');
					if (!!$another.length){ $another.remove(); }

					$.data (this, 'plugin_JS' + pluginName, new Plugin (this, options));
				}

			}
		};

		return this.each (initialize);
	};

})();
  
});