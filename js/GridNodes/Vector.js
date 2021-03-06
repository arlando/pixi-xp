/**
 * Created by arlando on 7/26/14.
 */
'use strict';

function Vector(x, y) {
    this.x = x || 0;
    this.y = y || 0;
}

Vector.prototype.add = function (v, out) {

};

Vector.prototype = {
    add: function (v) {
        this.x += v.x;
        this.y += v.y;
    },

    subtract: function (v, out) {
        if (out) {

            out.x -= v.x;
            out.y -= v.y;

        } else {

            this.x -= v.x;
            this.y -= v.y;

        }
    },

    scale: function (s, out) {
        if (out) {

            out.x *= s;
            out.y *= s;

        } else {

            this.x *= s;
            this.y *= s;

        }
    },

    length: function () {
        return Math.sqrt((this.x * this.x) + (this.y * this.y));
    },

    normalize: function(out) {
        var len;
        if (out) {

            len = 1 / out.length();
            out.x *= len;
            out.y *= len;

        } else {

            len = 1 / this.length();
            this.x *= len;
            this.y *= len;

        }
    }
};

module.exports = Vector;