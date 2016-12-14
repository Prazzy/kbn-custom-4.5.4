var angular = require('angular');
var template = require('ui/filter_editor/filter_editor.html');
var _ = require('lodash');
var module = require('ui/modules').get('kibana');

/**
 * Notes:
 *
 * Order is not preserved due to the bool filter API
 */

module.directive('filterEditor', function ($route, courier) {

  return {
    restrict: 'E',
    template: template,
    scope: {
      filter: '=',
      indexPattern: '='
    },

    link: function ($scope) {
      $scope.indexFields = {};
      $scope.indexFieldNames = [];

      courier.indexPatterns.get($scope.indexPattern).then(function (index) {
        $scope.indexFields = index.fields.reduce(function (fields, field) {
          if (field.filterable === true) {
            fields[field.name] = field.type;
          }

          return fields;
        }, {});

        $scope.indexFieldNames = Object.keys($scope.indexFields).sort();
      });

      //$scope.clauses = { Equals: 'must', 'Does Not Equal': 'must_not'};
      $scope.clauses = { Equals: 'must', 'Begins With': 'prefix', 'Contains': 'wildcard'};
      //$scope.types = { match: 'keyword', term: 'exact' };
      $scope.filterType = 'term';

      ensureBoolFilters();

      /**
       * Adds a filter expression
       *
       * @param {string} clause - must, must_not, should
       * @param {string} expression
       */

      $scope.add = function (clause = 'should', expression) {
        if (!expression) {
          expression = { bool: { must: { term: {} }  }};
          expression.bool.must.term[$scope.indexFieldNames[0]] = '';
        }

        // ensure clause exists as an array
        if (!($scope.filter.bool[clause] instanceof Array)) {
          $scope.filter.bool[clause] = [];
        }

        $scope.filter.bool[clause].push(angular.copy(expression));
      };

      /**
       * Removes a filter expression
       *
       * @param {string} clause - must, must_not, should
       * @param {integer} index - index of position within clause
       */

      $scope.remove = function (clause, index) {
        $scope.filter.bool[clause].splice(index, 1);

        // removes clause when no more expressions exist
        if (_.isEmpty($scope.filter.bool[clause])) {
          delete $scope.filter.bool[clause];
        }
      };

      /**
       * Changes the clause
       *
       * @param {string} fromClause
       * @param {string} toClause
       * @param {object} expression
       */

      $scope.changeClause = function (fromClause, toClause, expression, index) {
        if (fromClause == 'must') var from_value = expression.bool[fromClause].term;
        if (fromClause == 'prefix') var from_value = expression.query.prefix;
        if (fromClause == 'wildcard') var from_value = expression.query.wildcard;

        if (toClause == 'prefix') {
          var prefix_expression = { query: { prefix: {}}};
          var key = Object.keys(from_value)[0];
          from_value[key] = from_value[key].replace(/\*/g, '');
          prefix_expression.query.prefix = from_value;
          $scope.filter.bool.should[index] = angular.copy(prefix_expression);
        } else if (toClause == 'wildcard') {
          var wildcard_expression = { query: { wildcard: {}}};
          var key = Object.keys(from_value)[0];
          from_value[key] = '*' + from_value[key] + '*';
          wildcard_expression.query.wildcard = from_value;
          $scope.filter.bool.should[index] = angular.copy(wildcard_expression);
        } else {
          var bool_expression = { bool: {} };
          var key = Object.keys(from_value)[0];
          from_value[key] = from_value[key].replace(/\*/g, '');
          bool_expression.bool[toClause] = { term: from_value};
          $scope.filter.bool.should[index] = angular.copy(bool_expression);
        }
      };

      /**
       * Changes the value
       *
       * @param {string} fromClause
       * @param {string} toClause
       * @param {object} expression
       */

      $scope.changeValue = function (new_value, expression, index) {
        if (expression.bool) {
          var key = Object.keys(expression.bool.must.term)[0];
          expression.bool.must.term[key] = new_value;
        } else if (expression.query) {
          if (expression.query.prefix) {
            var key = Object.keys(expression.query.prefix)[0];
            expression.query.prefix[key] = new_value;
          } else if (expression.query.wildcard) {
            var key = Object.keys(expression.query.wildcard)[0];
            expression.query.wildcard[key] = new_value;
          }
        } 
      };      

      /**
       * Changes the field for an expression
       *
       * @param {string} name
       * @param {object} expression
       */

      $scope.changeField = function (new_field, expression, expressions) {
        _.map(expressions, function(filter) {
          if (filter.bool) {
            var key = Object.keys(filter.bool.must.term)[0];
            var value = filter.bool.must.term[key];
            filter.bool.must.term[new_field] = value;  
            delete filter.bool.must.term[key];  
          } else if (filter.query) {
            if (filter.query.prefix) {
              var key = Object.keys(filter.query.prefix)[0];
              var value = filter.query.prefix[key];
              filter.query.prefix[new_field] = value;  
              delete filter.query.prefix[key];  
            } else if (filter.query.wildcard) {
              var key = Object.keys(filter.query.wildcard)[0];
              var value = filter.query.wildcard[key];
              filter.query.wildcard[new_field] = value;  
              delete filter.query.wildcard[key];  
            }
          } 
        });
        

        // let type = Object.keys(expression)[0];
        // let prevField = Object.keys(expression[type])[0];
        // let filterType;

        // filterType = Object.keys(expression)[0];

        // expression[filterType][name] = expression[filterType][prevField];
        // delete expression[filterType][prevField];
      };

      /**
       * Changes the filter type (match|term)
       *
       * @param {string} toType
       * @param {object} expression
       */

      $scope.changeFilterType = function (toType, expression) {
        let fromType = Object.keys(expression)[0];
        let field = Object.keys(expression[fromType])[0];

        if (fromType === toType) {
          return;
        }

        expression[toType] = {};

        if (toType === 'term' && typeof expression[fromType][field] === 'object') {
          // term filters do not have options
          expression[toType][field] = expression[fromType][field].query;
        } else {
          expression[toType][field] = expression[fromType][field];
        }

        delete expression[fromType];
      };

      function ensureBoolFilters() {
        if ($scope.filter.query) {  
          if ($scope.filter.query.match) {
            var result = _.map($scope.filter.query.match, function(val, key) {
              return { key: key, val: val };
            });  

            var sub_query = {
                            bool: {
                              must: {
                                term: {
                                }
                              } 
                            }
                          };
            sub_query.bool.must.term[result[0].key] = result[0].val.query;         
            $scope.filter = {
              bool: {
                should: [
                   sub_query
                ]
              }
            };    
          } else {    
            $scope.filter = {
              bool: {
                should: [
                  $scope.filter.query
                ]
              }
            };
          }
        }
      }
    }
  };
});