/**
 * Created by arlando on 7/28/14.
 * Functions related to the position of a particle.
 */

'use strict';
//TODO consider exposing objects dat.gui can manipulate which will effect vars

var GRAVITY = require('./NEWTON_CONSTANTS').GRAVITY_CONSTANT;
var SETTINGS = require('./SETTINGS');

//mainly for walking
var wx = 0; //globals produce more of a chain like effect
var wy = Math.random() * 1000; //...
var wx = Math.random() * 1000; //...
var SimplexNoise = require('simplex-noise');
var outerScope = this;
var simplex = new SimplexNoise(); //expensive

module.exports.walker = function (cb) {
    if (!this.wx) {
        this.wx = Math.random() * 1000;
    }
    if (!this.wy) {
        this.wy = Math.random() * 1000;
    }
    var n2dx = simplex.noise2D(0, this.wx);
    var n2dy = simplex.noise2D(0, this.wy);
    this.px = map(n2dx, 0, 1, 0, SETTINGS.WIDTH);
    this.py = map(n2dy, 0, 1, 0, SETTINGS.HEIGHT);
    this.wx += .0008;
    this.wy += .0008;
    this.life -= this.lifeDecrement;
    this.updateSprite();
    if (cb) {
        cb.call(this);
    }
};

module.exports.globalWalker = function (cb) {
    if (!outerScope.wx) outerScope.wx = Math.random() * 1000;
    if (!outerScope.wy) outerScope.wy = Math.random() * 1000;
    var n2dx = simplex.noise2D(0, outerScope.wx);
    var n2dy = simplex.noise2D(0, outerScope.wy);
    this.px = map(n2dx, 0, 1, 0, SETTINGS.WIDTH);
    this.py = map(n2dy, 0, 1, 0, SETTINGS.HEIGHT);
    outerScope.wx += .001;
    outerScope.wy += .001;
    this.updateSprite();

    if (cb) {
        cb.call(this);
    }
}

module.exports.basic = function (cb) {
    this.vx += .2;
    this.vy += 0;
    this.px += this.vx;
    this.py += this.vy;
    this.life -= this.lifeDecrement;
    this.life -= this.lifeDecrement;

    if (cb) {
        cb.call(this);
    }
};


module.exports.gravity = function (cb) {
    this.vy += GRAVITY;

    if (cb) {
        cb.call(this);
    }
};

function map(value, low1, high1, low2, high2) {
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}