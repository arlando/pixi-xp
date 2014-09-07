/*
Functions to decide how particles should be reset, or have their
velocities mutated.

Life - How long has the particle been around?
If the particle has been around too long what do we do to it?
How much should we decrement the life by for the particle?

Bounds - Is the particle in bounds or out of bounds?
Is the particle's X position out of bounds?
Is the particle's Y position out of bounds?
 */

'use strict';
var SETTINGS = require('./SETTINGS');
module.exports = {
    ifOutOfBoundsReset: function () {
        if (!this.inBounds()) this.reset();
    },

    bounceOffWall: function () {
        //when dealing with high accelerated objects, you could go way out of bounds
        //this function would then toggle vx from negative to positive, thus the object could
        //get stuck in out of bounds. So we set a flag denoting that we are in
        //the process of switching bounds.
        if (!this.switchingVx && this.outOfBoundsX()) {
            this.vx *= this.bounceVx || SETTINGS.BOUNCEVX;
            this.switchingVx = true;
        }

        if (this.switchingVx && !this.outOfBoundsX()) {
            this.switchingVx = false;
            if (this.noiseXIncrement) {
                this.noiseXIncrement *= this.bounceVx || SETTINGS.BOUNCEVX;
            }
        }

        if (!this.switchingVy && this.outOfBoundsY()) {
            this.vy *= this.bounceVy || SETTINGS.BOUNCEVY;
            if (this.noiseYIncrement) {
                this.noiseYIncrement *= this.bounceVy || SETTINGS.BOUNCEVY;
            }
            this.switchingVy = true;
        }

        if (this.switchingVy && !this.outOfBoundsY()) {
            this.switchingVy = false;
        }
    },

    _decrementLife: function () {
        this.life -= this.lifeDecrement;
    },

    removeIfDead: function () {
        this._decrementLife();
    },

    resetIfDead: function () {
        this._decrementLife();
        this.reset();
    }
}