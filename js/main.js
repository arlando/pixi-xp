/**
 * Created by arlando on 7/26/14.
 */
'use strict';
var Grid = require('./Grid');
var Node = require('./Node');
var AdjacencyList = require('./AdjacencyList');
var PIXI = require('../bower_components/pixi/bin/pixi.js');
var domready = require('domready');

domready(function () {
    // create an new instance of a pixi stage
    var stage = new PIXI.Stage(0x66FF99);

    // create a renderer instance
    var renderer = new PIXI.WebGLRenderer(600, 600);//autoDetectRenderer(400, 300);

    // add the renderer view element to the DOM
    document.body.appendChild(renderer.view);
    requestAnimFrame( animate );

    //    // create a texture from an image path
    //    var texture = PIXI.Texture.fromImage("bunny.png");
    //    // create a new Sprite using the texture
    //    var bunny = new PIXI.Sprite(texture);
    //
    //    // center the sprites anchor point
    //    bunny.anchor.x = 0.5;
    //    bunny.anchor.y = 0.5;
    //
    //    // move the sprite t the center of the screen
    //    bunny.position.x = 200;
    //    bunny.position.y = 150;
    //
    //    stage.addChild(bunny);

    // draw a circle
    var graphics = new PIXI.Graphics();
    graphics.lineStyle(0);
    graphics.beginFill(0xFFFFFF, 0.5);

    var grid = new Grid();
    var adjacencyList = new AdjacencyList(graphics, grid);

    function makeNodes() {
        var n1 = new Node();
        adjacencyList.addNode(1, n1);

        var n2 = new Node();
        adjacencyList.addNode(2, n2);

        var n3 = new Node();
        adjacencyList.addNode(3, n3);

        n1.addConnection(n2);
        n2.addConnection(n3);

    }

    makeNodes();
    stage.addChild(graphics);


    function animate() {
        requestAnimFrame( animate );


        // just for fun, lets rotate mr rabbit a little
        //bunny.rotation += 0.1;


        // render the stage
        graphics.clear();
        adjacencyList.draw();
        renderer.render(stage);
    }
});