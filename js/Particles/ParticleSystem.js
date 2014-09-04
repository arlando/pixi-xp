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
var SETTINGS = require('./SETTINGS');

function ParticleSystem() {
    this.particles = 0;
    this.initialize();
}

ParticleSystem.prototype = {
    initialize: function () {
        this.repopulate = true;
        this.removeDeadParticlesFromSystem = false; //less performant? will remove particle from system entirely
        this.repositionDeadParticlesInSystem = true; //more performant? will reposition particle in system, no new object creation
        this.size = SETTINGS.SIZE;
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
     * @param Particle - instance of a particle potentially allows for difference types of particles in the same system
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

    getSize: function () {
        return Math.floor(this.size);
    },

    //todo clean this up!
    addOrRemoveParticles: function(i, Particle, spriteBatch) {
        if (i < this.particles.length) {
            var particlesToRemove = this.particles.splice(0, i);
            if (this.mode === mode.sprites) {
                async.each(particlesToRemove, function(particle) {
                    spriteBatch.removeChild(particle.getSprite());
                });
            }
        } else {
            this.addParticle(i, Particle);
        }
    },

    replenishParticles: function (Particle, spriteBatch) {
        if (this.repopulate) {
            var size = this.particles.length;
            while(size < this.getSize()) {
                //not very performant...
                this.particles.push(new Particle());
                size++;
            }
            if (size > this.getSize()) {
                var numberOfParticlesToRemove = size - this.size;
                this.removeParticles(spriteBatch, numberOfParticlesToRemove);
                size--;
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
        var len = this.particles.length;

        for (var i = len - 1; i >= 0; i--) {
            this.particles[i].update(injection);
        }

    },

    resetOrRemoveParticles: function (stage) {

        if (this.removeDeadParticlesFromSystem) {
            this.removeDeadParticles(stage);
        } else if (this.repositionDeadParticlesInSystem) {
            this.repositionParticles();
        }

        return this;
    },

    removeParticles: function (stage, numberOfParticlesToRemove)  {
        var removed = 0;
        var size = this.particles.length;

        while (removed < numberOfParticlesToRemove) {
            if (removed + 1 > size) break; //case where we want to remove more than we can
            this.particles[removed].life = -1;
            removed++;
        }
        //did we actually remove anything?
        if (removed !== 0) {
            this.removeDeadParticles(stage);
        }

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
    },

    repositionParticles: function() {
        var len = this.particles.length;
        for (var i = len - 1; i >= 0; i--) {
            var particle = this.particles[i];
            if (!particle.isAlive()) particle.reset();
        }
    },

    draw: function (injection) {
        this.drawParticles(injection);
        return this;
    },

    drawParticles: function (injection) {
        var self = this;

        for (var i = this.particles.length; i--;) {
            var particle = this.particles[i];
            if (self.mode === mode.sprites && !particle.hasSprite()) {
                particle.draw(injection);
            }
        }
    }

};

module.exports = ParticleSystem;