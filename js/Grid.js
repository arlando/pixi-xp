/**
 * Created by arlando on 7/26/14.
 */
'use strict';
var GridNode = require('./GridNode');
var Vector = require('./Vector');
var SETTINGS = require('./SETTINGS').GRID;
var async = require('../bower_components/async/lib/async');

function Grid() {
    this.setup();
}

Grid.prototype = {
    setup: function(vector, gridNode) {
        this._Vector = vector || Vector; //dependency injection
        this._GridNode = gridNode || GridNode; //dependency injection
        this.nodes = {};
        this.nodesArray = [];
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
        node.setObject(obj);

        if (obj.setLocation) {
            obj.setLocation(node.getLocation());
        }
    },

    getGridNode: function(i) {
        return this.nodes[i];
    },

    initializeNodes: function() {
        var numberOfNodes = 0;
        while (numberOfNodes < SETTINGS.MAX_NODES_X * SETTINGS.MAX_NODES_Y) {
            var gridNode = new this._GridNode();
            this.nodes[numberOfNodes] = gridNode;
            this.nodesArray.push(gridNode);
            numberOfNodes++;
        }
    },

    initializePositions: function () {
        var numberOfNodes = 0;
        var x = 0;
        for (x; x < SETTINGS.MAX_NODES_X; x++) {
            var y = 0;
            for (y; y < SETTINGS.MAX_NODES_Y; y++) {
                this.nodes[numberOfNodes].setLocation(Object.freeze(new this._Vector(x * SETTINGS.STEP_X, y * SETTINGS.STEP_Y)));
                numberOfNodes++;
            }
        }
    },

    draw: function (graphics) {
        if (graphics === void 0) throw new Error('Can not draw without graphics');
        var self = this;
        async.each(this.nodesArray, function (node, callback) {
            graphics.drawCircle(node.getLocation().x, node.getLocation().y, 1);
            callback(null);
        }, function (err) {
            if (err) throw err;
        });
    }
};

module.exports = Grid;