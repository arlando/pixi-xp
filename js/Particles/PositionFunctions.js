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

//This walker uses variables stored on the particle, but the wx, wy seed are
//a normal distribution of the random function.
//TODO: delineate from the normal distribution
module.exports.walker = function (cb) {
    this.noiseXIncrement = this.noiseYIncrement = .007;
    if (!this.wx) {
        this.wx = Math.random() + 20;
        this.vx = this.wx;
    }
    if (!this.wy) {
        this.wy = Math.random() + 60;
        this.vy = this.wy;
    }

    var n2dx = simplex.noise2D(0, this.vx);
    var n2dy = simplex.noise2D(0, this.vy);
    this.px = map(n2dx, 0, 1, 0, SETTINGS.WIDTH);
    this.py = map(n2dy, 0, 1, 0, SETTINGS.HEIGHT);
   // console.log(this.px);
    this.vx += this.noiseXIncrement;
    this.vy += this.noiseYIncrement;

    this.updateSprite();
    if (cb) {
        cb.call(this);
    }
};

//This walker uses global variables, so the particles act in unison
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

//Basic movement ood for testing
module.exports.basic = function (cb) {
    this.vx += .005;
    this.vy += .005;
    this.px += this.vx;
    this.py += this.vy;


    this.updateSprite();
    if (cb) {
        cb.call(this);
    }
};


//Adds gravity
module.exports.gravity = function (cb) {
    this.vy += GRAVITY;
    this.updateSprite();
    if (cb) {
        cb.call(this);
    }
};

function map(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

//notes:

//This produces an interesting harmonic
//if (!this.wx) {
//    this.wx = Math.random() + 20;
//    this.vx = this.wx;
//}
//if (!this.wy) {
//    this.wy = Math.random() + 60;
//    this.vy = this.wy;
//}