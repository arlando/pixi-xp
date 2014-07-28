/**
 * Created by arlando on 7/27/14.
 */

/**
 * TODO: Figure out how to encapsulate particle system graphics (rotation etc)
 */
'use strict';

var async = require('async');
var mode = Object.freeze({
    sprite : 'SPRITES',
    graphic: 'GRAPHICS'
});

function ParticleSystem() {
    this.particles = 0;
    this.initialize();
}

ParticleSystem.prototype = {
    initialize: function () {
        this.repopulate = true;
        this.size = 2000;
        this.mode = mode.sprites;
        this.particles = [];
        this.epicenterx = 0;
        this.epicentery = 0;
        this.boundsX = 0;
        this.boundsY = 0;
    },

    resetParticles: function () {
        this.particles = [];
    },

    /**
     * Dependency injection
     * @param i
     * @param Particle - instance of a particle
     */
    addParticles: function (i, Particle) {
        if (i < 0) return;
        if (Particle === void 0) return;
        var x = 0;
        while (x < i) {
            this.particles.push(new Particle());
            x++;
        }
    },

    replenishParticles: function (Particle) {
        if (this.repopulate) {
            while(this.particles.length < this.size) {
                this.particles.push(new Particle())
            }
        }
        return this;
    },

    addParticle: function(p) {
        this.particles.push(p);
    },

    update: function(injection) {
        this.updateParticles(injection);
        return this;
    },

    updateParticles: function(injection) {
        async.each(this.particles, function(particle, callback) {
            particle.update(injection);
            callback();
        }, function (err) {
            if (err) throw err;
        })
    },

    removeDeadParticles: function(stage) {
        var self = this;
        async.filter(this.particles, function(particle, callback) {
            var isAlive = particle.isAlive();
            if (self.mode === mode.sprites && !isAlive) stage.removeChild(particle.getSprite());
            callback(particle.isAlive());
        }, function (results) {
            self.particles = results;
        });
        return this;
    },

    draw: function (injection) {
        this.drawParticles(injection);
        return this;
    },

    drawParticles: function (injection) {
        var self = this;
        async.each(this.particles, function(particle, callback) {
            if (self.mode === mode.sprites && !particle.hasSprite()) {
                particle.draw(injection);
            }
            callback();
        }, function (err) {
            if (err) throw err;
        });
    }

};

module.exports = ParticleSystem;

