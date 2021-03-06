var test   = require('tape').test
  , serial = require('../serial.js')
  , defer  = require('../lib/defer.js')
  ;

test('serial: iterates over object', function(t)
{
  var source   = { first: 1, second: 2, third: 3, fourth: 4, three: 3, two: 2, one: 1 }
    , itemsSum = 16
    , keys     = Object.keys(source)
    , expected = { first: 'A', second: 'B', third: 'C', fourth: 'D', three: 'C', two: 'B', one: 'A' }
    , start    = +new Date()
    ;

  t.plan(keys.length * 2 + 3);

  // supports full value, key, callback interface
  serial(source, function(item, key, cb)
  {
    t.ok(keys.indexOf(key) != -1, 'expect key (' + key + ') to exist in the keys array');
    t.equal(item, source[key], 'expect item (' + item + ') to match in same key (' + key + ') element in the source object');

    setTimeout(cb.bind(null, null, String.fromCharCode(64 + item)), 10 * item);
  },
  function(err, result)
  {
    var diff = +new Date() - start;

    t.ok(diff > (itemsSum * 10), 'expect response time (' + diff + 'ms) to be more than ' + (itemsSum * 10) + ' ms');
    t.error(err, 'expect no errors');
    t.deepEqual(result, expected, 'expect result to be an ordered letters object');
  });
});

test('serial: handles sync object iterator asynchronously', function(t)
{
  var source   = { first: 1, second: 2, third: 3, fourth: 4, three: 3, two: 2, one: 1 }
    , keys     = Object.keys(source)
    , expected = { first: 'A', second: 'B', third: 'C', fourth: 'D', three: 'C', two: 'B', one: 'A' }
    , isAsync  = false
    ;

  t.plan(keys.length * 2 + 3);

  defer(function(){ isAsync = true; });

  // supports full value, key, callback (shortcut) interface
  serial(source, function(item, key, cb)
  {
    t.ok(keys.indexOf(key) != -1, 'expect key (' + key + ') to exist in the keys array');
    t.equal(item, source[key], 'expect item (' + item + ') to match in same key (' + key + ') element in the source object');

    cb(null, String.fromCharCode(64 + item));
  },
  function(err, result)
  {
    t.ok(isAsync, 'expect async response');
    t.error(err, 'expect no errors');
    t.deepEqual(result, expected, 'expect result to be an ordered letters object');
  });
});

test('serial: object: longest finishes in order', function(t)
{
  var source   = { first: 1, one: 1, four: 4, sixteen: 16, sixtyFour: 64, thirtyTwo: 32, eight: 8, two: 2 }
    , expected = [ 1, 1, 4, 16, 64, 32, 8, 2 ]
    , target   = []
    ;

  t.plan(3);

  // supports just value, callback (shortcut) interface
  serial(source, function(item, cb)
  {
    setTimeout(function()
    {
      target.push(item);
      cb(null, item);
    }, 5 * item);
  },
  function(err, result)
  {
    t.error(err, 'expect no errors');
    t.deepEqual(result, source, 'expect result to be same as source object');
    // expect it to be invoked in order
    // which is not always the case with objects
    // use `serialOrdered` if order really matters
    t.deepEqual(target, expected, 'expect target to be same as source object');
  });
});

test('serial: object: terminates early', function(t)
{
  var source   = { first: 1, one: 1, four: 4, sixteen: 16, sixtyFour: 64, thirtyTwo: 32, eight: 8, two: 2 }
    , salvaged = { first: 1, one: 1, four: 4 }
    , expected = [ 1, 1, 4 ]
    , target   = []
    ;

  t.plan(Object.keys(salvaged).length + 4 + 1);

  // supports full value, key, callback (shortcut) interface
  serial(source, function(item, key, cb)
  {
    var id = setTimeout(function()
    {
      // expect it to be invoked in order
      // which is not always the case with objects
      // use `serialOrdered` if order really matters
      t.ok(item < 5 || item == 16, 'expect only certain numbers being processed');

      if (item < 10)
      {
        target.push(item);
        cb(null, item);
      }
      // return error on big numbers
      else
      {
        cb({key: key, item: item});
      }
    }, 5 * item);

    return clearTimeout.bind(null, id);
  },
  function(err, result)
  {
    t.equal(err.key, 'sixteen', 'expect to error out on key `sixteen`');
    t.equal(err.item, 16, 'expect to error out on value `16`');
    t.deepEqual(result, salvaged, 'expect result to contain salvaged parts of the source object');
    t.deepEqual(target, expected, 'expect target to contain passed numbers');
  });
});

test('serial: object: terminated early from outside', function(t)
{
  var source   = { first: 1, one: 1, four: 4, sixteen: 16, sixtyFour: 64, thirtyTwo: 32, eight: 8, two: 2 }
    , salvaged = { first: 1, one: 1, four: 4 }
    , expected = [ 1, 1, 4 ]
    , target   = []
    , limitNum = 7
    , terminator
    ;

  t.plan(expected.length + 3);

  setTimeout(function()
  {
    terminator();
  }, 5 * (limitNum + expected.reduce(function(a, b){ return a + b; })));

  terminator = serial(source, function(item, key, cb)
  {
    var id = setTimeout(function()
    {
      t.ok(item < limitNum, 'expect only numbers (' + key + ':' + item + ') less than (' + limitNum + ') being processed');

      target.push(item);
      cb(null, item);
    }, 5 * item);

    return clearTimeout.bind(null, id);
  },
  function(err, result)
  {
    t.error(err, 'expect no error response');
    t.deepEqual(result, salvaged, 'expect result to contain salvaged parts of the source object');
    t.deepEqual(target, expected, 'expect target to contain passed numbers');
  });
});

test('serial: object: terminated prematurely from outside', function(t)
{
  var source   = { first: 1, one: 1, four: 4, sixteen: 16, sixtyFour: 64, thirtyTwo: 32, eight: 8, two: 2 }
    , expected = { }
    , terminator
    ;

  t.plan(2);

  terminator = serial(source, function(item, cb)
  {
    var id = setTimeout(function()
    {
      t.fail('do not expect it to come that far');
      cb(null, item);
    }, 5 * item);

    return clearTimeout.bind(null, id);
  },
  function(err, result)
  {
    t.error(err, 'expect no error response');
    t.deepEqual(result, expected, 'expect result to contain salvaged parts of the source object');
  });

  terminator();
});

test('serial: object: terminated too late from outside', function(t)
{
  var source   = { first: 1, one: 1, four: 4, sixteen: 16, sixtyFour: 64, thirtyTwo: 32, eight: 8, two: 2 }
    , salvaged = { first: 1, one: 1, four: 4, sixteen: 16, sixtyFour: 64, thirtyTwo: 32, eight: 8, two: 2 }
    , expected = [ 1, 1, 4, 16, 64, 32, 8, 2 ]
    , target   = []
    , terminator
    ;

  t.plan(expected.length + 3);

  terminator = serial(source, function(item, key, cb)
  {
    var id = setTimeout(function()
    {
      t.equal(source[key], item, 'expect item (' + key + ':' + item + ') to equal ' + source[key]);

      target.push(item);
      cb(null, item);
    }, 5 * item);

    return clearTimeout.bind(null, id);
  },
  function(err, result)
  {
    // terminate it after it's done
    terminator();

    t.error(err, 'expect no error response');
    t.deepEqual(result, salvaged, 'expect result to contain salvaged parts of the source oject');
    t.deepEqual(target, expected, 'expect target to contain passed numbers');
  });
});

test('serial: object: handles non terminable iterations', function(t)
{
  var source   = { first: 1, one: 1, four: 4, sixteen: 16, sixtyFour: 64, thirtyTwo: 32, eight: 8, two: 2 }
    , expected = [ 1, 1, 4 ]
    , target   = []
    , previous = 0
    ;

  t.plan(expected.length + 2 + 1);

  // supports just value, callback (shortcut) interface
  serial(source, function(item, cb)
  {
    var id = setTimeout(function()
    {
      // expect it to be invoked in order
      // which is not always the case with objects
      // use `serialOrdered` if order really matters
      t.ok(item >= previous, 'expect item (' + item + ') to be equal or greater than previous item (' +  previous + ')');
      previous = item;

      if (item < 10)
      {
        target.push(item);
        cb(null, item);
      }
      // return error on big numbers
      else
      {
        cb({item: item});
      }
    }, 5 * item);

    return (item % 2) ? null : clearTimeout.bind(null, id);
  },
  function(err)
  {
    t.equal(err.item, 16, 'expect to error out on 16');
    t.deepEqual(target, expected, 'expect target to contain passed numbers');
  });
});

test('serial: object: handles unclean callbacks', function(t)
{
  var source   = { first: 1, second: 2, third: 3, fourth: 4, three: 3, two: 2, one: 1 }
    , keys     = Object.keys(source)
    , expected = { first: 2, second: 4, third: 6, fourth: 8, three: 6, two: 4, one: 2 }
    ;

  t.plan(keys.length * 2 + 2);

  // supports full value, key, callback (shortcut) interface
  serial(source, function(item, key, cb)
  {
    setTimeout(function()
    {
      t.ok(keys.indexOf(key) != -1, 'expect key (' + key + ') to exist in the keys array');
      t.equal(item, source[key], 'expect item (' + item + ') to match in same key (' + key + ') element in the source object');

      cb(null, item * 2);
      cb(null, item * -2);

    }, 5 * item);
  },
  function(err, result)
  {
    t.error(err, 'expect no errors');
    t.deepEqual(result, expected, 'expect result to be an multiplied by two object values');
  });
});
