
/**
 * Created by arlando on 7/27/14.
 */
'use strict';
var id = 0;

function Particle() {
    this.life = Math.floor(Math.random() * 25) + 1;
    this.lifeDecrement = 1;
    this.radius = 1;
    this.mass = 1;
    this.px = Math.floor(Math.random() * 600);
    this.py = Math.floor(Math.random() * 600);
    this.seed = Math.random() * Math.random();
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.id = id;
    id++;
}

Particle.prototype = {
    isAlive: function () {
        return this.life > 0;
    },

    setSprite: function (sprite) {
        this.sprite = sprite;
    },

    hasSprite: function () {
        return this.sprite !== void 0;
    },

    getSprite: function () {
        return this.sprite;
    },

    update: function (injection) {
        if (injection) {
            injection.call(this);
            return this;
        }
        this.vx += this.ax;
        this.vy += this.ay;
        this.px += this.vx;
        this.py += this.vy;
        this.life -= this.lifeDecrement;
        return this;
    },

    setVelocity: function (vx, vy) {
        this.vx = vx;
        this.vy = vy;
        return this;
    },

    setAcceleration: function (ax, ay) {
        this.ax = ax;
        this.ay = ay;
        return this;
    },

    applyForce: function (fx, fy) {
        if (this.mass >= 0) throw new Error('mass cannot be zero');
        this.ax += fx / this.mass;
        this.ay += fy / this.mass;
    },

    /**
     * Is the particle in the bounds of the container
     * //TODO
     */
    checkBounds: function () {

    },

    //draws the function via dependency injection
    draw: function(injection) {
        if (injection) {
            injection.call(this);
        }
        return this;
    }
};

module.exports = Particle;