/**
 * Created by arlando on 7/27/14.
 */
/**
 * Particle experiments
 */

'use strict';
var domready = require('domready');
var PIXI = require('pixi');
var Particle = require('./Particle');
var dat = require('dat');
var ParticleSystem = require('./ParticleSystem');
var drawStyles = require('./DrawStyles');
var updateFunctions = require('./UpdateFunctions');
var curries = require('./Curries');
var stage;
var particleSystem;
var renderer;
var gui;
var graphics;
var spriteBatch;
var particleTexture;

//Controllers
var gravityController;
var numberOfParticlesController;

domready(function () {

    //TODO move somewhere else
    gui = new dat.GUI();

    renderer = new PIXI.autoDetectRenderer(600, 600, null, false, true);
    document.body.appendChild(renderer.view);
    requestAnimFrame(animate);

    stage = new PIXI.Stage(0x000000);

    spriteBatch = new PIXI.SpriteBatch();
//    spriteBatch.pivot.x = -300;
//    spriteBatch.pivot.y = -300;
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
        initialize(value)
    });
    particleSystem.addParticles(particleSystem.size, Particle);
    curries.setF(updateFunctions.walker);

    function animate() {
        requestAnimFrame( animate );
        //graphics.clear();
        particleSystem
            .replenishParticles(Particle)
            .update(curries.applicator)
            .draw(drawStyles.circle)
            .removeDeadParticles(spriteBatch);
        spriteBatch.alpha = 50;
        renderer.render(stage);
    }
});

function initialize(number) {
    particleSystem.addParticles(number, Particle);
}
