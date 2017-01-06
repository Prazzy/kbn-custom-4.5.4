define(function (require) {
  var _ = require('lodash');
  return function mapBoolProvider(Promise) {
    return function (filter) {
      if (!filter.bool) return Promise.reject(filter);
      var subFilters = filter.bool.should;
      var key;
      var values = _.map(subFilters, function (fl) {
        var field;
        var action = '<%= value %>';
        if (fl.query) {
          if (fl.query.prefix) {
            field = fl.query.prefix;
            action = '<%= value %>*';
          } else if (fl.query.wildcard) {
            field = fl.query.wildcard;
          }
        } else if (fl.bool) {
          field = fl.bool.must.term;
        }
        key = Object.keys(field)[0];

        var boolTemplate = _.template(action);
        return boolTemplate({'value': field[key]});
      });
      return Promise.resolve({ key: key, value: values.join() });
    };
  };

});
