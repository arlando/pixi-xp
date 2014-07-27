'use strict';
var gulp = require('gulp');
var express = require('express');
var livereload = require('gulp-livereload');
var browserify = require('gulp-browserify');
var embedlr = require('gulp-embedlr');
var concat = require('gulp-concat-sourcemap');
var lrserver = livereload();
var debug = process.env.NODE_ENV || 'development';


var EXPRESS_PORT = 4000;
var EXPRESS_ROOT = __dirname;

/**
 * Embeds live reload snippets on html files in static
 */
function embedLrSnippet() {
    if (debug === 'development') {
        gulp.src('./static/html/*.html')
            .pipe(embedlr())
            .pipe(gulp.dest('./static/'));
    }
}

/**
 * Start the Express server.
 */
function startExpress() {
    var app = express();
    app.use(express.static(EXPRESS_ROOT + '/static'));
    app.use('/bower_components',  express.static(EXPRESS_ROOT + '/bower_components'));
    app.use('/', express.static(EXPRESS_ROOT + '/static/build/index.html'));
    app.listen(EXPRESS_PORT);
}

gulp.task('default', ['libs', 'scripts'], function() {
    embedLrSnippet();
    startExpress();
    gulp.watch('js/**', ['scripts']);
    gulp.watch('./static/build/**').on('change', function (file) {
        lrserver.changed(file.path);
    });

});

gulp.task('scripts', function() {
    gulp.src('./js/GridNodes/gridnodes.js')
        .pipe(browserify({
            insertGlobals: true,
            debug: (debug === 'development')
        }))
        .pipe(gulp.dest('./static/build/'));
});

/**
 * Build vendor libraries and generate source maps.
 * Allows browserify-shim to reference libs as in package.json.
 */
gulp.task('libs', function() {
    gulp.src([
            './bower_components/pixi/bin/pixi.js',
            './bower_components/async/lib/async.js',
            './bower_components/underscore/underscore.js'
        ])
        .pipe(concat('libs.js'))
        .pipe(gulp.dest('./static/build'));
});