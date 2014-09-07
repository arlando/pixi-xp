/**
 * Created by arlando on 8/13/14.
 * This function calls processes on particles.
 * TODO: inspect optimizatioin by using Duff's Device if the size of the function set increases above a certain amount.
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

module.exports.addToSetCallAtRandom = function (f) {

}

module.exports.removeFromSet = function (f) {
    var index = functionSet.indexOf(f);
    if (index > -1) {
        functionSet.splice(index, 1);
    }
};

module.exports.applicator = function () {
    //important: add functions in reverse
    //TODO: consider duff's device
    for(var i = functionSet.length; i--;) {
        applicatorFunction.call(this, functionSet[i], i)
    }
};