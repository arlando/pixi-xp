/**
 * Created by arlando on 7/26/14.
 */
'use strict';

function Vector(x, y) {
    this.x = x || 0;
    this.y = y || 0;
}

Vector.prototype.add = function (x, y) {
    this.x += x;
    this.y += y;
    return this;
};

module.exports = Vector;