/*global bootstrap, define, module, ses*/
(function (definition) {
  'use strict';

  // This file will function properly as a <script> tag, or a module
  // using CommonJS and NodeJS or RequireJS module formats.  In
  // Common/Node/RequireJS, the module exports the yield-yield API and when
  // executed as a simple <script>, it creates a o_o global instance.

  // Montage Require
  if (typeof bootstrap == 'function') {
    bootstrap('promise', definition);

    // CommonJS
  } else if (typeof exports == 'object' && typeof module == 'object') {
    module.exports = definition();

    // RequireJS
  } else if (typeof define == 'function' && define.amd) {
    define(definition);

    // SES (Secure EcmaScript)
  } else if (typeof ses != 'undefined') {
    if (!ses.ok()) {
      return;
    } else {
      ses.makeQ = definition;
    }

    // <script>
  } else if (typeof self != 'undefined') {
    self.o_o = definition();

  } else {
    throw new Error('This environment was not anticipated by Q. Please file a bug.');
  }

})(function () {
  'use strict';

  var counter = 0;

  function callNext(gen, callbackReturnValue) {
    // test for the first value in callbackReturnValue
    var firstValue = callbackReturnValue[0];
    var v;

    if (firstValue === null || typeof firstValue == 'undefined') {
      if (callbackReturnValue.length <= 1) {
        v = gen.next();
      } else {
        // if there are more then one item, create an array of it, but show warning in the console
        if (callbackReturnValue.length == 2) {
          v = gen.next(callbackReturnValue[1]);
        } else {
          // console.log('more then one argument is passed to the callback');
          callbackReturnValue.shift();
          v = gen.next(callbackReturnValue);
        }
      }
    } else {
      // this is an error state
      v = gen.throw(firstValue);
    }

    return v;
  }

  function promiser(gen, promise, cb) {
    // it's a promise
    promise.then(function onSuccess(value) {
      var v;

      try {
        v = gen.next(value);
      } catch (e) {
        cb(e);
        return;
      }

      cb(null, v);
      // separate return after cb in order to not return anything into the
      // Promise
      return;
    }, function onError(error) {
      var v;
      try {
        v = gen.throw(error);
      } catch (e) {
        cb(e);
        return;
      }

      cb(null, v);
    });
  }

  function twicer(gen, cb) {

    var secondYieldCalled = false;
    var cbCalled = false;
    var callbackReturnValue;
    // first value of the arguments passed to the yieldCallback
    var stop = false;
    var returnFromGen;
    var v;
    var yieldCallback;

    counter++;

    // callback which is returned when yield is called for the first time
    yieldCallback = function () {
      var errMsg;
      if (stop) {
        // just do nothing, generator is stopped due to some error
        return;
      } else if (cbCalled) {
        errMsg = 'Callback is called twice. This is not good';
        if (secondYieldCalled) {
          // it's asynchronous
          throw new Error(errMsg);
        } else {
          // it's the same loop
          throw new Error(errMsg);
        }
        return;
      }

      // callback is called,
      // test if it has been called before the second yield or after
      cbCalled = true;

      callbackReturnValue = Array.prototype.slice.call(arguments);

      // if geneartor was already postponed, but the second yield statement
      // execute next()
      if (!secondYieldCalled) {
        // yield is not called yet
        // so waiting till it will resume
        return;
      }


      try {
        v = callNext(gen, callbackReturnValue);
      } catch (e) {
        // this can happen
        // after the second yield and next return/yield statement
        return cb(e);
      }

      // ok, this is already the next call to the yield, not ours
      return cb(null, v);
    };

    // Step 1: requesting callback
    try {
      returnFromGen = gen.next(yieldCallback);
    } catch (e) {
      // code might break in the normal loop
      // before second callback is called
      cb(e);
      return;
    }

    // putting flag, that second yield have been called
    secondYieldCalled = true;

    // Generator could exit using return, so testing result
    if (returnFromGen.done) {
      stop = true;
      return cb(new Error('Generator has no second yield statement. Using yield-yield is useless'));
    }


    if (!cbCalled) {
      // second yield is called, but our yieldCallback still not
      // waiting in the callback till this will happen and execute the .next
      return;
    }

    //if cb is already called, execute .next
    // resume the second yield statement
    try {
      v = callNext(gen, callbackReturnValue);
    } catch (e) {
      // this error might happen between second yield and the return/yield
      // statement
      return cb(e);
    }

    return cb(null, v);
  }

  function start(gen, finalCallback) {

    if (!gen.__id__) {
      gen.__id__ = ~~(Math.random() * 1000);
    }

    // result returned from the first yield
    var result;
    // checker of the main loop
    var testValue;

    // starts the Generator
    try {
      // first error before any yield will be called
      result = gen.next();
    } catch (e) {
      return finalCallback(e);
    }

    testValue = function (e, retValue) {
      // object which is returned by yield or return
      // sitting inside retValue.value
      var realValue;

      if (e) {
        finalCallback(e);
        return;
      }

      realValue = retValue.value;

      // test if the generator has been exited
      if (retValue.done) {
        // generator is done
        // if realValue has unwrap boolean
        // then apply arguments asif they're real args
        if (typeof realValue == 'undefined') {
          return finalCallback();
        } else {
          return finalCallback(null, realValue);
        }

      } else {
        // it's not return, but yield

        if (typeof realValue == 'undefined') {
          // this is a twicer, first callback
          // which means, that we pass the cb to the first yield
          // and returns value in the second yield
          twicer(gen, testValue);
        } else if (typeof realValue.then == 'function') {
          promiser(gen, realValue, testValue);
        } else if (typeof realValue == 'object') {
          // this might be generator
          // or null
          if (typeof realValue.next == 'function') {
            start(realValue, function () {
              var args = Array.prototype.slice.call(arguments);
              var err;

              result = null;

              try {
                result = callNext(gen, args);
              } catch (e) {
                err = e;
              }

              if (err) {
                return testValue(err);
              } else {
                testValue(null, result);
              }
            });

          }

        } else if (typeof realValue == 'function') {
          // function
          finalCallback(new Error('Function support not implemented yet'));
        }

      }

    };

    testValue(null, result);
  }


  function runner(Gen, args) {

    // callback which is passed with args
    var cb;
    // this is the wrapper which will calle cb
    var finalCallback;
    // generator instance
    var gen;

    // take the last argument as callback, and all other stuff pass as
    // arguments to Gen
    // but only if it was defined in original Generator
    args = args.slice();

    if (Gen.length === args.length - 1) {
      // doing magic
      cb = args[args.length - 1];
      if (typeof cb == 'function') {
        // great, real magic
        args.pop();

        finalCallback = function () {
          // detach final callback from the thread
          // in order not to catch any errors in here
          var recivedArgs = arguments;
          // make it one-time call
          finalCallback = function () {};
          setTimeout(function () {
            cb.apply(this, recivedArgs);
          }, 0);

          return;
        };
      } else finalCallback = function() {};
    } else {
      // arguments mismatch
      finalCallback = function () {};
    }

    gen = Gen.apply(this, args);

    start(gen, finalCallback);

  }

  var module = function (Gen) {
    var fnc;

    if (typeof Gen != 'function') {
      throw new Error('Generator is not a function');
    }

    fnc = function fnc(cb) {
      var args = Array.prototype.slice.call(arguments);
      runner(Gen, args);
    };

    return fnc;

  };

  module.run = function (Gen) {
    return module(Gen)();
  }

  return module;

});
