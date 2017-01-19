define(function (require) {
  var module = require('ui/modules').get('kibana');
  var $ = require('jquery');
  var _ = require('lodash');
  var moment = require('moment');

  module.directive('pacInputDatetime', function (courier) {
    return {
      restrict: 'A',
      require: 'ngModel',
      scope: false,
      link: function ($scope, $elem, attrs, ngModel) {

        let fieldCondition = $scope.subclause;
        let fieldDataType = $scope.filedTypes[$scope.fieldName];
        let fromUserFormat = 'YYYY-MM-DD HH:mm:ss.SSS';
        let toUserFormat = 'YYYY-MM-DD HH:mm:ss.SSS';
        if (fieldCondition === 'range') {
          fromUserFormat = 'YYYY-MM-DDTHH:mm:ss';
          toUserFormat = 'YYYY-MM-DD HH:mm:ss';
        }

        // What should I make with the input from the user?
        var fromUser = function (text) {
          let fieldDataType = $scope.indexFields[$scope.fieldName];
          if (fieldDataType !== 'date') return text;
          var parsed = moment(text, fromUserFormat);
          if (parsed.isValid()) {
            return (fieldCondition !== 'range') ? parsed.valueOf() : moment(text).format(fromUserFormat);
          } else return text;
        };

        // How should I present the data back to the user in the input field?
        var toUser = function (datetime) {
          let fieldDataType = $scope.indexFields[$scope.fieldName];
          if (fieldDataType !== 'date') return datetime;
          let value = moment(datetime).format(toUserFormat);
          if (value === 'Invalid date') return datetime;
          $elem.after('<div class="input-datetime-format">' + toUserFormat + '</div>');
          return value;
        };

        ngModel.$parsers.push(fromUser);
        ngModel.$formatters.push(toUser);

      }
    };
  });
});
