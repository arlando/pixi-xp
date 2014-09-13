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
var THREE = require('three');
var Particle = require('./Particle');
var dat = require('dat');
var ParticleSystem = require('./ParticleSystem');
var drawStyles = require('./DrawStyles');
var updateFunctions = require('./PositionFunctions');
var boundingStrategies = require('./BoundingStrategies');
var curries = require('./Curries');
var SETTINGS = require('./SETTINGS');
var stage;
var particleSystem;
var gui;
var graphics;
var spriteBatch;

//Controllers
var numberOfParticlesController;

//Three variables
var scene;
var camera;
var renderer;
var material;
var pointCloud;

init();
animate();

function init() {

    // dom
    var container = document.getElementById( 'container' );

    // renderer
    renderer = new THREE.WebGLRenderer( {preserveDrawingBuffer: true, clearAlpha: 0x000000} );
    renderer.autoClearColor = false;
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );

    // scene
    scene = new THREE.Scene();

    //camera
    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 400;

    // point cloud geometry
    var geometry = new THREE.SphereGeometry( 100, 32, 16 );

    // vertex colors
    var colors = [];
    for( var i = 0; i < geometry.vertices.length; i++ ) {

        // random color
        colors[i] = new THREE.Color();
        colors[i].setHSL( Math.random(), 1.0, 0.5 );

    }
    geometry.colors = colors;

    // material
    material = new THREE.PointCloudMaterial( {
        size: 5,
        transparent: true,
        opacity: 0.5,
        preserveDrawingBuffer: true,
        vertexColors: THREE.VertexColors
    } );

    // point cloud
    pointCloud = new THREE.PointCloud( geometry, material );

    scene.add( pointCloud );

    var plane = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshBasicMaterial( { transparent: true, color: 0x000000, opacity: 0.5 } ) );
    plane.position.z = -10;
    scene.add( plane );

}

function animate() {

    requestAnimationFrame( animate );

    render();

}

function render() {

    // rotate
    pointCloud.rotation.x += 0.005;
    pointCloud.rotation.y += 0.005;

    // render
    renderer.render( scene, camera );

}

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
curries.addToSet(boundingStrategies.bounceOffWall);
//curries.addToSet(updateFunctions.gravity);
curries.addToSet(updateFunctions.basic);
// curries.addToSet(updateFunctions.walker);

function animate() {
    requestAnimFrame( animate );

    //TODO: Consider exposing particles so you can use Duff's Device
    particleSystem
        .replenishParticles(Particle, spriteBatch)
        .update(curries.applicator)
        .draw(drawStyles.circle)
        .resetOrRemoveParticles(spriteBatch);

    renderer.render(stage);
}

function initialize(number, spriteBatch) {
    particleSystem.addOrRemoveParticles(number, Particle, spriteBatch);
}

/**
 var renderer, scene, camera, pointCloud;

 init();
 animate();

 function init() {

    // dom
    var container = document.getElementById( 'container' );

    // renderer
    renderer = new THREE.WebGLRenderer( {preserveDrawingBuffer: true, clearAlpha: 0x000000} );
    renderer.autoClearColor = false;
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );




    // scene
    scene = new THREE.Scene();

    //camera
    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 400;

    // point cloud geometry
    var geometry = new THREE.SphereGeometry( 100, 32, 16 );

    // vertex colors
    var colors = [];
    for( var i = 0; i < geometry.vertices.length; i++ ) {

        // random color
        colors[i] = new THREE.Color();
        colors[i].setHSL( Math.random(), 1.0, 0.5 );

    }
    geometry.colors = colors;

    // material
    material = new THREE.PointCloudMaterial( {
        size: 5,
        transparent: true,
        opacity: 0.5,
        preserveDrawingBuffer: true,
        vertexColors: THREE.VertexColors
    } );

    // point cloud
    pointCloud = new THREE.PointCloud( geometry, material );

    scene.add( pointCloud );

    var plane = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshBasicMaterial( { transparent: true, color: 0x000000, opacity: 0.5 } ) );
plane.position.z = -10;
scene.add( plane );

}

 function animate() {

    requestAnimationFrame( animate );

    render();

}

 function render() {

    // rotate
    pointCloud.rotation.x += 0.005;
    pointCloud.rotation.y += 0.005;

    // render
    renderer.render( scene, camera );

}
**/