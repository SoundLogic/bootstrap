angular.module('ui.bootstrap.demo')

  .controller('PopoverDialogDemoCtrl', function ($scope, $popoverDialog) {
    $scope.togglePopoverDialog = function ($event) {
      if (!$event) {
        return;
      }

      var popoverInstance = $popoverDialog.open({
        templateUrl: 'monkey-tooltip.html',
        controller: 'MonkeyTooltipCtrl',
        targetElement: $event.target,
        appendToBody: false,
        placement: 'right', // defaults to left if none provided
        resolve: {
          questionText: function() {
            return "Isn't this monkey adorable?!";
          },
          title: function() {
            return "TEST!";
          }
        }
      });

      popoverInstance.result.then(
        function (result) {
          if(result.enjoysMonkey){
            // show them more monkeys!!
          }
        },
        function () {
          // $log.info('popover dialog dismissed at: ' + new Date());
          // cats?
        });
    };
  })

  .controller('MonkeyTooltipCtrl', ['$scope', 'popoverDialogInstance', 'questionText', 'title',
    function($scope, popoverDialogInstance, questionText, title){

      $scope.questionText = questionText;
      $scope.title = title;

      $scope.ok = function () {
        popoverDialogInstance.close({
          enjoysMonkey: true
        });
      };

      $scope.cancel = function () {
        popoverDialogInstance.dismiss('cancel');
      };

  }]);
