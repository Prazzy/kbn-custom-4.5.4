define(function (require) {
  var _ = require('lodash');
  var angular = require('angular');
  require('ace');

  var html = require('ui/doc_viewer/doc_viewer.html');
  require('ui/doc_viewer/doc_viewer.less');

  require('ui/modules').get('kibana')
  .directive('docViewer', function (config, Private) {
    return {
      restrict: 'E',
      template: html,
      scope: {
        hit: '=',
        indexPattern: '=',
        filter: '=?',
        columns: '=?'
      },
      link: {
        pre($scope) {
          $scope.aceLoaded = (editor) => {
            editor.$blockScrolling = Infinity;
          };
        },

        post($scope, $el, attr) {
          // If a field isn't in the mapping, use this
          $scope.mode = 'table';
          $scope.mapping = $scope.indexPattern.fields.byName;
          $scope.flattened = $scope.indexPattern.flattenHit($scope.hit);
          $scope.hitJson = angular.toJson($scope.hit, true);
          $scope.formatted = $scope.indexPattern.formatHit($scope.hit);
          $scope.fields = $scope.columns;
          // show only fields of saved search in doc viewer
          if ($scope.$root.chrome.getActiveTabId()) {
            if ($scope.$root.chrome.getActiveTabId() !== 'dashboard') $scope.fields = _.keys($scope.flattened).sort();
          } else if ($scope.$root.chrome.getInjected().kbnDefaultAppId) {
            if ($scope.$root.chrome.getInjected().kbnDefaultAppId !== 'dashboard') $scope.fields = _.keys($scope.flattened).sort();
          } else {
            $scope.fields = $scope.columns;
          }
          $scope.toggleColumn = function (fieldName) {
            _.toggleInOut($scope.columns, fieldName);
          };

          $scope.showArrayInObjectsWarning = function (row, field) {
            var value = $scope.flattened[field];
            return _.isArray(value) && typeof value[0] === 'object';
          };
        }
      }
    };
  });
});
