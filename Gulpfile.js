'use strict';
var gulp = require('gulp');
var express = require('express');
var livereload = require('gulp-livereload');
var browserify = require('gulp-browserify');
var lrserver;

var EXPRESS_PORT = 4000;
var EXPRESS_ROOT = __dirname;

function startExpress() {
    var app = express();
    app.use(express.static(EXPRESS_ROOT + '/static'));
    app.use('/bower_components',  express.static(EXPRESS_ROOT + '/bower_components'));
    app.listen(EXPRESS_PORT);
}

gulp.task('default', ['scripts'], function() {
    startExpress();
    lrserver = livereload();
    gulp.watch('js/**', ['scripts']);
    gulp.watch('js/**').on('change', function (file) {
        lrserver.changed(file.path);
    });
});

gulp.task('scripts', function() {
    gulp.src('./js/main.js')
        .pipe(browserify({
            insertGlobals: true,
            debug: !process.env.NODE_ENV
        }))
        .pipe(gulp.dest('./static/build/'));
});