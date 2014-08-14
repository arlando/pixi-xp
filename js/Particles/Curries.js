/**
 * Created by arlando on 8/13/14.
 */
'use strict';

var currF;
module.exports.wobble = function () {

};

module.exports.setF = function (f) {
    currF = f;
}

module.exports.applicator = function () {
    currF.call(this);
    this.px *= -1;
}