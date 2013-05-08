define (['fos!jquery', 'fos!events', 'fos!boot/browser/libs/helpers.js'], function ($, events, helpers) {
	var geo = (function () {
      	var module = {errors: {} };

		_.extend (module, events.EventEmitter.prototype);
		module._isReady = false;

		function setReady () {
			module._isReady = true;
			module.trigger('ready');
		}		

		function setPosition (position){
			module.position = position.coords;

			var data = {
				geocode : module.position.longitude + ',' + module.position.latitude,
				kind	: 'locality',
				results : 1,
				format  : 'json'
			};

			$.get('http://geocode-maps.yandex.ru/1.x/', data, function(result){
				var geoResult = result.response.GeoObjectCollection;
				var geoObject = geoResult ? geoResult.featureMember[0].GeoObject : null;
              	var region    = geoObject.metaDataProperty.GeocoderMetaData.AddressDetails.Country.Locality.LocalityName;
              
                if (region) {
                  require('storage').get( helpers.makeUrn('urn:geo:toponym', {title: region}) ).ready(function(){
                    var toponim = this.models().length ? this.models() [0] : null;
                    
                    if (toponim) {
                        module.setLocation(toponim.id);
                    } else {
                        module.errors.matchingError = 'Search result in toponims collection is null';
                    }
    
                    setReady();
                  });
                } else {
                    module.errors.geocodeError = 'Geocode error happened';
                }
				
			}, 'json');
		};

		function translateError (error)  {
			module.errors.locationError = error;

	  		switch(error.code)    {
	    		case error.PERMISSION_DENIED:
	    		module.errors.locationError = "User denied the request.";
	      		break;

			    case error.POSITION_UNAVAILABLE:
			    module.errors.locationError = "Location information is unavailable.";
			    break;

	    		case error.TIMEOUT:
	    		module.errors.locationError = "The request to get user location timed out.";
			    break;

	    		case error.UNKNOWN_ERROR:
	    		module.errors.locationError = "An unknown error occurred.";
			    break;
	    	}
	  	}

		function locate () {
			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(setPosition, translateError);
    		} else {
    			module.errors.compatibilityError = 'Geolocation is not supported by this browser';
    		}
		};

		function getRegion () {
			if (module.account) {
				require('storage').get(module.account).ready(function(){
					if (this.get('region')){
						module.region = this.get('region');
						setReady();
					} else {
						locate();
					}
				});

			} else if ($.cookie('region')) {

              	module.region = $.cookie('region');
				setReady();
              
			} else {
				locate();
			}
		};

		module.setLocation = function (region){
			module.region = region;
			
			if (module.account) {
				require('storage').get(module.account).ready(function(){
					this.set({ region: region }, {silent: true});
                  	this.save({}, {
                      error: function(){console.error('geo save error', arguments);}
                  	});
				});						
			} else {
				$.cookie('region', region, { expires: 365 });
			}
		};		

		module.getLocation = function() {
			return { 
				ready: function(callback) {
					if (typeof callback == 'function'){
						var executeCallback = function(){
							if (module.errors) {
								callback.call({ errors: module.errors });
							} else {
								callback.call({ region: module.region });
							}					

							module.off('ready', executeCallback);
						};

						if (module._isReady){
							executeCallback();
						} else {
							module.on('ready', executeCallback);	
						}
					}
				}
			}; 
		};

		module.init = function() {
			_.delay(function(){
				module.account = require('iona.sessions').session.account;
				getRegion();
			}, 250);
		}

		return module;
	})();

	return geo;

});