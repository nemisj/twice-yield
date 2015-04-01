/*eslint-env node*/
'use strict';

describe.only('Promise', function () {
  
  var o_o = require('yield-yield');
  var fs = require('fs');
  var expect = require('chai').expect;
  var promise = require('promise');

  it('should run promise and return its value', function (done) {

    var getUsername = function () {
      var p = new Promise(function (res, rej) {
        setTimeout(function () {
          res('Maks Nemisj');
        }, 50);
      });
      return p;
    };

    var fnc = o_o(function *() {
      var result = yield getUsername();
      expect(result[1]).to.be.equal('Maks Nemisj');
    });

    fnc(function (err) {
      return done();
    });

  });

  it('should run promise and return error if occured', function (done) {
    var message = 'Promise Error #' + ~~(Math.random() * 1000);

    var getUsername = function () {
      var p = new Promise(function (res, rej) {
        setTimeout(function () {
          rej(message);
        }, 50);
      });
      return p;
    };

    var fnc = o_o(function *() {
      // this one will throw error and willstop
      var result = yield getUsername();
      expect(result[0]).to.be.equal(message);
    });

    fnc(function (err) {
      expect(err).to.be.not.ok;
      return done();
    });
  });


});
