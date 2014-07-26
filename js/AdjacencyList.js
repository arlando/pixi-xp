/**
 * Created by arlando on 7/26/14.
 */
'use strict';

function AdjacencyList(graphics, grid) {
        if (graphics === void 0) throw new Error('Must have a graphics!');
        if (grid === void 0) throw new Error('Must have a grid!');
        this.setup(graphics, grid);
}

AdjacencyList.prototype = {
    setup: function (graphics, grid) {
        this.list = {};
        this.currNodeId = 0;
        this.grid = grid;
        this.graphics = graphics;
    },


    /**
     *
     * @param i - grid node
     * @param node
     */
    addNode: function (i, node) {
        node.setId(this.currNodeId);
        this.list[node.getId()] = node;
        this.grid.addObjectToAGridNode(i, node);
        this.currNodeId++;
    },

    addEdge: function (node1, node2) {
        node1.addConnection(node2);
        node2.addConnection(node1);
    },

    removeEdge: function (node1, node2) {
        node1.removeConnection(node2);
        node2.removeConnection(node1);
    },

    isEmpty: function () {
        return Object.keys(this.list).length === 0;
    },

    draw: function () {
        this.drawList = _.clone(this.list); //Do not want to mutate actual list.
        _.forEach(this.drawList, this.removeNodeFromOtherLists, this);
        _.forEach(this.drawList, this._drawEdge, this);
        _.forEach(this.drawList, this._drawNode, this);
    },

    removeNodeFromOtherLists: function (node) {
        _.each(node.getConnections(), function (connectedNode) {
            //remove the current node from the connect node's list of connections
            connectedNode.removeConnection(node);
        });
    },

    //TODO BETTER PRIVATE FUNCTIONS
    _drawNode: function (node) {
        if (this.graphics == void 0) {
            throw new Error("Cannot draw without graphics.");
        }
        node.draw(this.graphics);
    },

    //TODO BETTER PRIVATE FUNCTIONS
    _drawEdge: function (node) {
        _.each(node.getConnections(), function(connectedNode) {
            this.drawConnection(node, connectedNode);
        }, this);
    },

    /**
     * Draws a line connecting two nodes.
     * @param node1
     * @param node2
     */
    drawConnection: function(node1, node2) {
        // set a fill and line style again
        this.graphics.lineStyle(10, 0xFF0000, 0.8);
        this.graphics.beginFill(0xFF700B, 1);

        // draw a second shape
        this.graphics.moveTo(node1.getLocation().x, node1.getLocation().y);
        //this.graphics.lineTo(node1.getLocation().x, node1.getLocation().y);
        this.graphics.lineTo(node2.getLocation().x, node2.getLocation().y);
        this.graphics.endFill();
    },

    /**
     * Draws the underlying grid structure
     */
    drawGrid: function () {

    }

};

module.exports = AdjacencyList;