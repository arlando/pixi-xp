/**
 * Created by arlando on 7/28/14.
 */
'use strict';
//TODO consider exposing objects dat.gui can manipulate which will effect vars
var noise = require('simplex-noise');
var GRAVITY = require('./NEWTON_CONSTANTS').GRAVITY_CONSTANT;

module.exports.walker = function (cb) {
    this.vx += .1;
    this.vy += .001;
    this.px += this.vx + Math.random() * 3;
    this.py += this.vy;

    if (this.hasSprite()) {
        this.sprite.position.x = this.px;
        this.sprite.position.y = this.py;
    }

    this.life -= this.lifeDecrement;
    if (cb) {
        cb();
    }
};

module.exports.gravity = function (cb) {
    this.vy += GRAVITY;

    if (cb) {
        cb();
    }
}