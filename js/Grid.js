/**
 * Created by arlando on 7/26/14.
 */
'use strict';

var Vector = require('./Vector');
var SETTINGS = require('./SETTINGS').GRID;

function Grid() {
    this.setup();
}

Grid.prototype = {
    setup: function(vector) {
        this._Vector = vector || Vector; //dependency injection
        this.nodes = {};
        this.initializeNodes();
        this.initializePositions();
    },

    getNodes: function() {
        return this.nodes;
    },

    getNumberofNodes: function() {
        return Object.keys(this.nodes).length;
    },

    addObjectToAGridNode: function(i, obj) {
        var node = this.nodes[i];
        node.object = obj;
        if (obj.setLocation) {
            obj.setLocation(node.location);
        }
    },

    getGridNode: function(i) {
        return this.nodes[i];
    },

    initializeNodes: function() {
        var numberOfNodes = 0;
        while (numberOfNodes < SETTINGS.MAX_NODES_X * SETTINGS.MAX_NODES_Y) {
            this.nodes[numberOfNodes] = {};
            numberOfNodes++;
        }
    },

    initializePositions: function () {
        var numberOfNodes = 0;
        var x = 0;
        for (x; x < SETTINGS.MAX_NODES_X; x++) {
            var y = 0;
            for (y; y < SETTINGS.MAX_NODES_Y; y++) {
                this.nodes[numberOfNodes].location = Object.freeze(new this._Vector(x * SETTINGS.STEP_X, y * SETTINGS.STEP_Y));
                numberOfNodes++;
            }
        }
    }
};

module.exports = Grid;