'use strict';

var id = 0;
var VectorMixin = require('./VectorMixin');
var _ = require('underscore');
var SETTINGS = require('./SETTINGS');

function Particle() {
    this.life = Math.floor(Math.random() * 25) + 1;
    this.lifeDecrement = 1;
    this.radius = 1;
    this.mass = 1;
    this.px = Math.floor(Math.random() * SETTINGS.WIDTH);
    this.py = Math.floor(Math.random() * SETTINGS.HEIGHT);
    this.seed = Math.random() * Math.random();
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.id = id;
    id++;
}

Particle.prototype = {
    reset: function () {
        //to make trailing effect
        this.px = Math.floor(Math.random() * SETTINGS.WIDTH);
        this.py = Math.floor(Math.random() * SETTINGS.HEIGHT);
        this.life = Math.floor(Math.random() * 25) + 1;
        this.seed = Math.random() * Math.random();
        this.vx = 0;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;
    },

    getMass: function () {
        return this.mass;
    },

    isAlive: function () {
        return this.life > 0;
    },

    setSprite: function (sprite) {
        this.sprite = sprite;
    },

    hasSprite: function () {
        return this.sprite !== void 0;
    },

    updateSprite: function () {
        if (this.hasSprite()) {
            this.sprite.position.x = this.px;
            this.sprite.position.y = this.py;
        }
    },

    getSprite: function () {
        return this.sprite;
    },

    update: function (injection) {
        if (injection) {
            injection.call(this);
        } else {
            this.vx += this.ax;
            this.vy += this.ay;
            this.px += this.vx;
            this.py += this.vy;
            this.life -= this.lifeDecrement;
        }
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

    /**
     * Is the particle in the bounds of the container
     * //TODO
     */
    inBounds: function () {
        return x < 0 || x > SETTINGS.WIDTH || y < 0 || y > SETTINGS.HEIGHT;
    },

    //draws the function via dependency injection
    draw: function(injection) {
        if (injection) {
            injection.call(this);
        }
        return this;
    }
};

//mix it up!
_.extend(Particle.prototype, VectorMixin);

module.exports = Particle;