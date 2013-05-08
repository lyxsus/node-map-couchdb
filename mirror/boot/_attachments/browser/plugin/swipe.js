  /*
   * Swipe 1.0
   *
   * Brad Birdsall, Prime
   * Copyright 2011, Licensed GPL & MIT
   *
  */

define([
    'fos!jquery',     // $.data support
    'fos!lodash', // extend support 
    'fos!events'    // Backbone.Events support
  
  ], function($, _, events){

  var swipe = (function(){
    
      var module = _.extend({

        id: 'plugins/swipe',

        setup: function(node, options){

          // return immediately if element doesn't exist
          if (!node) return;

          // reference dom elements
          var container = this.container = typeof node.get == 'function' ? node [0] : node;

          // return immediately if already attached
          if (!$.data(container, 'swipe')) { 
            $.data(container, 'swipe', this);
          } else {
            this.update();
            return;
          };

          var element = this.element = container.children[0]; // the slide pane

          // static css
          container.style.overflow = 'hidden';

          // retreive options
          this.options = options || {};
          this.index = this.options.startSlide || this.index || 0;
          this.speed = this.options.speed || this.speed || 300;
          this.callback = this.options.callback || function() {};
          
          // trigger measurements
          this.update();

          // add event listeners
          if (element.addEventListener) {
            element.addEventListener('touchstart', this, false);
            element.addEventListener('touchmove', this, false);
            element.addEventListener('touchend', this, false);
            element.addEventListener('touchcancel', this, false);
            element.addEventListener('webkitTransitionEnd', this, false);
            element.addEventListener('msTransitionEnd', this, false);
            element.addEventListener('oTransitionEnd', this, false);
            element.addEventListener('transitionend', this, false);

            window.addEventListener('resize', this, false);
          }
        },

        update: function() {

          // get and measure amt of slides
          this.slides = this.element.children;
          this.length = this.slides.length;

          // determine width of each slide
          var containerWidth = ("getBoundingClientRect" in this.container) ? this.container.getBoundingClientRect().width : this.container.offsetWidth;

          switch (true){
              case containerWidth <= (this.options.viewAmountsettings ['1'] || 767*1.2) : this.setViewAmount(1); break;
              case containerWidth <= (this.options.viewAmountsettings ['2'] || 979*1.4) : this.setViewAmount(2); break;       
              default: this.setViewAmount(3);
          }

          this.width = Math.ceil(containerWidth/this.viewAmount);

          // Fix width for Android WebView (i.e. PhoneGap) 
          if (this.width === 0 && typeof window.getComputedStyle === 'function') {
            this.width = window.getComputedStyle(this.container, null).width.replace('px','')/this.viewAmount;
          }

          // return immediately if measurement fails
          if (!this.width) return null;
          
          // hide slider element but keep positioning during setup
          var origVisibility = this.container.style.visibility;
          this.container.style.visibility = 'hidden';

          // dynamic css
          this.element.style.width = Math.ceil(this.slides.length * this.width) + 'px';
          var index = this.slides.length;
          while (index--) {
            var el = this.slides[index];
            el.style.width = this.width + 'px';
            el.style.display = 'inline-block';
          }

          // set start position and force translate to remove initial flickering
          this.slide(this.index, 0); 

          // restore the visibility of the slider element
          this.container.style.visibility = origVisibility;

        },

        handleEvent: function(e) {
          switch (e.type) {
            case 'touchstart': this.onTouchStart(e); break;
            case 'touchmove': this.onTouchMove(e); break;
            case 'touchcancel' :
            case 'touchend': this.onTouchEnd(e); break;
            case 'webkitTransitionEnd':
            case 'msTransitionEnd':
            case 'oTransitionEnd':
            case 'transitionend': this.transitionEnd(e); break;
            case 'resize': this.update(); break;
          }
        },        

        slide: function(index, duration) {
          
          //if (this.length <= this.viewAmount) return;
          
          var style = this.element.style;

          // fallback to default speed
          if (duration == undefined) {
              duration = this.speed;
          }

          // set duration speed (0 represents 1-to-1 scrolling)
          style.webkitTransitionDuration = style.MozTransitionDuration = style.msTransitionDuration = style.OTransitionDuration = style.transitionDuration = duration + 'ms';

          // translate to given index position

          var position = index + 1 - this.viewAmount > 0 ? index + 1 - this.viewAmount : 0;      
          
          style.MozTransform = style.webkitTransform = 'matrix(1,0,0,1,' + -(position * this.width) + ',0)';
          style.msTransform = style.OTransform = 'matrix(1,0,0,1,' + -(position * this.width) + ',0)';
        },

        getViewAmount: function(){
          return this.viewAmount;
        },

        setViewAmount: function(amount){
          var amount = parseInt(amount);
          
          if (amount != this.viewAmount) {
            this.viewAmount = amount;
            this.emit('change');
          }
        },        

        getIndex: function(){
          return this.index;      
        },

        setIndex: function(index, options){
          this.index = parseInt(index);

          if (!(options && options.silent)) {
            this.slide(this.index);
            this.emit('change');
          }
        },

        prev: function(options) {
          // if not at first slide
          if (!!this.index) {
            this.setIndex(this.index - 1, options); 
          }
        },

        next: function(options) {
          // if not last slide
          if (this.index < this.length - 1) {
            this.setIndex(this.index + 1, options); 
          } 
        },

        transitionEnd: function(e) {
          
          this.callback(e, this.index, this.slides[this.index]);

        },

        onTouchStart: function(e) {
          
          this.start = {

            // get touch coordinates for delta calculations in onTouchMove
            pageX: e.touches[0].pageX,
            pageY: e.touches[0].pageY,

            // set initial timestamp of touch sequence
            time: Number( new Date() )

          };

          // used for testing first onTouchMove event
          this.isScrolling = undefined;
          
          // reset deltaX
          this.deltaX = 0;

          // set transition time to 0 for 1-to-1 touch movement
          this.element.style.MozTransitionDuration = this.element.style.webkitTransitionDuration = 0;
          
          e.stopPropagation();
        },

        onTouchMove: function(e) {

          // ensure swiping with one touch and not pinching
          if(e.touches.length > 1 || e.scale && e.scale !== 1) return;

          this.deltaX = e.touches[0].pageX - this.start.pageX;

          // determine if scrolling test has run - one time test
          if ( typeof this.isScrolling == 'undefined') {
            this.isScrolling = !!( this.isScrolling || Math.abs(this.deltaX) < Math.abs(e.touches[0].pageY - this.start.pageY) );
          }

          // if user is not trying to scroll vertically
          if (!this.isScrolling) {

            // prevent native scrolling 
            e.preventDefault();

            // increase resistance if first or last slide
            this.deltaX = 
              this.deltaX / 
                ( (!this.index && this.deltaX > 0               // if first slide and sliding left
                  || this.index == this.length - 1              // or if last slide and sliding right
                  && this.deltaX < 0                            // and if sliding at all
                ) ?                      
                ( Math.abs(this.deltaX) / this.width + 1 )      // determine resistance level
                : 1 );                                          // no resistance if false
            
            
            var style = this.element.style,
                position = this.index + 1 - this.viewAmount > 0 ? this.index + 1 - this.viewAmount : 0;

            // translate immediately 1-to-1
            style.MozTransform = style.webkitTransform = 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ' + (this.deltaX - position * this.width) + ', 0, 0, 1)';
            
            e.stopPropagation();
          }

        },

        onTouchEnd: function(e) {

          // determine if slide attempt triggers next/prev slide
          var isValidSlide = 
                Number(new Date()) - this.start.time < 250      // if slide duration is less than 250ms
                && Math.abs(this.deltaX) > 20                   // and if slide amt is greater than 20px
                || Math.abs(this.deltaX) > this.width/2,        // or if slide amt is greater than half the width

          // determine if slide attempt is past start and end
              isPastBounds = 
                !this.index && this.deltaX > 0                          // if first slide and slide amt is greater than 0
                || this.index == this.length - 1 && this.deltaX < 0;    // or if last slide and slide amt is less than 0

          // if not scrolling vertically
          if (!this.isScrolling) {

            // call slide function with slide end value based on isValidSlide and isPastBounds tests
            this.setIndex( this.index + ( isValidSlide && !isPastBounds ? (this.deltaX < 0 ? 1 : -1) : 0 ) );

          }
          
          e.stopPropagation();
        }

      }, events.EventEmitter.prototype);      

      return module;
  })();  

  return swipe;

});