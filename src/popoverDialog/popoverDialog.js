angular.module( 'ui.bootstrap.popoverDialog', [ 'ui.bootstrap.tooltip' ] )

  .provider('$popoverDialog', function () {
    var provider = {
      openedPopoverDialog: (function() {
        var instCtx, inst;
        return {
          get: get,
          getInstance: getInstance,
          getContext: getContext,
          set: set,
          isSet: isSet,
          clear: clear
        };

        function get(){ return instCtx; }
        function getInstance(){ return inst; }
        function getContext() { return get(); }
        function set(instanceContext, instance){
          instCtx = instanceContext;
          inst = instance;
        }
        function isSet(){ return instCtx != undefined; }
        function clear(){
          instCtx = undefined;
          inst = undefined;
        }
      })(),
      hasPending: false,
      //TODO: add dynamic placement option?
      options: {
        placement: 'left'
      },
      $get: ['$injector', '$rootScope', '$q', '$http', '$templateCache', '$controller', '$position', '$document', '$compile', '$timeout',
        function ($injector, $rootScope, $q, $http, $templateCache, $controller, $position, $document, $compile, $timeout) {

          var $popoverDialog = {}, popoverDialogId = 'ui-bootstrap-popover-dialog', popoverDialogClass = 'ui-bootstrap-popover-dialog';

          function getTemplatePromise(options) {
            return options.template
              ? $q.when(options.template)
              : $http.get(angular.isFunction(options.templateUrl) ? (options.templateUrl)() : options.templateUrl, { cache: $templateCache })
              .then(function (result) { return result.data; });
          }

          function getResolvePromises(resolves) {
            var promisesArr = [];
            angular.forEach(resolves, function (value) {
              if (angular.isFunction(value) || angular.isArray(value)) {
                promisesArr.push($q.when($injector.invoke(value)));
              }
            });

            return promisesArr;
          }

          $popoverDialog.hasPending = function(){
            return provider.hasPending || provider.openedPopoverDialog.isSet();
          }

          $popoverDialog.getPending = function(){
            return provider.openedPopoverDialog.getInstance();
          }

          $popoverDialog.popoverRendered = function(){
            var popoverDialog = provider.openedPopoverDialog.get();
            if(popoverDialog){
              popoverDialog.renderDeferred.resolve();
            }
          }

          $popoverDialog.forceCloseAll = function(){
            provider.hasPending = false;
            var dialog = provider.openedPopoverDialog.get();
            if(dialog){ dialog.dismiss('force close'); }
            angular.element(document.querySelector('.' + popoverDialogClass)).remove();
          }

          $popoverDialog.open = function (popoverDialogOptions) {

            var popoverDialogResultDeferred = $q.defer();
            var popoverDialogOpenedDeferred = $q.defer();
            var popoverDialogRenderDeferred = $q.defer();

            //prepare an instance of a popoverDialog to be injected into controllers and returned to a caller
            var popoverDialogInstance = {
              result: popoverDialogResultDeferred.promise,
              opened: popoverDialogOpenedDeferred.promise,
              rendered: popoverDialogRenderDeferred.promise,
              close: function (result) {
                var popoverDialog = provider.openedPopoverDialog.get();
                if(popoverDialog) {
                  close(popoverDialog);
                  popoverDialog.deferred.resolve(result);
                } else{
                  close();
                }
              },
              dismiss: function (reason) {
                var popoverDialog = provider.openedPopoverDialog.get();
                if(popoverDialog) {
                  dismiss(popoverDialog);
                  popoverDialog.deferred.reject(reason);
                } else{
                  dismiss();
                }
              }
            };

            // TODO: maybe an error should be thrown here if popoverDialog already open?
            if(provider.openedPopoverDialog.isSet()){
              popoverDialogResultDeferred.reject("another popoverDialog is already open");
              return popoverDialogInstance;
            }

            provider.openedPopoverDialog.set({}, popoverDialogInstance);
            provider.hasPending = true;

            angular.element(document.querySelector('.' + popoverDialogClass)).remove();

            //merge and clean up options
            popoverDialogOptions = angular.extend({}, provider.options, popoverDialogOptions);
            popoverDialogOptions.resolve = popoverDialogOptions.resolve || {};

            //verify options
            var noTemplateProvided = !popoverDialogOptions.template && !popoverDialogOptions.templateUrl;
            if (noTemplateProvided || !popoverDialogOptions.targetElement) {
              throw new Error('One of template or templateUrl options is required.');
            }

            var templateAndResolvePromise =
              $q.all([getTemplatePromise(popoverDialogOptions)].concat(getResolvePromises(popoverDialogOptions.resolve)));


            templateAndResolvePromise.then(function resolveSuccess(tplAndVars) {
              var popoverDialogScope = (popoverDialogOptions.scope || $rootScope).$new(true);
              popoverDialogScope.$close = popoverDialogInstance.close;
              popoverDialogScope.$dismiss = popoverDialogInstance.dismiss;

              var ctrlInstance, ctrlLocals = {};
              var resolveIter = 1;

              //controllers
              if (popoverDialogOptions.controller) {
                ctrlLocals.$scope = popoverDialogScope;
                ctrlLocals.popoverDialogInstance = popoverDialogInstance;
                angular.forEach(popoverDialogOptions.resolve, function (value, key) {
                  ctrlLocals[key] = tplAndVars[resolveIter++];
                });

                ctrlInstance = $controller(popoverDialogOptions.controller, ctrlLocals);
                if (popoverDialogOptions.controllerAs) {
                  popoverDialogScope[popoverDialogOptions.controllerAs] = ctrlInstance;
                }
              }

              //TODO: reposition

              var popoverDialog = {
                scope: popoverDialogScope,
                deferred: popoverDialogResultDeferred,
                content: tplAndVars[0],
                keyboard: popoverDialogOptions.keyboard,
                placement: popoverDialogOptions.placement,
                popoverDialogClass: popoverDialogOptions.popoverDialogClass,
                popoverDialogTemplateUrl: popoverDialogOptions.templateUrl,
                targetElement: popoverDialogOptions.targetElement,
                ignoreTriggers: true
              };

              provider.openedPopoverDialog.set({
                deferred: popoverDialog.deferred,
                renderDeferred: popoverDialogRenderDeferred,
                popoverDialogScope: popoverDialog.scope,
                keyboard: popoverDialog.keyboard,
                placement: popoverDialog.placement,
                targetElement: popoverDialog.targetElement
              }, popoverDialogInstance);

              var body = $document.find('body').eq(0);

              var angularDomEl = angular.element('<div popover-dialog="popover-dialog"></div>');
              angularDomEl.attr({
                'template-url': popoverDialog.templateUrl,
                'popup-class': popoverDialog.popoverDialogClass,
                'placement': popoverDialog.placement,
                'animation': 'animation'
              }).html(popoverDialog.content);

              var popoverDomEl = $compile(angularDomEl)(popoverDialog.scope);
              popoverDomEl.attr('id', popoverDialogId);
              provider.openedPopoverDialog.get().popoverDomEl = popoverDomEl;
              // use angular.element because $event.target does not return standard angular element such that can access element as element[0]
              // and $position depends on element[0] where $event.target already returns element[0]
              var targetElement = angular.element(popoverDialog.targetElement);
              var appendToBody = angular.isDefined(popoverDialogOptions.appendToBody) ? popoverDialogOptions.appendToBody : false;
              if(appendToBody){
                $document.find('body').append(popoverDomEl);
              } else{
                targetElement.after(popoverDomEl);
              }

              //TODO: add option to docs
              var removeOnLocationChange = angular.isDefined(popoverDialogOptions.removeOnLocationChange) ? popoverDialogOptions.removeOnLocationChange : false;
              if(removeOnLocationChange){
                var locationChangeListener = $rootScope.$on('$locationChangeStart', function(){
                  var popoverDialog = provider.openedPopoverDialog.get();
                  if(popoverDialog){
                    dismiss(popoverDialog);
                    popoverDialog.reject('navigation');
                  }
                })
                provider.openedPopoverDialog.get().locationChangeListener = locationChangeListener;
              }

              var positionPopover = function () {
                var position = $position.positionElements(targetElement, popoverDomEl, popoverDialog.placement, appendToBody);
                position.top += 'px';
                position.left += 'px';

                // Now set the calculated positioning.
                popoverDomEl.css(position);
              };

              provider.openedPopoverDialog.get().renderDeferred.promise.then(function(){
                postDigest(function(){
                  popoverDomEl[0].setAttribute('id', popoverDialogId);
                  popoverDomEl.addClass('placement-' + popoverDialog.placement);
                  popoverDomEl.addClass('in');
                  popoverDomEl.addClass(popoverDialogClass);
                  popoverDomEl.css({ top: 0, left: 0, display: 'block', "max-width": 'none' });
                  positionPopover();
                  popoverDialogOpenedDeferred.resolve(true);
                },0, false);
              });

            }, function resolveError(reason) {
              popoverDialogResultDeferred.reject(reason);
              provider.openedPopoverDialog.clear();
              popoverDialogOpenedDeferred.reject(false);
            });

            /*templateAndResolvePromise.then(function () {
             popoverDialogOpenedDeferred.resolve(true);
             }, function () {
             popoverDialogOpenedDeferred.reject(false);
             });*/

            return popoverDialogInstance;
          };

          var close = function(popoverDialog){
            angular.element(document.getElementById(popoverDialogId)).remove();
            provider.hasPending = false;
            if(popoverDialog){
              provider.openedPopoverDialog.clear();
              if(popoverDialog.locationChangeListener){
                popoverDialog.locationChangeListener();
              }
            }
          };

          var dismiss = function(popoverDialog){
            angular.element(document.getElementById(popoverDialogId)).remove();
            provider.hasPending = false;
            if(popoverDialog){
              provider.openedPopoverDialog.clear();
              if(popoverDialog.locationChangeListener){
                popoverDialog.locationChangeListener();
              }
            }
          };

          function postDigest(callback) {
            var unregister = $rootScope.$watch(function () {
              unregister();
              $timeout(function () {
                callback();
              }, 0, false);
            });
          };

          return $popoverDialog;
        }]
    }

    return provider;
  })

  .directive('popoverDialog', ['$q', '$popoverDialog', function ($q, $popoverDialog) {
    return {
      restrict: 'EA',
      scope: {},
      replace: true,
      transclude: true,
      templateUrl: function(tElement, tAttrs) {
        return tAttrs.templateUrl || 'template/popoverDialog/popover-dialog.html';
      },
      link: function (scope, element, attrs) {
        element.addClass(attrs.windowClass || '');

        // This property is only added to the scope for the purpose of detecting when this directive is rendered.
        // We can detect that by using this property in the template associated with this directive and then use
        // {@link Attribute#$observe} on it. For more details please see {@link TableColumnResize}.
        scope.$isRendered = true;

        // Deferred object that will be resolved when this popover is rendered.
        var popoverDialogRenderDeferObj = $q.defer();
        // Observe function will be called on next digest cycle after compilation, ensuring that the DOM is ready.
        // In order to use this way of finding whether DOM is ready, we need to observe a scope property used in popover dialog's template.
        attrs.$observe('popoverDialogRender', function (value) {
          if (value == 'true') {
            popoverDialogRenderDeferObj.resolve();
          }
        });

        popoverDialogRenderDeferObj.promise.then(function () {
          // trigger CSS transitions
          scope.animate = true;

          var inputsWithAutofocus = element[0].querySelectorAll('[autofocus]');
          /**
           * Auto-focusing of a freshly-opened popover dialog causes any child elements
           * with the autofocus attribute to lose focus. This is an issue on touch
           * based devices which will show and then hide the onscreen keyboard.
           * Attempts to refocus the autofocus element via JavaScript will not reopen
           * the onscreen keyboard. Fixed by updated the focusing logic to only autofocus
           * the popover element if the popover does not contain an autofocus element.
           */
          if (inputsWithAutofocus.length) {
            inputsWithAutofocus[0].focus();
          } else {
            element[0].focus();
          }

          // Notify {@link $popoverDialog} that popoverDialog is rendered.
          $popoverDialog.popoverRendered();
        });
      }
    };
  }])

  .directive('popoverDialogTransclude', function () {
    return {
      link: function($scope, $element, $attrs, controller, $transclude) {
        $transclude($scope.$parent, function(clone) {
          $element.empty();
          $element.append(clone);
        });
      }
    };
  })
