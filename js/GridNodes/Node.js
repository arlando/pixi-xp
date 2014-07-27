/**
 * Created by arlando on 7/26/14.
 */
'use strict';
var Vector = require('./Vector');
var SETTINGS = require('./SETTINGS').NODE;

function Node() {
    this.setup();
}

Node.prototype = {
    setup: function () {
        this.connections = {};
        this.setId(0);
    },

    setId: function(id) {
        this.id = id;
    },

    getId: function() {
        return this.id;
    },

    getConnections: function() {
        return this.connections;
    },

    setLocation: function (vector) {
        if (vector instanceof Vector) {
            this.location = vector;
        } else {
            throw new Error('Do not know what to do with a non Vector instance.');
        }
    },

    getLocation: function() {
        return this.location;
    },

    addConnection: function (nodeToAdd) {
        var canAdd = false;
        //Do not add self
        if (this.getId() === nodeToAdd.getId()) {
            canAdd = false;
        }

        //Do not add nodes already have been added.
        if (this.connections[nodeToAdd.getId()] === undefined) {
            canAdd = true;
        }

        if (canAdd) {
            this.connections[nodeToAdd.getId()] = nodeToAdd;
        }
    },

    removeConnection: function (nodeToRemove) {
        if (this.connections[nodeToRemove.getId()] !== undefined) {
            delete this.connections[nodeToRemove.getId()];
        }
    },

    hasConnections: function () {
        return Object.keys(this.connections).length > 0;
    },

    draw: function (graphics) {
        var nodeLocation = this.getLocation();
        graphics.lineStyle(1, 0xFF00FF, 1);
        //console.log('x', nodeLocation.x, 'y', nodeLocation.y);
        graphics.drawCircle(nodeLocation.x, nodeLocation.y, SETTINGS.RADIUS);
    }
};

module.exports = Node;