/**
 * Created by arlando on 7/26/14.
 */
'use strict';
var Grid = require('./Grid');
var Node = require('./Node');
var AdjacencyList = require('./AdjacencyList');
var PIXI = require('pixi');
var stage = require('./stage');
var async = require('async');
var domready = require('domready');

domready(function () {

    // create a renderer instance
    var renderer = new PIXI.WebGLRenderer(600, 600, null, false, true);//autoDetectRenderer(400, 300);

    // add the renderer view element to the DOM
    document.body.appendChild(renderer.view);
    requestAnimFrame( animate );

    // draw a circle
    var graphics = new PIXI.Graphics();
    graphics.lineStyle(0);
    graphics.beginFill(0xFFFFFF, 0.5);

    var grid = new Grid();
    var adjacencyList = new AdjacencyList(graphics, grid);

    function makeNodes() {
        var arr = [];
        var i = 0;

        while (i < 9) {
            arr[i] = i;
            i++;
        }

        async.each(arr, function (index, callback) {
            var node = new Node();
            adjacencyList.addNode(index, node);
            callback();
        }, function (err) {
           if (err) throw err;
        });

    //    var n2 = new Node();
  //      adjacencyList.addNode(3, n2);
//
    //    var n3 = new Node();
   //     adjacencyList.addNode(3, n3);

      //  n1.addConnection(n2);
//        n3.addConnection(n1);

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