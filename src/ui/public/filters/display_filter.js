define(function (require) {
  require('ui/modules')
    .get('kibana')
    .filter('displayFilter', function () {
      return function (filter) {
        console.log(filter);
        return filter.meta.key;
      };
    });
});
