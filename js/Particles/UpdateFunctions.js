/**
 * Created by arlando on 7/28/14.
 */
'use strict';
//TODO consider exposing objects dat.gui can manipulate which will effect vars
var noise = require('simplex-noise');

module.exports.walker = function () {
    this.vx += .01;
    this.vy += .01;
    this.px += this.vx;
    this.py += this.vy;
    if (this.hasSprite()) {
        this.sprite.position.x = this.px;
        this.sprite.position.y = this.py;
    }
    this.life -= this.lifeDecrement;
};