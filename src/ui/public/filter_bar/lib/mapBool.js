define(function (require) {
  var _ = require('lodash');
  var moment = require('moment');
  return function mapBoolProvider(Promise, courier) {
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
          } else if (fl.query.regexp) {
            field = fl.query.regexp;
          } else if (fl.query.range) {
            field = fl.query.range;
            key = Object.keys(field)[0];
            if (field[key].gte && field[key].lte) return field[key].gte + ' TO ' + field[key].lte;
            else if (!field[key].lte) return '>=' + field[key].gte;
            if (!field[key].gte) return '<=' + field[key].lte;
          } else {
            field = fl.query;
          }
        } else if (fl.range) {
          //field = Object.keys(fl.range)[0];
          field = fl.range;
        }
        else if (fl.bool) {
          field = fl.bool.must.term;
        }

        // if (filter.meta.index) {
        //   var fieldValue;
        //   return courier.indexPatterns.get(filter.meta.index).then(function (indexPattern) {
        //       debugger;
        //       key = Object.keys(field)[0];
        //       let indexField = indexPattern.fields.byName[key];
        //       let value = field[key];
        //       if (indexField) field[key] = indexField.format.convert(value);
        //       if (indexField.format.constructor.name === 'DateTime') field[key] = value.replace(' ', 'T');
        //       return Promise.resolve({ key: key, value: field[key]});
        //   });
        // } else {
        key = Object.keys(field)[0];
        var boolTemplate = _.template(action);
        let fieldValue = field[key];
        // if (moment(fieldValue).isValid()) {
        //   fieldValue = moment(fieldValue).format('YYYY-MM-DD HH:mm:ss');
        // }
        return boolTemplate({'value': fieldValue});
        //}
      });

      if (filter.meta.index && values.length === 1) {
        var fieldValue;
        return courier.indexPatterns.get(filter.meta.index).then(function (indexPattern) {
          let indexField = indexPattern.fields.byName[key];
          let value;
          if (indexField) {
            value = (indexField.format.constructor.id === 'date') ?  Number(values[0]) : values[0];
            if (isNaN(value)) value = values[0];
            else value = indexField.format.convert(value);
          } else value = values[0];
          return Promise.resolve({ key: key, value: value});
        });
      } else {
        return Promise.resolve({ key: key, value: values.join()});
      }
    };
  };

});
