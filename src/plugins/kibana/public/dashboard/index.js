define(function (require) {
  const _ = require('lodash');
  const $ = require('jquery');
  const angular = require('angular');
  const ConfigTemplate = require('ui/ConfigTemplate');
  const chrome = require('ui/chrome');

  require('ui/directives/config');
  require('ui/courier');
  require('ui/config');
  require('ui/notify');
  require('ui/typeahead');
  require('ui/share');

  require('plugins/kibana/dashboard/directives/grid');
  require('plugins/kibana/dashboard/components/panel/panel');
  require('plugins/kibana/dashboard/services/saved_dashboards');
  require('plugins/kibana/dashboard/styles/main.less');

  require('ui/saved_objects/saved_object_registry').register(require('plugins/kibana/dashboard/services/saved_dashboard_register'));


  const app = require('ui/modules').get('app/dashboard', [
    'elasticsearch',
    'ngRoute',
    'kibana/courier',
    'kibana/config',
    'kibana/notify',
    'kibana/typeahead'
  ]);

  require('ui/routes')
  .when('/dashboard', {
    template: require('plugins/kibana/dashboard/index.html'),
    resolve: {
      dash: function (savedDashboards, config) {
        return savedDashboards.get();
      }
    }
  })
  .when('/dashboard/:id', {
    template: require('plugins/kibana/dashboard/index.html'),
    resolve: {
      dash: function (savedDashboards, Notifier, $route, $location, courier) {
        return savedDashboards.get($route.current.params.id)
        .catch(courier.redirectWhenMissing({
          'dashboard' : '/dashboard'
        }));
      }
    }
  });

  app.directive('dashboardApp', function (Notifier, courier, AppState, timefilter, kbnUrl) {
    return {
      controller: function ($scope, $rootScope, $route, $routeParams, $location, Private, getAppState) {

        const services = Private(require('ui/saved_objects/saved_object_registry')).byLoaderPropertiesName;
        const queryFilter = Private(require('ui/filter_bar/query_filter'));

        const notify = new Notifier({
          location: 'Dashboard'
        });

        const dash = $scope.dash = $route.current.locals.dash;

        if (dash.timeRestore && dash.timeTo && dash.timeFrom && !getAppState.previouslyStored()) {
          timefilter.time.to = dash.timeTo;
          timefilter.time.from = dash.timeFrom;
          if (dash.refreshInterval) {
           timefilter.refreshInterval = dash.refreshInterval;
          }
        }

        $scope.$on('$destroy', dash.destroy);

        const matchQueryFilter = function (filter) {
          return filter.query && filter.query.query_string && !filter.meta;
        };

        const extractQueryFromFilters = function (filters) {
          const filter = _.find(filters, matchQueryFilter);
          if (filter) return filter.query;
        };

        const stateDefaults = {
          title: dash.title,
          panels: dash.panelsJSON ? JSON.parse(dash.panelsJSON) : [],
          options: dash.optionsJSON ? JSON.parse(dash.optionsJSON) : {},
          uiState: dash.uiStateJSON ? JSON.parse(dash.uiStateJSON) : {},
          query: extractQueryFromFilters(dash.searchSource.getOwn('filter')) || {query_string: {query: '*'}},
          filters: _.reject(dash.searchSource.getOwn('filter'), matchQueryFilter),
        };

        const $state = $scope.state = new AppState(stateDefaults);
        const $uiState = $scope.uiState = $state.makeStateful('uiState');

        $scope.$watchCollection('state.options', function (newVal, oldVal) {
          if (!angular.equals(newVal, oldVal)) $state.save();
        });
        $scope.$watch('state.options.darkTheme', setDarkTheme);

        $scope.configTemplate = new ConfigTemplate({
          save: require('plugins/kibana/dashboard/partials/save_dashboard.html'),
          load: require('plugins/kibana/dashboard/partials/load_dashboard.html'),
          share: require('plugins/kibana/dashboard/partials/share.html'),
          pickVis: require('plugins/kibana/dashboard/partials/pick_visualization.html'),
          options: require('plugins/kibana/dashboard/partials/options.html')
        });

        $scope.refresh = _.bindKey(courier, 'fetch');

        timefilter.enabled = true;
        $scope.timefilter = timefilter;
        $scope.$listen(timefilter, 'fetch', $scope.refresh);

        courier.setRootSearchSource(dash.searchSource);

        function init() {
          updateQueryOnRootSource();

          const docTitle = Private(require('ui/doc_title'));
          if (dash.id) {
            docTitle.change(dash.title);
          }

          initPanelIndices();
          $scope.$emit('application.load');
        }

        function initPanelIndices() {
          // find the largest panelIndex in all the panels
          let maxIndex = getMaxPanelIndex();

          // ensure that all panels have a panelIndex
          $scope.state.panels.forEach(function (panel) {
            if (!panel.panelIndex) {
              panel.panelIndex = maxIndex++;
            }
          });
        }

        function getMaxPanelIndex() {
          let index = $scope.state.panels.reduce(function (idx, panel) {
            // if panel is missing an index, add one and increment the index
            return Math.max(idx, panel.panelIndex || idx);
          }, 0);
          return ++index;
        }

        function updateQueryOnRootSource() {
          const filters = queryFilter.getFilters();
          if ($state.query) {
            dash.searchSource.set('filter', _.union(filters, [{
              query: $state.query
            }]));
          } else {
            dash.searchSource.set('filter', filters);
          }
        }

        function setDarkTheme(enabled) {
          const theme = Boolean(enabled) ? 'theme-dark' : 'theme-light';
          chrome.removeApplicationClass(['theme-dark', 'theme-light']);
          chrome.addApplicationClass(theme);
        }

        // update root source when filters update
        $scope.$listen(queryFilter, 'update', function () {
          updateQueryOnRootSource();
          $state.save();
        });

        // update data when filters fire fetch event
        $scope.$listen(queryFilter, 'fetch', $scope.refresh);

        $scope.newDashboard = function () {
          kbnUrl.change('/dashboard', {});
        };

        $scope.filterResults = function () {
          updateQueryOnRootSource();
          $state.save();
          $scope.refresh();
        };

        // PAC Feature: collect all index fields added to a dashboard
        $scope.indexFieldNames = [];
        $scope.indexPatterns = [];
        $scope.searches = [];
        $scope.getIndexFieldNames = function (indexPattern) {
          courier.indexPatterns.get(indexPattern).then(function (index) {
          let indexFields = index.fields.reduce(function (fields, field) {
            if (field.filterable === true) {
              fields[field.name] = field.type;
            }
            return fields;
          }, {});
          //let old_fields = $scope.indexFieldNames;
          //$scope.indexFieldNames = _.merge(old_fields, Object.keys(indexFields).sort());
          $scope.indexFieldNames.push(Object.keys(indexFields).sort());
          });
        };

        $scope.parsePanelVis = function () {
          let panels = _.merge($scope.state.panels, $state.panels);
          let visualizations = services.visualizations;
          // let ids = [];
          // panels.forEach(function (panel) {
          //   ids.push(panel)
          // });

          // visualizations.mget(ids)
          // .then(function (hits) {
          //   debugger;
          //   hits.hits.forEach(function (hit) {
          //     let doc = hit['_source'];
          //     if (doc['savedSearchId']) $scope.searches.push(doc['savedSearchId']);
          //     else $scope.indexPatterns.push(JSON.parse(doc['kibanaSavedObjectMeta']['searchSourceJSON']).index);
          //   });
          // });

          panels.forEach(function (panel) {
            visualizations.get(panel.id)
              .then(function (hit) {
                if (hit) {
                  if (hit.savedSearchId) {
                    $scope.getIndexFieldNamesBySearch(hit.savedSearchId);
                  }
                  else {
                    let indexPat = JSON.parse(hit.kibanaSavedObjectMeta.searchSourceJSON).index;
                    //if (!_.includes($scope.indexPatterns, indexPat))
                    $scope.getIndexFieldNames(indexPat);
                  }
                }
              });
          });
        };

        $scope.getIndexFieldNamesBySearch = function (searchName) {
          let searches = services.searches;
          searches.get(searchName)
          .then(function (hit) {
            if (hit) {
              let indexPat = JSON.parse(hit.kibanaSavedObjectMeta.searchSourceJSON).index;
              //if (!_.includes($scope.indexPatterns, indexPat))
              $scope.getIndexFieldNames(indexPat);
            }
          });

        };

        $scope.parsePanelSearches = function () {
          let panels = _.merge($scope.state.panels, $state.panels);
          let searches = services.searches;
          panels.forEach(function (panel) {
            searches.get(panel.id)
            .then(function (hit) {
              let indexPat = JSON.parse(hit.kibanaSavedObjectMeta.searchSourceJSON).index;
              //if (!_.includes($scope.indexPatterns, indexPat))
              $scope.getIndexFieldNames(indexPat);
            });
          });
        };

        $scope.getIndexPatterns = function () {
          $scope.searches = _.uniq($scope.searches);
          let searches = services.searches;
          $scope.searches.forEach(function (search) {
            searches.find(search)
            .then(function (hits) {
              if (hits.hits.length > 0) $scope.indexPatterns.push(JSON.parse(hits.hits[0].kibanaSavedObjectMeta.searchSourceJSON).index);
            });
          });
        };

        $scope.parsePanelVis();
        $scope.parsePanelSearches();
        // PAC Feature: collect all index fields added to a dashboard

        $scope.save = function () {
          $state.title = dash.id = dash.title;
          $state.save();

          const timeRestoreObj = _.pick(timefilter.refreshInterval, ['display', 'pause', 'section', 'value']);
          dash.panelsJSON = angular.toJson($state.panels);
          dash.uiStateJSON = angular.toJson($uiState.getChanges());
          dash.timeFrom = dash.timeRestore ? timefilter.time.from : undefined;
          dash.timeTo = dash.timeRestore ? timefilter.time.to : undefined;
          dash.refreshInterval = dash.timeRestore ? timeRestoreObj : undefined;
          // PAC Feature: collect all index fields added to a dashboard
          //if (_.find($state.panels, {type: 'search'})) $state.options['fields'] =
          // angular.toJson(_.find($state.panels, {type: 'search'}).columns);
          $state.options.fields = _.uniq(_.flatten($scope.indexFieldNames)).sort();
          // PAC Feature: collect all index fields added to a dashboard
          dash.optionsJSON = angular.toJson($state.options);

          dash.save()
          .then(function (id) {
            $scope.configTemplate.close('save');
            if (id) {
              notify.info('Saved Dashboard as "' + dash.title + '"');
              if (dash.id !== $routeParams.id) {
                kbnUrl.change('/dashboard/{{id}}', {id: dash.id});
              }
            }
          })
          .catch(notify.fatal);
        };

        let pendingVis = _.size($state.panels);
        $scope.$on('ready:vis', function () {
          if (pendingVis) pendingVis--;
          if (pendingVis === 0) {
            $state.save();
            $scope.refresh();
          }
        });

        // listen for notifications from the grid component that changes have
        // been made, rather than watching the panels deeply
        $scope.$on('change:vis', function () {
          $state.save();
        });

        // called by the saved-object-finder when a user clicks a vis
        $scope.addVis = function (hit) {
          $scope.parsePanelVis(); // PAC Feature: collect all index fields added to a dashboard
          pendingVis++;
          $state.panels.push({ id: hit.id, type: 'visualization', panelIndex: getMaxPanelIndex() });
        };

        $scope.addSearch = function (hit) {
          $scope.parsePanelSearches(); // PAC Feature: collect all index fields added to a dashboard
          pendingVis++;
          $state.panels.push({ id: hit.id, type: 'search', panelIndex: getMaxPanelIndex() });
        };

        // Setup configurable values for config directive, after objects are initialized
        $scope.opts = {
          dashboard: dash,
          ui: $state.options,
          save: $scope.save,
          addVis: $scope.addVis,
          addSearch: $scope.addSearch
        };

        init();
      }
    };
  });
});
