/*!
 * QUnit CLI Boilerplate v1.0.0-pre
 * Copyright 2011-2012 John-David Dalton <http://allyoucanleet.com/>
 * Based on a gist by Jörn Zaefferer <https://gist.github.com/722381>
 * Available under MIT license <http://mths.be/mit>
 */
;(function(global) {
  'use strict';

  /** Add `console.log()` support for Narwhal, Rhino, and RingoJS */
  global.console || (global.console = { 'log': global.print });

  /** Reduce global.QUnit.QUnit -> global.QUnit */
  global.QUnit && (QUnit = QUnit.QUnit || QUnit);

  /*--------------------------------------------------------------------------*/

  /** Used as a horizontal rule in console output */
  var hr = '----------------------------------------';

  /** Shortcut used to convert array-like objects to arrays */
  var slice = [].slice;

  /** Used to resolve a value's internal [[Class]] */
  var toString = {}.toString;

  /** Used by timer methods */
  var doneCalled,
      timer,
      counter = 0,
      ids = {};

  /*--------------------------------------------------------------------------*/

  /**
   * An iteration utility for arrays.
   *
   * @private
   * @param {Array} array The array to iterate over.
   * @param {Function} callback The function called per iteration.
   */
  function each(array, callback) {
    var index = -1,
        length = array.length;

    while (++index < length) {
      callback(array[index], index, array);
    }
  }

  /**
   * Checks if the specified `value` is a function.
   *
   * @private
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if `value` is a function, else `false`.
   */
  function isFunction(value) {
    return toString.call(value) == '[object Function]';
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Timeout fallbacks based on the work of Andrea Giammarchi and Weston C.
   * https://github.com/WebReflection/wru/blob/master/src/rhinoTimers.js
   * http://stackoverflow.com/questions/2261705/how-to-run-a-javascript-function-asynchronously-without-using-settimeout
   */

  /**
   * Clears the delay set by `setInterval` or `setTimeout`.
   *
   * @memberOf global
   * @param {Number} id The ID of the timeout to be cleared.
   */
  function clearTimer(id) {
    if (ids[id]) {
      ids[id].cancel();
      timer.purge();
      delete ids[id];
    }
  }

  /**
   * Schedules timer-based callbacks.
   *
   * @private
   * @param {Function} fn The function to call.
   * @oaram {Number} delay The number of milliseconds to delay the `fn` call.
   * @param [arg1, arg2, ...] Arguments to invoke `fn` with.
   * @param {Boolean} repeated A flag to specify whether `fn` is called repeatedly.
   * @returns {Number} The the ID of the timeout.
   */
  function schedule(fn, delay, args, repeated) {
    var task = ids[++counter] = new JavaAdapter(java.util.TimerTask, {
      'run': function() {
        fn.apply(global, args);
      }
    });
    // support non-functions
    if (!isFunction(fn)) {
      fn = (function(code) {
        code = String(code);
        return function() { eval(code); };
      }(fn));
    }
    // used by setInterval
    if (repeated) {
      timer.schedule(task, delay, delay);
    }
    // used by setTimeout
    else {
      timer.schedule(task, delay);
    }
    return counter;
  }

  /**
   * Executes a code snippet or function repeatedly, with a delay between each call.
   *
   * @memberOf global
   * @param {Function|String} fn The function to call or string to evaluate.
   * @oaram {Number} delay The number of milliseconds to delay each `fn` call.
   * @param [arg1, arg2, ...] Arguments to invoke `fn` with.
   * @returns {Number} The the ID of the timeout.
   */
  function setInterval(fn, delay) {
    return schedule(fn, delay, slice.call(arguments, 2), true);
  }

  /**
   * Executes a code snippet or a function after specified delay.
   *
   * @memberOf global
   * @param {Function|String} fn The function to call or string to evaluate.
   * @oaram {Number} delay The number of milliseconds to delay the `fn` call.
   * @param [arg1, arg2, ...] Arguments to invoke `fn` with.
   * @returns {Number} The the ID of the timeout.
   */
  function setTimeout(fn, delay) {
    return schedule(fn, delay, slice.call(arguments, 2));
  }

  /*--------------------------------------------------------------------------*/

  /**
   * A logging callback triggered when all testing is completed.
   *
   * @memberOf QUnit
   * @param {Object} details An object with properties `failed`, `passed`,
   *  `runtime`, and `total`.
   */
  function done(details) {
    // stop `asyncTest()` from erroneously calling `done()` twice in
    // environments w/o timeouts
    if (doneCalled) {
      return;
    }
    doneCalled = true;
    console.log(hr);
    console.log('    PASS: ' + details.passed + '  FAIL: ' + details.failed + '  TOTAL: ' + details.total);
    console.log('    Finished in ' + details.runtime + ' milliseconds.');
    console.log(hr);

    // exit out of Rhino
    try {
      quit();
    } catch(e) { }

    // exit out of Node.js
    try {
      process.exit();
    } catch(e) { }
  }

  /**
   * A logging callback triggered after every assertion.
   *
   * @memberOf QUnit
   * @param {Object} details An object with properties `actual`, `expected`,
   *  `message`, and `result`.
   */
  function log(details) {
    var expected = details.expected,
        result = details.result,
        type = typeof expected != 'undefined' ? 'EQ' : 'OK';

    var assertion = [
      result ? 'PASS' : 'FAIL',
      type,
      details.message || 'ok'
    ];

    if (!result && type == 'EQ') {
      assertion.push('Expected: ' + expected + ', Actual: ' + details.actual);
    }
    QUnit.config.testStats.assertions.push(assertion.join(' | '));
  }

  /**
   * A logging callback triggered at the start of every test module.
   *
   * @memberOf QUnit
   * @param {Object} details An object with property `name`.
   */
  function moduleStart(details) {
    console.log(hr);
    console.log(details.name);
    console.log(hr);
  }

  /**
   * Converts an object into a string representation.
   *
   * @memberOf QUnit
   * @type Function
   * @param {Object} object The object to stringify.
   * @returns {String} The result string.
   */
  var parseObject = (function() {
    var func = QUnit.jsDump.parsers.object;
    return function(object) {
      // fork to support Rhino's error objects
      if (typeof object.rhinoException == 'object') {
        return object.name +
          ' { message: "' + object.message +
          '", fileName: "' + object.fileName +
          '", lineNumber: ' + object.lineNumber + ' }';
      }
      return func(object);
    };
  }());

  /**
   * A logging callback triggered after a test is completed.
   *
   * @memberOf QUnit
   * @param {Object} details An object with properties `failed`, `name`,
   *  `passed`, and `total`.
   */
  function testDone(details) {
    var assertions = QUnit.config.testStats.assertions,
        testName = details.name;

    if (details.failed > 0) {
      console.log(' FAIL - '+ testName);
      each(assertions, function(value) {
        console.log('    ' + value);
      });
    }
    else {
      console.log(' PASS - ' + testName);
    }
    assertions.length = 0;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * An object used to hold information about the current running test.
   *
   * @memberOf QUnit.config
   * @type Object
   */
  QUnit.config.testStats = {

    /**
     * An array of test summaries (pipe separated).
     *
     * @memberOf QUnit.config.testStats
     * @type Array
     */
    'assertions': []
  };

  // add shortcuts to the global
  // exclude `module` because some environments have it as a built-in object
  each(['asyncTest', 'deepEqual', 'equal', 'equals', 'expect', 'notDeepEqual',
        'notEqual', 'notStrictEqual', 'ok', 'raises', 'same', 'start', 'stop',
        'strictEqual', 'test', 'throws'], function(funcName) {
    var func = QUnit[funcName];
    if (func) {
      global[funcName] = func;
    }
  });

  // expose timer methods to global
  try {
    timer = new java.util.Timer;
    if (!isFunction(global.clearInterval)) {
      global.clearInterval = clearTimer;
    }
    if (!isFunction(global.clearTimeout)) {
      global.clearTimeout = clearTimer;
    }
    if (!isFunction(global.setInterval)) {
      global.setInterval = setInterval;
    }
    if (!isFunction(global.setTimeout)) {
      global.setTimeout = setTimeout;
    }
  } catch(e) { }

  // add callbacks
  QUnit.done(done);
  QUnit.log(log);
  QUnit.moduleStart(moduleStart);
  QUnit.testDone(testDone);

  // add wrapped function
  QUnit.jsDump.parsers.object = parseObject;

  // must call `QUnit.start()` in the test file if using QUnit < 1.3.0 with
  // Node.js or any version of QUnit with Narwhal, Rhino, or RingoJS
  QUnit.init();

}(typeof global == 'object' && global || this));
