define(function (require) {
  var _ = require('lodash');

  var html = require('ui/doc_table/doc_table.html');
  var getSort = require('ui/doc_table/lib/get_sort');

  require('ui/doc_table/doc_table.less');
  require('ui/directives/truncated');
  require('ui/directives/infinite_scroll');
  require('ui/doc_table/components/table_header');
  require('ui/doc_table/components/table_row');

  require('ui/modules').get('kibana')
  .directive('docTable', function (config, Notifier, getAppState, Private) {
    return {
      restrict: 'E',
      template: html,
      scope: {
        sorting: '=',
        columns: '=',
        hits: '=?', // You really want either hits & indexPattern, OR searchSource
        indexPattern: '=?',
        searchSource: '=?',
        infiniteScroll: '=?',
        filter: '=?',
      },
      controllerAs: 'docTableCSV',
      controller: function ($scope) {
        $scope.showSpinner = false;
        var SearchSource = Private(require('ui/courier/data_source/search_source'));
        var self = this;

        self._saveAs = require('@spalger/filesaver').saveAs;
        self.csv = {
          separator: config.get('csv:separator'),
          quoteValues: config.get('csv:quoteValues')
        };

        self.exportAsCsv = function (formatted) {
          $scope.showSpinner = true;
          var searchSource = new SearchSource();
          searchSource.set('filter', $scope.searchSource.getOwn('filter')); 
          searchSource.set('query', $scope.searchSource.getOwn('query'));
          searchSource.size(config.get('csv:rowsCount'));
          searchSource.index($scope.searchSource.get('index'));
          searchSource.onResults().then(function onResults(resp) {

            // Abort if something changed
            if ($scope.searchSource !== $scope.searchSource) return;

            var csv = new Blob([self.toCsv(formatted, resp.hits.hits)], { type: 'text/plain' });
            $scope.showSpinner = false;
            self._saveAs(csv, 'download.csv');

          }).catch(notify.fatal);
          searchSource.fetchQueued();
        };

        self.toCsv = function (formatted, rows) {
          var csv = [];
          //var rows = $scope.hits;
          var columns = $scope.columns;
          var nonAlphaNumRE = /[^a-zA-Z0-9]/;
          var allDoubleQuoteRE = /"/g;

          function escape(val) {
            if (!formatted && _.isObject(val)) val = val.valueOf();
            val = String(val);
            if (self.csv.quoteValues && nonAlphaNumRE.test(val)) {
              val = '"' + val.replace(allDoubleQuoteRE, '""') + '"';
            }
            return val;
          }

          csv.push(_.map(columns, function (col) {
              return escape(col);
          }).join(","));

          _.forEach(rows, function (row) {
            //row = $scope.indexPattern.formatHit(row);
            csv.push(_.map(columns, function (col) {
              if (row._source[col] === undefined) return "";
              return escape(row._source[col]);
            }).join(","));
          });
          return csv.join("\r\n") + "\r\n";

        };


        var notify = new Notifier();
        $scope.limit = 50;
        $scope.persist = {
          sorting: $scope.sorting,
          columns: $scope.columns
        };

        var prereq = (function () {
          var fns = [];

          return function register(fn) {
            fns.push(fn);

            return function () {
              fn.apply(this, arguments);

              if (fns.length) {
                _.pull(fns, fn);
                if (!fns.length) {
                  $scope.$root.$broadcast('ready:vis');
                }
              }
            };
          };
        }());

        $scope.addRows = function () {
          $scope.limit += 50;
        };

        // This exists to fix the problem of an empty initial column list not playing nice with watchCollection.
        $scope.$watch('columns', function (columns) {
          if (columns.length !== 0) return;

          var $state = getAppState();
          $scope.columns.push('_source');
          if ($state) $state.replace();
        });

        $scope.$watchCollection('columns', function (columns, oldColumns) {
          if (oldColumns.length === 1 && oldColumns[0] === '_source' && $scope.columns.length > 1) {
            _.pull($scope.columns, '_source');
          }

          if ($scope.columns.length === 0) $scope.columns.push('_source');
        });


        $scope.$watch('searchSource', prereq(function (searchSource) {
          if (!$scope.searchSource) return;

          $scope.indexPattern = $scope.searchSource.get('index');

          $scope.searchSource.size(config.get('discover:sampleSize'));
          $scope.searchSource.sort(getSort($scope.sorting, $scope.indexPattern));

          // Set the watcher after initialization
          $scope.$watchCollection('sorting', function (newSort, oldSort) {
            // Don't react if sort values didn't really change
            if (newSort === oldSort) return;
            $scope.searchSource.sort(getSort(newSort, $scope.indexPattern));
            $scope.searchSource.fetchQueued();
          });

          $scope.$on('$destroy', function () {
            if ($scope.searchSource) $scope.searchSource.destroy();
          });

          // TODO: we need to have some way to clean up result requests
          $scope.searchSource.onResults().then(function onResults(resp) {
            // Reset infinite scroll limit
            $scope.limit = 50;

            // Abort if something changed
            if ($scope.searchSource !== $scope.searchSource) return;

            $scope.hits = resp.hits.hits;

            return $scope.searchSource.onResults().then(onResults);
          }).catch(notify.fatal);

          $scope.searchSource.onError(notify.error).catch(notify.fatal);
        }));

      }
    };
  });
});
