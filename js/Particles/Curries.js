/**
 * Created by arlando on 8/13/14.
 */
'use strict';

var functionSet = [];
var applicatorFunction = function (funct, index) {
    //if (Math.random()*30 % 2) {
        funct.call(this);
    //}
};

module.exports.addToSet = function (f) {
    if (f instanceof Array) {
        functionSet = functionSet.concat(f);
    } else {
        functionSet.push(f);
    }
};

module.exports.removeFromSet = function (f) {
    var index = functionSet.indexOf(f);
    if (index > -1) {
        functionSet.splice(index, 1);
    }
};

module.exports.applicator = function () {
    for(var i = 0, len = functionSet.length; i < len; i++) {
        applicatorFunction.call(this, functionSet[i], i)
    }
};

