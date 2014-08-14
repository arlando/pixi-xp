/**
 * Created by arlando on 7/27/14.
 * Think about mutating this with noise functions that
 * augment the output of the function via noise values. Think
 * of a function that can be noisly manipulated in O(1) time.
 */
'use strict';
var _graphics;
var _stage;
var _sprite;
var _circleTexture;
var _circleSpriteFromImage;
var _sprite;
var rot = 0;

function Settings(){
    this.blendMode = PIXI.blendModes.ADD
    this.rot = 0;
};

var settings = new Settings();

module.exports.init = function(stage, sprite) {
    _stage = stage;
    _sprite = sprite;
};

module.exports.settings = settings;

module.exports.setCircleSpriteFromImage = function (sprite) {
    _circleSpriteFromImage = sprite;
}

module.exports.setCircleTexture = function (texture) {
    _circleTexture = texture;
};

module.exports.circle = function (texture) {

    //graphics = new _graphics();
    //graphics.beginFill(0xFFFFFF, .5);
    //graphics.drawCircle(this.px, this.py, this.radius);
    //graphics.endFill();
    //var circleSprite = new _spriteFromImage(_circleTexture);
    var circleSprite = new _sprite.fromImage('img/FFFFFF.png'); //consider reuse
    circleSprite.alpha = 1;
    circleSprite.height = Math.random() + .4;
    circleSprite.width = Math.random() + .8;
    settings.rot += .0001;
    circleSprite.rotation = settings.rot;
    circleSprite.blendMode = settings.blendMode;
    circleSprite.tint = 0xFF69B4;
    circleSprite.anchor.x = 0.5;
    circleSprite.anchor.y = 0.5;
    circleSprite.position.x = this.px;
    circleSprite.position.y = this.py;
    this.setSprite(circleSprite);
    _stage.addChild(circleSprite);
};

module.exports.concept = function () {
    var circleSprite = new _sprite.fromImage('img/FFFFFF.png');
    circleSprite.alpha = 1;
    circleSprite.height = 2;
    circleSprite.width = 2;
    this.setSprite(circleSprite);
    _stage.addChild(circleSprite);
};

module.exports.sprite = function () {

}