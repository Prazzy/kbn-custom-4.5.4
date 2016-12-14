define(function (require) {
  var _ = require('lodash');
  return function mapBoolProvider(Promise) {
    return function (filter) {
      if (!filter.bool.should) return Promise.reject(filter);
        var sub_filters = filter.bool.should;
        var key;
        values = _.map(sub_filters, function(fl){
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

          var bool_template = _.template(action);
          return bool_template({'value': field[key]});
        });
        return Promise.resolve({ key: key, value: values.join() });
      

    };
  };

});
