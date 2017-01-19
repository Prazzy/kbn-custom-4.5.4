define(function (require) {
  require('ui/modules')
    .get('kibana')
    .filter('displayFilter', function () {
      return function (filter) {
        return filter.meta.key;
      };
    });
});
