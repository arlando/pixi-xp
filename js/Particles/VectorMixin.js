/**
 * Mixin to make an object act like a vector.
 */

'use strict';

module.exports = {
    applyForce: function (fx, fy) {
        if (this.mass === 0) throw new Error("Cannot applyForce if mass is zero.");
        fx /= this.mass;
        fy /= this.mass;
        this.ax += fx;
        this.ay += fy;
    },

    add: function (v, out) {
        if (out) {

            out.x += v.x;
            out.y += v.y;

        } else {

            this.x += v.x;
            this.y += v.y;

        }
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

    length: function (x, y) {
        if (x && y) {
            return Math.sqrt((x * x) + (y * y));
        }
        return Math.sqrt((this.x * this.x) + (this.y * this.y));
    },

    lengthSq: function () {
        return this.x * this.x + this.y * this.y;
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
    },

    getDirection : function(vx, vy) {
        return Math.atan2(vx, -vy) * (180 / Math.PI);
    },

    /**
     * v is something that has a vector mixin
     * @param v
     * @returns {*}
     */
    dot: function (v) {
        return this.x * v.x + this.y + v.y;
    },

    /**
     * v is something that has a vector mixin
     * @param v
     */
    distanceTo: function (v) {

    }

};