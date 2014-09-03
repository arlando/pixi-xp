/**
 * Created by arlando on 7/27/14.
 */
/**
 * Particle experiments
 * - How many particles can we get rendered?
 * - How not to block the UI thread (50ms max execution time)?
 * - How can we expose properties to dynamically change the system?
 * - How can we keep particles independent of one another?
 */

'use strict';
var domready = require('domready');
var PIXI = require('pixi');
var Particle = require('./Particle');
var dat = require('dat');
var ParticleSystem = require('./ParticleSystem');
var drawStyles = require('./DrawStyles');
var updateFunctions = require('./PositionFunctions');
var curries = require('./Curries');
var SETTINGS = require('./SETTINGS');
var stage;
var particleSystem;
var renderer;
var gui;
var graphics;
var spriteBatch;

//Controllers
var numberOfParticlesController;

domready(function () {

    //TODO move somewhere else
    gui = new dat.GUI();

    renderer = new PIXI.autoDetectRenderer(SETTINGS.WIDTH, SETTINGS.HEIGHT, null, false, true);
    renderer.clearBeforeRender = false;
    document.body.appendChild(renderer.view);
    requestAnimFrame(animate);

    stage = new PIXI.Stage(0x000000);

    spriteBatch = new PIXI.SpriteBatch();
    stage.addChild(spriteBatch);

    drawStyles.setCircleTexture(new PIXI.Texture.fromImage('img/FFFFFF.png'));
    drawStyles.init(spriteBatch, PIXI.Sprite);
    gui.add(drawStyles.settings, 'blendMode', PIXI.blendModes);
    gui.add(drawStyles.settings, 'rot');

    //initialize ParticleSystem
    particleSystem = new ParticleSystem();
    gui.remember(particleSystem);

    //gravityController = gui.add(text, 'Gravity', 0, 10);
    numberOfParticlesController = gui.add(particleSystem, 'size', 0, 100000);

    numberOfParticlesController.onFinishChange(function (value) {
        particleSystem.size = Math.floor(value);
    });

    particleSystem.addParticles(particleSystem.size, Particle);
    //todo move this setup somewhere else
    //curries.addToSet(updateFunctions.gravity);
    curries.addToSet(updateFunctions.walker);
    //curries.addToSet(updateFunctions.basic);

    function animate() {
        requestAnimFrame( animate );

        particleSystem
            .replenishParticles(Particle, spriteBatch)
            .update(curries.applicator)
            .draw(drawStyles.circle)
            .resetOrRemoveParticles(spriteBatch);

        renderer.render(stage);
    }
});

function initialize(number, spriteBatch) {
    particleSystem.addOrRemoveParticles(number, Particle, spriteBatch);
}