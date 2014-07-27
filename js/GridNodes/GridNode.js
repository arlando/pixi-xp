/**
 * Created by arlando on 7/27/14.
 */
/**
 * Represent a node in a grid.
 */
var Vector = require('./Vector');

function GridNode() {};

GridNode.prototype = {
    setLocation: function (vector) {
        if (!vector instanceof Vector) throw new Error('Location must be an instance of a Vector.');
        this.location = vector;
    },

    getLocation: function () {
        return this.location;
    },

    setObject: function (obj) {
        this.obj = obj;
    },

    getObject: function () {
        return this.obj;
    }
};

module.exports = GridNode;

