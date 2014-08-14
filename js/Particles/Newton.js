/**
 * Created by arlando on 7/30/14.
 * Takes in an object that implements the VectorMixin and does Newtonian Physics on it
 */


'use strict';

var NEWTON_CONSTANTS = require('./NEWTON_CONSTANTS');

module.exports = Object.freeze({
    friction: function (p) {
        var frictionMagnitude = NEWTON_CONSTANTS.COEFFICIENT_FRICTION * NEWTON_CONSTANTS.NORMAL_FRICTION;
        var fx = p.vx * -1;
        var fy = p.vy * -1;
        var len = Math.sqrt((fx * fx) + (fy * fy));

        fx /= len;
        fy /= len;

        fx *= frictionMagnitude;
        fy *= frictionMagnitude;

        p.applyForce(fx, fy);
    },

    gravity: NEWTON_CONSTANTS.GRAVITY_CONSTANT,

    /**
     * Attracts two particles together.
     * @param p1
     * @param p2
     */
    attract: function(p1, p2) {
        if (p1.id !== p2.id) {
            var fx = p1.px - p2.px;
            var fy = p1.py - p2.py;
            var distance = Math.sqrt((fx*fx) + (fy*fy));
            var nfx = fx / distance; //normalized
            var nfy = fy / distance;
            var strength = ( NEWTON_CONSTANTS.GRAVITATIONAL_CONSTANT * p1.mass * p2.mass ) / ( distance * distance );
            nfx *= strength;
            nfy *= strength;
            p2.applyForce(nfx, nfy)
        }

    }
});