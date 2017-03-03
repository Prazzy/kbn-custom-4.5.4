define(function (require) {
  const _ = require('lodash');
  const numeral = require('numeral');
  // get the kibana/table_vis module, and make sure that it requires the "kibana" module if it
  // didn't already
  const module = require('ui/modules').get('kibana/table_vis', ['kibana']);

  // add a controller to tha module, which will transform the esResponse into a
  // tabular format that we can pass to the table directive
  module.controller('KbnTableVisController', function ($scope, Private) {
    const tabifyAggResponse = Private(require('ui/agg_response/tabify/tabify'));

    $scope.$watch('esResponse', function (resp, oldResp) {
      let tableGroups = $scope.tableGroups = null;
      let hasSomeRows = $scope.hasSomeRows = null;

      if (resp) {
        const vis = $scope.vis;
        const params = vis.params;

        tableGroups = tabifyAggResponse(vis, resp, {
          partialRows: params.showPartialRows,
          minimalColumns: vis.isHierarchical() && !params.showMeticsAtAllLevels,
          asAggConfigResults: true
        });

        hasSomeRows = tableGroups.tables.some(function haveRows(table) {
          if (table.tables) return table.tables.some(haveRows);
          return table.rows.length > 0;
        });
      }

      $scope.hasSomeRows = hasSomeRows;
      if (hasSomeRows) {
        const params = $scope.vis.params;
        // PAC Feature:  extended metric cols
        if (params.formulaEnabled) {
          let newRows = [];
          let newCols = [];
          let cols = tableGroups.tables[0].columns;
          let rows = tableGroups.tables[0].rows;
          let formulaCols = params.formulaCols.split(',');
          let formula = params.formula;
          let formulaLabel = params.formulaLabel;
          let metricColAppended = 0;
          _.forEach(cols, function (col) {
            if (_.includes(formulaCols, col.title) && !metricColAppended) {
              col.title = formulaLabel;
              newCols.push(col);
              metricColAppended = 1;
            } else {
              if (!_.includes(formulaCols, col.title)) newCols.push(col);
            }
          });
          //newCols = cols.slice(0, 2);
          tableGroups.tables[0].columns = newCols;
          //delete tableGroups.tables[0].columns[2];

          _.forEach(rows, function (row) {
            let newRow = [];
            let metrics = [];
            let cachedCol = '';
            _.forEach(row, function (col) {
              if (col.type !== 'metric') {
                newRow.push(col);
              } else if (!_.includes(formulaCols, col.aggConfig.params.customLabel)) {
                newRow.push(col);
              } else {
                cachedCol = col;
                const metric = {
                  label: col.aggConfig.params.customLabel,
                  value: col.value
                };
                metrics.push(metric);
                metrics[col.aggConfig.params.customLabel] = metric;
              }
            });
            let computedValue;
            try {
              const func = Function('metrics', 'return ' + formula);
              computedValue = numeral(func(metrics)).format($scope.vis.params.outputNumberFormat);
            } catch (e) {
              computedValue = '';
            }
            if (cachedCol) {
              cachedCol.value = computedValue;
              newRow.push(cachedCol);
            }
            newRows.push(newRow);
          });
          tableGroups.tables[0].rows = newRows;
        }
        // PAC Feature:  extended metric cols

        $scope.tableGroups = tableGroups;
      }
    });
  });
});
