(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * async
 * https://github.com/caolan/async
 *
 * Copyright 2010-2014 Caolan McMahon
 * Released under the MIT license
 */
/*jshint onevar: false, indent:4 */
/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _toString = Object.prototype.toString;

    var _isArray = Array.isArray || function (obj) {
        return _toString.call(obj) === '[object Array]';
    };

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = function (fn) {
              // not a direct alias for IE10 compatibility
              setImmediate(fn);
            };
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(done) );
        });
        function done(err) {
          if (err) {
              callback(err);
              callback = function () {};
          }
          else {
              completed += 1;
              if (completed >= arr.length) {
                  callback();
              }
          }
        }
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback();
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        if (!callback) {
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err) {
                    callback(err);
                });
            });
        } else {
            var results = [];
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err, v) {
                    results[x.index] = v;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        var remainingTasks = keys.length
        if (!remainingTasks) {
            return callback();
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            remainingTasks--
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (!remainingTasks) {
                var theCallback = callback;
                // prevent final callback from calling itself if it errors
                callback = function () {};

                theCallback(null, results);
            }
        });

        _each(keys, function (k) {
            var task = _isArray(tasks[k]) ? tasks[k]: [tasks[k]];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.retry = function(times, task, callback) {
        var DEFAULT_TIMES = 5;
        var attempts = [];
        // Use defaults if times not passed
        if (typeof times === 'function') {
            callback = task;
            task = times;
            times = DEFAULT_TIMES;
        }
        // Make sure times is a number
        times = parseInt(times, 10) || DEFAULT_TIMES;
        var wrappedTask = function(wrappedCallback, wrappedResults) {
            var retryAttempt = function(task, finalAttempt) {
                return function(seriesCallback) {
                    task(function(err, result){
                        seriesCallback(!err || finalAttempt, {err: err, result: result});
                    }, wrappedResults);
                };
            };
            while (times) {
                attempts.push(retryAttempt(task, !(times-=1)));
            }
            async.series(attempts, function(done, data){
                data = data[data.length - 1];
                (wrappedCallback || callback)(data.err, data.result);
            });
        }
        // If a callback is passed, run this as a controll flow
        return callback ? wrappedTask() : wrappedTask
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (!_isArray(tasks)) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (test.apply(null, args)) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (!test.apply(null, args)) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            started: false,
            paused: false,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            kill: function () {
              q.drain = null;
              q.tasks = [];
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (!q.paused && workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            },
            idle: function() {
                return q.tasks.length + workers === 0;
            },
            pause: function () {
                if (q.paused === true) { return; }
                q.paused = true;
                q.process();
            },
            resume: function () {
                if (q.paused === false) { return; }
                q.paused = false;
                q.process();
            }
        };
        return q;
    };
    
    async.priorityQueue = function (worker, concurrency) {
        
        function _compareTasks(a, b){
          return a.priority - b.priority;
        };
        
        function _binarySearch(sequence, item, compare) {
          var beg = -1,
              end = sequence.length - 1;
          while (beg < end) {
            var mid = beg + ((end - beg + 1) >>> 1);
            if (compare(item, sequence[mid]) >= 0) {
              beg = mid;
            } else {
              end = mid - 1;
            }
          }
          return beg;
        }
        
        function _insert(q, data, priority, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  priority: priority,
                  callback: typeof callback === 'function' ? callback : null
              };
              
              q.tasks.splice(_binarySearch(q.tasks, item, _compareTasks) + 1, 0, item);

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }
        
        // Start with a normal queue
        var q = async.queue(worker, concurrency);
        
        // Override push to accept second parameter representing priority
        q.push = function (data, priority, callback) {
          _insert(q, data, priority, callback);
        };
        
        // Remove unshift function
        delete q.unshift;

        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            drained: true,
            push: function (data, callback) {
                if (!_isArray(data)) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    cargo.drained = false;
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain && !cargo.drained) cargo.drain();
                    cargo.drained = true;
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0, tasks.length);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                async.nextTick(function () {
                    callback.apply(null, memo[key]);
                });
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.seq = function (/* functions... */) {
        var fns = arguments;
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    async.compose = function (/* functions... */) {
      return async.seq.apply(null, Array.prototype.reverse.call(arguments));
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // AMD / RequireJS
    else if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../bower_components/async/lib/async.js","/../bower_components/async/lib")
},{"1YiZ5S":14,"buffer":11}],2:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/**
 * @license
 * pixi.js - v1.6.0
 * Copyright (c) 2012-2014, Mat Groves
 * http://goodboydigital.com/
 *
 * Compiled: 2014-07-18
 *
 * pixi.js is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license.php
 */
(function(){var a=this,b=b||{};b.WEBGL_RENDERER=0,b.CANVAS_RENDERER=1,b.VERSION="v1.6.1",b.blendModes={NORMAL:0,ADD:1,MULTIPLY:2,SCREEN:3,OVERLAY:4,DARKEN:5,LIGHTEN:6,COLOR_DODGE:7,COLOR_BURN:8,HARD_LIGHT:9,SOFT_LIGHT:10,DIFFERENCE:11,EXCLUSION:12,HUE:13,SATURATION:14,COLOR:15,LUMINOSITY:16},b.scaleModes={DEFAULT:0,LINEAR:0,NEAREST:1},b._UID=0,"undefined"!=typeof Float32Array?(b.Float32Array=Float32Array,b.Uint16Array=Uint16Array):(b.Float32Array=Array,b.Uint16Array=Array),b.INTERACTION_FREQUENCY=30,b.AUTO_PREVENT_DEFAULT=!0,b.RAD_TO_DEG=180/Math.PI,b.DEG_TO_RAD=Math.PI/180,b.dontSayHello=!1,b.sayHello=function(a){if(!b.dontSayHello){if(navigator.userAgent.toLowerCase().indexOf("chrome")>-1){var c=["%c %c %c Pixi.js "+b.VERSION+" - "+a+"  %c  %c  http://www.pixijs.com/  %c %c ♥%c♥%c♥ ","background: #ff66a5","background: #ff66a5","color: #ff66a5; background: #030307;","background: #ff66a5","background: #ffc3dc","background: #ff66a5","color: #ff2424; background: #fff","color: #ff2424; background: #fff","color: #ff2424; background: #fff"];console.log.apply(console,c)}else window.console&&console.log("Pixi.js "+b.VERSION+" - http://www.pixijs.com/");b.dontSayHello=!0}},b.Point=function(a,b){this.x=a||0,this.y=b||0},b.Point.prototype.clone=function(){return new b.Point(this.x,this.y)},b.Point.prototype.set=function(a,b){this.x=a||0,this.y=b||(0!==b?this.x:0)},b.Point.prototype.constructor=b.Point,b.Rectangle=function(a,b,c,d){this.x=a||0,this.y=b||0,this.width=c||0,this.height=d||0},b.Rectangle.prototype.clone=function(){return new b.Rectangle(this.x,this.y,this.width,this.height)},b.Rectangle.prototype.contains=function(a,b){if(this.width<=0||this.height<=0)return!1;var c=this.x;if(a>=c&&a<=c+this.width){var d=this.y;if(b>=d&&b<=d+this.height)return!0}return!1},b.Rectangle.prototype.constructor=b.Rectangle,b.EmptyRectangle=new b.Rectangle(0,0,0,0),b.Polygon=function(a){if(a instanceof Array||(a=Array.prototype.slice.call(arguments)),"number"==typeof a[0]){for(var c=[],d=0,e=a.length;e>d;d+=2)c.push(new b.Point(a[d],a[d+1]));a=c}this.points=a},b.Polygon.prototype.clone=function(){for(var a=[],c=0;c<this.points.length;c++)a.push(this.points[c].clone());return new b.Polygon(a)},b.Polygon.prototype.contains=function(a,b){for(var c=!1,d=0,e=this.points.length-1;d<this.points.length;e=d++){var f=this.points[d].x,g=this.points[d].y,h=this.points[e].x,i=this.points[e].y,j=g>b!=i>b&&(h-f)*(b-g)/(i-g)+f>a;j&&(c=!c)}return c},b.Polygon.prototype.constructor=b.Polygon,b.Circle=function(a,b,c){this.x=a||0,this.y=b||0,this.radius=c||0},b.Circle.prototype.clone=function(){return new b.Circle(this.x,this.y,this.radius)},b.Circle.prototype.contains=function(a,b){if(this.radius<=0)return!1;var c=this.x-a,d=this.y-b,e=this.radius*this.radius;return c*=c,d*=d,e>=c+d},b.Circle.prototype.getBounds=function(){return new b.Rectangle(this.x-this.radius,this.y-this.radius,this.width,this.height)},b.Circle.prototype.constructor=b.Circle,b.Ellipse=function(a,b,c,d){this.x=a||0,this.y=b||0,this.width=c||0,this.height=d||0},b.Ellipse.prototype.clone=function(){return new b.Ellipse(this.x,this.y,this.width,this.height)},b.Ellipse.prototype.contains=function(a,b){if(this.width<=0||this.height<=0)return!1;var c=(a-this.x)/this.width,d=(b-this.y)/this.height;return c*=c,d*=d,1>=c+d},b.Ellipse.prototype.getBounds=function(){return new b.Rectangle(this.x-this.width,this.y-this.height,this.width,this.height)},b.Ellipse.prototype.constructor=b.Ellipse,b.Matrix=function(){this.a=1,this.b=0,this.c=0,this.d=1,this.tx=0,this.ty=0},b.Matrix.prototype.fromArray=function(a){this.a=a[0],this.b=a[1],this.c=a[3],this.d=a[4],this.tx=a[2],this.ty=a[5]},b.Matrix.prototype.toArray=function(a){this.array||(this.array=new Float32Array(9));var b=this.array;return a?(b[0]=this.a,b[1]=this.c,b[2]=0,b[3]=this.b,b[4]=this.d,b[5]=0,b[6]=this.tx,b[7]=this.ty,b[8]=1):(b[0]=this.a,b[1]=this.b,b[2]=this.tx,b[3]=this.c,b[4]=this.d,b[5]=this.ty,b[6]=0,b[7]=0,b[8]=1),b},b.identityMatrix=new b.Matrix,b.determineMatrixArrayType=function(){return"undefined"!=typeof Float32Array?Float32Array:Array},b.Matrix2=b.determineMatrixArrayType(),b.DisplayObject=function(){this.position=new b.Point,this.scale=new b.Point(1,1),this.pivot=new b.Point(0,0),this.rotation=0,this.alpha=1,this.visible=!0,this.hitArea=null,this.buttonMode=!1,this.renderable=!1,this.parent=null,this.stage=null,this.worldAlpha=1,this._interactive=!1,this.defaultCursor="pointer",this.worldTransform=new b.Matrix,this.color=[],this.dynamic=!0,this._sr=0,this._cr=1,this.filterArea=null,this._bounds=new b.Rectangle(0,0,1,1),this._currentBounds=null,this._mask=null,this._cacheAsBitmap=!1,this._cacheIsDirty=!1},b.DisplayObject.prototype.constructor=b.DisplayObject,b.DisplayObject.prototype.setInteractive=function(a){this.interactive=a},Object.defineProperty(b.DisplayObject.prototype,"interactive",{get:function(){return this._interactive},set:function(a){this._interactive=a,this.stage&&(this.stage.dirty=!0)}}),Object.defineProperty(b.DisplayObject.prototype,"worldVisible",{get:function(){var a=this;do{if(!a.visible)return!1;a=a.parent}while(a);return!0}}),Object.defineProperty(b.DisplayObject.prototype,"mask",{get:function(){return this._mask},set:function(a){this._mask&&(this._mask.isMask=!1),this._mask=a,this._mask&&(this._mask.isMask=!0)}}),Object.defineProperty(b.DisplayObject.prototype,"filters",{get:function(){return this._filters},set:function(a){if(a){for(var b=[],c=0;c<a.length;c++)for(var d=a[c].passes,e=0;e<d.length;e++)b.push(d[e]);this._filterBlock={target:this,filterPasses:b}}this._filters=a}}),Object.defineProperty(b.DisplayObject.prototype,"cacheAsBitmap",{get:function(){return this._cacheAsBitmap},set:function(a){this._cacheAsBitmap!==a&&(a?this._generateCachedSprite():this._destroyCachedSprite(),this._cacheAsBitmap=a)}}),b.DisplayObject.prototype.updateTransform=function(){this.rotation!==this.rotationCache&&(this.rotationCache=this.rotation,this._sr=Math.sin(this.rotation),this._cr=Math.cos(this.rotation));var a=this.parent.worldTransform,b=this.worldTransform,c=this.pivot.x,d=this.pivot.y,e=this._cr*this.scale.x,f=-this._sr*this.scale.y,g=this._sr*this.scale.x,h=this._cr*this.scale.y,i=this.position.x-e*c-d*f,j=this.position.y-h*d-c*g,k=a.a,l=a.b,m=a.c,n=a.d;b.a=k*e+l*g,b.b=k*f+l*h,b.tx=k*i+l*j+a.tx,b.c=m*e+n*g,b.d=m*f+n*h,b.ty=m*i+n*j+a.ty,this.worldAlpha=this.alpha*this.parent.worldAlpha},b.DisplayObject.prototype.getBounds=function(a){return a=a,b.EmptyRectangle},b.DisplayObject.prototype.getLocalBounds=function(){return this.getBounds(b.identityMatrix)},b.DisplayObject.prototype.setStageReference=function(a){this.stage=a,this._interactive&&(this.stage.dirty=!0)},b.DisplayObject.prototype.generateTexture=function(a){var c=this.getLocalBounds(),d=new b.RenderTexture(0|c.width,0|c.height,a);return d.render(this,new b.Point(-c.x,-c.y)),d},b.DisplayObject.prototype.updateCache=function(){this._generateCachedSprite()},b.DisplayObject.prototype._renderCachedSprite=function(a){this._cachedSprite.worldAlpha=this.worldAlpha,a.gl?b.Sprite.prototype._renderWebGL.call(this._cachedSprite,a):b.Sprite.prototype._renderCanvas.call(this._cachedSprite,a)},b.DisplayObject.prototype._generateCachedSprite=function(){this._cacheAsBitmap=!1;var a=this.getLocalBounds();if(this._cachedSprite)this._cachedSprite.texture.resize(0|a.width,0|a.height);else{var c=new b.RenderTexture(0|a.width,0|a.height);this._cachedSprite=new b.Sprite(c),this._cachedSprite.worldTransform=this.worldTransform}var d=this._filters;this._filters=null,this._cachedSprite.filters=d,this._cachedSprite.texture.render(this,new b.Point(-a.x,-a.y)),this._cachedSprite.anchor.x=-(a.x/a.width),this._cachedSprite.anchor.y=-(a.y/a.height),this._filters=d,this._cacheAsBitmap=!0},b.DisplayObject.prototype._destroyCachedSprite=function(){this._cachedSprite&&(this._cachedSprite.texture.destroy(!0),this._cachedSprite=null)},b.DisplayObject.prototype._renderWebGL=function(a){a=a},b.DisplayObject.prototype._renderCanvas=function(a){a=a},Object.defineProperty(b.DisplayObject.prototype,"x",{get:function(){return this.position.x},set:function(a){this.position.x=a}}),Object.defineProperty(b.DisplayObject.prototype,"y",{get:function(){return this.position.y},set:function(a){this.position.y=a}}),b.DisplayObjectContainer=function(){b.DisplayObject.call(this),this.children=[]},b.DisplayObjectContainer.prototype=Object.create(b.DisplayObject.prototype),b.DisplayObjectContainer.prototype.constructor=b.DisplayObjectContainer,Object.defineProperty(b.DisplayObjectContainer.prototype,"width",{get:function(){return this.scale.x*this.getLocalBounds().width},set:function(a){var b=this.getLocalBounds().width;this.scale.x=0!==b?a/(b/this.scale.x):1,this._width=a}}),Object.defineProperty(b.DisplayObjectContainer.prototype,"height",{get:function(){return this.scale.y*this.getLocalBounds().height},set:function(a){var b=this.getLocalBounds().height;this.scale.y=0!==b?a/(b/this.scale.y):1,this._height=a}}),b.DisplayObjectContainer.prototype.addChild=function(a){return this.addChildAt(a,this.children.length)},b.DisplayObjectContainer.prototype.addChildAt=function(a,b){if(b>=0&&b<=this.children.length)return a.parent&&a.parent.removeChild(a),a.parent=this,this.children.splice(b,0,a),this.stage&&a.setStageReference(this.stage),a;throw new Error(a+" The index "+b+" supplied is out of bounds "+this.children.length)},b.DisplayObjectContainer.prototype.swapChildren=function(a,b){if(a!==b){var c=this.children.indexOf(a),d=this.children.indexOf(b);if(0>c||0>d)throw new Error("swapChildren: Both the supplied DisplayObjects must be a child of the caller.");this.children[c]=b,this.children[d]=a}},b.DisplayObjectContainer.prototype.getChildAt=function(a){if(a>=0&&a<this.children.length)return this.children[a];throw new Error("Supplied index does not exist in the child list, or the supplied DisplayObject must be a child of the caller")},b.DisplayObjectContainer.prototype.removeChild=function(a){return this.removeChildAt(this.children.indexOf(a))},b.DisplayObjectContainer.prototype.removeChildAt=function(a){var b=this.getChildAt(a);return this.stage&&b.removeStageReference(),b.parent=void 0,this.children.splice(a,1),b},b.DisplayObjectContainer.prototype.removeChildren=function(a,b){var c=a||0,d="number"==typeof b?b:this.children.length,e=d-c;if(e>0&&d>=e){for(var f=this.children.splice(c,e),g=0;g<f.length;g++){var h=f[g];this.stage&&h.removeStageReference(),h.parent=void 0}return f}throw new Error("Range Error, numeric values are outside the acceptable range")},b.DisplayObjectContainer.prototype.updateTransform=function(){if(this.visible&&(b.DisplayObject.prototype.updateTransform.call(this),!this._cacheAsBitmap))for(var a=0,c=this.children.length;c>a;a++)this.children[a].updateTransform()},b.DisplayObjectContainer.prototype.getBounds=function(a){if(0===this.children.length)return b.EmptyRectangle;if(a){var c=this.worldTransform;this.worldTransform=a,this.updateTransform(),this.worldTransform=c}for(var d,e,f,g=1/0,h=1/0,i=-1/0,j=-1/0,k=!1,l=0,m=this.children.length;m>l;l++){var n=this.children[l];n.visible&&(k=!0,d=this.children[l].getBounds(a),g=g<d.x?g:d.x,h=h<d.y?h:d.y,e=d.width+d.x,f=d.height+d.y,i=i>e?i:e,j=j>f?j:f)}if(!k)return b.EmptyRectangle;var o=this._bounds;return o.x=g,o.y=h,o.width=i-g,o.height=j-h,o},b.DisplayObjectContainer.prototype.getLocalBounds=function(){var a=this.worldTransform;this.worldTransform=b.identityMatrix;for(var c=0,d=this.children.length;d>c;c++)this.children[c].updateTransform();var e=this.getBounds();return this.worldTransform=a,e},b.DisplayObjectContainer.prototype.setStageReference=function(a){this.stage=a,this._interactive&&(this.stage.dirty=!0);for(var b=0,c=this.children.length;c>b;b++){var d=this.children[b];d.setStageReference(a)}},b.DisplayObjectContainer.prototype.removeStageReference=function(){for(var a=0,b=this.children.length;b>a;a++){var c=this.children[a];c.removeStageReference()}this._interactive&&(this.stage.dirty=!0),this.stage=null},b.DisplayObjectContainer.prototype._renderWebGL=function(a){if(this.visible&&!(this.alpha<=0)){if(this._cacheAsBitmap)return this._renderCachedSprite(a),void 0;var b,c;if(this._mask||this._filters){for(this._filters&&(a.spriteBatch.flush(),a.filterManager.pushFilter(this._filterBlock)),this._mask&&(a.spriteBatch.stop(),a.maskManager.pushMask(this.mask,a),a.spriteBatch.start()),b=0,c=this.children.length;c>b;b++)this.children[b]._renderWebGL(a);a.spriteBatch.stop(),this._mask&&a.maskManager.popMask(this._mask,a),this._filters&&a.filterManager.popFilter(),a.spriteBatch.start()}else for(b=0,c=this.children.length;c>b;b++)this.children[b]._renderWebGL(a)}},b.DisplayObjectContainer.prototype._renderCanvas=function(a){if(this.visible!==!1&&0!==this.alpha){if(this._cacheAsBitmap)return this._renderCachedSprite(a),void 0;this._mask&&a.maskManager.pushMask(this._mask,a.context);for(var b=0,c=this.children.length;c>b;b++){var d=this.children[b];d._renderCanvas(a)}this._mask&&a.maskManager.popMask(a.context)}},b.Sprite=function(a){b.DisplayObjectContainer.call(this),this.anchor=new b.Point,this.texture=a,this._width=0,this._height=0,this.tint=16777215,this.blendMode=b.blendModes.NORMAL,a.baseTexture.hasLoaded?this.onTextureUpdate():(this.onTextureUpdateBind=this.onTextureUpdate.bind(this),this.texture.addEventListener("update",this.onTextureUpdateBind)),this.renderable=!0},b.Sprite.prototype=Object.create(b.DisplayObjectContainer.prototype),b.Sprite.prototype.constructor=b.Sprite,Object.defineProperty(b.Sprite.prototype,"width",{get:function(){return this.scale.x*this.texture.frame.width},set:function(a){this.scale.x=a/this.texture.frame.width,this._width=a}}),Object.defineProperty(b.Sprite.prototype,"height",{get:function(){return this.scale.y*this.texture.frame.height},set:function(a){this.scale.y=a/this.texture.frame.height,this._height=a}}),b.Sprite.prototype.setTexture=function(a){this.texture=a,this.cachedTint=16777215},b.Sprite.prototype.onTextureUpdate=function(){this._width&&(this.scale.x=this._width/this.texture.frame.width),this._height&&(this.scale.y=this._height/this.texture.frame.height)},b.Sprite.prototype.getBounds=function(a){var b=this.texture.frame.width,c=this.texture.frame.height,d=b*(1-this.anchor.x),e=b*-this.anchor.x,f=c*(1-this.anchor.y),g=c*-this.anchor.y,h=a||this.worldTransform,i=h.a,j=h.c,k=h.b,l=h.d,m=h.tx,n=h.ty,o=i*e+k*g+m,p=l*g+j*e+n,q=i*d+k*g+m,r=l*g+j*d+n,s=i*d+k*f+m,t=l*f+j*d+n,u=i*e+k*f+m,v=l*f+j*e+n,w=-1/0,x=-1/0,y=1/0,z=1/0;y=y>o?o:y,y=y>q?q:y,y=y>s?s:y,y=y>u?u:y,z=z>p?p:z,z=z>r?r:z,z=z>t?t:z,z=z>v?v:z,w=o>w?o:w,w=q>w?q:w,w=s>w?s:w,w=u>w?u:w,x=p>x?p:x,x=r>x?r:x,x=t>x?t:x,x=v>x?v:x;var A=this._bounds;return A.x=y,A.width=w-y,A.y=z,A.height=x-z,this._currentBounds=A,A},b.Sprite.prototype._renderWebGL=function(a){if(this.visible&&!(this.alpha<=0)){var b,c;if(this._mask||this._filters){var d=a.spriteBatch;for(this._filters&&(d.flush(),a.filterManager.pushFilter(this._filterBlock)),this._mask&&(d.stop(),a.maskManager.pushMask(this.mask,a),d.start()),d.render(this),b=0,c=this.children.length;c>b;b++)this.children[b]._renderWebGL(a);d.stop(),this._mask&&a.maskManager.popMask(this._mask,a),this._filters&&a.filterManager.popFilter(),d.start()}else for(a.spriteBatch.render(this),b=0,c=this.children.length;c>b;b++)this.children[b]._renderWebGL(a)}},b.Sprite.prototype._renderCanvas=function(a){if(this.visible!==!1&&0!==this.alpha){if(this.blendMode!==a.currentBlendMode&&(a.currentBlendMode=this.blendMode,a.context.globalCompositeOperation=b.blendModesCanvas[a.currentBlendMode]),this._mask&&a.maskManager.pushMask(this._mask,a.context),this.texture.valid){a.context.globalAlpha=this.worldAlpha,a.roundPixels?a.context.setTransform(this.worldTransform.a,this.worldTransform.c,this.worldTransform.b,this.worldTransform.d,0|this.worldTransform.tx,0|this.worldTransform.ty):a.context.setTransform(this.worldTransform.a,this.worldTransform.c,this.worldTransform.b,this.worldTransform.d,this.worldTransform.tx,this.worldTransform.ty),a.smoothProperty&&a.scaleMode!==this.texture.baseTexture.scaleMode&&(a.scaleMode=this.texture.baseTexture.scaleMode,a.context[a.smoothProperty]=a.scaleMode===b.scaleModes.LINEAR);var c=this.texture.trim?this.texture.trim.x-this.anchor.x*this.texture.trim.width:this.anchor.x*-this.texture.frame.width,d=this.texture.trim?this.texture.trim.y-this.anchor.y*this.texture.trim.height:this.anchor.y*-this.texture.frame.height;16777215!==this.tint?(this.cachedTint!==this.tint&&(this.cachedTint=this.tint,this.tintedTexture=b.CanvasTinter.getTintedTexture(this,this.tint)),a.context.drawImage(this.tintedTexture,0,0,this.texture.crop.width,this.texture.crop.height,c,d,this.texture.crop.width,this.texture.crop.height)):a.context.drawImage(this.texture.baseTexture.source,this.texture.crop.x,this.texture.crop.y,this.texture.crop.width,this.texture.crop.height,c,d,this.texture.crop.width,this.texture.crop.height)}for(var e=0,f=this.children.length;f>e;e++)this.children[e]._renderCanvas(a);this._mask&&a.maskManager.popMask(a.context)}},b.Sprite.fromFrame=function(a){var c=b.TextureCache[a];if(!c)throw new Error('The frameId "'+a+'" does not exist in the texture cache'+this);return new b.Sprite(c)},b.Sprite.fromImage=function(a,c,d){var e=b.Texture.fromImage(a,c,d);return new b.Sprite(e)},b.SpriteBatch=function(a){b.DisplayObjectContainer.call(this),this.textureThing=a,this.ready=!1},b.SpriteBatch.prototype=Object.create(b.DisplayObjectContainer.prototype),b.SpriteBatch.constructor=b.SpriteBatch,b.SpriteBatch.prototype.initWebGL=function(a){this.fastSpriteBatch=new b.WebGLFastSpriteBatch(a),this.ready=!0},b.SpriteBatch.prototype.updateTransform=function(){b.DisplayObject.prototype.updateTransform.call(this)},b.SpriteBatch.prototype._renderWebGL=function(a){!this.visible||this.alpha<=0||!this.children.length||(this.ready||this.initWebGL(a.gl),a.spriteBatch.stop(),a.shaderManager.setShader(a.shaderManager.fastShader),this.fastSpriteBatch.begin(this,a),this.fastSpriteBatch.render(this),a.spriteBatch.start())},b.SpriteBatch.prototype._renderCanvas=function(a){var c=a.context;c.globalAlpha=this.worldAlpha,b.DisplayObject.prototype.updateTransform.call(this);for(var d=this.worldTransform,e=!0,f=0;f<this.children.length;f++){var g=this.children[f];if(g.visible){var h=g.texture,i=h.frame;if(c.globalAlpha=this.worldAlpha*g.alpha,g.rotation%(2*Math.PI)===0)e&&(c.setTransform(d.a,d.c,d.b,d.d,d.tx,d.ty),e=!1),c.drawImage(h.baseTexture.source,i.x,i.y,i.width,i.height,g.anchor.x*-i.width*g.scale.x+g.position.x+.5|0,g.anchor.y*-i.height*g.scale.y+g.position.y+.5|0,i.width*g.scale.x,i.height*g.scale.y);else{e||(e=!0),b.DisplayObject.prototype.updateTransform.call(g);var j=g.worldTransform;a.roundPixels?c.setTransform(j.a,j.c,j.b,j.d,0|j.tx,0|j.ty):c.setTransform(j.a,j.c,j.b,j.d,j.tx,j.ty),c.drawImage(h.baseTexture.source,i.x,i.y,i.width,i.height,g.anchor.x*-i.width+.5|0,g.anchor.y*-i.height+.5|0,i.width,i.height)}}}},b.MovieClip=function(a){b.Sprite.call(this,a[0]),this.textures=a,this.animationSpeed=1,this.loop=!0,this.onComplete=null,this.currentFrame=0,this.playing=!1},b.MovieClip.prototype=Object.create(b.Sprite.prototype),b.MovieClip.prototype.constructor=b.MovieClip,Object.defineProperty(b.MovieClip.prototype,"totalFrames",{get:function(){return this.textures.length}}),b.MovieClip.prototype.stop=function(){this.playing=!1},b.MovieClip.prototype.play=function(){this.playing=!0},b.MovieClip.prototype.gotoAndStop=function(a){this.playing=!1,this.currentFrame=a;var b=this.currentFrame+.5|0;this.setTexture(this.textures[b%this.textures.length])},b.MovieClip.prototype.gotoAndPlay=function(a){this.currentFrame=a,this.playing=!0},b.MovieClip.prototype.updateTransform=function(){if(b.Sprite.prototype.updateTransform.call(this),this.playing){this.currentFrame+=this.animationSpeed;var a=this.currentFrame+.5|0;this.currentFrame=this.currentFrame%this.textures.length,this.loop||a<this.textures.length?this.setTexture(this.textures[a%this.textures.length]):a>=this.textures.length&&(this.gotoAndStop(this.textures.length-1),this.onComplete&&this.onComplete())}},b.MovieClip.fromFrames=function(a){for(var c=[],d=0;d<a.length;d++)c.push(new b.Texture.fromFrame(a[d]));return new b.MovieClip(c)},b.MovieClip.fromImages=function(a){for(var c=[],d=0;d<a.length;d++)c.push(new b.Texture.fromImage(a[d]));return new b.MovieClip(c)},b.FilterBlock=function(){this.visible=!0,this.renderable=!0},b.Text=function(a,c){this.canvas=document.createElement("canvas"),this.context=this.canvas.getContext("2d"),b.Sprite.call(this,b.Texture.fromCanvas(this.canvas)),this.setText(a),this.setStyle(c)},b.Text.prototype=Object.create(b.Sprite.prototype),b.Text.prototype.constructor=b.Text,Object.defineProperty(b.Text.prototype,"width",{get:function(){return this.dirty&&(this.updateText(),this.dirty=!1),this.scale.x*this.texture.frame.width},set:function(a){this.scale.x=a/this.texture.frame.width,this._width=a}}),Object.defineProperty(b.Text.prototype,"height",{get:function(){return this.dirty&&(this.updateText(),this.dirty=!1),this.scale.y*this.texture.frame.height},set:function(a){this.scale.y=a/this.texture.frame.height,this._height=a}}),b.Text.prototype.setStyle=function(a){a=a||{},a.font=a.font||"bold 20pt Arial",a.fill=a.fill||"black",a.align=a.align||"left",a.stroke=a.stroke||"black",a.strokeThickness=a.strokeThickness||0,a.wordWrap=a.wordWrap||!1,a.wordWrapWidth=a.wordWrapWidth||100,a.wordWrapWidth=a.wordWrapWidth||100,a.dropShadow=a.dropShadow||!1,a.dropShadowAngle=a.dropShadowAngle||Math.PI/6,a.dropShadowDistance=a.dropShadowDistance||4,a.dropShadowColor=a.dropShadowColor||"black",this.style=a,this.dirty=!0},b.Text.prototype.setText=function(a){this.text=a.toString()||" ",this.dirty=!0},b.Text.prototype.updateText=function(){this.context.font=this.style.font;var a=this.text;this.style.wordWrap&&(a=this.wordWrap(this.text));for(var b=a.split(/(?:\r\n|\r|\n)/),c=[],d=0,e=0;e<b.length;e++){var f=this.context.measureText(b[e]).width;c[e]=f,d=Math.max(d,f)}var g=d+this.style.strokeThickness;this.style.dropShadow&&(g+=this.style.dropShadowDistance),this.canvas.width=g+this.context.lineWidth;var h=this.determineFontHeight("font: "+this.style.font+";")+this.style.strokeThickness,i=h*b.length;this.style.dropShadow&&(i+=this.style.dropShadowDistance),this.canvas.height=i,navigator.isCocoonJS&&this.context.clearRect(0,0,this.canvas.width,this.canvas.height),this.context.font=this.style.font,this.context.strokeStyle=this.style.stroke,this.context.lineWidth=this.style.strokeThickness,this.context.textBaseline="top";var j,k;if(this.style.dropShadow){this.context.fillStyle=this.style.dropShadowColor;var l=Math.sin(this.style.dropShadowAngle)*this.style.dropShadowDistance,m=Math.cos(this.style.dropShadowAngle)*this.style.dropShadowDistance;for(e=0;e<b.length;e++)j=this.style.strokeThickness/2,k=this.style.strokeThickness/2+e*h,"right"===this.style.align?j+=d-c[e]:"center"===this.style.align&&(j+=(d-c[e])/2),this.style.fill&&this.context.fillText(b[e],j+l,k+m)}for(this.context.fillStyle=this.style.fill,e=0;e<b.length;e++)j=this.style.strokeThickness/2,k=this.style.strokeThickness/2+e*h,"right"===this.style.align?j+=d-c[e]:"center"===this.style.align&&(j+=(d-c[e])/2),this.style.stroke&&this.style.strokeThickness&&this.context.strokeText(b[e],j,k),this.style.fill&&this.context.fillText(b[e],j,k);this.updateTexture()},b.Text.prototype.updateTexture=function(){this.texture.baseTexture.width=this.canvas.width,this.texture.baseTexture.height=this.canvas.height,this.texture.crop.width=this.texture.frame.width=this.canvas.width,this.texture.crop.height=this.texture.frame.height=this.canvas.height,this._width=this.canvas.width,this._height=this.canvas.height,this.requiresUpdate=!0},b.Text.prototype._renderWebGL=function(a){this.requiresUpdate&&(this.requiresUpdate=!1,b.updateWebGLTexture(this.texture.baseTexture,a.gl)),b.Sprite.prototype._renderWebGL.call(this,a)},b.Text.prototype.updateTransform=function(){this.dirty&&(this.updateText(),this.dirty=!1),b.Sprite.prototype.updateTransform.call(this)},b.Text.prototype.determineFontHeight=function(a){var c=b.Text.heightCache[a];if(!c){var d=document.getElementsByTagName("body")[0],e=document.createElement("div"),f=document.createTextNode("M");e.appendChild(f),e.setAttribute("style",a+";position:absolute;top:0;left:0"),d.appendChild(e),c=e.offsetHeight,b.Text.heightCache[a]=c,d.removeChild(e)}return c},b.Text.prototype.wordWrap=function(a){for(var b="",c=a.split("\n"),d=0;d<c.length;d++){for(var e=this.style.wordWrapWidth,f=c[d].split(" "),g=0;g<f.length;g++){var h=this.context.measureText(f[g]).width,i=h+this.context.measureText(" ").width;0===g||i>e?(g>0&&(b+="\n"),b+=f[g],e=this.style.wordWrapWidth-h):(e-=i,b+=" "+f[g])}d<c.length-1&&(b+="\n")}return b},b.Text.prototype.destroy=function(a){this.context=null,this.canvas=null,this.texture.destroy(void 0===a?!0:a)},b.Text.heightCache={},b.BitmapText=function(a,c){b.DisplayObjectContainer.call(this),this._pool=[],this.setText(a),this.setStyle(c),this.updateText(),this.dirty=!1},b.BitmapText.prototype=Object.create(b.DisplayObjectContainer.prototype),b.BitmapText.prototype.constructor=b.BitmapText,b.BitmapText.prototype.setText=function(a){this.text=a||" ",this.dirty=!0},b.BitmapText.prototype.setStyle=function(a){a=a||{},a.align=a.align||"left",this.style=a;var c=a.font.split(" ");this.fontName=c[c.length-1],this.fontSize=c.length>=2?parseInt(c[c.length-2],10):b.BitmapText.fonts[this.fontName].size,this.dirty=!0,this.tint=a.tint},b.BitmapText.prototype.updateText=function(){for(var a=b.BitmapText.fonts[this.fontName],c=new b.Point,d=null,e=[],f=0,g=[],h=0,i=this.fontSize/a.size,j=0;j<this.text.length;j++){var k=this.text.charCodeAt(j);if(/(?:\r\n|\r|\n)/.test(this.text.charAt(j)))g.push(c.x),f=Math.max(f,c.x),h++,c.x=0,c.y+=a.lineHeight,d=null;else{var l=a.chars[k];l&&(d&&l[d]&&(c.x+=l.kerning[d]),e.push({texture:l.texture,line:h,charCode:k,position:new b.Point(c.x+l.xOffset,c.y+l.yOffset)}),c.x+=l.xAdvance,d=k)}}g.push(c.x),f=Math.max(f,c.x);var m=[];for(j=0;h>=j;j++){var n=0;"right"===this.style.align?n=f-g[j]:"center"===this.style.align&&(n=(f-g[j])/2),m.push(n)}var o=this.children.length,p=e.length,q=this.tint||16777215;for(j=0;p>j;j++){var r=o>j?this.children[j]:this._pool.pop();r?r.setTexture(e[j].texture):r=new b.Sprite(e[j].texture),r.position.x=(e[j].position.x+m[e[j].line])*i,r.position.y=e[j].position.y*i,r.scale.x=r.scale.y=i,r.tint=q,r.parent||this.addChild(r)}for(;this.children.length>p;){var s=this.getChildAt(this.children.length-1);this._pool.push(s),this.removeChild(s)}this.textWidth=f*i,this.textHeight=(c.y+a.lineHeight)*i},b.BitmapText.prototype.updateTransform=function(){this.dirty&&(this.updateText(),this.dirty=!1),b.DisplayObjectContainer.prototype.updateTransform.call(this)},b.BitmapText.fonts={},b.InteractionData=function(){this.global=new b.Point,this.target=null,this.originalEvent=null},b.InteractionData.prototype.getLocalPosition=function(a){var c=a.worldTransform,d=this.global,e=c.a,f=c.b,g=c.tx,h=c.c,i=c.d,j=c.ty,k=1/(e*i+f*-h);return new b.Point(i*k*d.x+-f*k*d.y+(j*f-g*i)*k,e*k*d.y+-h*k*d.x+(-j*e+g*h)*k)},b.InteractionData.prototype.constructor=b.InteractionData,b.InteractionManager=function(a){this.stage=a,this.mouse=new b.InteractionData,this.touchs={},this.tempPoint=new b.Point,this.mouseoverEnabled=!0,this.pool=[],this.interactiveItems=[],this.interactionDOMElement=null,this.onMouseMove=this.onMouseMove.bind(this),this.onMouseDown=this.onMouseDown.bind(this),this.onMouseOut=this.onMouseOut.bind(this),this.onMouseUp=this.onMouseUp.bind(this),this.onTouchStart=this.onTouchStart.bind(this),this.onTouchEnd=this.onTouchEnd.bind(this),this.onTouchMove=this.onTouchMove.bind(this),this.last=0,this.currentCursorStyle="inherit",this.mouseOut=!1},b.InteractionManager.prototype.constructor=b.InteractionManager,b.InteractionManager.prototype.collectInteractiveSprite=function(a,b){for(var c=a.children,d=c.length,e=d-1;e>=0;e--){var f=c[e];f._interactive?(b.interactiveChildren=!0,this.interactiveItems.push(f),f.children.length>0&&this.collectInteractiveSprite(f,f)):(f.__iParent=null,f.children.length>0&&this.collectInteractiveSprite(f,b))}},b.InteractionManager.prototype.setTarget=function(a){this.target=a,null===this.interactionDOMElement&&this.setTargetDomElement(a.view)},b.InteractionManager.prototype.setTargetDomElement=function(a){this.removeEvents(),window.navigator.msPointerEnabled&&(a.style["-ms-content-zooming"]="none",a.style["-ms-touch-action"]="none"),this.interactionDOMElement=a,a.addEventListener("mousemove",this.onMouseMove,!0),a.addEventListener("mousedown",this.onMouseDown,!0),a.addEventListener("mouseout",this.onMouseOut,!0),a.addEventListener("touchstart",this.onTouchStart,!0),a.addEventListener("touchend",this.onTouchEnd,!0),a.addEventListener("touchmove",this.onTouchMove,!0),window.addEventListener("mouseup",this.onMouseUp,!0)},b.InteractionManager.prototype.removeEvents=function(){this.interactionDOMElement&&(this.interactionDOMElement.style["-ms-content-zooming"]="",this.interactionDOMElement.style["-ms-touch-action"]="",this.interactionDOMElement.removeEventListener("mousemove",this.onMouseMove,!0),this.interactionDOMElement.removeEventListener("mousedown",this.onMouseDown,!0),this.interactionDOMElement.removeEventListener("mouseout",this.onMouseOut,!0),this.interactionDOMElement.removeEventListener("touchstart",this.onTouchStart,!0),this.interactionDOMElement.removeEventListener("touchend",this.onTouchEnd,!0),this.interactionDOMElement.removeEventListener("touchmove",this.onTouchMove,!0),this.interactionDOMElement=null,window.removeEventListener("mouseup",this.onMouseUp,!0))},b.InteractionManager.prototype.update=function(){if(this.target){var a=Date.now(),c=a-this.last;if(c=c*b.INTERACTION_FREQUENCY/1e3,!(1>c)){this.last=a;var d=0;this.dirty&&this.rebuildInteractiveGraph();var e=this.interactiveItems.length,f="inherit",g=!1;for(d=0;e>d;d++){var h=this.interactiveItems[d];h.__hit=this.hitTest(h,this.mouse),this.mouse.target=h,h.__hit&&!g?(h.buttonMode&&(f=h.defaultCursor),h.interactiveChildren||(g=!0),h.__isOver||(h.mouseover&&h.mouseover(this.mouse),h.__isOver=!0)):h.__isOver&&(h.mouseout&&h.mouseout(this.mouse),h.__isOver=!1)}this.currentCursorStyle!==f&&(this.currentCursorStyle=f,this.interactionDOMElement.style.cursor=f)}}},b.InteractionManager.prototype.rebuildInteractiveGraph=function(){this.dirty=!1;for(var a=this.interactiveItems.length,b=0;a>b;b++)this.interactiveItems[b].interactiveChildren=!1;this.interactiveItems=[],this.stage.interactive&&this.interactiveItems.push(this.stage),this.collectInteractiveSprite(this.stage,this.stage)},b.InteractionManager.prototype.onMouseMove=function(a){this.dirty&&this.rebuildInteractiveGraph(),this.mouse.originalEvent=a||window.event;var b=this.interactionDOMElement.getBoundingClientRect();this.mouse.global.x=(a.clientX-b.left)*(this.target.width/b.width),this.mouse.global.y=(a.clientY-b.top)*(this.target.height/b.height);for(var c=this.interactiveItems.length,d=0;c>d;d++){var e=this.interactiveItems[d];e.mousemove&&e.mousemove(this.mouse)}},b.InteractionManager.prototype.onMouseDown=function(a){this.dirty&&this.rebuildInteractiveGraph(),this.mouse.originalEvent=a||window.event,b.AUTO_PREVENT_DEFAULT&&this.mouse.originalEvent.preventDefault();for(var c=this.interactiveItems.length,d=0;c>d;d++){var e=this.interactiveItems[d];if((e.mousedown||e.click)&&(e.__mouseIsDown=!0,e.__hit=this.hitTest(e,this.mouse),e.__hit&&(e.mousedown&&e.mousedown(this.mouse),e.__isDown=!0,!e.interactiveChildren)))break}},b.InteractionManager.prototype.onMouseOut=function(){this.dirty&&this.rebuildInteractiveGraph();var a=this.interactiveItems.length;this.interactionDOMElement.style.cursor="inherit";for(var b=0;a>b;b++){var c=this.interactiveItems[b];c.__isOver&&(this.mouse.target=c,c.mouseout&&c.mouseout(this.mouse),c.__isOver=!1)}this.mouseOut=!0,this.mouse.global.x=-1e4,this.mouse.global.y=-1e4},b.InteractionManager.prototype.onMouseUp=function(a){this.dirty&&this.rebuildInteractiveGraph(),this.mouse.originalEvent=a||window.event;
for(var b=this.interactiveItems.length,c=!1,d=0;b>d;d++){var e=this.interactiveItems[d];e.__hit=this.hitTest(e,this.mouse),e.__hit&&!c?(e.mouseup&&e.mouseup(this.mouse),e.__isDown&&e.click&&e.click(this.mouse),e.interactiveChildren||(c=!0)):e.__isDown&&e.mouseupoutside&&e.mouseupoutside(this.mouse),e.__isDown=!1}},b.InteractionManager.prototype.hitTest=function(a,c){var d=c.global;if(!a.worldVisible)return!1;var e=a instanceof b.Sprite,f=a.worldTransform,g=f.a,h=f.b,i=f.tx,j=f.c,k=f.d,l=f.ty,m=1/(g*k+h*-j),n=k*m*d.x+-h*m*d.y+(l*h-i*k)*m,o=g*m*d.y+-j*m*d.x+(-l*g+i*j)*m;if(c.target=a,a.hitArea&&a.hitArea.contains)return a.hitArea.contains(n,o)?(c.target=a,!0):!1;if(e){var p,q=a.texture.frame.width,r=a.texture.frame.height,s=-q*a.anchor.x;if(n>s&&s+q>n&&(p=-r*a.anchor.y,o>p&&p+r>o))return c.target=a,!0}for(var t=a.children.length,u=0;t>u;u++){var v=a.children[u],w=this.hitTest(v,c);if(w)return c.target=a,!0}return!1},b.InteractionManager.prototype.onTouchMove=function(a){this.dirty&&this.rebuildInteractiveGraph();var b,c=this.interactionDOMElement.getBoundingClientRect(),d=a.changedTouches,e=0;for(e=0;e<d.length;e++){var f=d[e];b=this.touchs[f.identifier],b.originalEvent=a||window.event,b.global.x=(f.clientX-c.left)*(this.target.width/c.width),b.global.y=(f.clientY-c.top)*(this.target.height/c.height),navigator.isCocoonJS&&(b.global.x=f.clientX,b.global.y=f.clientY);for(var g=0;g<this.interactiveItems.length;g++){var h=this.interactiveItems[g];h.touchmove&&h.__touchData&&h.__touchData[f.identifier]&&h.touchmove(b)}}},b.InteractionManager.prototype.onTouchStart=function(a){this.dirty&&this.rebuildInteractiveGraph();var c=this.interactionDOMElement.getBoundingClientRect();b.AUTO_PREVENT_DEFAULT&&a.preventDefault();for(var d=a.changedTouches,e=0;e<d.length;e++){var f=d[e],g=this.pool.pop();g||(g=new b.InteractionData),g.originalEvent=a||window.event,this.touchs[f.identifier]=g,g.global.x=(f.clientX-c.left)*(this.target.width/c.width),g.global.y=(f.clientY-c.top)*(this.target.height/c.height),navigator.isCocoonJS&&(g.global.x=f.clientX,g.global.y=f.clientY);for(var h=this.interactiveItems.length,i=0;h>i;i++){var j=this.interactiveItems[i];if((j.touchstart||j.tap)&&(j.__hit=this.hitTest(j,g),j.__hit&&(j.touchstart&&j.touchstart(g),j.__isDown=!0,j.__touchData=j.__touchData||{},j.__touchData[f.identifier]=g,!j.interactiveChildren)))break}}},b.InteractionManager.prototype.onTouchEnd=function(a){this.dirty&&this.rebuildInteractiveGraph();for(var b=this.interactionDOMElement.getBoundingClientRect(),c=a.changedTouches,d=0;d<c.length;d++){var e=c[d],f=this.touchs[e.identifier],g=!1;f.global.x=(e.clientX-b.left)*(this.target.width/b.width),f.global.y=(e.clientY-b.top)*(this.target.height/b.height),navigator.isCocoonJS&&(f.global.x=e.clientX,f.global.y=e.clientY);for(var h=this.interactiveItems.length,i=0;h>i;i++){var j=this.interactiveItems[i];j.__touchData&&j.__touchData[e.identifier]&&(j.__hit=this.hitTest(j,j.__touchData[e.identifier]),f.originalEvent=a||window.event,(j.touchend||j.tap)&&(j.__hit&&!g?(j.touchend&&j.touchend(f),j.__isDown&&j.tap&&j.tap(f),j.interactiveChildren||(g=!0)):j.__isDown&&j.touchendoutside&&j.touchendoutside(f),j.__isDown=!1),j.__touchData[e.identifier]=null)}this.pool.push(f),this.touchs[e.identifier]=null}},b.Stage=function(a){b.DisplayObjectContainer.call(this),this.worldTransform=new b.Matrix,this.interactive=!0,this.interactionManager=new b.InteractionManager(this),this.dirty=!0,this.stage=this,this.stage.hitArea=new b.Rectangle(0,0,1e5,1e5),this.setBackgroundColor(a)},b.Stage.prototype=Object.create(b.DisplayObjectContainer.prototype),b.Stage.prototype.constructor=b.Stage,b.Stage.prototype.setInteractionDelegate=function(a){this.interactionManager.setTargetDomElement(a)},b.Stage.prototype.updateTransform=function(){this.worldAlpha=1;for(var a=0,b=this.children.length;b>a;a++)this.children[a].updateTransform();this.dirty&&(this.dirty=!1,this.interactionManager.dirty=!0),this.interactive&&this.interactionManager.update()},b.Stage.prototype.setBackgroundColor=function(a){this.backgroundColor=a||0,this.backgroundColorSplit=b.hex2rgb(this.backgroundColor);var c=this.backgroundColor.toString(16);c="000000".substr(0,6-c.length)+c,this.backgroundColorString="#"+c},b.Stage.prototype.getMousePosition=function(){return this.interactionManager.mouse.global};for(var c=0,d=["ms","moz","webkit","o"],e=0;e<d.length&&!window.requestAnimationFrame;++e)window.requestAnimationFrame=window[d[e]+"RequestAnimationFrame"],window.cancelAnimationFrame=window[d[e]+"CancelAnimationFrame"]||window[d[e]+"CancelRequestAnimationFrame"];window.requestAnimationFrame||(window.requestAnimationFrame=function(a){var b=(new Date).getTime(),d=Math.max(0,16-(b-c)),e=window.setTimeout(function(){a(b+d)},d);return c=b+d,e}),window.cancelAnimationFrame||(window.cancelAnimationFrame=function(a){clearTimeout(a)}),window.requestAnimFrame=window.requestAnimationFrame,b.hex2rgb=function(a){return[(a>>16&255)/255,(a>>8&255)/255,(255&a)/255]},b.rgb2hex=function(a){return(255*a[0]<<16)+(255*a[1]<<8)+255*a[2]},"function"!=typeof Function.prototype.bind&&(Function.prototype.bind=function(){var a=Array.prototype.slice;return function(b){function c(){var f=e.concat(a.call(arguments));d.apply(this instanceof c?this:b,f)}var d=this,e=a.call(arguments,1);if("function"!=typeof d)throw new TypeError;return c.prototype=function f(a){return a&&(f.prototype=a),this instanceof f?void 0:new f}(d.prototype),c}}()),b.AjaxRequest=function(){var a=["Msxml2.XMLHTTP.6.0","Msxml2.XMLHTTP.3.0","Microsoft.XMLHTTP"];if(!window.ActiveXObject)return window.XMLHttpRequest?new window.XMLHttpRequest:!1;for(var b=0;b<a.length;b++)try{return new window.ActiveXObject(a[b])}catch(c){}},b.canUseNewCanvasBlendModes=function(){var a=document.createElement("canvas");a.width=1,a.height=1;var b=a.getContext("2d");return b.fillStyle="#000",b.fillRect(0,0,1,1),b.globalCompositeOperation="multiply",b.fillStyle="#fff",b.fillRect(0,0,1,1),0===b.getImageData(0,0,1,1).data[0]},b.getNextPowerOfTwo=function(a){if(a>0&&0===(a&a-1))return a;for(var b=1;a>b;)b<<=1;return b},b.EventTarget=function(){var a={};this.addEventListener=this.on=function(b,c){void 0===a[b]&&(a[b]=[]),-1===a[b].indexOf(c)&&a[b].unshift(c)},this.dispatchEvent=this.emit=function(b){if(a[b.type]&&a[b.type].length)for(var c=a[b.type].length-1;c>=0;c--)a[b.type][c](b)},this.removeEventListener=this.off=function(b,c){if(void 0!==a[b]){var d=a[b].indexOf(c);-1!==d&&a[b].splice(d,1)}},this.removeAllEventListeners=function(b){var c=a[b];c&&(c.length=0)}},b.autoDetectRenderer=function(a,c,d,e,f){a||(a=800),c||(c=600);var g=function(){try{var a=document.createElement("canvas");return!!window.WebGLRenderingContext&&(a.getContext("webgl")||a.getContext("experimental-webgl"))}catch(b){return!1}}();return g?new b.WebGLRenderer(a,c,d,e,f):new b.CanvasRenderer(a,c,d,e)},b.autoDetectRecommendedRenderer=function(a,c,d,e,f){a||(a=800),c||(c=600);var g=function(){try{var a=document.createElement("canvas");return!!window.WebGLRenderingContext&&(a.getContext("webgl")||a.getContext("experimental-webgl"))}catch(b){return!1}}(),h=/Android/i.test(navigator.userAgent);return g&&!h?new b.WebGLRenderer(a,c,d,e,f):new b.CanvasRenderer(a,c,d,e)},b.PolyK={},b.PolyK.Triangulate=function(a){var c=!0,d=a.length>>1;if(3>d)return[];for(var e=[],f=[],g=0;d>g;g++)f.push(g);g=0;for(var h=d;h>3;){var i=f[(g+0)%h],j=f[(g+1)%h],k=f[(g+2)%h],l=a[2*i],m=a[2*i+1],n=a[2*j],o=a[2*j+1],p=a[2*k],q=a[2*k+1],r=!1;if(b.PolyK._convex(l,m,n,o,p,q,c)){r=!0;for(var s=0;h>s;s++){var t=f[s];if(t!==i&&t!==j&&t!==k&&b.PolyK._PointInTriangle(a[2*t],a[2*t+1],l,m,n,o,p,q)){r=!1;break}}}if(r)e.push(i,j,k),f.splice((g+1)%h,1),h--,g=0;else if(g++>3*h){if(!c)return window.console.log("PIXI Warning: shape too complex to fill"),[];for(e=[],f=[],g=0;d>g;g++)f.push(g);g=0,h=d,c=!1}}return e.push(f[0],f[1],f[2]),e},b.PolyK._PointInTriangle=function(a,b,c,d,e,f,g,h){var i=g-c,j=h-d,k=e-c,l=f-d,m=a-c,n=b-d,o=i*i+j*j,p=i*k+j*l,q=i*m+j*n,r=k*k+l*l,s=k*m+l*n,t=1/(o*r-p*p),u=(r*q-p*s)*t,v=(o*s-p*q)*t;return u>=0&&v>=0&&1>u+v},b.PolyK._convex=function(a,b,c,d,e,f,g){return(b-d)*(e-c)+(c-a)*(f-d)>=0===g},b.initDefaultShaders=function(){},b.CompileVertexShader=function(a,c){return b._CompileShader(a,c,a.VERTEX_SHADER)},b.CompileFragmentShader=function(a,c){return b._CompileShader(a,c,a.FRAGMENT_SHADER)},b._CompileShader=function(a,b,c){var d=b.join("\n"),e=a.createShader(c);return a.shaderSource(e,d),a.compileShader(e),a.getShaderParameter(e,a.COMPILE_STATUS)?e:(window.console.log(a.getShaderInfoLog(e)),null)},b.compileProgram=function(a,c,d){var e=b.CompileFragmentShader(a,d),f=b.CompileVertexShader(a,c),g=a.createProgram();return a.attachShader(g,f),a.attachShader(g,e),a.linkProgram(g),a.getProgramParameter(g,a.LINK_STATUS)||window.console.log("Could not initialise shaders"),g},b.PixiShader=function(a){this._UID=b._UID++,this.gl=a,this.program=null,this.fragmentSrc=["precision lowp float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform sampler2D uSampler;","void main(void) {","   gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor ;","}"],this.textureCount=0,this.attributes=[],this.init()},b.PixiShader.prototype.init=function(){var a=this.gl,c=b.compileProgram(a,this.vertexSrc||b.PixiShader.defaultVertexSrc,this.fragmentSrc);a.useProgram(c),this.uSampler=a.getUniformLocation(c,"uSampler"),this.projectionVector=a.getUniformLocation(c,"projectionVector"),this.offsetVector=a.getUniformLocation(c,"offsetVector"),this.dimensions=a.getUniformLocation(c,"dimensions"),this.aVertexPosition=a.getAttribLocation(c,"aVertexPosition"),this.aTextureCoord=a.getAttribLocation(c,"aTextureCoord"),this.colorAttribute=a.getAttribLocation(c,"aColor"),-1===this.colorAttribute&&(this.colorAttribute=2),this.attributes=[this.aVertexPosition,this.aTextureCoord,this.colorAttribute];for(var d in this.uniforms)this.uniforms[d].uniformLocation=a.getUniformLocation(c,d);this.initUniforms(),this.program=c},b.PixiShader.prototype.initUniforms=function(){this.textureCount=1;var a,b=this.gl;for(var c in this.uniforms){a=this.uniforms[c];var d=a.type;"sampler2D"===d?(a._init=!1,null!==a.value&&this.initSampler2D(a)):"mat2"===d||"mat3"===d||"mat4"===d?(a.glMatrix=!0,a.glValueLength=1,"mat2"===d?a.glFunc=b.uniformMatrix2fv:"mat3"===d?a.glFunc=b.uniformMatrix3fv:"mat4"===d&&(a.glFunc=b.uniformMatrix4fv)):(a.glFunc=b["uniform"+d],a.glValueLength="2f"===d||"2i"===d?2:"3f"===d||"3i"===d?3:"4f"===d||"4i"===d?4:1)}},b.PixiShader.prototype.initSampler2D=function(a){if(a.value&&a.value.baseTexture&&a.value.baseTexture.hasLoaded){var b=this.gl;if(b.activeTexture(b["TEXTURE"+this.textureCount]),b.bindTexture(b.TEXTURE_2D,a.value.baseTexture._glTextures[b.id]),a.textureData){var c=a.textureData,d=c.magFilter?c.magFilter:b.LINEAR,e=c.minFilter?c.minFilter:b.LINEAR,f=c.wrapS?c.wrapS:b.CLAMP_TO_EDGE,g=c.wrapT?c.wrapT:b.CLAMP_TO_EDGE,h=c.luminance?b.LUMINANCE:b.RGBA;if(c.repeat&&(f=b.REPEAT,g=b.REPEAT),b.pixelStorei(b.UNPACK_FLIP_Y_WEBGL,!!c.flipY),c.width){var i=c.width?c.width:512,j=c.height?c.height:2,k=c.border?c.border:0;b.texImage2D(b.TEXTURE_2D,0,h,i,j,k,h,b.UNSIGNED_BYTE,null)}else b.texImage2D(b.TEXTURE_2D,0,h,b.RGBA,b.UNSIGNED_BYTE,a.value.baseTexture.source);b.texParameteri(b.TEXTURE_2D,b.TEXTURE_MAG_FILTER,d),b.texParameteri(b.TEXTURE_2D,b.TEXTURE_MIN_FILTER,e),b.texParameteri(b.TEXTURE_2D,b.TEXTURE_WRAP_S,f),b.texParameteri(b.TEXTURE_2D,b.TEXTURE_WRAP_T,g)}b.uniform1i(a.uniformLocation,this.textureCount),a._init=!0,this.textureCount++}},b.PixiShader.prototype.syncUniforms=function(){this.textureCount=1;var a,c=this.gl;for(var d in this.uniforms)a=this.uniforms[d],1===a.glValueLength?a.glMatrix===!0?a.glFunc.call(c,a.uniformLocation,a.transpose,a.value):a.glFunc.call(c,a.uniformLocation,a.value):2===a.glValueLength?a.glFunc.call(c,a.uniformLocation,a.value.x,a.value.y):3===a.glValueLength?a.glFunc.call(c,a.uniformLocation,a.value.x,a.value.y,a.value.z):4===a.glValueLength?a.glFunc.call(c,a.uniformLocation,a.value.x,a.value.y,a.value.z,a.value.w):"sampler2D"===a.type&&(a._init?(c.activeTexture(c["TEXTURE"+this.textureCount]),c.bindTexture(c.TEXTURE_2D,a.value.baseTexture._glTextures[c.id]||b.createWebGLTexture(a.value.baseTexture,c)),c.uniform1i(a.uniformLocation,this.textureCount),this.textureCount++):this.initSampler2D(a))},b.PixiShader.prototype.destroy=function(){this.gl.deleteProgram(this.program),this.uniforms=null,this.gl=null,this.attributes=null},b.PixiShader.defaultVertexSrc=["attribute vec2 aVertexPosition;","attribute vec2 aTextureCoord;","attribute vec2 aColor;","uniform vec2 projectionVector;","uniform vec2 offsetVector;","varying vec2 vTextureCoord;","varying vec4 vColor;","const vec2 center = vec2(-1.0, 1.0);","void main(void) {","   gl_Position = vec4( ((aVertexPosition + offsetVector) / projectionVector) + center , 0.0, 1.0);","   vTextureCoord = aTextureCoord;","   vec3 color = mod(vec3(aColor.y/65536.0, aColor.y/256.0, aColor.y), 256.0) / 256.0;","   vColor = vec4(color * aColor.x, aColor.x);","}"],b.PixiFastShader=function(a){this._UID=b._UID++,this.gl=a,this.program=null,this.fragmentSrc=["precision lowp float;","varying vec2 vTextureCoord;","varying float vColor;","uniform sampler2D uSampler;","void main(void) {","   gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor ;","}"],this.vertexSrc=["attribute vec2 aVertexPosition;","attribute vec2 aPositionCoord;","attribute vec2 aScale;","attribute float aRotation;","attribute vec2 aTextureCoord;","attribute float aColor;","uniform vec2 projectionVector;","uniform vec2 offsetVector;","uniform mat3 uMatrix;","varying vec2 vTextureCoord;","varying float vColor;","const vec2 center = vec2(-1.0, 1.0);","void main(void) {","   vec2 v;","   vec2 sv = aVertexPosition * aScale;","   v.x = (sv.x) * cos(aRotation) - (sv.y) * sin(aRotation);","   v.y = (sv.x) * sin(aRotation) + (sv.y) * cos(aRotation);","   v = ( uMatrix * vec3(v + aPositionCoord , 1.0) ).xy ;","   gl_Position = vec4( ( v / projectionVector) + center , 0.0, 1.0);","   vTextureCoord = aTextureCoord;","   vColor = aColor;","}"],this.textureCount=0,this.init()},b.PixiFastShader.prototype.init=function(){var a=this.gl,c=b.compileProgram(a,this.vertexSrc,this.fragmentSrc);a.useProgram(c),this.uSampler=a.getUniformLocation(c,"uSampler"),this.projectionVector=a.getUniformLocation(c,"projectionVector"),this.offsetVector=a.getUniformLocation(c,"offsetVector"),this.dimensions=a.getUniformLocation(c,"dimensions"),this.uMatrix=a.getUniformLocation(c,"uMatrix"),this.aVertexPosition=a.getAttribLocation(c,"aVertexPosition"),this.aPositionCoord=a.getAttribLocation(c,"aPositionCoord"),this.aScale=a.getAttribLocation(c,"aScale"),this.aRotation=a.getAttribLocation(c,"aRotation"),this.aTextureCoord=a.getAttribLocation(c,"aTextureCoord"),this.colorAttribute=a.getAttribLocation(c,"aColor"),-1===this.colorAttribute&&(this.colorAttribute=2),this.attributes=[this.aVertexPosition,this.aPositionCoord,this.aScale,this.aRotation,this.aTextureCoord,this.colorAttribute],this.program=c},b.PixiFastShader.prototype.destroy=function(){this.gl.deleteProgram(this.program),this.uniforms=null,this.gl=null,this.attributes=null},b.StripShader=function(a){this._UID=b._UID++,this.gl=a,this.program=null,this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","uniform float alpha;","uniform sampler2D uSampler;","void main(void) {","   gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y));","}"],this.vertexSrc=["attribute vec2 aVertexPosition;","attribute vec2 aTextureCoord;","uniform mat3 translationMatrix;","uniform vec2 projectionVector;","uniform vec2 offsetVector;","varying vec2 vTextureCoord;","void main(void) {","   vec3 v = translationMatrix * vec3(aVertexPosition , 1.0);","   v -= offsetVector.xyx;","   gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);","   vTextureCoord = aTextureCoord;","}"],this.init()},b.StripShader.prototype.init=function(){var a=this.gl,c=b.compileProgram(a,this.vertexSrc,this.fragmentSrc);a.useProgram(c),this.uSampler=a.getUniformLocation(c,"uSampler"),this.projectionVector=a.getUniformLocation(c,"projectionVector"),this.offsetVector=a.getUniformLocation(c,"offsetVector"),this.colorAttribute=a.getAttribLocation(c,"aColor"),this.aVertexPosition=a.getAttribLocation(c,"aVertexPosition"),this.aTextureCoord=a.getAttribLocation(c,"aTextureCoord"),this.attributes=[this.aVertexPosition,this.aTextureCoord],this.translationMatrix=a.getUniformLocation(c,"translationMatrix"),this.alpha=a.getUniformLocation(c,"alpha"),this.program=c},b.PrimitiveShader=function(a){this._UID=b._UID++,this.gl=a,this.program=null,this.fragmentSrc=["precision mediump float;","varying vec4 vColor;","void main(void) {","   gl_FragColor = vColor;","}"],this.vertexSrc=["attribute vec2 aVertexPosition;","attribute vec4 aColor;","uniform mat3 translationMatrix;","uniform vec2 projectionVector;","uniform vec2 offsetVector;","uniform float alpha;","uniform vec3 tint;","varying vec4 vColor;","void main(void) {","   vec3 v = translationMatrix * vec3(aVertexPosition , 1.0);","   v -= offsetVector.xyx;","   gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);","   vColor = aColor * vec4(tint * alpha, alpha);","}"],this.init()},b.PrimitiveShader.prototype.init=function(){var a=this.gl,c=b.compileProgram(a,this.vertexSrc,this.fragmentSrc);a.useProgram(c),this.projectionVector=a.getUniformLocation(c,"projectionVector"),this.offsetVector=a.getUniformLocation(c,"offsetVector"),this.tintColor=a.getUniformLocation(c,"tint"),this.aVertexPosition=a.getAttribLocation(c,"aVertexPosition"),this.colorAttribute=a.getAttribLocation(c,"aColor"),this.attributes=[this.aVertexPosition,this.colorAttribute],this.translationMatrix=a.getUniformLocation(c,"translationMatrix"),this.alpha=a.getUniformLocation(c,"alpha"),this.program=c},b.PrimitiveShader.prototype.destroy=function(){this.gl.deleteProgram(this.program),this.uniforms=null,this.gl=null,this.attribute=null},b.ComplexPrimitiveShader=function(a){this._UID=b._UID++,this.gl=a,this.program=null,this.fragmentSrc=["precision mediump float;","varying vec4 vColor;","void main(void) {","   gl_FragColor = vColor;","}"],this.vertexSrc=["attribute vec2 aVertexPosition;","uniform mat3 translationMatrix;","uniform vec2 projectionVector;","uniform vec2 offsetVector;","uniform vec3 tint;","uniform float alpha;","uniform vec3 color;","varying vec4 vColor;","void main(void) {","   vec3 v = translationMatrix * vec3(aVertexPosition , 1.0);","   v -= offsetVector.xyx;","   gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);","   vColor = vec4(color * alpha * tint, alpha);","}"],this.init()},b.ComplexPrimitiveShader.prototype.init=function(){var a=this.gl,c=b.compileProgram(a,this.vertexSrc,this.fragmentSrc);a.useProgram(c),this.projectionVector=a.getUniformLocation(c,"projectionVector"),this.offsetVector=a.getUniformLocation(c,"offsetVector"),this.tintColor=a.getUniformLocation(c,"tint"),this.color=a.getUniformLocation(c,"color"),this.aVertexPosition=a.getAttribLocation(c,"aVertexPosition"),this.attributes=[this.aVertexPosition,this.colorAttribute],this.translationMatrix=a.getUniformLocation(c,"translationMatrix"),this.alpha=a.getUniformLocation(c,"alpha"),this.program=c},b.ComplexPrimitiveShader.prototype.destroy=function(){this.gl.deleteProgram(this.program),this.uniforms=null,this.gl=null,this.attribute=null},b.WebGLGraphics=function(){},b.WebGLGraphics.renderGraphics=function(a,c){var d,e=c.gl,f=c.projection,g=c.offset,h=c.shaderManager.primitiveShader;a.dirty&&b.WebGLGraphics.updateGraphics(a,e);for(var i=a._webGL[e.id],j=0;j<i.data.length;j++)1===i.data[j].mode?(d=i.data[j],c.stencilManager.pushStencil(a,d,c),e.drawElements(e.TRIANGLE_FAN,4,e.UNSIGNED_SHORT,2*(d.indices.length-4)),c.stencilManager.popStencil(a,d,c),this.last=d.mode):(d=i.data[j],c.shaderManager.setShader(h),h=c.shaderManager.primitiveShader,e.uniformMatrix3fv(h.translationMatrix,!1,a.worldTransform.toArray(!0)),e.uniform2f(h.projectionVector,f.x,-f.y),e.uniform2f(h.offsetVector,-g.x,-g.y),e.uniform3fv(h.tintColor,b.hex2rgb(a.tint)),e.uniform1f(h.alpha,a.worldAlpha),e.bindBuffer(e.ARRAY_BUFFER,d.buffer),e.vertexAttribPointer(h.aVertexPosition,2,e.FLOAT,!1,24,0),e.vertexAttribPointer(h.colorAttribute,4,e.FLOAT,!1,24,8),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,d.indexBuffer),e.drawElements(e.TRIANGLE_STRIP,d.indices.length,e.UNSIGNED_SHORT,0))},b.WebGLGraphics.updateGraphics=function(a,c){var d=a._webGL[c.id];d||(d=a._webGL[c.id]={lastIndex:0,data:[],gl:c}),a.dirty=!1;var e;if(a.clearDirty){for(a.clearDirty=!1,e=0;e<d.data.length;e++){var f=d.data[e];f.reset(),b.WebGLGraphics.graphicsDataPool.push(f)}d.data=[],d.lastIndex=0}var g;for(e=d.lastIndex;e<a.graphicsData.length;e++){var h=a.graphicsData[e];h.type===b.Graphics.POLY?(h.fill&&h.points.length>6&&(h.points.length>10?(g=b.WebGLGraphics.switchMode(d,1),b.WebGLGraphics.buildComplexPoly(h,g)):(g=b.WebGLGraphics.switchMode(d,0),b.WebGLGraphics.buildPoly(h,g))),h.lineWidth>0&&(g=b.WebGLGraphics.switchMode(d,0),b.WebGLGraphics.buildLine(h,g))):(g=b.WebGLGraphics.switchMode(d,0),h.type===b.Graphics.RECT?b.WebGLGraphics.buildRectangle(h,g):h.type===b.Graphics.CIRC||h.type===b.Graphics.ELIP?b.WebGLGraphics.buildCircle(h,g):h.type===b.Graphics.RREC&&b.WebGLGraphics.buildRoundedRectangle(h,g)),d.lastIndex++}for(e=0;e<d.data.length;e++)g=d.data[e],g.dirty&&g.upload()},b.WebGLGraphics.switchMode=function(a,c){var d;return a.data.length?(d=a.data[a.data.length-1],(d.mode!==c||1===c)&&(d=b.WebGLGraphics.graphicsDataPool.pop()||new b.WebGLGraphicsData(a.gl),d.mode=c,a.data.push(d))):(d=b.WebGLGraphics.graphicsDataPool.pop()||new b.WebGLGraphicsData(a.gl),d.mode=c,a.data.push(d)),d.dirty=!0,d},b.WebGLGraphics.buildRectangle=function(a,c){var d=a.points,e=d[0],f=d[1],g=d[2],h=d[3];if(a.fill){var i=b.hex2rgb(a.fillColor),j=a.fillAlpha,k=i[0]*j,l=i[1]*j,m=i[2]*j,n=c.points,o=c.indices,p=n.length/6;n.push(e,f),n.push(k,l,m,j),n.push(e+g,f),n.push(k,l,m,j),n.push(e,f+h),n.push(k,l,m,j),n.push(e+g,f+h),n.push(k,l,m,j),o.push(p,p,p+1,p+2,p+3,p+3)}if(a.lineWidth){var q=a.points;a.points=[e,f,e+g,f,e+g,f+h,e,f+h,e,f],b.WebGLGraphics.buildLine(a,c),a.points=q}},b.WebGLGraphics.buildRoundedRectangle=function(a,c){var d=a.points,e=d[0],f=d[1],g=d[2],h=d[3],i=d[4],j=[];if(j.push(e,f+i),j=j.concat(b.WebGLGraphics.quadraticBezierCurve(e,f+h-i,e,f+h,e+i,f+h)),j=j.concat(b.WebGLGraphics.quadraticBezierCurve(e+g-i,f+h,e+g,f+h,e+g,f+h-i)),j=j.concat(b.WebGLGraphics.quadraticBezierCurve(e+g,f+i,e+g,f,e+g-i,f)),j=j.concat(b.WebGLGraphics.quadraticBezierCurve(e+i,f,e,f,e,f+i)),a.fill){var k=b.hex2rgb(a.fillColor),l=a.fillAlpha,m=k[0]*l,n=k[1]*l,o=k[2]*l,p=c.points,q=c.indices,r=p.length/6,s=b.PolyK.Triangulate(j),t=0;for(t=0;t<s.length;t+=3)q.push(s[t]+r),q.push(s[t]+r),q.push(s[t+1]+r),q.push(s[t+2]+r),q.push(s[t+2]+r);for(t=0;t<j.length;t++)p.push(j[t],j[++t],m,n,o,l)}if(a.lineWidth){var u=a.points;a.points=j,b.WebGLGraphics.buildLine(a,c),a.points=u}},b.WebGLGraphics.quadraticBezierCurve=function(a,b,c,d,e,f){function g(a,b,c){var d=b-a;return a+d*c}for(var h,i,j,k,l,m,n=20,o=[],p=0,q=0;n>=q;q++)p=q/n,h=g(a,c,p),i=g(b,d,p),j=g(c,e,p),k=g(d,f,p),l=g(h,j,p),m=g(i,k,p),o.push(l,m);return o},b.WebGLGraphics.buildCircle=function(a,c){var d=a.points,e=d[0],f=d[1],g=d[2],h=d[3],i=40,j=2*Math.PI/i,k=0;if(a.fill){var l=b.hex2rgb(a.fillColor),m=a.fillAlpha,n=l[0]*m,o=l[1]*m,p=l[2]*m,q=c.points,r=c.indices,s=q.length/6;for(r.push(s),k=0;i+1>k;k++)q.push(e,f,n,o,p,m),q.push(e+Math.sin(j*k)*g,f+Math.cos(j*k)*h,n,o,p,m),r.push(s++,s++);r.push(s-1)}if(a.lineWidth){var t=a.points;for(a.points=[],k=0;i+1>k;k++)a.points.push(e+Math.sin(j*k)*g,f+Math.cos(j*k)*h);b.WebGLGraphics.buildLine(a,c),a.points=t}},b.WebGLGraphics.buildLine=function(a,c){var d=0,e=a.points;if(0!==e.length){if(a.lineWidth%2)for(d=0;d<e.length;d++)e[d]+=.5;var f=new b.Point(e[0],e[1]),g=new b.Point(e[e.length-2],e[e.length-1]);if(f.x===g.x&&f.y===g.y){e=e.slice(),e.pop(),e.pop(),g=new b.Point(e[e.length-2],e[e.length-1]);var h=g.x+.5*(f.x-g.x),i=g.y+.5*(f.y-g.y);e.unshift(h,i),e.push(h,i)}var j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G=c.points,H=c.indices,I=e.length/2,J=e.length,K=G.length/6,L=a.lineWidth/2,M=b.hex2rgb(a.lineColor),N=a.lineAlpha,O=M[0]*N,P=M[1]*N,Q=M[2]*N;for(l=e[0],m=e[1],n=e[2],o=e[3],r=-(m-o),s=l-n,F=Math.sqrt(r*r+s*s),r/=F,s/=F,r*=L,s*=L,G.push(l-r,m-s,O,P,Q,N),G.push(l+r,m+s,O,P,Q,N),d=1;I-1>d;d++)l=e[2*(d-1)],m=e[2*(d-1)+1],n=e[2*d],o=e[2*d+1],p=e[2*(d+1)],q=e[2*(d+1)+1],r=-(m-o),s=l-n,F=Math.sqrt(r*r+s*s),r/=F,s/=F,r*=L,s*=L,t=-(o-q),u=n-p,F=Math.sqrt(t*t+u*u),t/=F,u/=F,t*=L,u*=L,x=-s+m-(-s+o),y=-r+n-(-r+l),z=(-r+l)*(-s+o)-(-r+n)*(-s+m),A=-u+q-(-u+o),B=-t+n-(-t+p),C=(-t+p)*(-u+o)-(-t+n)*(-u+q),D=x*B-A*y,Math.abs(D)<.1?(D+=10.1,G.push(n-r,o-s,O,P,Q,N),G.push(n+r,o+s,O,P,Q,N)):(j=(y*C-B*z)/D,k=(A*z-x*C)/D,E=(j-n)*(j-n)+(k-o)+(k-o),E>19600?(v=r-t,w=s-u,F=Math.sqrt(v*v+w*w),v/=F,w/=F,v*=L,w*=L,G.push(n-v,o-w),G.push(O,P,Q,N),G.push(n+v,o+w),G.push(O,P,Q,N),G.push(n-v,o-w),G.push(O,P,Q,N),J++):(G.push(j,k),G.push(O,P,Q,N),G.push(n-(j-n),o-(k-o)),G.push(O,P,Q,N)));for(l=e[2*(I-2)],m=e[2*(I-2)+1],n=e[2*(I-1)],o=e[2*(I-1)+1],r=-(m-o),s=l-n,F=Math.sqrt(r*r+s*s),r/=F,s/=F,r*=L,s*=L,G.push(n-r,o-s),G.push(O,P,Q,N),G.push(n+r,o+s),G.push(O,P,Q,N),H.push(K),d=0;J>d;d++)H.push(K++);H.push(K-1)}},b.WebGLGraphics.buildComplexPoly=function(a,c){var d=a.points.slice();if(!(d.length<6)){var e=c.indices;c.points=d,c.alpha=a.fillAlpha,c.color=b.hex2rgb(a.fillColor);for(var f,g,h=1/0,i=-1/0,j=1/0,k=-1/0,l=0;l<d.length;l+=2)f=d[l],g=d[l+1],h=h>f?f:h,i=f>i?f:i,j=j>g?g:j,k=g>k?g:k;d.push(h,j,i,j,i,k,h,k);var m=d.length/2;for(l=0;m>l;l++)e.push(l)}},b.WebGLGraphics.buildPoly=function(a,c){var d=a.points;if(!(d.length<6)){var e=c.points,f=c.indices,g=d.length/2,h=b.hex2rgb(a.fillColor),i=a.fillAlpha,j=h[0]*i,k=h[1]*i,l=h[2]*i,m=b.PolyK.Triangulate(d),n=e.length/6,o=0;for(o=0;o<m.length;o+=3)f.push(m[o]+n),f.push(m[o]+n),f.push(m[o+1]+n),f.push(m[o+2]+n),f.push(m[o+2]+n);for(o=0;g>o;o++)e.push(d[2*o],d[2*o+1],j,k,l,i)}},b.WebGLGraphics.graphicsDataPool=[],b.WebGLGraphicsData=function(a){this.gl=a,this.color=[0,0,0],this.points=[],this.indices=[],this.lastIndex=0,this.buffer=a.createBuffer(),this.indexBuffer=a.createBuffer(),this.mode=1,this.alpha=1,this.dirty=!0},b.WebGLGraphicsData.prototype.reset=function(){this.points=[],this.indices=[],this.lastIndex=0},b.WebGLGraphicsData.prototype.upload=function(){var a=this.gl;this.glPoints=new Float32Array(this.points),a.bindBuffer(a.ARRAY_BUFFER,this.buffer),a.bufferData(a.ARRAY_BUFFER,this.glPoints,a.STATIC_DRAW),this.glIndicies=new Uint16Array(this.indices),a.bindBuffer(a.ELEMENT_ARRAY_BUFFER,this.indexBuffer),a.bufferData(a.ELEMENT_ARRAY_BUFFER,this.glIndicies,a.STATIC_DRAW),this.dirty=!1},b.glContexts=[],b.WebGLRenderer=function(a,c,d,e,f,g){b.defaultRenderer||(b.sayHello("webGL"),b.defaultRenderer=this),this.type=b.WEBGL_RENDERER,this.transparent=!!e,this.preserveDrawingBuffer=g,this.width=a||800,this.height=c||600,this.view=d||document.createElement("canvas"),this.view.width=this.width,this.view.height=this.height,this.contextLost=this.handleContextLost.bind(this),this.contextRestoredLost=this.handleContextRestored.bind(this),this.view.addEventListener("webglcontextlost",this.contextLost,!1),this.view.addEventListener("webglcontextrestored",this.contextRestoredLost,!1),this.options={alpha:this.transparent,antialias:!!f,premultipliedAlpha:!!e,stencil:!0,preserveDrawingBuffer:g};var h=null;if(["experimental-webgl","webgl"].forEach(function(a){try{h=h||this.view.getContext(a,this.options)}catch(b){}},this),!h)throw new Error("This browser does not support webGL. Try using the canvas renderer"+this);this.gl=h,this.glContextId=h.id=b.WebGLRenderer.glContextId++,b.glContexts[this.glContextId]=h,b.blendModesWebGL||(b.blendModesWebGL=[],b.blendModesWebGL[b.blendModes.NORMAL]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.ADD]=[h.SRC_ALPHA,h.DST_ALPHA],b.blendModesWebGL[b.blendModes.MULTIPLY]=[h.DST_COLOR,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.SCREEN]=[h.SRC_ALPHA,h.ONE],b.blendModesWebGL[b.blendModes.OVERLAY]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.DARKEN]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.LIGHTEN]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.COLOR_DODGE]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.COLOR_BURN]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.HARD_LIGHT]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.SOFT_LIGHT]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.DIFFERENCE]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.EXCLUSION]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.HUE]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.SATURATION]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.COLOR]=[h.ONE,h.ONE_MINUS_SRC_ALPHA],b.blendModesWebGL[b.blendModes.LUMINOSITY]=[h.ONE,h.ONE_MINUS_SRC_ALPHA]),this.projection=new b.Point,this.projection.x=this.width/2,this.projection.y=-this.height/2,this.offset=new b.Point(0,0),this.resize(this.width,this.height),this.contextLost=!1,this.shaderManager=new b.WebGLShaderManager(h),this.spriteBatch=new b.WebGLSpriteBatch(h),this.maskManager=new b.WebGLMaskManager(h),this.filterManager=new b.WebGLFilterManager(h,this.transparent),this.stencilManager=new b.WebGLStencilManager(h),this.blendModeManager=new b.WebGLBlendModeManager(h),this.renderSession={},this.renderSession.gl=this.gl,this.renderSession.drawCount=0,this.renderSession.shaderManager=this.shaderManager,this.renderSession.maskManager=this.maskManager,this.renderSession.filterManager=this.filterManager,this.renderSession.blendModeManager=this.blendModeManager,this.renderSession.spriteBatch=this.spriteBatch,this.renderSession.stencilManager=this.stencilManager,this.renderSession.renderer=this,h.useProgram(this.shaderManager.defaultShader.program),h.disable(h.DEPTH_TEST),h.disable(h.CULL_FACE),h.enable(h.BLEND),h.colorMask(!0,!0,!0,this.transparent)},b.WebGLRenderer.prototype.constructor=b.WebGLRenderer,b.WebGLRenderer.prototype.render=function(a){if(!this.contextLost){this.__stage!==a&&(a.interactive&&a.interactionManager.removeEvents(),this.__stage=a),b.WebGLRenderer.updateTextures(),a.updateTransform(),a._interactive&&(a._interactiveEventsAdded||(a._interactiveEventsAdded=!0,a.interactionManager.setTarget(this)));var c=this.gl;c.viewport(0,0,this.width,this.height),c.bindFramebuffer(c.FRAMEBUFFER,null),this.transparent?c.clearColor(0,0,0,0):c.clearColor(a.backgroundColorSplit[0],a.backgroundColorSplit[1],a.backgroundColorSplit[2],1),c.clear(c.COLOR_BUFFER_BIT),this.renderDisplayObject(a,this.projection),a.interactive?a._interactiveEventsAdded||(a._interactiveEventsAdded=!0,a.interactionManager.setTarget(this)):a._interactiveEventsAdded&&(a._interactiveEventsAdded=!1,a.interactionManager.setTarget(this))}},b.WebGLRenderer.prototype.renderDisplayObject=function(a,c,d){this.renderSession.blendModeManager.setBlendMode(b.blendModes.NORMAL),this.renderSession.drawCount=0,this.renderSession.currentBlendMode=9999,this.renderSession.projection=c,this.renderSession.offset=this.offset,this.spriteBatch.begin(this.renderSession),this.filterManager.begin(this.renderSession,d),a._renderWebGL(this.renderSession),this.spriteBatch.end()},b.WebGLRenderer.updateTextures=function(){var a=0;for(a=0;a<b.Texture.frameUpdates.length;a++)b.WebGLRenderer.updateTextureFrame(b.Texture.frameUpdates[a]);for(a=0;a<b.texturesToDestroy.length;a++)b.WebGLRenderer.destroyTexture(b.texturesToDestroy[a]);b.texturesToUpdate.length=0,b.texturesToDestroy.length=0,b.Texture.frameUpdates.length=0},b.WebGLRenderer.destroyTexture=function(a){for(var c=a._glTextures.length-1;c>=0;c--){var d=a._glTextures[c],e=b.glContexts[c];
e&&d&&e.deleteTexture(d)}a._glTextures.length=0},b.WebGLRenderer.updateTextureFrame=function(a){a._updateWebGLuvs()},b.WebGLRenderer.prototype.resize=function(a,b){this.width=a,this.height=b,this.view.width=a,this.view.height=b,this.gl.viewport(0,0,this.width,this.height),this.projection.x=this.width/2,this.projection.y=-this.height/2},b.createWebGLTexture=function(a,c){return a.hasLoaded&&(a._glTextures[c.id]=c.createTexture(),c.bindTexture(c.TEXTURE_2D,a._glTextures[c.id]),c.pixelStorei(c.UNPACK_PREMULTIPLY_ALPHA_WEBGL,a.premultipliedAlpha),c.texImage2D(c.TEXTURE_2D,0,c.RGBA,c.RGBA,c.UNSIGNED_BYTE,a.source),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MAG_FILTER,a.scaleMode===b.scaleModes.LINEAR?c.LINEAR:c.NEAREST),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,a.scaleMode===b.scaleModes.LINEAR?c.LINEAR:c.NEAREST),a._powerOf2?(c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_S,c.REPEAT),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_T,c.REPEAT)):(c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_S,c.CLAMP_TO_EDGE),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_T,c.CLAMP_TO_EDGE)),c.bindTexture(c.TEXTURE_2D,null),a._dirty[c.id]=!1),a._glTextures[c.id]},b.updateWebGLTexture=function(a,c){a._glTextures[c.id]&&(c.bindTexture(c.TEXTURE_2D,a._glTextures[c.id]),c.pixelStorei(c.UNPACK_PREMULTIPLY_ALPHA_WEBGL,a.premultipliedAlpha),c.texImage2D(c.TEXTURE_2D,0,c.RGBA,c.RGBA,c.UNSIGNED_BYTE,a.source),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MAG_FILTER,a.scaleMode===b.scaleModes.LINEAR?c.LINEAR:c.NEAREST),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,a.scaleMode===b.scaleModes.LINEAR?c.LINEAR:c.NEAREST),a._powerOf2?(c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_S,c.REPEAT),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_T,c.REPEAT)):(c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_S,c.CLAMP_TO_EDGE),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_T,c.CLAMP_TO_EDGE)),a._dirty[c.id]=!1)},b.WebGLRenderer.prototype.handleContextLost=function(a){a.preventDefault(),this.contextLost=!0},b.WebGLRenderer.prototype.handleContextRestored=function(){try{this.gl=this.view.getContext("experimental-webgl",this.options)}catch(a){try{this.gl=this.view.getContext("webgl",this.options)}catch(c){throw new Error(" This browser does not support webGL. Try using the canvas renderer"+this)}}var d=this.gl;d.id=b.WebGLRenderer.glContextId++,this.shaderManager.setContext(d),this.spriteBatch.setContext(d),this.primitiveBatch.setContext(d),this.maskManager.setContext(d),this.filterManager.setContext(d),this.renderSession.gl=this.gl,d.disable(d.DEPTH_TEST),d.disable(d.CULL_FACE),d.enable(d.BLEND),d.colorMask(!0,!0,!0,this.transparent),this.gl.viewport(0,0,this.width,this.height);for(var e in b.TextureCache){var f=b.TextureCache[e].baseTexture;f._glTextures=[]}this.contextLost=!1},b.WebGLRenderer.prototype.destroy=function(){this.view.removeEventListener("webglcontextlost",this.contextLost),this.view.removeEventListener("webglcontextrestored",this.contextRestoredLost),b.glContexts[this.glContextId]=null,this.projection=null,this.offset=null,this.shaderManager.destroy(),this.spriteBatch.destroy(),this.primitiveBatch.destroy(),this.maskManager.destroy(),this.filterManager.destroy(),this.shaderManager=null,this.spriteBatch=null,this.maskManager=null,this.filterManager=null,this.gl=null,this.renderSession=null},b.WebGLRenderer.glContextId=0,b.WebGLBlendModeManager=function(a){this.gl=a,this.currentBlendMode=99999},b.WebGLBlendModeManager.prototype.setBlendMode=function(a){if(this.currentBlendMode===a)return!1;this.currentBlendMode=a;var c=b.blendModesWebGL[this.currentBlendMode];return this.gl.blendFunc(c[0],c[1]),!0},b.WebGLBlendModeManager.prototype.destroy=function(){this.gl=null},b.WebGLMaskManager=function(a){this.maskStack=[],this.maskPosition=0,this.setContext(a),this.reverse=!1,this.count=0},b.WebGLMaskManager.prototype.setContext=function(a){this.gl=a},b.WebGLMaskManager.prototype.pushMask=function(a,c){var d=c.gl;a.dirty&&b.WebGLGraphics.updateGraphics(a,d),a._webGL[d.id].data.length&&c.stencilManager.pushStencil(a,a._webGL[d.id].data[0],c)},b.WebGLMaskManager.prototype.popMask=function(a,b){var c=this.gl;b.stencilManager.popStencil(a,a._webGL[c.id].data[0],b)},b.WebGLMaskManager.prototype.destroy=function(){this.maskStack=null,this.gl=null},b.WebGLStencilManager=function(a){this.stencilStack=[],this.setContext(a),this.reverse=!0,this.count=0},b.WebGLStencilManager.prototype.setContext=function(a){this.gl=a},b.WebGLStencilManager.prototype.pushStencil=function(a,b,c){var d=this.gl;this.bindGraphics(a,b,c),0===this.stencilStack.length&&(d.enable(d.STENCIL_TEST),d.clear(d.STENCIL_BUFFER_BIT),this.reverse=!0,this.count=0),this.stencilStack.push(b);var e=this.count;d.colorMask(!1,!1,!1,!1),d.stencilFunc(d.ALWAYS,0,255),d.stencilOp(d.KEEP,d.KEEP,d.INVERT),1===b.mode?(d.drawElements(d.TRIANGLE_FAN,b.indices.length-4,d.UNSIGNED_SHORT,0),this.reverse?(d.stencilFunc(d.EQUAL,255-e,255),d.stencilOp(d.KEEP,d.KEEP,d.DECR)):(d.stencilFunc(d.EQUAL,e,255),d.stencilOp(d.KEEP,d.KEEP,d.INCR)),d.drawElements(d.TRIANGLE_FAN,4,d.UNSIGNED_SHORT,2*(b.indices.length-4)),this.reverse?d.stencilFunc(d.EQUAL,255-(e+1),255):d.stencilFunc(d.EQUAL,e+1,255),this.reverse=!this.reverse):(this.reverse?(d.stencilFunc(d.EQUAL,e,255),d.stencilOp(d.KEEP,d.KEEP,d.INCR)):(d.stencilFunc(d.EQUAL,255-e,255),d.stencilOp(d.KEEP,d.KEEP,d.DECR)),d.drawElements(d.TRIANGLE_STRIP,b.indices.length,d.UNSIGNED_SHORT,0),this.reverse?d.stencilFunc(d.EQUAL,e+1,255):d.stencilFunc(d.EQUAL,255-(e+1),255)),d.colorMask(!0,!0,!0,!0),d.stencilOp(d.KEEP,d.KEEP,d.KEEP),this.count++},b.WebGLStencilManager.prototype.bindGraphics=function(a,c,d){this._currentGraphics=a;var e,f=this.gl,g=d.projection,h=d.offset;1===c.mode?(e=d.shaderManager.complexPrimativeShader,d.shaderManager.setShader(e),f.uniformMatrix3fv(e.translationMatrix,!1,a.worldTransform.toArray(!0)),f.uniform2f(e.projectionVector,g.x,-g.y),f.uniform2f(e.offsetVector,-h.x,-h.y),f.uniform3fv(e.tintColor,b.hex2rgb(a.tint)),f.uniform3fv(e.color,c.color),f.uniform1f(e.alpha,a.worldAlpha*c.alpha),f.bindBuffer(f.ARRAY_BUFFER,c.buffer),f.vertexAttribPointer(e.aVertexPosition,2,f.FLOAT,!1,8,0),f.bindBuffer(f.ELEMENT_ARRAY_BUFFER,c.indexBuffer)):(e=d.shaderManager.primitiveShader,d.shaderManager.setShader(e),f.uniformMatrix3fv(e.translationMatrix,!1,a.worldTransform.toArray(!0)),f.uniform2f(e.projectionVector,g.x,-g.y),f.uniform2f(e.offsetVector,-h.x,-h.y),f.uniform3fv(e.tintColor,b.hex2rgb(a.tint)),f.uniform1f(e.alpha,a.worldAlpha),f.bindBuffer(f.ARRAY_BUFFER,c.buffer),f.vertexAttribPointer(e.aVertexPosition,2,f.FLOAT,!1,24,0),f.vertexAttribPointer(e.colorAttribute,4,f.FLOAT,!1,24,8),f.bindBuffer(f.ELEMENT_ARRAY_BUFFER,c.indexBuffer))},b.WebGLStencilManager.prototype.popStencil=function(a,b,c){var d=this.gl;if(this.stencilStack.pop(),this.count--,0===this.stencilStack.length)d.disable(d.STENCIL_TEST);else{var e=this.count;this.bindGraphics(a,b,c),d.colorMask(!1,!1,!1,!1),1===b.mode?(this.reverse=!this.reverse,this.reverse?(d.stencilFunc(d.EQUAL,255-(e+1),255),d.stencilOp(d.KEEP,d.KEEP,d.INCR)):(d.stencilFunc(d.EQUAL,e+1,255),d.stencilOp(d.KEEP,d.KEEP,d.DECR)),d.drawElements(d.TRIANGLE_FAN,4,d.UNSIGNED_SHORT,2*(b.indices.length-4)),d.stencilFunc(d.ALWAYS,0,255),d.stencilOp(d.KEEP,d.KEEP,d.INVERT),d.drawElements(d.TRIANGLE_FAN,b.indices.length-4,d.UNSIGNED_SHORT,0),this.reverse?d.stencilFunc(d.EQUAL,e,255):d.stencilFunc(d.EQUAL,255-e,255)):(this.reverse?(d.stencilFunc(d.EQUAL,e+1,255),d.stencilOp(d.KEEP,d.KEEP,d.DECR)):(d.stencilFunc(d.EQUAL,255-(e+1),255),d.stencilOp(d.KEEP,d.KEEP,d.INCR)),d.drawElements(d.TRIANGLE_STRIP,b.indices.length,d.UNSIGNED_SHORT,0),this.reverse?d.stencilFunc(d.EQUAL,e,255):d.stencilFunc(d.EQUAL,255-e,255)),d.colorMask(!0,!0,!0,!0),d.stencilOp(d.KEEP,d.KEEP,d.KEEP)}},b.WebGLStencilManager.prototype.destroy=function(){this.maskStack=null,this.gl=null},b.WebGLShaderManager=function(a){this.maxAttibs=10,this.attribState=[],this.tempAttribState=[],this.shaderMap=[];for(var b=0;b<this.maxAttibs;b++)this.attribState[b]=!1;this.setContext(a)},b.WebGLShaderManager.prototype.setContext=function(a){this.gl=a,this.primitiveShader=new b.PrimitiveShader(a),this.complexPrimativeShader=new b.ComplexPrimitiveShader(a),this.defaultShader=new b.PixiShader(a),this.fastShader=new b.PixiFastShader(a),this.stripShader=new b.StripShader(a),this.setShader(this.defaultShader)},b.WebGLShaderManager.prototype.setAttribs=function(a){var b;for(b=0;b<this.tempAttribState.length;b++)this.tempAttribState[b]=!1;for(b=0;b<a.length;b++){var c=a[b];this.tempAttribState[c]=!0}var d=this.gl;for(b=0;b<this.attribState.length;b++)this.attribState[b]!==this.tempAttribState[b]&&(this.attribState[b]=this.tempAttribState[b],this.tempAttribState[b]?d.enableVertexAttribArray(b):d.disableVertexAttribArray(b))},b.WebGLShaderManager.prototype.setShader=function(a){return this._currentId===a._UID?!1:(this._currentId=a._UID,this.currentShader=a,this.gl.useProgram(a.program),this.setAttribs(a.attributes),!0)},b.WebGLShaderManager.prototype.destroy=function(){this.attribState=null,this.tempAttribState=null,this.primitiveShader.destroy(),this.defaultShader.destroy(),this.fastShader.destroy(),this.stripShader.destroy(),this.gl=null},b.WebGLSpriteBatch=function(a){this.vertSize=6,this.size=2e3;var b=4*this.size*this.vertSize,c=6*this.size;this.vertices=new Float32Array(b),this.indices=new Uint16Array(c),this.lastIndexCount=0;for(var d=0,e=0;c>d;d+=6,e+=4)this.indices[d+0]=e+0,this.indices[d+1]=e+1,this.indices[d+2]=e+2,this.indices[d+3]=e+0,this.indices[d+4]=e+2,this.indices[d+5]=e+3;this.drawing=!1,this.currentBatchSize=0,this.currentBaseTexture=null,this.setContext(a),this.dirty=!0,this.textures=[],this.blendModes=[]},b.WebGLSpriteBatch.prototype.setContext=function(a){this.gl=a,this.vertexBuffer=a.createBuffer(),this.indexBuffer=a.createBuffer(),a.bindBuffer(a.ELEMENT_ARRAY_BUFFER,this.indexBuffer),a.bufferData(a.ELEMENT_ARRAY_BUFFER,this.indices,a.STATIC_DRAW),a.bindBuffer(a.ARRAY_BUFFER,this.vertexBuffer),a.bufferData(a.ARRAY_BUFFER,this.vertices,a.DYNAMIC_DRAW),this.currentBlendMode=99999},b.WebGLSpriteBatch.prototype.begin=function(a){this.renderSession=a,this.shader=this.renderSession.shaderManager.defaultShader,this.start()},b.WebGLSpriteBatch.prototype.end=function(){this.flush()},b.WebGLSpriteBatch.prototype.render=function(a){var b=a.texture;this.currentBatchSize>=this.size&&(this.flush(),this.currentBaseTexture=b.baseTexture);var c=b._uvs;if(c){var d,e,f,g,h=a.worldAlpha,i=a.tint,j=this.vertices,k=a.anchor.x,l=a.anchor.y;if(b.trim){var m=b.trim;e=m.x-k*m.width,d=e+b.crop.width,g=m.y-l*m.height,f=g+b.crop.height}else d=b.frame.width*(1-k),e=b.frame.width*-k,f=b.frame.height*(1-l),g=b.frame.height*-l;var n=4*this.currentBatchSize*this.vertSize,o=a.worldTransform,p=o.a,q=o.c,r=o.b,s=o.d,t=o.tx,u=o.ty;j[n++]=p*e+r*g+t,j[n++]=s*g+q*e+u,j[n++]=c.x0,j[n++]=c.y0,j[n++]=h,j[n++]=i,j[n++]=p*d+r*g+t,j[n++]=s*g+q*d+u,j[n++]=c.x1,j[n++]=c.y1,j[n++]=h,j[n++]=i,j[n++]=p*d+r*f+t,j[n++]=s*f+q*d+u,j[n++]=c.x2,j[n++]=c.y2,j[n++]=h,j[n++]=i,j[n++]=p*e+r*f+t,j[n++]=s*f+q*e+u,j[n++]=c.x3,j[n++]=c.y3,j[n++]=h,j[n++]=i,this.textures[this.currentBatchSize]=a.texture.baseTexture,this.blendModes[this.currentBatchSize]=a.blendMode,this.currentBatchSize++}},b.WebGLSpriteBatch.prototype.renderTilingSprite=function(a){var c=a.tilingTexture;this.currentBatchSize>=this.size&&(this.flush(),this.currentBaseTexture=c.baseTexture),a._uvs||(a._uvs=new b.TextureUvs);var d=a._uvs;a.tilePosition.x%=c.baseTexture.width*a.tileScaleOffset.x,a.tilePosition.y%=c.baseTexture.height*a.tileScaleOffset.y;var e=a.tilePosition.x/(c.baseTexture.width*a.tileScaleOffset.x),f=a.tilePosition.y/(c.baseTexture.height*a.tileScaleOffset.y),g=a.width/c.baseTexture.width/(a.tileScale.x*a.tileScaleOffset.x),h=a.height/c.baseTexture.height/(a.tileScale.y*a.tileScaleOffset.y);d.x0=0-e,d.y0=0-f,d.x1=1*g-e,d.y1=0-f,d.x2=1*g-e,d.y2=1*h-f,d.x3=0-e,d.y3=1*h-f;var i=a.worldAlpha,j=a.tint,k=this.vertices,l=a.width,m=a.height,n=a.anchor.x,o=a.anchor.y,p=l*(1-n),q=l*-n,r=m*(1-o),s=m*-o,t=4*this.currentBatchSize*this.vertSize,u=a.worldTransform,v=u.a,w=u.c,x=u.b,y=u.d,z=u.tx,A=u.ty;k[t++]=v*q+x*s+z,k[t++]=y*s+w*q+A,k[t++]=d.x0,k[t++]=d.y0,k[t++]=i,k[t++]=j,k[t++]=v*p+x*s+z,k[t++]=y*s+w*p+A,k[t++]=d.x1,k[t++]=d.y1,k[t++]=i,k[t++]=j,k[t++]=v*p+x*r+z,k[t++]=y*r+w*p+A,k[t++]=d.x2,k[t++]=d.y2,k[t++]=i,k[t++]=j,k[t++]=v*q+x*r+z,k[t++]=y*r+w*q+A,k[t++]=d.x3,k[t++]=d.y3,k[t++]=i,k[t++]=j,this.textures[this.currentBatchSize]=c.baseTexture,this.blendModes[this.currentBatchSize]=a.blendMode,this.currentBatchSize++},b.WebGLSpriteBatch.prototype.flush=function(){if(0!==this.currentBatchSize){var a=this.gl;if(this.renderSession.shaderManager.setShader(this.renderSession.shaderManager.defaultShader),this.dirty){this.dirty=!1,a.activeTexture(a.TEXTURE0),a.bindBuffer(a.ARRAY_BUFFER,this.vertexBuffer),a.bindBuffer(a.ELEMENT_ARRAY_BUFFER,this.indexBuffer);var b=this.renderSession.projection;a.uniform2f(this.shader.projectionVector,b.x,b.y);var c=4*this.vertSize;a.vertexAttribPointer(this.shader.aVertexPosition,2,a.FLOAT,!1,c,0),a.vertexAttribPointer(this.shader.aTextureCoord,2,a.FLOAT,!1,c,8),a.vertexAttribPointer(this.shader.colorAttribute,2,a.FLOAT,!1,c,16)}if(this.currentBatchSize>.5*this.size)a.bufferSubData(a.ARRAY_BUFFER,0,this.vertices);else{var d=this.vertices.subarray(0,4*this.currentBatchSize*this.vertSize);a.bufferSubData(a.ARRAY_BUFFER,0,d)}for(var e,f,g=0,h=0,i=null,j=this.renderSession.blendModeManager.currentBlendMode,k=0,l=this.currentBatchSize;l>k;k++)e=this.textures[k],f=this.blendModes[k],(i!==e||j!==f)&&(this.renderBatch(i,g,h),h=k,g=0,i=e,j=f,this.renderSession.blendModeManager.setBlendMode(j)),g++;this.renderBatch(i,g,h),this.currentBatchSize=0}},b.WebGLSpriteBatch.prototype.renderBatch=function(a,c,d){if(0!==c){var e=this.gl;e.bindTexture(e.TEXTURE_2D,a._glTextures[e.id]||b.createWebGLTexture(a,e)),a._dirty[e.id]&&b.updateWebGLTexture(this.currentBaseTexture,e),e.drawElements(e.TRIANGLES,6*c,e.UNSIGNED_SHORT,6*d*2),this.renderSession.drawCount++}},b.WebGLSpriteBatch.prototype.stop=function(){this.flush()},b.WebGLSpriteBatch.prototype.start=function(){this.dirty=!0},b.WebGLSpriteBatch.prototype.destroy=function(){this.vertices=null,this.indices=null,this.gl.deleteBuffer(this.vertexBuffer),this.gl.deleteBuffer(this.indexBuffer),this.currentBaseTexture=null,this.gl=null},b.WebGLFastSpriteBatch=function(a){this.vertSize=10,this.maxSize=6e3,this.size=this.maxSize;var b=4*this.size*this.vertSize,c=6*this.maxSize;this.vertices=new Float32Array(b),this.indices=new Uint16Array(c),this.vertexBuffer=null,this.indexBuffer=null,this.lastIndexCount=0;for(var d=0,e=0;c>d;d+=6,e+=4)this.indices[d+0]=e+0,this.indices[d+1]=e+1,this.indices[d+2]=e+2,this.indices[d+3]=e+0,this.indices[d+4]=e+2,this.indices[d+5]=e+3;this.drawing=!1,this.currentBatchSize=0,this.currentBaseTexture=null,this.currentBlendMode=0,this.renderSession=null,this.shader=null,this.matrix=null,this.setContext(a)},b.WebGLFastSpriteBatch.prototype.setContext=function(a){this.gl=a,this.vertexBuffer=a.createBuffer(),this.indexBuffer=a.createBuffer(),a.bindBuffer(a.ELEMENT_ARRAY_BUFFER,this.indexBuffer),a.bufferData(a.ELEMENT_ARRAY_BUFFER,this.indices,a.STATIC_DRAW),a.bindBuffer(a.ARRAY_BUFFER,this.vertexBuffer),a.bufferData(a.ARRAY_BUFFER,this.vertices,a.DYNAMIC_DRAW)},b.WebGLFastSpriteBatch.prototype.begin=function(a,b){this.renderSession=b,this.shader=this.renderSession.shaderManager.fastShader,this.matrix=a.worldTransform.toArray(!0),this.start()},b.WebGLFastSpriteBatch.prototype.end=function(){this.flush()},b.WebGLFastSpriteBatch.prototype.render=function(a){var b=a.children,c=b[0];if(c.texture._uvs){this.currentBaseTexture=c.texture.baseTexture,c.blendMode!==this.renderSession.blendModeManager.currentBlendMode&&(this.flush(),this.renderSession.blendModeManager.setBlendMode(c.blendMode));for(var d=0,e=b.length;e>d;d++)this.renderSprite(b[d]);this.flush()}},b.WebGLFastSpriteBatch.prototype.renderSprite=function(a){if(a.visible&&(a.texture.baseTexture===this.currentBaseTexture||(this.flush(),this.currentBaseTexture=a.texture.baseTexture,a.texture._uvs))){var b,c,d,e,f,g,h,i,j=this.vertices;if(b=a.texture._uvs,c=a.texture.frame.width,d=a.texture.frame.height,a.texture.trim){var k=a.texture.trim;f=k.x-a.anchor.x*k.width,e=f+a.texture.crop.width,h=k.y-a.anchor.y*k.height,g=h+a.texture.crop.height}else e=a.texture.frame.width*(1-a.anchor.x),f=a.texture.frame.width*-a.anchor.x,g=a.texture.frame.height*(1-a.anchor.y),h=a.texture.frame.height*-a.anchor.y;i=4*this.currentBatchSize*this.vertSize,j[i++]=f,j[i++]=h,j[i++]=a.position.x,j[i++]=a.position.y,j[i++]=a.scale.x,j[i++]=a.scale.y,j[i++]=a.rotation,j[i++]=b.x0,j[i++]=b.y1,j[i++]=a.alpha,j[i++]=e,j[i++]=h,j[i++]=a.position.x,j[i++]=a.position.y,j[i++]=a.scale.x,j[i++]=a.scale.y,j[i++]=a.rotation,j[i++]=b.x1,j[i++]=b.y1,j[i++]=a.alpha,j[i++]=e,j[i++]=g,j[i++]=a.position.x,j[i++]=a.position.y,j[i++]=a.scale.x,j[i++]=a.scale.y,j[i++]=a.rotation,j[i++]=b.x2,j[i++]=b.y2,j[i++]=a.alpha,j[i++]=f,j[i++]=g,j[i++]=a.position.x,j[i++]=a.position.y,j[i++]=a.scale.x,j[i++]=a.scale.y,j[i++]=a.rotation,j[i++]=b.x3,j[i++]=b.y3,j[i++]=a.alpha,this.currentBatchSize++,this.currentBatchSize>=this.size&&this.flush()}},b.WebGLFastSpriteBatch.prototype.flush=function(){if(0!==this.currentBatchSize){var a=this.gl;if(this.currentBaseTexture._glTextures[a.id]||b.createWebGLTexture(this.currentBaseTexture,a),a.bindTexture(a.TEXTURE_2D,this.currentBaseTexture._glTextures[a.id]),this.currentBatchSize>.5*this.size)a.bufferSubData(a.ARRAY_BUFFER,0,this.vertices);else{var c=this.vertices.subarray(0,4*this.currentBatchSize*this.vertSize);a.bufferSubData(a.ARRAY_BUFFER,0,c)}a.drawElements(a.TRIANGLES,6*this.currentBatchSize,a.UNSIGNED_SHORT,0),this.currentBatchSize=0,this.renderSession.drawCount++}},b.WebGLFastSpriteBatch.prototype.stop=function(){this.flush()},b.WebGLFastSpriteBatch.prototype.start=function(){var a=this.gl;a.activeTexture(a.TEXTURE0),a.bindBuffer(a.ARRAY_BUFFER,this.vertexBuffer),a.bindBuffer(a.ELEMENT_ARRAY_BUFFER,this.indexBuffer);var b=this.renderSession.projection;a.uniform2f(this.shader.projectionVector,b.x,b.y),a.uniformMatrix3fv(this.shader.uMatrix,!1,this.matrix);var c=4*this.vertSize;a.vertexAttribPointer(this.shader.aVertexPosition,2,a.FLOAT,!1,c,0),a.vertexAttribPointer(this.shader.aPositionCoord,2,a.FLOAT,!1,c,8),a.vertexAttribPointer(this.shader.aScale,2,a.FLOAT,!1,c,16),a.vertexAttribPointer(this.shader.aRotation,1,a.FLOAT,!1,c,24),a.vertexAttribPointer(this.shader.aTextureCoord,2,a.FLOAT,!1,c,28),a.vertexAttribPointer(this.shader.colorAttribute,1,a.FLOAT,!1,c,36)},b.WebGLFilterManager=function(a,b){this.transparent=b,this.filterStack=[],this.offsetX=0,this.offsetY=0,this.setContext(a)},b.WebGLFilterManager.prototype.setContext=function(a){this.gl=a,this.texturePool=[],this.initShaderBuffers()},b.WebGLFilterManager.prototype.begin=function(a,b){this.renderSession=a,this.defaultShader=a.shaderManager.defaultShader;var c=this.renderSession.projection;this.width=2*c.x,this.height=2*-c.y,this.buffer=b},b.WebGLFilterManager.prototype.pushFilter=function(a){var c=this.gl,d=this.renderSession.projection,e=this.renderSession.offset;a._filterArea=a.target.filterArea||a.target.getBounds(),this.filterStack.push(a);var f=a.filterPasses[0];this.offsetX+=a._filterArea.x,this.offsetY+=a._filterArea.y;var g=this.texturePool.pop();g?g.resize(this.width,this.height):g=new b.FilterTexture(this.gl,this.width,this.height),c.bindTexture(c.TEXTURE_2D,g.texture);var h=a._filterArea,i=f.padding;h.x-=i,h.y-=i,h.width+=2*i,h.height+=2*i,h.x<0&&(h.x=0),h.width>this.width&&(h.width=this.width),h.y<0&&(h.y=0),h.height>this.height&&(h.height=this.height),c.bindFramebuffer(c.FRAMEBUFFER,g.frameBuffer),c.viewport(0,0,h.width,h.height),d.x=h.width/2,d.y=-h.height/2,e.x=-h.x,e.y=-h.y,this.renderSession.shaderManager.setShader(this.defaultShader),c.uniform2f(this.defaultShader.projectionVector,h.width/2,-h.height/2),c.uniform2f(this.defaultShader.offsetVector,-h.x,-h.y),c.colorMask(!0,!0,!0,!0),c.clearColor(0,0,0,0),c.clear(c.COLOR_BUFFER_BIT),a._glFilterTexture=g},b.WebGLFilterManager.prototype.popFilter=function(){var a=this.gl,c=this.filterStack.pop(),d=c._filterArea,e=c._glFilterTexture,f=this.renderSession.projection,g=this.renderSession.offset;if(c.filterPasses.length>1){a.viewport(0,0,d.width,d.height),a.bindBuffer(a.ARRAY_BUFFER,this.vertexBuffer),this.vertexArray[0]=0,this.vertexArray[1]=d.height,this.vertexArray[2]=d.width,this.vertexArray[3]=d.height,this.vertexArray[4]=0,this.vertexArray[5]=0,this.vertexArray[6]=d.width,this.vertexArray[7]=0,a.bufferSubData(a.ARRAY_BUFFER,0,this.vertexArray),a.bindBuffer(a.ARRAY_BUFFER,this.uvBuffer),this.uvArray[2]=d.width/this.width,this.uvArray[5]=d.height/this.height,this.uvArray[6]=d.width/this.width,this.uvArray[7]=d.height/this.height,a.bufferSubData(a.ARRAY_BUFFER,0,this.uvArray);var h=e,i=this.texturePool.pop();i||(i=new b.FilterTexture(this.gl,this.width,this.height)),i.resize(this.width,this.height),a.bindFramebuffer(a.FRAMEBUFFER,i.frameBuffer),a.clear(a.COLOR_BUFFER_BIT),a.disable(a.BLEND);for(var j=0;j<c.filterPasses.length-1;j++){var k=c.filterPasses[j];a.bindFramebuffer(a.FRAMEBUFFER,i.frameBuffer),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,h.texture),this.applyFilterPass(k,d,d.width,d.height);var l=h;h=i,i=l}a.enable(a.BLEND),e=h,this.texturePool.push(i)}var m=c.filterPasses[c.filterPasses.length-1];this.offsetX-=d.x,this.offsetY-=d.y;var n=this.width,o=this.height,p=0,q=0,r=this.buffer;if(0===this.filterStack.length)a.colorMask(!0,!0,!0,!0);else{var s=this.filterStack[this.filterStack.length-1];d=s._filterArea,n=d.width,o=d.height,p=d.x,q=d.y,r=s._glFilterTexture.frameBuffer}f.x=n/2,f.y=-o/2,g.x=p,g.y=q,d=c._filterArea;var t=d.x-p,u=d.y-q;a.bindBuffer(a.ARRAY_BUFFER,this.vertexBuffer),this.vertexArray[0]=t,this.vertexArray[1]=u+d.height,this.vertexArray[2]=t+d.width,this.vertexArray[3]=u+d.height,this.vertexArray[4]=t,this.vertexArray[5]=u,this.vertexArray[6]=t+d.width,this.vertexArray[7]=u,a.bufferSubData(a.ARRAY_BUFFER,0,this.vertexArray),a.bindBuffer(a.ARRAY_BUFFER,this.uvBuffer),this.uvArray[2]=d.width/this.width,this.uvArray[5]=d.height/this.height,this.uvArray[6]=d.width/this.width,this.uvArray[7]=d.height/this.height,a.bufferSubData(a.ARRAY_BUFFER,0,this.uvArray),a.viewport(0,0,n,o),a.bindFramebuffer(a.FRAMEBUFFER,r),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,e.texture),this.applyFilterPass(m,d,n,o),this.renderSession.shaderManager.setShader(this.defaultShader),a.uniform2f(this.defaultShader.projectionVector,n/2,-o/2),a.uniform2f(this.defaultShader.offsetVector,-p,-q),this.texturePool.push(e),c._glFilterTexture=null},b.WebGLFilterManager.prototype.applyFilterPass=function(a,c,d,e){var f=this.gl,g=a.shaders[f.id];g||(g=new b.PixiShader(f),g.fragmentSrc=a.fragmentSrc,g.uniforms=a.uniforms,g.init(),a.shaders[f.id]=g),this.renderSession.shaderManager.setShader(g),f.uniform2f(g.projectionVector,d/2,-e/2),f.uniform2f(g.offsetVector,0,0),a.uniforms.dimensions&&(a.uniforms.dimensions.value[0]=this.width,a.uniforms.dimensions.value[1]=this.height,a.uniforms.dimensions.value[2]=this.vertexArray[0],a.uniforms.dimensions.value[3]=this.vertexArray[5]),g.syncUniforms(),f.bindBuffer(f.ARRAY_BUFFER,this.vertexBuffer),f.vertexAttribPointer(g.aVertexPosition,2,f.FLOAT,!1,0,0),f.bindBuffer(f.ARRAY_BUFFER,this.uvBuffer),f.vertexAttribPointer(g.aTextureCoord,2,f.FLOAT,!1,0,0),f.bindBuffer(f.ARRAY_BUFFER,this.colorBuffer),f.vertexAttribPointer(g.colorAttribute,2,f.FLOAT,!1,0,0),f.bindBuffer(f.ELEMENT_ARRAY_BUFFER,this.indexBuffer),f.drawElements(f.TRIANGLES,6,f.UNSIGNED_SHORT,0),this.renderSession.drawCount++},b.WebGLFilterManager.prototype.initShaderBuffers=function(){var a=this.gl;this.vertexBuffer=a.createBuffer(),this.uvBuffer=a.createBuffer(),this.colorBuffer=a.createBuffer(),this.indexBuffer=a.createBuffer(),this.vertexArray=new Float32Array([0,0,1,0,0,1,1,1]),a.bindBuffer(a.ARRAY_BUFFER,this.vertexBuffer),a.bufferData(a.ARRAY_BUFFER,this.vertexArray,a.STATIC_DRAW),this.uvArray=new Float32Array([0,0,1,0,0,1,1,1]),a.bindBuffer(a.ARRAY_BUFFER,this.uvBuffer),a.bufferData(a.ARRAY_BUFFER,this.uvArray,a.STATIC_DRAW),this.colorArray=new Float32Array([1,16777215,1,16777215,1,16777215,1,16777215]),a.bindBuffer(a.ARRAY_BUFFER,this.colorBuffer),a.bufferData(a.ARRAY_BUFFER,this.colorArray,a.STATIC_DRAW),a.bindBuffer(a.ELEMENT_ARRAY_BUFFER,this.indexBuffer),a.bufferData(a.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,1,3,2]),a.STATIC_DRAW)},b.WebGLFilterManager.prototype.destroy=function(){var a=this.gl;this.filterStack=null,this.offsetX=0,this.offsetY=0;for(var b=0;b<this.texturePool.length;b++)this.texturePool[b].destroy();this.texturePool=null,a.deleteBuffer(this.vertexBuffer),a.deleteBuffer(this.uvBuffer),a.deleteBuffer(this.colorBuffer),a.deleteBuffer(this.indexBuffer)},b.FilterTexture=function(a,c,d,e){this.gl=a,this.frameBuffer=a.createFramebuffer(),this.texture=a.createTexture(),e=e||b.scaleModes.DEFAULT,a.bindTexture(a.TEXTURE_2D,this.texture),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,e===b.scaleModes.LINEAR?a.LINEAR:a.NEAREST),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,e===b.scaleModes.LINEAR?a.LINEAR:a.NEAREST),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE),a.bindFramebuffer(a.FRAMEBUFFER,this.framebuffer),a.bindFramebuffer(a.FRAMEBUFFER,this.frameBuffer),a.framebufferTexture2D(a.FRAMEBUFFER,a.COLOR_ATTACHMENT0,a.TEXTURE_2D,this.texture,0),this.renderBuffer=a.createRenderbuffer(),a.bindRenderbuffer(a.RENDERBUFFER,this.renderBuffer),a.framebufferRenderbuffer(a.FRAMEBUFFER,a.DEPTH_STENCIL_ATTACHMENT,a.RENDERBUFFER,this.renderBuffer),this.resize(c,d)},b.FilterTexture.prototype.clear=function(){var a=this.gl;a.clearColor(0,0,0,0),a.clear(a.COLOR_BUFFER_BIT)},b.FilterTexture.prototype.resize=function(a,b){if(this.width!==a||this.height!==b){this.width=a,this.height=b;var c=this.gl;c.bindTexture(c.TEXTURE_2D,this.texture),c.texImage2D(c.TEXTURE_2D,0,c.RGBA,a,b,0,c.RGBA,c.UNSIGNED_BYTE,null),c.bindRenderbuffer(c.RENDERBUFFER,this.renderBuffer),c.renderbufferStorage(c.RENDERBUFFER,c.DEPTH_STENCIL,a,b)}},b.FilterTexture.prototype.destroy=function(){var a=this.gl;a.deleteFramebuffer(this.frameBuffer),a.deleteTexture(this.texture),this.frameBuffer=null,this.texture=null},b.CanvasMaskManager=function(){},b.CanvasMaskManager.prototype.pushMask=function(a,c){c.save();var d=a.alpha,e=a.worldTransform;c.setTransform(e.a,e.c,e.b,e.d,e.tx,e.ty),b.CanvasGraphics.renderGraphicsMask(a,c),c.clip(),a.worldAlpha=d},b.CanvasMaskManager.prototype.popMask=function(a){a.restore()},b.CanvasTinter=function(){},b.CanvasTinter.getTintedTexture=function(a,c){var d=a.texture;c=b.CanvasTinter.roundColor(c);var e="#"+("00000"+(0|c).toString(16)).substr(-6);if(d.tintCache=d.tintCache||{},d.tintCache[e])return d.tintCache[e];var f=b.CanvasTinter.canvas||document.createElement("canvas");if(b.CanvasTinter.tintMethod(d,c,f),b.CanvasTinter.convertTintToImage){var g=new Image;g.src=f.toDataURL(),d.tintCache[e]=g}else d.tintCache[e]=f,b.CanvasTinter.canvas=null;return f},b.CanvasTinter.tintWithMultiply=function(a,b,c){var d=c.getContext("2d"),e=a.frame;c.width=e.width,c.height=e.height,d.fillStyle="#"+("00000"+(0|b).toString(16)).substr(-6),d.fillRect(0,0,e.width,e.height),d.globalCompositeOperation="multiply",d.drawImage(a.baseTexture.source,e.x,e.y,e.width,e.height,0,0,e.width,e.height),d.globalCompositeOperation="destination-atop",d.drawImage(a.baseTexture.source,e.x,e.y,e.width,e.height,0,0,e.width,e.height)},b.CanvasTinter.tintWithOverlay=function(a,b,c){var d=c.getContext("2d"),e=a.frame;c.width=e.width,c.height=e.height,d.globalCompositeOperation="copy",d.fillStyle="#"+("00000"+(0|b).toString(16)).substr(-6),d.fillRect(0,0,e.width,e.height),d.globalCompositeOperation="destination-atop",d.drawImage(a.baseTexture.source,e.x,e.y,e.width,e.height,0,0,e.width,e.height)},b.CanvasTinter.tintWithPerPixel=function(a,c,d){var e=d.getContext("2d"),f=a.frame;d.width=f.width,d.height=f.height,e.globalCompositeOperation="copy",e.drawImage(a.baseTexture.source,f.x,f.y,f.width,f.height,0,0,f.width,f.height);for(var g=b.hex2rgb(c),h=g[0],i=g[1],j=g[2],k=e.getImageData(0,0,f.width,f.height),l=k.data,m=0;m<l.length;m+=4)l[m+0]*=h,l[m+1]*=i,l[m+2]*=j;e.putImageData(k,0,0)},b.CanvasTinter.roundColor=function(a){var c=b.CanvasTinter.cacheStepsPerColorChannel,d=b.hex2rgb(a);return d[0]=Math.min(255,d[0]/c*c),d[1]=Math.min(255,d[1]/c*c),d[2]=Math.min(255,d[2]/c*c),b.rgb2hex(d)},b.CanvasTinter.cacheStepsPerColorChannel=8,b.CanvasTinter.convertTintToImage=!1,b.CanvasTinter.canUseMultiply=b.canUseNewCanvasBlendModes(),b.CanvasTinter.tintMethod=b.CanvasTinter.canUseMultiply?b.CanvasTinter.tintWithMultiply:b.CanvasTinter.tintWithPerPixel,b.CanvasRenderer=function(a,c,d,e){b.defaultRenderer||(b.sayHello("Canvas"),b.defaultRenderer=this),this.type=b.CANVAS_RENDERER,this.clearBeforeRender=!0,this.transparent=!!e,b.blendModesCanvas||(b.blendModesCanvas=[],b.canUseNewCanvasBlendModes()?(b.blendModesCanvas[b.blendModes.NORMAL]="source-over",b.blendModesCanvas[b.blendModes.ADD]="lighter",b.blendModesCanvas[b.blendModes.MULTIPLY]="multiply",b.blendModesCanvas[b.blendModes.SCREEN]="screen",b.blendModesCanvas[b.blendModes.OVERLAY]="overlay",b.blendModesCanvas[b.blendModes.DARKEN]="darken",b.blendModesCanvas[b.blendModes.LIGHTEN]="lighten",b.blendModesCanvas[b.blendModes.COLOR_DODGE]="color-dodge",b.blendModesCanvas[b.blendModes.COLOR_BURN]="color-burn",b.blendModesCanvas[b.blendModes.HARD_LIGHT]="hard-light",b.blendModesCanvas[b.blendModes.SOFT_LIGHT]="soft-light",b.blendModesCanvas[b.blendModes.DIFFERENCE]="difference",b.blendModesCanvas[b.blendModes.EXCLUSION]="exclusion",b.blendModesCanvas[b.blendModes.HUE]="hue",b.blendModesCanvas[b.blendModes.SATURATION]="saturation",b.blendModesCanvas[b.blendModes.COLOR]="color",b.blendModesCanvas[b.blendModes.LUMINOSITY]="luminosity"):(b.blendModesCanvas[b.blendModes.NORMAL]="source-over",b.blendModesCanvas[b.blendModes.ADD]="lighter",b.blendModesCanvas[b.blendModes.MULTIPLY]="source-over",b.blendModesCanvas[b.blendModes.SCREEN]="source-over",b.blendModesCanvas[b.blendModes.OVERLAY]="source-over",b.blendModesCanvas[b.blendModes.DARKEN]="source-over",b.blendModesCanvas[b.blendModes.LIGHTEN]="source-over",b.blendModesCanvas[b.blendModes.COLOR_DODGE]="source-over",b.blendModesCanvas[b.blendModes.COLOR_BURN]="source-over",b.blendModesCanvas[b.blendModes.HARD_LIGHT]="source-over",b.blendModesCanvas[b.blendModes.SOFT_LIGHT]="source-over",b.blendModesCanvas[b.blendModes.DIFFERENCE]="source-over",b.blendModesCanvas[b.blendModes.EXCLUSION]="source-over",b.blendModesCanvas[b.blendModes.HUE]="source-over",b.blendModesCanvas[b.blendModes.SATURATION]="source-over",b.blendModesCanvas[b.blendModes.COLOR]="source-over",b.blendModesCanvas[b.blendModes.LUMINOSITY]="source-over")),this.width=a||800,this.height=c||600,this.view=d||document.createElement("canvas"),this.context=this.view.getContext("2d",{alpha:this.transparent}),this.refresh=!0,this.view.width=this.width,this.view.height=this.height,this.count=0,this.maskManager=new b.CanvasMaskManager,this.renderSession={context:this.context,maskManager:this.maskManager,scaleMode:null,smoothProperty:null,roundPixels:!1},"imageSmoothingEnabled"in this.context?this.renderSession.smoothProperty="imageSmoothingEnabled":"webkitImageSmoothingEnabled"in this.context?this.renderSession.smoothProperty="webkitImageSmoothingEnabled":"mozImageSmoothingEnabled"in this.context?this.renderSession.smoothProperty="mozImageSmoothingEnabled":"oImageSmoothingEnabled"in this.context&&(this.renderSession.smoothProperty="oImageSmoothingEnabled")},b.CanvasRenderer.prototype.constructor=b.CanvasRenderer,b.CanvasRenderer.prototype.render=function(a){b.texturesToUpdate.length=0,b.texturesToDestroy.length=0,a.updateTransform(),this.context.setTransform(1,0,0,1,0,0),this.context.globalAlpha=1,navigator.isCocoonJS&&this.view.screencanvas&&(this.context.fillStyle="black",this.context.clear()),!this.transparent&&this.clearBeforeRender?(this.context.fillStyle=a.backgroundColorString,this.context.fillRect(0,0,this.width,this.height)):this.transparent&&this.clearBeforeRender&&this.context.clearRect(0,0,this.width,this.height),this.renderDisplayObject(a),a.interactive&&(a._interactiveEventsAdded||(a._interactiveEventsAdded=!0,a.interactionManager.setTarget(this))),b.Texture.frameUpdates.length>0&&(b.Texture.frameUpdates.length=0)
},b.CanvasRenderer.prototype.resize=function(a,b){this.width=a,this.height=b,this.view.width=a,this.view.height=b},b.CanvasRenderer.prototype.renderDisplayObject=function(a,b){this.renderSession.context=b||this.context,a._renderCanvas(this.renderSession)},b.CanvasRenderer.prototype.renderStripFlat=function(a){var b=this.context,c=a.verticies,d=c.length/2;this.count++,b.beginPath();for(var e=1;d-2>e;e++){var f=2*e,g=c[f],h=c[f+2],i=c[f+4],j=c[f+1],k=c[f+3],l=c[f+5];b.moveTo(g,j),b.lineTo(h,k),b.lineTo(i,l)}b.fillStyle="#FF0000",b.fill(),b.closePath()},b.CanvasRenderer.prototype.renderStrip=function(a){var b=this.context,c=a.verticies,d=a.uvs,e=c.length/2;this.count++;for(var f=1;e-2>f;f++){var g=2*f,h=c[g],i=c[g+2],j=c[g+4],k=c[g+1],l=c[g+3],m=c[g+5],n=d[g]*a.texture.width,o=d[g+2]*a.texture.width,p=d[g+4]*a.texture.width,q=d[g+1]*a.texture.height,r=d[g+3]*a.texture.height,s=d[g+5]*a.texture.height;b.save(),b.beginPath(),b.moveTo(h,k),b.lineTo(i,l),b.lineTo(j,m),b.closePath(),b.clip();var t=n*r+q*p+o*s-r*p-q*o-n*s,u=h*r+q*j+i*s-r*j-q*i-h*s,v=n*i+h*p+o*j-i*p-h*o-n*j,w=n*r*j+q*i*p+h*o*s-h*r*p-q*o*j-n*i*s,x=k*r+q*m+l*s-r*m-q*l-k*s,y=n*l+k*p+o*m-l*p-k*o-n*m,z=n*r*m+q*l*p+k*o*s-k*r*p-q*o*m-n*l*s;b.transform(u/t,x/t,v/t,y/t,w/t,z/t),b.drawImage(a.texture.baseTexture.source,0,0),b.restore()}},b.CanvasBuffer=function(a,b){this.width=a,this.height=b,this.canvas=document.createElement("canvas"),this.context=this.canvas.getContext("2d"),this.canvas.width=a,this.canvas.height=b},b.CanvasBuffer.prototype.clear=function(){this.context.clearRect(0,0,this.width,this.height)},b.CanvasBuffer.prototype.resize=function(a,b){this.width=this.canvas.width=a,this.height=this.canvas.height=b},b.CanvasGraphics=function(){},b.CanvasGraphics.renderGraphics=function(a,c){for(var d=a.worldAlpha,e="",f=0;f<a.graphicsData.length;f++){var g=a.graphicsData[f],h=g.points;if(c.strokeStyle=e="#"+("00000"+(0|g.lineColor).toString(16)).substr(-6),c.lineWidth=g.lineWidth,g.type===b.Graphics.POLY){c.beginPath(),c.moveTo(h[0],h[1]);for(var i=1;i<h.length/2;i++)c.lineTo(h[2*i],h[2*i+1]);h[0]===h[h.length-2]&&h[1]===h[h.length-1]&&c.closePath(),g.fill&&(c.globalAlpha=g.fillAlpha*d,c.fillStyle=e="#"+("00000"+(0|g.fillColor).toString(16)).substr(-6),c.fill()),g.lineWidth&&(c.globalAlpha=g.lineAlpha*d,c.stroke())}else if(g.type===b.Graphics.RECT)(g.fillColor||0===g.fillColor)&&(c.globalAlpha=g.fillAlpha*d,c.fillStyle=e="#"+("00000"+(0|g.fillColor).toString(16)).substr(-6),c.fillRect(h[0],h[1],h[2],h[3])),g.lineWidth&&(c.globalAlpha=g.lineAlpha*d,c.strokeRect(h[0],h[1],h[2],h[3]));else if(g.type===b.Graphics.CIRC)c.beginPath(),c.arc(h[0],h[1],h[2],0,2*Math.PI),c.closePath(),g.fill&&(c.globalAlpha=g.fillAlpha*d,c.fillStyle=e="#"+("00000"+(0|g.fillColor).toString(16)).substr(-6),c.fill()),g.lineWidth&&(c.globalAlpha=g.lineAlpha*d,c.stroke());else if(g.type===b.Graphics.ELIP){var j=g.points,k=2*j[2],l=2*j[3],m=j[0]-k/2,n=j[1]-l/2;c.beginPath();var o=.5522848,p=k/2*o,q=l/2*o,r=m+k,s=n+l,t=m+k/2,u=n+l/2;c.moveTo(m,u),c.bezierCurveTo(m,u-q,t-p,n,t,n),c.bezierCurveTo(t+p,n,r,u-q,r,u),c.bezierCurveTo(r,u+q,t+p,s,t,s),c.bezierCurveTo(t-p,s,m,u+q,m,u),c.closePath(),g.fill&&(c.globalAlpha=g.fillAlpha*d,c.fillStyle=e="#"+("00000"+(0|g.fillColor).toString(16)).substr(-6),c.fill()),g.lineWidth&&(c.globalAlpha=g.lineAlpha*d,c.stroke())}else if(g.type===b.Graphics.RREC){var v=h[0],w=h[1],x=h[2],y=h[3],z=h[4],A=Math.min(x,y)/2|0;z=z>A?A:z,c.beginPath(),c.moveTo(v,w+z),c.lineTo(v,w+y-z),c.quadraticCurveTo(v,w+y,v+z,w+y),c.lineTo(v+x-z,w+y),c.quadraticCurveTo(v+x,w+y,v+x,w+y-z),c.lineTo(v+x,w+z),c.quadraticCurveTo(v+x,w,v+x-z,w),c.lineTo(v+z,w),c.quadraticCurveTo(v,w,v,w+z),c.closePath(),(g.fillColor||0===g.fillColor)&&(c.globalAlpha=g.fillAlpha*d,c.fillStyle=e="#"+("00000"+(0|g.fillColor).toString(16)).substr(-6),c.fill()),g.lineWidth&&(c.globalAlpha=g.lineAlpha*d,c.stroke())}}},b.CanvasGraphics.renderGraphicsMask=function(a,c){var d=a.graphicsData.length;if(0!==d){d>1&&(d=1,window.console.log("Pixi.js warning: masks in canvas can only mask using the first path in the graphics object"));for(var e=0;1>e;e++){var f=a.graphicsData[e],g=f.points;if(f.type===b.Graphics.POLY){c.beginPath(),c.moveTo(g[0],g[1]);for(var h=1;h<g.length/2;h++)c.lineTo(g[2*h],g[2*h+1]);g[0]===g[g.length-2]&&g[1]===g[g.length-1]&&c.closePath()}else if(f.type===b.Graphics.RECT)c.beginPath(),c.rect(g[0],g[1],g[2],g[3]),c.closePath();else if(f.type===b.Graphics.CIRC)c.beginPath(),c.arc(g[0],g[1],g[2],0,2*Math.PI),c.closePath();else if(f.type===b.Graphics.ELIP){var i=f.points,j=2*i[2],k=2*i[3],l=i[0]-j/2,m=i[1]-k/2;c.beginPath();var n=.5522848,o=j/2*n,p=k/2*n,q=l+j,r=m+k,s=l+j/2,t=m+k/2;c.moveTo(l,t),c.bezierCurveTo(l,t-p,s-o,m,s,m),c.bezierCurveTo(s+o,m,q,t-p,q,t),c.bezierCurveTo(q,t+p,s+o,r,s,r),c.bezierCurveTo(s-o,r,l,t+p,l,t),c.closePath()}else if(f.type===b.Graphics.RREC){var u=g[0],v=g[1],w=g[2],x=g[3],y=g[4],z=Math.min(w,x)/2|0;y=y>z?z:y,c.beginPath(),c.moveTo(u,v+y),c.lineTo(u,v+x-y),c.quadraticCurveTo(u,v+x,u+y,v+x),c.lineTo(u+w-y,v+x),c.quadraticCurveTo(u+w,v+x,u+w,v+x-y),c.lineTo(u+w,v+y),c.quadraticCurveTo(u+w,v,u+w-y,v),c.lineTo(u+y,v),c.quadraticCurveTo(u,v,u,v+y),c.closePath()}}}},b.Graphics=function(){b.DisplayObjectContainer.call(this),this.renderable=!0,this.fillAlpha=1,this.lineWidth=0,this.lineColor="black",this.graphicsData=[],this.tint=16777215,this.blendMode=b.blendModes.NORMAL,this.currentPath={points:[]},this._webGL=[],this.isMask=!1,this.bounds=null,this.boundsPadding=10,this.dirty=!0},b.Graphics.prototype=Object.create(b.DisplayObjectContainer.prototype),b.Graphics.prototype.constructor=b.Graphics,Object.defineProperty(b.Graphics.prototype,"cacheAsBitmap",{get:function(){return this._cacheAsBitmap},set:function(a){this._cacheAsBitmap=a,this._cacheAsBitmap?this._generateCachedSprite():(this.destroyCachedSprite(),this.dirty=!0)}}),b.Graphics.prototype.lineStyle=function(a,c,d){return this.currentPath.points.length||this.graphicsData.pop(),this.lineWidth=a||0,this.lineColor=c||0,this.lineAlpha=arguments.length<3?1:d,this.currentPath={lineWidth:this.lineWidth,lineColor:this.lineColor,lineAlpha:this.lineAlpha,fillColor:this.fillColor,fillAlpha:this.fillAlpha,fill:this.filling,points:[],type:b.Graphics.POLY},this.graphicsData.push(this.currentPath),this},b.Graphics.prototype.moveTo=function(a,c){return this.currentPath.points.length||this.graphicsData.pop(),this.currentPath=this.currentPath={lineWidth:this.lineWidth,lineColor:this.lineColor,lineAlpha:this.lineAlpha,fillColor:this.fillColor,fillAlpha:this.fillAlpha,fill:this.filling,points:[],type:b.Graphics.POLY},this.currentPath.points.push(a,c),this.graphicsData.push(this.currentPath),this},b.Graphics.prototype.lineTo=function(a,b){return this.currentPath.points.push(a,b),this.dirty=!0,this},b.Graphics.prototype.quadraticCurveTo=function(a,b,c,d){0===this.currentPath.points.length&&this.moveTo(0,0);var e,f,g=20,h=this.currentPath.points;0===h.length&&this.moveTo(0,0);for(var i=h[h.length-2],j=h[h.length-1],k=0,l=1;g>=l;l++)k=l/g,e=i+(a-i)*k,f=j+(b-j)*k,h.push(e+(a+(c-a)*k-e)*k,f+(b+(d-b)*k-f)*k);return this.dirty=!0,this},b.Graphics.prototype.bezierCurveTo=function(a,b,c,d,e,f){0===this.currentPath.points.length&&this.moveTo(0,0);for(var g,h,i,j,k,l=20,m=this.currentPath.points,n=m[m.length-2],o=m[m.length-1],p=0,q=1;l>q;q++)p=q/l,g=1-p,h=g*g,i=h*g,j=p*p,k=j*p,m.push(i*n+3*h*p*a+3*g*j*c+k*e,i*o+3*h*p*b+3*g*j*d+k*f);return this.dirty=!0,this},b.Graphics.prototype.arcTo=function(a,b,c,d,e){0===this.currentPath.points.length&&this.moveTo(a,b);var f=this.currentPath.points,g=f[f.length-2],h=f[f.length-1],i=h-b,j=g-a,k=d-b,l=c-a,m=Math.abs(i*l-j*k);if(1e-8>m||0===e)f.push(a,b);else{var n=i*i+j*j,o=k*k+l*l,p=i*k+j*l,q=e*Math.sqrt(n)/m,r=e*Math.sqrt(o)/m,s=q*p/n,t=r*p/o,u=q*l+r*j,v=q*k+r*i,w=j*(r+s),x=i*(r+s),y=l*(q+t),z=k*(q+t),A=Math.atan2(x-v,w-u),B=Math.atan2(z-v,y-u);this.arc(u+a,v+b,e,A,B,j*k>l*i)}return this.dirty=!0,this},b.Graphics.prototype.arc=function(a,b,c,d,e,f){var g=a+Math.cos(d)*c,h=b+Math.sin(d)*c,i=this.currentPath.points;if((0!==i.length&&i[i.length-2]!==g||i[i.length-1]!==h)&&(this.moveTo(g,h),i=this.currentPath.points),d===e)return this;!f&&d>=e?e+=2*Math.PI:f&&e>=d&&(d+=2*Math.PI);var j=f?-1*(d-e):e-d,k=Math.abs(j)/(2*Math.PI)*40;if(0===j)return this;for(var l=j/(2*k),m=2*l,n=Math.cos(l),o=Math.sin(l),p=k-1,q=p%1/p,r=0;p>=r;r++){var s=r+q*r,t=l+d+m*s,u=Math.cos(t),v=-Math.sin(t);i.push((n*u+o*v)*c+a,(n*-v+o*u)*c+b)}return this.dirty=!0,this},b.Graphics.prototype.drawPath=function(a){return this.currentPath.points.length||this.graphicsData.pop(),this.currentPath=this.currentPath={lineWidth:this.lineWidth,lineColor:this.lineColor,lineAlpha:this.lineAlpha,fillColor:this.fillColor,fillAlpha:this.fillAlpha,fill:this.filling,points:[],type:b.Graphics.POLY},this.graphicsData.push(this.currentPath),this.currentPath.points=this.currentPath.points.concat(a),this.dirty=!0,this},b.Graphics.prototype.beginFill=function(a,b){return this.filling=!0,this.fillColor=a||0,this.fillAlpha=arguments.length<2?1:b,this},b.Graphics.prototype.endFill=function(){return this.filling=!1,this.fillColor=null,this.fillAlpha=1,this},b.Graphics.prototype.drawRect=function(a,c,d,e){return this.currentPath.points.length||this.graphicsData.pop(),this.currentPath={lineWidth:this.lineWidth,lineColor:this.lineColor,lineAlpha:this.lineAlpha,fillColor:this.fillColor,fillAlpha:this.fillAlpha,fill:this.filling,points:[a,c,d,e],type:b.Graphics.RECT},this.graphicsData.push(this.currentPath),this.dirty=!0,this},b.Graphics.prototype.drawRoundedRect=function(a,c,d,e,f){return this.currentPath.points.length||this.graphicsData.pop(),this.currentPath={lineWidth:this.lineWidth,lineColor:this.lineColor,lineAlpha:this.lineAlpha,fillColor:this.fillColor,fillAlpha:this.fillAlpha,fill:this.filling,points:[a,c,d,e,f],type:b.Graphics.RREC},this.graphicsData.push(this.currentPath),this.dirty=!0,this},b.Graphics.prototype.drawCircle=function(a,c,d){return this.currentPath.points.length||this.graphicsData.pop(),this.currentPath={lineWidth:this.lineWidth,lineColor:this.lineColor,lineAlpha:this.lineAlpha,fillColor:this.fillColor,fillAlpha:this.fillAlpha,fill:this.filling,points:[a,c,d,d],type:b.Graphics.CIRC},this.graphicsData.push(this.currentPath),this.dirty=!0,this},b.Graphics.prototype.drawEllipse=function(a,c,d,e){return this.currentPath.points.length||this.graphicsData.pop(),this.currentPath={lineWidth:this.lineWidth,lineColor:this.lineColor,lineAlpha:this.lineAlpha,fillColor:this.fillColor,fillAlpha:this.fillAlpha,fill:this.filling,points:[a,c,d,e],type:b.Graphics.ELIP},this.graphicsData.push(this.currentPath),this.dirty=!0,this},b.Graphics.prototype.clear=function(){return this.lineWidth=0,this.filling=!1,this.dirty=!0,this.clearDirty=!0,this.graphicsData=[],this.bounds=null,this},b.Graphics.prototype.generateTexture=function(){var a=this.getBounds(),c=new b.CanvasBuffer(a.width,a.height),d=b.Texture.fromCanvas(c.canvas);return c.context.translate(-a.x,-a.y),b.CanvasGraphics.renderGraphics(this,c.context),d},b.Graphics.prototype._renderWebGL=function(a){if(this.visible!==!1&&0!==this.alpha&&this.isMask!==!0){if(this._cacheAsBitmap)return this.dirty&&(this._generateCachedSprite(),b.updateWebGLTexture(this._cachedSprite.texture.baseTexture,a.gl),this.dirty=!1),this._cachedSprite.alpha=this.alpha,b.Sprite.prototype._renderWebGL.call(this._cachedSprite,a),void 0;if(a.spriteBatch.stop(),a.blendModeManager.setBlendMode(this.blendMode),this._mask&&a.maskManager.pushMask(this._mask,a),this._filters&&a.filterManager.pushFilter(this._filterBlock),this.blendMode!==a.spriteBatch.currentBlendMode){a.spriteBatch.currentBlendMode=this.blendMode;var c=b.blendModesWebGL[a.spriteBatch.currentBlendMode];a.spriteBatch.gl.blendFunc(c[0],c[1])}if(b.WebGLGraphics.renderGraphics(this,a),this.children.length){a.spriteBatch.start();for(var d=0,e=this.children.length;e>d;d++)this.children[d]._renderWebGL(a);a.spriteBatch.stop()}this._filters&&a.filterManager.popFilter(),this._mask&&a.maskManager.popMask(this.mask,a),a.drawCount++,a.spriteBatch.start()}},b.Graphics.prototype._renderCanvas=function(a){if(this.visible!==!1&&0!==this.alpha&&this.isMask!==!0){var c=a.context,d=this.worldTransform;this.blendMode!==a.currentBlendMode&&(a.currentBlendMode=this.blendMode,c.globalCompositeOperation=b.blendModesCanvas[a.currentBlendMode]),this._mask&&a.maskManager.pushMask(this._mask,a.context),c.setTransform(d.a,d.c,d.b,d.d,d.tx,d.ty),b.CanvasGraphics.renderGraphics(this,c);for(var e=0,f=this.children.length;f>e;e++)this.children[e]._renderCanvas(a);this._mask&&a.maskManager.popMask(a.context)}},b.Graphics.prototype.getBounds=function(a){this.bounds||this.updateBounds();var b=this.bounds.x,c=this.bounds.width+this.bounds.x,d=this.bounds.y,e=this.bounds.height+this.bounds.y,f=a||this.worldTransform,g=f.a,h=f.c,i=f.b,j=f.d,k=f.tx,l=f.ty,m=g*c+i*e+k,n=j*e+h*c+l,o=g*b+i*e+k,p=j*e+h*b+l,q=g*b+i*d+k,r=j*d+h*b+l,s=g*c+i*d+k,t=j*d+h*c+l,u=m,v=n,w=m,x=n;w=w>o?o:w,w=w>q?q:w,w=w>s?s:w,x=x>p?p:x,x=x>r?r:x,x=x>t?t:x,u=o>u?o:u,u=q>u?q:u,u=s>u?s:u,v=p>v?p:v,v=r>v?r:v,v=t>v?t:v;var y=this._bounds;return y.x=w,y.width=u-w,y.y=x,y.height=v-x,y},b.Graphics.prototype.updateBounds=function(){for(var a,c,d,e,f,g=1/0,h=-1/0,i=1/0,j=-1/0,k=0;k<this.graphicsData.length;k++){var l=this.graphicsData[k],m=l.type,n=l.lineWidth;if(a=l.points,m===b.Graphics.RECT)c=a[0]-n/2,d=a[1]-n/2,e=a[2]+n,f=a[3]+n,g=g>c?c:g,h=c+e>h?c+e:h,i=i>d?c:i,j=d+f>j?d+f:j;else if(m===b.Graphics.CIRC||m===b.Graphics.ELIP)c=a[0],d=a[1],e=a[2]+n/2,f=a[3]+n/2,g=g>c-e?c-e:g,h=c+e>h?c+e:h,i=i>d-f?d-f:i,j=d+f>j?d+f:j;else for(var o=0;o<a.length;o+=2)c=a[o],d=a[o+1],g=g>c-n?c-n:g,h=c+n>h?c+n:h,i=i>d-n?d-n:i,j=d+n>j?d+n:j}var p=this.boundsPadding;this.bounds=new b.Rectangle(g-p,i-p,h-g+2*p,j-i+2*p)},b.Graphics.prototype._generateCachedSprite=function(){var a=this.getLocalBounds();if(this._cachedSprite)this._cachedSprite.buffer.resize(a.width,a.height);else{var c=new b.CanvasBuffer(a.width,a.height),d=b.Texture.fromCanvas(c.canvas);this._cachedSprite=new b.Sprite(d),this._cachedSprite.buffer=c,this._cachedSprite.worldTransform=this.worldTransform}this._cachedSprite.anchor.x=-(a.x/a.width),this._cachedSprite.anchor.y=-(a.y/a.height),this._cachedSprite.buffer.context.translate(-a.x,-a.y),b.CanvasGraphics.renderGraphics(this,this._cachedSprite.buffer.context),this._cachedSprite.alpha=this.alpha},b.Graphics.prototype.destroyCachedSprite=function(){this._cachedSprite.texture.destroy(!0),this._cachedSprite=null},b.Graphics.POLY=0,b.Graphics.RECT=1,b.Graphics.CIRC=2,b.Graphics.ELIP=3,b.Graphics.RREC=4,b.Strip=function(a){b.DisplayObjectContainer.call(this),this.texture=a,this.uvs=new b.Float32Array([0,1,1,1,1,0,0,1]),this.verticies=new b.Float32Array([0,0,100,0,100,100,0,100]),this.colors=new b.Float32Array([1,1,1,1]),this.indices=new b.Uint16Array([0,1,2,3]),this.dirty=!0},b.Strip.prototype=Object.create(b.DisplayObjectContainer.prototype),b.Strip.prototype.constructor=b.Strip,b.Strip.prototype._renderWebGL=function(a){!this.visible||this.alpha<=0||(a.spriteBatch.stop(),this._vertexBuffer||this._initWebGL(a),a.shaderManager.setShader(a.shaderManager.stripShader),this._renderStrip(a),a.spriteBatch.start())},b.Strip.prototype._initWebGL=function(a){var b=a.gl;this._vertexBuffer=b.createBuffer(),this._indexBuffer=b.createBuffer(),this._uvBuffer=b.createBuffer(),this._colorBuffer=b.createBuffer(),b.bindBuffer(b.ARRAY_BUFFER,this._vertexBuffer),b.bufferData(b.ARRAY_BUFFER,this.verticies,b.DYNAMIC_DRAW),b.bindBuffer(b.ARRAY_BUFFER,this._uvBuffer),b.bufferData(b.ARRAY_BUFFER,this.uvs,b.STATIC_DRAW),b.bindBuffer(b.ARRAY_BUFFER,this._colorBuffer),b.bufferData(b.ARRAY_BUFFER,this.colors,b.STATIC_DRAW),b.bindBuffer(b.ELEMENT_ARRAY_BUFFER,this._indexBuffer),b.bufferData(b.ELEMENT_ARRAY_BUFFER,this.indices,b.STATIC_DRAW)},b.Strip.prototype._renderStrip=function(a){var c=a.gl,d=a.projection,e=a.offset,f=a.shaderManager.stripShader;c.blendFunc(c.ONE,c.ONE_MINUS_SRC_ALPHA),c.uniformMatrix3fv(f.translationMatrix,!1,this.worldTransform.toArray(!0)),c.uniform2f(f.projectionVector,d.x,-d.y),c.uniform2f(f.offsetVector,-e.x,-e.y),c.uniform1f(f.alpha,1),this.dirty?(this.dirty=!1,c.bindBuffer(c.ARRAY_BUFFER,this._vertexBuffer),c.bufferData(c.ARRAY_BUFFER,this.verticies,c.STATIC_DRAW),c.vertexAttribPointer(f.aVertexPosition,2,c.FLOAT,!1,0,0),c.bindBuffer(c.ARRAY_BUFFER,this._uvBuffer),c.bufferData(c.ARRAY_BUFFER,this.uvs,c.STATIC_DRAW),c.vertexAttribPointer(f.aTextureCoord,2,c.FLOAT,!1,0,0),c.activeTexture(c.TEXTURE0),c.bindTexture(c.TEXTURE_2D,this.texture.baseTexture._glTextures[c.id]||b.createWebGLTexture(this.texture.baseTexture,c)),c.bindBuffer(c.ELEMENT_ARRAY_BUFFER,this._indexBuffer),c.bufferData(c.ELEMENT_ARRAY_BUFFER,this.indices,c.STATIC_DRAW)):(c.bindBuffer(c.ARRAY_BUFFER,this._vertexBuffer),c.bufferSubData(c.ARRAY_BUFFER,0,this.verticies),c.vertexAttribPointer(f.aVertexPosition,2,c.FLOAT,!1,0,0),c.bindBuffer(c.ARRAY_BUFFER,this._uvBuffer),c.vertexAttribPointer(f.aTextureCoord,2,c.FLOAT,!1,0,0),c.activeTexture(c.TEXTURE0),c.bindTexture(c.TEXTURE_2D,this.texture.baseTexture._glTextures[c.id]||b.createWebGLTexture(this.texture.baseTexture,c)),c.bindBuffer(c.ELEMENT_ARRAY_BUFFER,this._indexBuffer)),c.drawElements(c.TRIANGLE_STRIP,this.indices.length,c.UNSIGNED_SHORT,0)},b.Strip.prototype._renderCanvas=function(a){var b=a.context,c=this.worldTransform;a.roundPixels?b.setTransform(c.a,c.c,c.b,c.d,0|c.tx,0|c.ty):b.setTransform(c.a,c.c,c.b,c.d,c.tx,c.ty);var d=this,e=d.verticies,f=d.uvs,g=e.length/2;this.count++;for(var h=0;g-2>h;h++){var i=2*h,j=e[i],k=e[i+2],l=e[i+4],m=e[i+1],n=e[i+3],o=e[i+5],p=(j+k+l)/3,q=(m+n+o)/3,r=j-p,s=m-q,t=Math.sqrt(r*r+s*s);j=p+r/t*(t+3),m=q+s/t*(t+3),r=k-p,s=n-q,t=Math.sqrt(r*r+s*s),k=p+r/t*(t+3),n=q+s/t*(t+3),r=l-p,s=o-q,t=Math.sqrt(r*r+s*s),l=p+r/t*(t+3),o=q+s/t*(t+3);var u=f[i]*d.texture.width,v=f[i+2]*d.texture.width,w=f[i+4]*d.texture.width,x=f[i+1]*d.texture.height,y=f[i+3]*d.texture.height,z=f[i+5]*d.texture.height;b.save(),b.beginPath(),b.moveTo(j,m),b.lineTo(k,n),b.lineTo(l,o),b.closePath(),b.clip();var A=u*y+x*w+v*z-y*w-x*v-u*z,B=j*y+x*l+k*z-y*l-x*k-j*z,C=u*k+j*w+v*l-k*w-j*v-u*l,D=u*y*l+x*k*w+j*v*z-j*y*w-x*v*l-u*k*z,E=m*y+x*o+n*z-y*o-x*n-m*z,F=u*n+m*w+v*o-n*w-m*v-u*o,G=u*y*o+x*n*w+m*v*z-m*y*w-x*v*o-u*n*z;b.transform(B/A,E/A,C/A,F/A,D/A,G/A),b.drawImage(d.texture.baseTexture.source,0,0),b.restore()}},b.Strip.prototype.onTextureUpdate=function(){this.updateFrame=!0},b.Rope=function(a,c){b.Strip.call(this,a),this.points=c,this.verticies=new b.Float32Array(4*c.length),this.uvs=new b.Float32Array(4*c.length),this.colors=new b.Float32Array(2*c.length),this.indices=new b.Uint16Array(2*c.length),this.refresh()},b.Rope.prototype=Object.create(b.Strip.prototype),b.Rope.prototype.constructor=b.Rope,b.Rope.prototype.refresh=function(){var a=this.points;if(!(a.length<1)){var b=this.uvs,c=a[0],d=this.indices,e=this.colors;this.count-=.2,b[0]=0,b[1]=0,b[2]=0,b[3]=1,e[0]=1,e[1]=1,d[0]=0,d[1]=1;for(var f,g,h,i=a.length,j=1;i>j;j++)f=a[j],g=4*j,h=j/(i-1),j%2?(b[g]=h,b[g+1]=0,b[g+2]=h,b[g+3]=1):(b[g]=h,b[g+1]=0,b[g+2]=h,b[g+3]=1),g=2*j,e[g]=1,e[g+1]=1,g=2*j,d[g]=g,d[g+1]=g+1,c=f}},b.Rope.prototype.updateTransform=function(){var a=this.points;if(!(a.length<1)){var c,d=a[0],e={x:0,y:0};this.count-=.2;for(var f,g,h,i,j,k=this.verticies,l=a.length,m=0;l>m;m++)f=a[m],g=4*m,c=m<a.length-1?a[m+1]:f,e.y=-(c.x-d.x),e.x=c.y-d.y,h=10*(1-m/(l-1)),h>1&&(h=1),i=Math.sqrt(e.x*e.x+e.y*e.y),j=this.texture.height/2,e.x/=i,e.y/=i,e.x*=j,e.y*=j,k[g]=f.x+e.x,k[g+1]=f.y+e.y,k[g+2]=f.x-e.x,k[g+3]=f.y-e.y,d=f;b.DisplayObjectContainer.prototype.updateTransform.call(this)}},b.Rope.prototype.setTexture=function(a){this.texture=a},b.TilingSprite=function(a,c,d){b.Sprite.call(this,a),this._width=c||100,this._height=d||100,this.tileScale=new b.Point(1,1),this.tileScaleOffset=new b.Point(1,1),this.tilePosition=new b.Point(0,0),this.renderable=!0,this.tint=16777215,this.blendMode=b.blendModes.NORMAL},b.TilingSprite.prototype=Object.create(b.Sprite.prototype),b.TilingSprite.prototype.constructor=b.TilingSprite,Object.defineProperty(b.TilingSprite.prototype,"width",{get:function(){return this._width},set:function(a){this._width=a}}),Object.defineProperty(b.TilingSprite.prototype,"height",{get:function(){return this._height},set:function(a){this._height=a}}),b.TilingSprite.prototype.setTexture=function(a){this.texture!==a&&(this.texture=a,this.refreshTexture=!0,this.cachedTint=16777215)},b.TilingSprite.prototype._renderWebGL=function(a){if(this.visible!==!1&&0!==this.alpha){var c,d;for(this._mask&&(a.spriteBatch.stop(),a.maskManager.pushMask(this.mask,a),a.spriteBatch.start()),this._filters&&(a.spriteBatch.flush(),a.filterManager.pushFilter(this._filterBlock)),!this.tilingTexture||this.refreshTexture?(this.generateTilingTexture(!0),this.tilingTexture&&this.tilingTexture.needsUpdate&&(b.updateWebGLTexture(this.tilingTexture.baseTexture,a.gl),this.tilingTexture.needsUpdate=!1)):a.spriteBatch.renderTilingSprite(this),c=0,d=this.children.length;d>c;c++)this.children[c]._renderWebGL(a);a.spriteBatch.stop(),this._filters&&a.filterManager.popFilter(),this._mask&&a.maskManager.popMask(a),a.spriteBatch.start()}},b.TilingSprite.prototype._renderCanvas=function(a){if(this.visible!==!1&&0!==this.alpha){var c=a.context;this._mask&&a.maskManager.pushMask(this._mask,c),c.globalAlpha=this.worldAlpha;var d,e,f=this.worldTransform;if(c.setTransform(f.a,f.c,f.b,f.d,f.tx,f.ty),!this.__tilePattern||this.refreshTexture){if(this.generateTilingTexture(!1),!this.tilingTexture)return;this.__tilePattern=c.createPattern(this.tilingTexture.baseTexture.source,"repeat")}this.blendMode!==a.currentBlendMode&&(a.currentBlendMode=this.blendMode,c.globalCompositeOperation=b.blendModesCanvas[a.currentBlendMode]);var g=this.tilePosition,h=this.tileScale;for(g.x%=this.tilingTexture.baseTexture.width,g.y%=this.tilingTexture.baseTexture.height,c.scale(h.x,h.y),c.translate(g.x,g.y),c.fillStyle=this.__tilePattern,c.fillRect(-g.x+this.anchor.x*-this._width,-g.y+this.anchor.y*-this._height,this._width/h.x,this._height/h.y),c.scale(1/h.x,1/h.y),c.translate(-g.x,-g.y),this._mask&&a.maskManager.popMask(a.context),d=0,e=this.children.length;e>d;d++)this.children[d]._renderCanvas(a)}},b.TilingSprite.prototype.getBounds=function(){var a=this._width,b=this._height,c=a*(1-this.anchor.x),d=a*-this.anchor.x,e=b*(1-this.anchor.y),f=b*-this.anchor.y,g=this.worldTransform,h=g.a,i=g.c,j=g.b,k=g.d,l=g.tx,m=g.ty,n=h*d+j*f+l,o=k*f+i*d+m,p=h*c+j*f+l,q=k*f+i*c+m,r=h*c+j*e+l,s=k*e+i*c+m,t=h*d+j*e+l,u=k*e+i*d+m,v=-1/0,w=-1/0,x=1/0,y=1/0;x=x>n?n:x,x=x>p?p:x,x=x>r?r:x,x=x>t?t:x,y=y>o?o:y,y=y>q?q:y,y=y>s?s:y,y=y>u?u:y,v=n>v?n:v,v=p>v?p:v,v=r>v?r:v,v=t>v?t:v,w=o>w?o:w,w=q>w?q:w,w=s>w?s:w,w=u>w?u:w;var z=this._bounds;return z.x=x,z.width=v-x,z.y=y,z.height=w-y,this._currentBounds=z,z},b.TilingSprite.prototype.onTextureUpdate=function(){},b.TilingSprite.prototype.generateTilingTexture=function(a){if(this.texture.baseTexture.hasLoaded){var c,d,e=this.texture,f=e.frame,g=f.width!==e.baseTexture.width||f.height!==e.baseTexture.height,h=!1;if(a?(c=b.getNextPowerOfTwo(f.width),d=b.getNextPowerOfTwo(f.height),(f.width!==c||f.height!==d)&&(h=!0)):g&&(c=f.width,d=f.height,h=!0),h){var i;this.tilingTexture&&this.tilingTexture.isTiling?(i=this.tilingTexture.canvasBuffer,i.resize(c,d),this.tilingTexture.baseTexture.width=c,this.tilingTexture.baseTexture.height=d,this.tilingTexture.needsUpdate=!0):(i=new b.CanvasBuffer(c,d),this.tilingTexture=b.Texture.fromCanvas(i.canvas),this.tilingTexture.canvasBuffer=i,this.tilingTexture.isTiling=!0),i.context.drawImage(e.baseTexture.source,e.crop.x,e.crop.y,e.crop.width,e.crop.height,0,0,c,d),this.tileScaleOffset.x=f.width/c,this.tileScaleOffset.y=f.height/d}else this.tilingTexture&&this.tilingTexture.isTiling&&this.tilingTexture.destroy(!0),this.tileScaleOffset.x=1,this.tileScaleOffset.y=1,this.tilingTexture=e;this.refreshTexture=!1,this.tilingTexture.baseTexture._powerOf2=!0}};var f={};f.BoneData=function(a,b){this.name=a,this.parent=b},f.BoneData.prototype={length:0,x:0,y:0,rotation:0,scaleX:1,scaleY:1},f.SlotData=function(a,b){this.name=a,this.boneData=b},f.SlotData.prototype={r:1,g:1,b:1,a:1,attachmentName:null},f.Bone=function(a,b){this.data=a,this.parent=b,this.setToSetupPose()},f.Bone.yDown=!1,f.Bone.prototype={x:0,y:0,rotation:0,scaleX:1,scaleY:1,m00:0,m01:0,worldX:0,m10:0,m11:0,worldY:0,worldRotation:0,worldScaleX:1,worldScaleY:1,updateWorldTransform:function(a,b){var c=this.parent;null!=c?(this.worldX=this.x*c.m00+this.y*c.m01+c.worldX,this.worldY=this.x*c.m10+this.y*c.m11+c.worldY,this.worldScaleX=c.worldScaleX*this.scaleX,this.worldScaleY=c.worldScaleY*this.scaleY,this.worldRotation=c.worldRotation+this.rotation):(this.worldX=this.x,this.worldY=this.y,this.worldScaleX=this.scaleX,this.worldScaleY=this.scaleY,this.worldRotation=this.rotation);var d=this.worldRotation*Math.PI/180,e=Math.cos(d),g=Math.sin(d);this.m00=e*this.worldScaleX,this.m10=g*this.worldScaleX,this.m01=-g*this.worldScaleY,this.m11=e*this.worldScaleY,a&&(this.m00=-this.m00,this.m01=-this.m01),b&&(this.m10=-this.m10,this.m11=-this.m11),f.Bone.yDown&&(this.m10=-this.m10,this.m11=-this.m11)},setToSetupPose:function(){var a=this.data;this.x=a.x,this.y=a.y,this.rotation=a.rotation,this.scaleX=a.scaleX,this.scaleY=a.scaleY}},f.Slot=function(a,b,c){this.data=a,this.skeleton=b,this.bone=c,this.setToSetupPose()},f.Slot.prototype={r:1,g:1,b:1,a:1,_attachmentTime:0,attachment:null,setAttachment:function(a){this.attachment=a,this._attachmentTime=this.skeleton.time},setAttachmentTime:function(a){this._attachmentTime=this.skeleton.time-a},getAttachmentTime:function(){return this.skeleton.time-this._attachmentTime},setToSetupPose:function(){var a=this.data;this.r=a.r,this.g=a.g,this.b=a.b,this.a=a.a;for(var b=this.skeleton.data.slots,c=0,d=b.length;d>c;c++)if(b[c]==a){this.setAttachment(a.attachmentName?this.skeleton.getAttachmentBySlotIndex(c,a.attachmentName):null);break}}},f.Skin=function(a){this.name=a,this.attachments={}},f.Skin.prototype={addAttachment:function(a,b,c){this.attachments[a+":"+b]=c},getAttachment:function(a,b){return this.attachments[a+":"+b]},_attachAll:function(a,b){for(var c in b.attachments){var d=c.indexOf(":"),e=parseInt(c.substring(0,d),10),f=c.substring(d+1),g=a.slots[e];if(g.attachment&&g.attachment.name==f){var h=this.getAttachment(e,f);h&&g.setAttachment(h)}}}},f.Animation=function(a,b,c){this.name=a,this.timelines=b,this.duration=c},f.Animation.prototype={apply:function(a,b,c){c&&this.duration&&(b%=this.duration);for(var d=this.timelines,e=0,f=d.length;f>e;e++)d[e].apply(a,b,1)},mix:function(a,b,c,d){c&&this.duration&&(b%=this.duration);for(var e=this.timelines,f=0,g=e.length;g>f;f++)e[f].apply(a,b,d)}},f.binarySearch=function(a,b,c){var d=0,e=Math.floor(a.length/c)-2;if(!e)return c;for(var f=e>>>1;;){if(a[(f+1)*c]<=b?d=f+1:e=f,d==e)return(d+1)*c;f=d+e>>>1}},f.linearSearch=function(a,b,c){for(var d=0,e=a.length-c;e>=d;d+=c)if(a[d]>b)return d;return-1},f.Curves=function(a){this.curves=[],this.curves.length=6*(a-1)},f.Curves.prototype={setLinear:function(a){this.curves[6*a]=0},setStepped:function(a){this.curves[6*a]=-1},setCurve:function(a,b,c,d,e){var f=.1,g=f*f,h=g*f,i=3*f,j=3*g,k=6*g,l=6*h,m=2*-b+d,n=2*-c+e,o=3*(b-d)+1,p=3*(c-e)+1,q=6*a,r=this.curves;r[q]=b*i+m*j+o*h,r[q+1]=c*i+n*j+p*h,r[q+2]=m*k+o*l,r[q+3]=n*k+p*l,r[q+4]=o*l,r[q+5]=p*l},getCurvePercent:function(a,b){b=0>b?0:b>1?1:b;var c=6*a,d=this.curves,e=d[c];if(!e)return b;if(-1==e)return 0;for(var f=d[c+1],g=d[c+2],h=d[c+3],i=d[c+4],j=d[c+5],k=e,l=f,m=8;;){if(k>=b){var n=k-e,o=l-f;return o+(l-o)*(b-n)/(k-n)}if(!m)break;m--,e+=g,f+=h,g+=i,h+=j,k+=e,l+=f}return l+(1-l)*(b-k)/(1-k)}},f.RotateTimeline=function(a){this.curves=new f.Curves(a),this.frames=[],this.frames.length=2*a},f.RotateTimeline.prototype={boneIndex:0,getFrameCount:function(){return this.frames.length/2},setFrame:function(a,b,c){a*=2,this.frames[a]=b,this.frames[a+1]=c},apply:function(a,b,c){var d,e=this.frames;if(!(b<e[0])){var g=a.bones[this.boneIndex];if(b>=e[e.length-2]){for(d=g.data.rotation+e[e.length-1]-g.rotation;d>180;)d-=360;for(;-180>d;)d+=360;return g.rotation+=d*c,void 0}var h=f.binarySearch(e,b,2),i=e[h-1],j=e[h],k=1-(b-j)/(e[h-2]-j);for(k=this.curves.getCurvePercent(h/2-1,k),d=e[h+1]-i;d>180;)d-=360;for(;-180>d;)d+=360;for(d=g.data.rotation+(i+d*k)-g.rotation;d>180;)d-=360;for(;-180>d;)d+=360;g.rotation+=d*c}}},f.TranslateTimeline=function(a){this.curves=new f.Curves(a),this.frames=[],this.frames.length=3*a},f.TranslateTimeline.prototype={boneIndex:0,getFrameCount:function(){return this.frames.length/3},setFrame:function(a,b,c,d){a*=3,this.frames[a]=b,this.frames[a+1]=c,this.frames[a+2]=d},apply:function(a,b,c){var d=this.frames;if(!(b<d[0])){var e=a.bones[this.boneIndex];if(b>=d[d.length-3])return e.x+=(e.data.x+d[d.length-2]-e.x)*c,e.y+=(e.data.y+d[d.length-1]-e.y)*c,void 0;var g=f.binarySearch(d,b,3),h=d[g-2],i=d[g-1],j=d[g],k=1-(b-j)/(d[g+-3]-j);k=this.curves.getCurvePercent(g/3-1,k),e.x+=(e.data.x+h+(d[g+1]-h)*k-e.x)*c,e.y+=(e.data.y+i+(d[g+2]-i)*k-e.y)*c}}},f.ScaleTimeline=function(a){this.curves=new f.Curves(a),this.frames=[],this.frames.length=3*a},f.ScaleTimeline.prototype={boneIndex:0,getFrameCount:function(){return this.frames.length/3},setFrame:function(a,b,c,d){a*=3,this.frames[a]=b,this.frames[a+1]=c,this.frames[a+2]=d},apply:function(a,b,c){var d=this.frames;if(!(b<d[0])){var e=a.bones[this.boneIndex];if(b>=d[d.length-3])return e.scaleX+=(e.data.scaleX-1+d[d.length-2]-e.scaleX)*c,e.scaleY+=(e.data.scaleY-1+d[d.length-1]-e.scaleY)*c,void 0;var g=f.binarySearch(d,b,3),h=d[g-2],i=d[g-1],j=d[g],k=1-(b-j)/(d[g+-3]-j);k=this.curves.getCurvePercent(g/3-1,k),e.scaleX+=(e.data.scaleX-1+h+(d[g+1]-h)*k-e.scaleX)*c,e.scaleY+=(e.data.scaleY-1+i+(d[g+2]-i)*k-e.scaleY)*c}}},f.ColorTimeline=function(a){this.curves=new f.Curves(a),this.frames=[],this.frames.length=5*a},f.ColorTimeline.prototype={slotIndex:0,getFrameCount:function(){return this.frames.length/5},setFrame:function(a,b,c,d,e,f){a*=5,this.frames[a]=b,this.frames[a+1]=c,this.frames[a+2]=d,this.frames[a+3]=e,this.frames[a+4]=f},apply:function(a,b,c){var d=this.frames;if(!(b<d[0])){var e=a.slots[this.slotIndex];if(b>=d[d.length-5]){var g=d.length-1;return e.r=d[g-3],e.g=d[g-2],e.b=d[g-1],e.a=d[g],void 0}var h=f.binarySearch(d,b,5),i=d[h-4],j=d[h-3],k=d[h-2],l=d[h-1],m=d[h],n=1-(b-m)/(d[h-5]-m);n=this.curves.getCurvePercent(h/5-1,n);var o=i+(d[h+1]-i)*n,p=j+(d[h+2]-j)*n,q=k+(d[h+3]-k)*n,r=l+(d[h+4]-l)*n;1>c?(e.r+=(o-e.r)*c,e.g+=(p-e.g)*c,e.b+=(q-e.b)*c,e.a+=(r-e.a)*c):(e.r=o,e.g=p,e.b=q,e.a=r)}}},f.AttachmentTimeline=function(a){this.curves=new f.Curves(a),this.frames=[],this.frames.length=a,this.attachmentNames=[],this.attachmentNames.length=a},f.AttachmentTimeline.prototype={slotIndex:0,getFrameCount:function(){return this.frames.length},setFrame:function(a,b,c){this.frames[a]=b,this.attachmentNames[a]=c},apply:function(a,b){var c=this.frames;if(!(b<c[0])){var d;d=b>=c[c.length-1]?c.length-1:f.binarySearch(c,b,1)-1;var e=this.attachmentNames[d];a.slots[this.slotIndex].setAttachment(e?a.getAttachmentBySlotIndex(this.slotIndex,e):null)}}},f.SkeletonData=function(){this.bones=[],this.slots=[],this.skins=[],this.animations=[]},f.SkeletonData.prototype={defaultSkin:null,findBone:function(a){for(var b=this.bones,c=0,d=b.length;d>c;c++)if(b[c].name==a)return b[c];return null},findBoneIndex:function(a){for(var b=this.bones,c=0,d=b.length;d>c;c++)if(b[c].name==a)return c;return-1},findSlot:function(a){for(var b=this.slots,c=0,d=b.length;d>c;c++)if(b[c].name==a)return slot[c];return null},findSlotIndex:function(a){for(var b=this.slots,c=0,d=b.length;d>c;c++)if(b[c].name==a)return c;return-1},findSkin:function(a){for(var b=this.skins,c=0,d=b.length;d>c;c++)if(b[c].name==a)return b[c];return null},findAnimation:function(a){for(var b=this.animations,c=0,d=b.length;d>c;c++)if(b[c].name==a)return b[c];return null}},f.Skeleton=function(a){this.data=a,this.bones=[];
for(var b=0,c=a.bones.length;c>b;b++){var d=a.bones[b],e=d.parent?this.bones[a.bones.indexOf(d.parent)]:null;this.bones.push(new f.Bone(d,e))}for(this.slots=[],this.drawOrder=[],b=0,c=a.slots.length;c>b;b++){var g=a.slots[b],h=this.bones[a.bones.indexOf(g.boneData)],i=new f.Slot(g,this,h);this.slots.push(i),this.drawOrder.push(i)}},f.Skeleton.prototype={x:0,y:0,skin:null,r:1,g:1,b:1,a:1,time:0,flipX:!1,flipY:!1,updateWorldTransform:function(){for(var a=this.flipX,b=this.flipY,c=this.bones,d=0,e=c.length;e>d;d++)c[d].updateWorldTransform(a,b)},setToSetupPose:function(){this.setBonesToSetupPose(),this.setSlotsToSetupPose()},setBonesToSetupPose:function(){for(var a=this.bones,b=0,c=a.length;c>b;b++)a[b].setToSetupPose()},setSlotsToSetupPose:function(){for(var a=this.slots,b=0,c=a.length;c>b;b++)a[b].setToSetupPose(b)},getRootBone:function(){return this.bones.length?this.bones[0]:null},findBone:function(a){for(var b=this.bones,c=0,d=b.length;d>c;c++)if(b[c].data.name==a)return b[c];return null},findBoneIndex:function(a){for(var b=this.bones,c=0,d=b.length;d>c;c++)if(b[c].data.name==a)return c;return-1},findSlot:function(a){for(var b=this.slots,c=0,d=b.length;d>c;c++)if(b[c].data.name==a)return b[c];return null},findSlotIndex:function(a){for(var b=this.slots,c=0,d=b.length;d>c;c++)if(b[c].data.name==a)return c;return-1},setSkinByName:function(a){var b=this.data.findSkin(a);if(!b)throw"Skin not found: "+a;this.setSkin(b)},setSkin:function(a){this.skin&&a&&a._attachAll(this,this.skin),this.skin=a},getAttachmentBySlotName:function(a,b){return this.getAttachmentBySlotIndex(this.data.findSlotIndex(a),b)},getAttachmentBySlotIndex:function(a,b){if(this.skin){var c=this.skin.getAttachment(a,b);if(c)return c}return this.data.defaultSkin?this.data.defaultSkin.getAttachment(a,b):null},setAttachment:function(a,b){for(var c=this.slots,d=0,e=c.size;e>d;d++){var f=c[d];if(f.data.name==a){var g=null;if(b&&(g=this.getAttachment(d,b),null==g))throw"Attachment not found: "+b+", for slot: "+a;return f.setAttachment(g),void 0}}throw"Slot not found: "+a},update:function(a){time+=a}},f.AttachmentType={region:0},f.RegionAttachment=function(){this.offset=[],this.offset.length=8,this.uvs=[],this.uvs.length=8},f.RegionAttachment.prototype={x:0,y:0,rotation:0,scaleX:1,scaleY:1,width:0,height:0,rendererObject:null,regionOffsetX:0,regionOffsetY:0,regionWidth:0,regionHeight:0,regionOriginalWidth:0,regionOriginalHeight:0,setUVs:function(a,b,c,d,e){var f=this.uvs;e?(f[2]=a,f[3]=d,f[4]=a,f[5]=b,f[6]=c,f[7]=b,f[0]=c,f[1]=d):(f[0]=a,f[1]=d,f[2]=a,f[3]=b,f[4]=c,f[5]=b,f[6]=c,f[7]=d)},updateOffset:function(){var a=this.width/this.regionOriginalWidth*this.scaleX,b=this.height/this.regionOriginalHeight*this.scaleY,c=-this.width/2*this.scaleX+this.regionOffsetX*a,d=-this.height/2*this.scaleY+this.regionOffsetY*b,e=c+this.regionWidth*a,f=d+this.regionHeight*b,g=this.rotation*Math.PI/180,h=Math.cos(g),i=Math.sin(g),j=c*h+this.x,k=c*i,l=d*h+this.y,m=d*i,n=e*h+this.x,o=e*i,p=f*h+this.y,q=f*i,r=this.offset;r[0]=j-m,r[1]=l+k,r[2]=j-q,r[3]=p+k,r[4]=n-q,r[5]=p+o,r[6]=n-m,r[7]=l+o},computeVertices:function(a,b,c,d){a+=c.worldX,b+=c.worldY;var e=c.m00,f=c.m01,g=c.m10,h=c.m11,i=this.offset;d[0]=i[0]*e+i[1]*f+a,d[1]=i[0]*g+i[1]*h+b,d[2]=i[2]*e+i[3]*f+a,d[3]=i[2]*g+i[3]*h+b,d[4]=i[4]*e+i[5]*f+a,d[5]=i[4]*g+i[5]*h+b,d[6]=i[6]*e+i[7]*f+a,d[7]=i[6]*g+i[7]*h+b}},f.AnimationStateData=function(a){this.skeletonData=a,this.animationToMixTime={}},f.AnimationStateData.prototype={defaultMix:0,setMixByName:function(a,b,c){var d=this.skeletonData.findAnimation(a);if(!d)throw"Animation not found: "+a;var e=this.skeletonData.findAnimation(b);if(!e)throw"Animation not found: "+b;this.setMix(d,e,c)},setMix:function(a,b,c){this.animationToMixTime[a.name+":"+b.name]=c},getMix:function(a,b){var c=this.animationToMixTime[a.name+":"+b.name];return c?c:this.defaultMix}},f.AnimationState=function(a){this.data=a,this.queue=[]},f.AnimationState.prototype={animationSpeed:1,current:null,previous:null,currentTime:0,previousTime:0,currentLoop:!1,previousLoop:!1,mixTime:0,mixDuration:0,update:function(a){if(this.currentTime+=a*this.animationSpeed,this.previousTime+=a,this.mixTime+=a,this.queue.length>0){var b=this.queue[0];this.currentTime>=b.delay&&(this._setAnimation(b.animation,b.loop),this.queue.shift())}},apply:function(a){if(this.current)if(this.previous){this.previous.apply(a,this.previousTime,this.previousLoop);var b=this.mixTime/this.mixDuration;b>=1&&(b=1,this.previous=null),this.current.mix(a,this.currentTime,this.currentLoop,b)}else this.current.apply(a,this.currentTime,this.currentLoop)},clearAnimation:function(){this.previous=null,this.current=null,this.queue.length=0},_setAnimation:function(a,b){this.previous=null,a&&this.current&&(this.mixDuration=this.data.getMix(this.current,a),this.mixDuration>0&&(this.mixTime=0,this.previous=this.current,this.previousTime=this.currentTime,this.previousLoop=this.currentLoop)),this.current=a,this.currentLoop=b,this.currentTime=0},setAnimationByName:function(a,b){var c=this.data.skeletonData.findAnimation(a);if(!c)throw"Animation not found: "+a;this.setAnimation(c,b)},setAnimation:function(a,b){this.queue.length=0,this._setAnimation(a,b)},addAnimationByName:function(a,b,c){var d=this.data.skeletonData.findAnimation(a);if(!d)throw"Animation not found: "+a;this.addAnimation(d,b,c)},addAnimation:function(a,b,c){var d={};if(d.animation=a,d.loop=b,!c||0>=c){var e=this.queue.length?this.queue[this.queue.length-1].animation:this.current;c=null!=e?e.duration-this.data.getMix(e,a)+(c||0):0}d.delay=c,this.queue.push(d)},isComplete:function(){return!this.current||this.currentTime>=this.current.duration}},f.SkeletonJson=function(a){this.attachmentLoader=a},f.SkeletonJson.prototype={scale:1,readSkeletonData:function(a){for(var b,c=new f.SkeletonData,d=a.bones,e=0,g=d.length;g>e;e++){var h=d[e],i=null;if(h.parent&&(i=c.findBone(h.parent),!i))throw"Parent bone not found: "+h.parent;b=new f.BoneData(h.name,i),b.length=(h.length||0)*this.scale,b.x=(h.x||0)*this.scale,b.y=(h.y||0)*this.scale,b.rotation=h.rotation||0,b.scaleX=h.scaleX||1,b.scaleY=h.scaleY||1,c.bones.push(b)}var j=a.slots;for(e=0,g=j.length;g>e;e++){var k=j[e];if(b=c.findBone(k.bone),!b)throw"Slot bone not found: "+k.bone;var l=new f.SlotData(k.name,b),m=k.color;m&&(l.r=f.SkeletonJson.toColor(m,0),l.g=f.SkeletonJson.toColor(m,1),l.b=f.SkeletonJson.toColor(m,2),l.a=f.SkeletonJson.toColor(m,3)),l.attachmentName=k.attachment,c.slots.push(l)}var n=a.skins;for(var o in n)if(n.hasOwnProperty(o)){var p=n[o],q=new f.Skin(o);for(var r in p)if(p.hasOwnProperty(r)){var s=c.findSlotIndex(r),t=p[r];for(var u in t)if(t.hasOwnProperty(u)){var v=this.readAttachment(q,u,t[u]);null!=v&&q.addAttachment(s,u,v)}}c.skins.push(q),"default"==q.name&&(c.defaultSkin=q)}var w=a.animations;for(var x in w)w.hasOwnProperty(x)&&this.readAnimation(x,w[x],c);return c},readAttachment:function(a,b,c){b=c.name||b;var d=f.AttachmentType[c.type||"region"];if(d==f.AttachmentType.region){var e=new f.RegionAttachment;return e.x=(c.x||0)*this.scale,e.y=(c.y||0)*this.scale,e.scaleX=c.scaleX||1,e.scaleY=c.scaleY||1,e.rotation=c.rotation||0,e.width=(c.width||32)*this.scale,e.height=(c.height||32)*this.scale,e.updateOffset(),e.rendererObject={},e.rendererObject.name=b,e.rendererObject.scale={},e.rendererObject.scale.x=e.scaleX,e.rendererObject.scale.y=e.scaleY,e.rendererObject.rotation=-e.rotation*Math.PI/180,e}throw"Unknown attachment type: "+d},readAnimation:function(a,b,c){var d,e,g,h,i,j,k,l=[],m=0,n=b.bones;for(var o in n)if(n.hasOwnProperty(o)){var p=c.findBoneIndex(o);if(-1==p)throw"Bone not found: "+o;var q=n[o];for(g in q)if(q.hasOwnProperty(g))if(i=q[g],"rotate"==g){for(e=new f.RotateTimeline(i.length),e.boneIndex=p,d=0,j=0,k=i.length;k>j;j++)h=i[j],e.setFrame(d,h.time,h.angle),f.SkeletonJson.readCurve(e,d,h),d++;l.push(e),m=Math.max(m,e.frames[2*e.getFrameCount()-2])}else{if("translate"!=g&&"scale"!=g)throw"Invalid timeline type for a bone: "+g+" ("+o+")";var r=1;for("scale"==g?e=new f.ScaleTimeline(i.length):(e=new f.TranslateTimeline(i.length),r=this.scale),e.boneIndex=p,d=0,j=0,k=i.length;k>j;j++){h=i[j];var s=(h.x||0)*r,t=(h.y||0)*r;e.setFrame(d,h.time,s,t),f.SkeletonJson.readCurve(e,d,h),d++}l.push(e),m=Math.max(m,e.frames[3*e.getFrameCount()-3])}}var u=b.slots;for(var v in u)if(u.hasOwnProperty(v)){var w=u[v],x=c.findSlotIndex(v);for(g in w)if(w.hasOwnProperty(g))if(i=w[g],"color"==g){for(e=new f.ColorTimeline(i.length),e.slotIndex=x,d=0,j=0,k=i.length;k>j;j++){h=i[j];var y=h.color,z=f.SkeletonJson.toColor(y,0),A=f.SkeletonJson.toColor(y,1),B=f.SkeletonJson.toColor(y,2),C=f.SkeletonJson.toColor(y,3);e.setFrame(d,h.time,z,A,B,C),f.SkeletonJson.readCurve(e,d,h),d++}l.push(e),m=Math.max(m,e.frames[5*e.getFrameCount()-5])}else{if("attachment"!=g)throw"Invalid timeline type for a slot: "+g+" ("+v+")";for(e=new f.AttachmentTimeline(i.length),e.slotIndex=x,d=0,j=0,k=i.length;k>j;j++)h=i[j],e.setFrame(d++,h.time,h.name);l.push(e),m=Math.max(m,e.frames[e.getFrameCount()-1])}}c.animations.push(new f.Animation(a,l,m))}},f.SkeletonJson.readCurve=function(a,b,c){var d=c.curve;d&&("stepped"==d?a.curves.setStepped(b):d instanceof Array&&a.curves.setCurve(b,d[0],d[1],d[2],d[3]))},f.SkeletonJson.toColor=function(a,b){if(8!=a.length)throw"Color hexidecimal length must be 8, recieved: "+a;return parseInt(a.substr(2*b,2),16)/255},f.Atlas=function(a,b){this.textureLoader=b,this.pages=[],this.regions=[];var c=new f.AtlasReader(a),d=[];d.length=4;for(var e=null;;){var g=c.readLine();if(null==g)break;if(g=c.trim(g),g.length)if(e){var h=new f.AtlasRegion;h.name=g,h.page=e,h.rotate="true"==c.readValue(),c.readTuple(d);var i=parseInt(d[0],10),j=parseInt(d[1],10);c.readTuple(d);var k=parseInt(d[0],10),l=parseInt(d[1],10);h.u=i/e.width,h.v=j/e.height,h.rotate?(h.u2=(i+l)/e.width,h.v2=(j+k)/e.height):(h.u2=(i+k)/e.width,h.v2=(j+l)/e.height),h.x=i,h.y=j,h.width=Math.abs(k),h.height=Math.abs(l),4==c.readTuple(d)&&(h.splits=[parseInt(d[0],10),parseInt(d[1],10),parseInt(d[2],10),parseInt(d[3],10)],4==c.readTuple(d)&&(h.pads=[parseInt(d[0],10),parseInt(d[1],10),parseInt(d[2],10),parseInt(d[3],10)],c.readTuple(d))),h.originalWidth=parseInt(d[0],10),h.originalHeight=parseInt(d[1],10),c.readTuple(d),h.offsetX=parseInt(d[0],10),h.offsetY=parseInt(d[1],10),h.index=parseInt(c.readValue(),10),this.regions.push(h)}else{e=new f.AtlasPage,e.name=g,e.format=f.Atlas.Format[c.readValue()],c.readTuple(d),e.minFilter=f.Atlas.TextureFilter[d[0]],e.magFilter=f.Atlas.TextureFilter[d[1]];var m=c.readValue();e.uWrap=f.Atlas.TextureWrap.clampToEdge,e.vWrap=f.Atlas.TextureWrap.clampToEdge,"x"==m?e.uWrap=f.Atlas.TextureWrap.repeat:"y"==m?e.vWrap=f.Atlas.TextureWrap.repeat:"xy"==m&&(e.uWrap=e.vWrap=f.Atlas.TextureWrap.repeat),b.load(e,g),this.pages.push(e)}else e=null}},f.Atlas.prototype={findRegion:function(a){for(var b=this.regions,c=0,d=b.length;d>c;c++)if(b[c].name==a)return b[c];return null},dispose:function(){for(var a=this.pages,b=0,c=a.length;c>b;b++)this.textureLoader.unload(a[b].rendererObject)},updateUVs:function(a){for(var b=this.regions,c=0,d=b.length;d>c;c++){var e=b[c];e.page==a&&(e.u=e.x/a.width,e.v=e.y/a.height,e.rotate?(e.u2=(e.x+e.height)/a.width,e.v2=(e.y+e.width)/a.height):(e.u2=(e.x+e.width)/a.width,e.v2=(e.y+e.height)/a.height))}}},f.Atlas.Format={alpha:0,intensity:1,luminanceAlpha:2,rgb565:3,rgba4444:4,rgb888:5,rgba8888:6},f.Atlas.TextureFilter={nearest:0,linear:1,mipMap:2,mipMapNearestNearest:3,mipMapLinearNearest:4,mipMapNearestLinear:5,mipMapLinearLinear:6},f.Atlas.TextureWrap={mirroredRepeat:0,clampToEdge:1,repeat:2},f.AtlasPage=function(){},f.AtlasPage.prototype={name:null,format:null,minFilter:null,magFilter:null,uWrap:null,vWrap:null,rendererObject:null,width:0,height:0},f.AtlasRegion=function(){},f.AtlasRegion.prototype={page:null,name:null,x:0,y:0,width:0,height:0,u:0,v:0,u2:0,v2:0,offsetX:0,offsetY:0,originalWidth:0,originalHeight:0,index:0,rotate:!1,splits:null,pads:null},f.AtlasReader=function(a){this.lines=a.split(/\r\n|\r|\n/)},f.AtlasReader.prototype={index:0,trim:function(a){return a.replace(/^\s+|\s+$/g,"")},readLine:function(){return this.index>=this.lines.length?null:this.lines[this.index++]},readValue:function(){var a=this.readLine(),b=a.indexOf(":");if(-1==b)throw"Invalid line: "+a;return this.trim(a.substring(b+1))},readTuple:function(a){var b=this.readLine(),c=b.indexOf(":");if(-1==c)throw"Invalid line: "+b;for(var d=0,e=c+1;3>d;d++){var f=b.indexOf(",",e);if(-1==f){if(!d)throw"Invalid line: "+b;break}a[d]=this.trim(b.substr(e,f-e)),e=f+1}return a[d]=this.trim(b.substring(e)),d+1}},f.AtlasAttachmentLoader=function(a){this.atlas=a},f.AtlasAttachmentLoader.prototype={newAttachment:function(a,b,c){switch(b){case f.AttachmentType.region:var d=this.atlas.findRegion(c);if(!d)throw"Region not found in atlas: "+c+" ("+b+")";var e=new f.RegionAttachment(c);return e.rendererObject=d,e.setUVs(d.u,d.v,d.u2,d.v2,d.rotate),e.regionOffsetX=d.offsetX,e.regionOffsetY=d.offsetY,e.regionWidth=d.width,e.regionHeight=d.height,e.regionOriginalWidth=d.originalWidth,e.regionOriginalHeight=d.originalHeight,e}throw"Unknown attachment type: "+b}},f.Bone.yDown=!0,b.AnimCache={},b.Spine=function(a){if(b.DisplayObjectContainer.call(this),this.spineData=b.AnimCache[a],!this.spineData)throw new Error("Spine data must be preloaded using PIXI.SpineLoader or PIXI.AssetLoader: "+a);this.skeleton=new f.Skeleton(this.spineData),this.skeleton.updateWorldTransform(),this.stateData=new f.AnimationStateData(this.spineData),this.state=new f.AnimationState(this.stateData),this.slotContainers=[];for(var c=0,d=this.skeleton.drawOrder.length;d>c;c++){var e=this.skeleton.drawOrder[c],g=e.attachment,h=new b.DisplayObjectContainer;if(this.slotContainers.push(h),this.addChild(h),g instanceof f.RegionAttachment){var i=g.rendererObject.name,j=this.createSprite(e,g.rendererObject);e.currentSprite=j,e.currentSpriteName=i,h.addChild(j)}}},b.Spine.prototype=Object.create(b.DisplayObjectContainer.prototype),b.Spine.prototype.constructor=b.Spine,b.Spine.prototype.updateTransform=function(){this.lastTime=this.lastTime||Date.now();var a=.001*(Date.now()-this.lastTime);this.lastTime=Date.now(),this.state.update(a),this.state.apply(this.skeleton),this.skeleton.updateWorldTransform();for(var c=this.skeleton.drawOrder,d=0,e=c.length;e>d;d++){var g=c[d],h=g.attachment,i=this.slotContainers[d];if(h instanceof f.RegionAttachment){if(h.rendererObject&&(!g.currentSpriteName||g.currentSpriteName!=h.name)){var j=h.rendererObject.name;if(void 0!==g.currentSprite&&(g.currentSprite.visible=!1),g.sprites=g.sprites||{},void 0!==g.sprites[j])g.sprites[j].visible=!0;else{var k=this.createSprite(g,h.rendererObject);i.addChild(k)}g.currentSprite=g.sprites[j],g.currentSpriteName=j}i.visible=!0;var l=g.bone;i.position.x=l.worldX+h.x*l.m00+h.y*l.m01,i.position.y=l.worldY+h.x*l.m10+h.y*l.m11,i.scale.x=l.worldScaleX,i.scale.y=l.worldScaleY,i.rotation=-(g.bone.worldRotation*Math.PI/180),i.alpha=g.a,g.currentSprite.tint=b.rgb2hex([g.r,g.g,g.b])}else i.visible=!1}b.DisplayObjectContainer.prototype.updateTransform.call(this)},b.Spine.prototype.createSprite=function(a,c){var d=b.TextureCache[c.name]?c.name:c.name+".png",e=new b.Sprite(b.Texture.fromFrame(d));return e.scale=c.scale,e.rotation=c.rotation,e.anchor.x=e.anchor.y=.5,a.sprites=a.sprites||{},a.sprites[c.name]=e,e},b.BaseTextureCache={},b.texturesToUpdate=[],b.texturesToDestroy=[],b.BaseTextureCacheIdGenerator=0,b.BaseTexture=function(a,c){if(b.EventTarget.call(this),this.width=100,this.height=100,this.scaleMode=c||b.scaleModes.DEFAULT,this.hasLoaded=!1,this.source=a,this.id=b.BaseTextureCacheIdGenerator++,this.premultipliedAlpha=!0,this._glTextures=[],this._dirty=[],a){if((this.source.complete||this.source.getContext)&&this.source.width&&this.source.height)this.hasLoaded=!0,this.width=this.source.width,this.height=this.source.height,b.texturesToUpdate.push(this);else{var d=this;this.source.onload=function(){d.hasLoaded=!0,d.width=d.source.width,d.height=d.source.height;for(var a=0;a<d._glTextures.length;a++)d._dirty[a]=!0;d.dispatchEvent({type:"loaded",content:d})},this.source.onerror=function(){d.dispatchEvent({type:"error",content:d})}}this.imageUrl=null,this._powerOf2=!1}},b.BaseTexture.prototype.constructor=b.BaseTexture,b.BaseTexture.prototype.destroy=function(){this.imageUrl?(delete b.BaseTextureCache[this.imageUrl],delete b.TextureCache[this.imageUrl],this.imageUrl=null,this.source.src=null):this.source&&this.source._pixiId&&delete b.BaseTextureCache[this.source._pixiId],this.source=null,b.texturesToDestroy.push(this)},b.BaseTexture.prototype.updateSourceImage=function(a){this.hasLoaded=!1,this.source.src=null,this.source.src=a},b.BaseTexture.fromImage=function(a,c,d){var e=b.BaseTextureCache[a];if(void 0===c&&-1===a.indexOf("data:")&&(c=!0),!e){var f=new Image;c&&(f.crossOrigin=""),f.src=a,e=new b.BaseTexture(f,d),e.imageUrl=a,b.BaseTextureCache[a]=e}return e},b.BaseTexture.fromCanvas=function(a,c){a._pixiId||(a._pixiId="canvas_"+b.TextureCacheIdGenerator++);var d=b.BaseTextureCache[a._pixiId];return d||(d=new b.BaseTexture(a,c),b.BaseTextureCache[a._pixiId]=d),d},b.TextureCache={},b.FrameCache={},b.TextureCacheIdGenerator=0,b.Texture=function(a,c){if(b.EventTarget.call(this),this.noFrame=!1,c||(this.noFrame=!0,c=new b.Rectangle(0,0,1,1)),a instanceof b.Texture&&(a=a.baseTexture),this.baseTexture=a,this.frame=c,this.trim=null,this.valid=!1,this.scope=this,this._uvs=null,this.width=0,this.height=0,this.crop=new b.Rectangle(0,0,1,1),a.hasLoaded)this.noFrame&&(c=new b.Rectangle(0,0,a.width,a.height)),this.setFrame(c);else{var d=this;a.addEventListener("loaded",function(){d.onBaseTextureLoaded()})}},b.Texture.prototype.constructor=b.Texture,b.Texture.prototype.onBaseTextureLoaded=function(){var a=this.baseTexture;a.removeEventListener("loaded",this.onLoaded),this.noFrame&&(this.frame=new b.Rectangle(0,0,a.width,a.height)),this.setFrame(this.frame),this.scope.dispatchEvent({type:"update",content:this})},b.Texture.prototype.destroy=function(a){a&&this.baseTexture.destroy(),this.valid=!1},b.Texture.prototype.setFrame=function(a){if(this.noFrame=!1,this.frame=a,this.width=a.width,this.height=a.height,this.crop.x=a.x,this.crop.y=a.y,this.crop.width=a.width,this.crop.height=a.height,!this.trim&&(a.x+a.width>this.baseTexture.width||a.y+a.height>this.baseTexture.height))throw new Error("Texture Error: frame does not fit inside the base Texture dimensions "+this);this.valid=a&&a.width&&a.height&&this.baseTexture.source&&this.baseTexture.hasLoaded,this.trim&&(this.width=this.trim.width,this.height=this.trim.height,this.frame.width=this.trim.width,this.frame.height=this.trim.height),this.valid&&b.Texture.frameUpdates.push(this)},b.Texture.prototype._updateWebGLuvs=function(){this._uvs||(this._uvs=new b.TextureUvs);var a=this.crop,c=this.baseTexture.width,d=this.baseTexture.height;this._uvs.x0=a.x/c,this._uvs.y0=a.y/d,this._uvs.x1=(a.x+a.width)/c,this._uvs.y1=a.y/d,this._uvs.x2=(a.x+a.width)/c,this._uvs.y2=(a.y+a.height)/d,this._uvs.x3=a.x/c,this._uvs.y3=(a.y+a.height)/d},b.Texture.fromImage=function(a,c,d){var e=b.TextureCache[a];return e||(e=new b.Texture(b.BaseTexture.fromImage(a,c,d)),b.TextureCache[a]=e),e},b.Texture.fromFrame=function(a){var c=b.TextureCache[a];if(!c)throw new Error('The frameId "'+a+'" does not exist in the texture cache ');return c},b.Texture.fromCanvas=function(a,c){var d=b.BaseTexture.fromCanvas(a,c);return new b.Texture(d)},b.Texture.addTextureToCache=function(a,c){b.TextureCache[c]=a},b.Texture.removeTextureFromCache=function(a){var c=b.TextureCache[a];return delete b.TextureCache[a],delete b.BaseTextureCache[a],c},b.Texture.frameUpdates=[],b.TextureUvs=function(){this.x0=0,this.y0=0,this.x1=0,this.y1=0,this.x2=0,this.y2=0,this.x3=0,this.y3=0},b.RenderTexture=function(a,c,d,e){if(b.EventTarget.call(this),this.width=a||100,this.height=c||100,this.frame=new b.Rectangle(0,0,this.width,this.height),this.crop=new b.Rectangle(0,0,this.width,this.height),this.baseTexture=new b.BaseTexture,this.baseTexture.width=this.width,this.baseTexture.height=this.height,this.baseTexture._glTextures=[],this.baseTexture.scaleMode=e||b.scaleModes.DEFAULT,this.baseTexture.hasLoaded=!0,this.renderer=d||b.defaultRenderer,this.renderer.type===b.WEBGL_RENDERER){var f=this.renderer.gl;this.textureBuffer=new b.FilterTexture(f,this.width,this.height,this.baseTexture.scaleMode),this.baseTexture._glTextures[f.id]=this.textureBuffer.texture,this.render=this.renderWebGL,this.projection=new b.Point(this.width/2,-this.height/2)}else this.render=this.renderCanvas,this.textureBuffer=new b.CanvasBuffer(this.width,this.height),this.baseTexture.source=this.textureBuffer.canvas;this.valid=!0,b.Texture.frameUpdates.push(this)},b.RenderTexture.prototype=Object.create(b.Texture.prototype),b.RenderTexture.prototype.constructor=b.RenderTexture,b.RenderTexture.prototype.resize=function(a,c,d){(a!==this.width||c!==this.height)&&(this.width=this.frame.width=this.crop.width=a,this.height=this.frame.height=this.crop.height=c,d&&(this.baseTexture.width=this.width,this.baseTexture.height=this.height),this.renderer.type===b.WEBGL_RENDERER&&(this.projection.x=this.width/2,this.projection.y=-this.height/2),this.textureBuffer.resize(this.width,this.height))},b.RenderTexture.prototype.clear=function(){this.renderer.type===b.WEBGL_RENDERER&&this.renderer.gl.bindFramebuffer(this.renderer.gl.FRAMEBUFFER,this.textureBuffer.frameBuffer),this.textureBuffer.clear()},b.RenderTexture.prototype.renderWebGL=function(a,c,d){var e=this.renderer.gl;e.colorMask(!0,!0,!0,!0),e.viewport(0,0,this.width,this.height),e.bindFramebuffer(e.FRAMEBUFFER,this.textureBuffer.frameBuffer),d&&this.textureBuffer.clear();var f=a.children,g=a.worldTransform;a.worldTransform=b.RenderTexture.tempMatrix,a.worldTransform.d=-1,a.worldTransform.ty=-2*this.projection.y,c&&(a.worldTransform.tx=c.x,a.worldTransform.ty-=c.y);for(var h=0,i=f.length;i>h;h++)f[h].updateTransform();b.WebGLRenderer.updateTextures(),this.renderer.spriteBatch.dirty=!0,this.renderer.renderDisplayObject(a,this.projection,this.textureBuffer.frameBuffer),a.worldTransform=g,this.renderer.spriteBatch.dirty=!0},b.RenderTexture.prototype.renderCanvas=function(a,c,d){var e=a.children,f=a.worldTransform;a.worldTransform=b.RenderTexture.tempMatrix,c?(a.worldTransform.tx=c.x,a.worldTransform.ty=c.y):(a.worldTransform.tx=0,a.worldTransform.ty=0);for(var g=0,h=e.length;h>g;g++)e[g].updateTransform();d&&this.textureBuffer.clear();var i=this.textureBuffer.context;this.renderer.renderDisplayObject(a,i),i.setTransform(1,0,0,1,0,0),a.worldTransform=f},b.RenderTexture.tempMatrix=new b.Matrix,b.AssetLoader=function(a,c){b.EventTarget.call(this),this.assetURLs=a,this.crossorigin=c,this.loadersByType={jpg:b.ImageLoader,jpeg:b.ImageLoader,png:b.ImageLoader,gif:b.ImageLoader,webp:b.ImageLoader,json:b.JsonLoader,atlas:b.AtlasLoader,anim:b.SpineLoader,xml:b.BitmapFontLoader,fnt:b.BitmapFontLoader}},b.AssetLoader.prototype.constructor=b.AssetLoader,b.AssetLoader.prototype._getDataType=function(a){var b="data:",c=a.slice(0,b.length).toLowerCase();if(c===b){var d=a.slice(b.length),e=d.indexOf(",");if(-1===e)return null;var f=d.slice(0,e).split(";")[0];return f&&"text/plain"!==f.toLowerCase()?f.split("/").pop().toLowerCase():"txt"}return null},b.AssetLoader.prototype.load=function(){function a(a){b.onAssetLoaded(a.content)}var b=this;this.loadCount=this.assetURLs.length;for(var c=0;c<this.assetURLs.length;c++){var d=this.assetURLs[c],e=this._getDataType(d);e||(e=d.split("?").shift().split(".").pop().toLowerCase());var f=this.loadersByType[e];if(!f)throw new Error(e+" is an unsupported file type");var g=new f(d,this.crossorigin);g.addEventListener("loaded",a),g.load()}},b.AssetLoader.prototype.onAssetLoaded=function(a){this.loadCount--,this.dispatchEvent({type:"onProgress",content:this,loader:a}),this.onProgress&&this.onProgress(a),this.loadCount||(this.dispatchEvent({type:"onComplete",content:this}),this.onComplete&&this.onComplete())},b.JsonLoader=function(a,c){b.EventTarget.call(this),this.url=a,this.crossorigin=c,this.baseUrl=a.replace(/[^\/]*$/,""),this.loaded=!1},b.JsonLoader.prototype.constructor=b.JsonLoader,b.JsonLoader.prototype.load=function(){var a=this;window.XDomainRequest&&a.crossorigin?(this.ajaxRequest=new window.XDomainRequest,this.ajaxRequest.timeout=3e3,this.ajaxRequest.onerror=function(){a.onError()},this.ajaxRequest.ontimeout=function(){a.onError()},this.ajaxRequest.onprogress=function(){}):this.ajaxRequest=window.XMLHttpRequest?new window.XMLHttpRequest:new window.ActiveXObject("Microsoft.XMLHTTP"),this.ajaxRequest.onload=function(){a.onJSONLoaded()},this.ajaxRequest.open("GET",this.url,!0),this.ajaxRequest.send()},b.JsonLoader.prototype.onJSONLoaded=function(){if(!this.ajaxRequest.responseText)return this.onError(),void 0;if(this.json=JSON.parse(this.ajaxRequest.responseText),this.json.frames){var a=this,c=this.baseUrl+this.json.meta.image,d=new b.ImageLoader(c,this.crossorigin),e=this.json.frames;this.texture=d.texture.baseTexture,d.addEventListener("loaded",function(){a.onLoaded()});for(var g in e){var h=e[g].frame;if(h&&(b.TextureCache[g]=new b.Texture(this.texture,{x:h.x,y:h.y,width:h.w,height:h.h}),b.TextureCache[g].crop=new b.Rectangle(h.x,h.y,h.w,h.h),e[g].trimmed)){var i=e[g].sourceSize,j=e[g].spriteSourceSize;b.TextureCache[g].trim=new b.Rectangle(j.x,j.y,i.w,i.h)}}d.load()}else if(this.json.bones){var k=new f.SkeletonJson,l=k.readSkeletonData(this.json);b.AnimCache[this.url]=l,this.onLoaded()}else this.onLoaded()},b.JsonLoader.prototype.onLoaded=function(){this.loaded=!0,this.dispatchEvent({type:"loaded",content:this})},b.JsonLoader.prototype.onError=function(){this.dispatchEvent({type:"error",content:this})},b.AtlasLoader=function(a,c){b.EventTarget.call(this),this.url=a,this.baseUrl=a.replace(/[^\/]*$/,""),this.crossorigin=c,this.loaded=!1},b.AtlasLoader.constructor=b.AtlasLoader,b.AtlasLoader.prototype.load=function(){this.ajaxRequest=new b.AjaxRequest,this.ajaxRequest.onreadystatechange=this.onAtlasLoaded.bind(this),this.ajaxRequest.open("GET",this.url,!0),this.ajaxRequest.overrideMimeType&&this.ajaxRequest.overrideMimeType("application/json"),this.ajaxRequest.send(null)},b.AtlasLoader.prototype.onAtlasLoaded=function(){if(4===this.ajaxRequest.readyState)if(200===this.ajaxRequest.status||-1===window.location.href.indexOf("http")){this.atlas={meta:{image:[]},frames:[]};var a=this.ajaxRequest.responseText.split(/\r?\n/),c=-3,d=0,e=null,f=!1,g=0,h=0,i=this.onLoaded.bind(this);for(g=0;g<a.length;g++)if(a[g]=a[g].replace(/^\s+|\s+$/g,""),""===a[g]&&(f=g+1),a[g].length>0){if(f===g)this.atlas.meta.image.push(a[g]),d=this.atlas.meta.image.length-1,this.atlas.frames.push({}),c=-3;else if(c>0)if(c%7===1)null!=e&&(this.atlas.frames[d][e.name]=e),e={name:a[g],frame:{}};else{var j=a[g].split(" ");if(c%7===3)e.frame.x=Number(j[1].replace(",","")),e.frame.y=Number(j[2]);else if(c%7===4)e.frame.w=Number(j[1].replace(",","")),e.frame.h=Number(j[2]);else if(c%7===5){var k={x:0,y:0,w:Number(j[1].replace(",","")),h:Number(j[2])};k.w>e.frame.w||k.h>e.frame.h?(e.trimmed=!0,e.realSize=k):e.trimmed=!1}}c++}if(null!=e&&(this.atlas.frames[d][e.name]=e),this.atlas.meta.image.length>0){for(this.images=[],h=0;h<this.atlas.meta.image.length;h++){var l=this.baseUrl+this.atlas.meta.image[h],m=this.atlas.frames[h];this.images.push(new b.ImageLoader(l,this.crossorigin));for(g in m){var n=m[g].frame;n&&(b.TextureCache[g]=new b.Texture(this.images[h].texture.baseTexture,{x:n.x,y:n.y,width:n.w,height:n.h}),m[g].trimmed&&(b.TextureCache[g].realSize=m[g].realSize,b.TextureCache[g].trim.x=0,b.TextureCache[g].trim.y=0))}}for(this.currentImageId=0,h=0;h<this.images.length;h++)this.images[h].addEventListener("loaded",i);this.images[this.currentImageId].load()}else this.onLoaded()}else this.onError()},b.AtlasLoader.prototype.onLoaded=function(){this.images.length-1>this.currentImageId?(this.currentImageId++,this.images[this.currentImageId].load()):(this.loaded=!0,this.dispatchEvent({type:"loaded",content:this}))},b.AtlasLoader.prototype.onError=function(){this.dispatchEvent({type:"error",content:this})},b.SpriteSheetLoader=function(a,c){b.EventTarget.call(this),this.url=a,this.crossorigin=c,this.baseUrl=a.replace(/[^\/]*$/,""),this.texture=null,this.frames={}},b.SpriteSheetLoader.prototype.constructor=b.SpriteSheetLoader,b.SpriteSheetLoader.prototype.load=function(){var a=this,c=new b.JsonLoader(this.url,this.crossorigin);c.addEventListener("loaded",function(b){a.json=b.content.json,a.onLoaded()}),c.load()},b.SpriteSheetLoader.prototype.onLoaded=function(){this.dispatchEvent({type:"loaded",content:this})},b.ImageLoader=function(a,c){b.EventTarget.call(this),this.texture=b.Texture.fromImage(a,c),this.frames=[]},b.ImageLoader.prototype.constructor=b.ImageLoader,b.ImageLoader.prototype.load=function(){if(this.texture.baseTexture.hasLoaded)this.onLoaded();else{var a=this;this.texture.baseTexture.addEventListener("loaded",function(){a.onLoaded()})}},b.ImageLoader.prototype.onLoaded=function(){this.dispatchEvent({type:"loaded",content:this})},b.ImageLoader.prototype.loadFramedSpriteSheet=function(a,c,d){this.frames=[];for(var e=Math.floor(this.texture.width/a),f=Math.floor(this.texture.height/c),g=0,h=0;f>h;h++)for(var i=0;e>i;i++,g++){var j=new b.Texture(this.texture,{x:i*a,y:h*c,width:a,height:c});this.frames.push(j),d&&(b.TextureCache[d+"-"+g]=j)}if(this.texture.baseTexture.hasLoaded)this.onLoaded();else{var k=this;this.texture.baseTexture.addEventListener("loaded",function(){k.onLoaded()})}},b.BitmapFontLoader=function(a,c){b.EventTarget.call(this),this.url=a,this.crossorigin=c,this.baseUrl=a.replace(/[^\/]*$/,""),this.texture=null},b.BitmapFontLoader.prototype.constructor=b.BitmapFontLoader,b.BitmapFontLoader.prototype.load=function(){this.ajaxRequest=new b.AjaxRequest;var a=this;this.ajaxRequest.onreadystatechange=function(){a.onXMLLoaded()},this.ajaxRequest.open("GET",this.url,!0),this.ajaxRequest.overrideMimeType&&this.ajaxRequest.overrideMimeType("application/xml"),this.ajaxRequest.send(null)},b.BitmapFontLoader.prototype.onXMLLoaded=function(){if(4===this.ajaxRequest.readyState&&(200===this.ajaxRequest.status||-1===window.location.protocol.indexOf("http"))){var a=this.ajaxRequest.responseXML;if(!a||/MSIE 9/i.test(navigator.userAgent)||navigator.isCocoonJS)if("function"==typeof window.DOMParser){var c=new DOMParser;a=c.parseFromString(this.ajaxRequest.responseText,"text/xml")}else{var d=document.createElement("div");d.innerHTML=this.ajaxRequest.responseText,a=d}var e=this.baseUrl+a.getElementsByTagName("page")[0].getAttribute("file"),f=new b.ImageLoader(e,this.crossorigin);this.texture=f.texture.baseTexture;var g={},h=a.getElementsByTagName("info")[0],i=a.getElementsByTagName("common")[0];g.font=h.getAttribute("face"),g.size=parseInt(h.getAttribute("size"),10),g.lineHeight=parseInt(i.getAttribute("lineHeight"),10),g.chars={};for(var j=a.getElementsByTagName("char"),k=0;k<j.length;k++){var l=parseInt(j[k].getAttribute("id"),10),m=new b.Rectangle(parseInt(j[k].getAttribute("x"),10),parseInt(j[k].getAttribute("y"),10),parseInt(j[k].getAttribute("width"),10),parseInt(j[k].getAttribute("height"),10));g.chars[l]={xOffset:parseInt(j[k].getAttribute("xoffset"),10),yOffset:parseInt(j[k].getAttribute("yoffset"),10),xAdvance:parseInt(j[k].getAttribute("xadvance"),10),kerning:{},texture:b.TextureCache[l]=new b.Texture(this.texture,m)}}var n=a.getElementsByTagName("kerning");for(k=0;k<n.length;k++){var o=parseInt(n[k].getAttribute("first"),10),p=parseInt(n[k].getAttribute("second"),10),q=parseInt(n[k].getAttribute("amount"),10);g.chars[p].kerning[o]=q}b.BitmapText.fonts[g.font]=g;var r=this;f.addEventListener("loaded",function(){r.onLoaded()}),f.load()}},b.BitmapFontLoader.prototype.onLoaded=function(){this.dispatchEvent({type:"loaded",content:this})},b.SpineLoader=function(a,c){b.EventTarget.call(this),this.url=a,this.crossorigin=c,this.loaded=!1},b.SpineLoader.prototype.constructor=b.SpineLoader,b.SpineLoader.prototype.load=function(){var a=this,c=new b.JsonLoader(this.url,this.crossorigin);
c.addEventListener("loaded",function(b){a.json=b.content.json,a.onLoaded()}),c.load()},b.SpineLoader.prototype.onLoaded=function(){this.loaded=!0,this.dispatchEvent({type:"loaded",content:this})},b.AbstractFilter=function(a,b){this.passes=[this],this.shaders=[],this.dirty=!0,this.padding=0,this.uniforms=b||{},this.fragmentSrc=a||[]},b.AlphaMaskFilter=function(a){b.AbstractFilter.call(this),this.passes=[this],a.baseTexture._powerOf2=!0,this.uniforms={mask:{type:"sampler2D",value:a},mapDimensions:{type:"2f",value:{x:1,y:5112}},dimensions:{type:"4fv",value:[0,0,0,0]}},a.baseTexture.hasLoaded?(this.uniforms.mask.value.x=a.width,this.uniforms.mask.value.y=a.height):(this.boundLoadedFunction=this.onTextureLoaded.bind(this),a.baseTexture.on("loaded",this.boundLoadedFunction)),this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform sampler2D mask;","uniform sampler2D uSampler;","uniform vec2 offset;","uniform vec4 dimensions;","uniform vec2 mapDimensions;","void main(void) {","   vec2 mapCords = vTextureCoord.xy;","   mapCords += (dimensions.zw + offset)/ dimensions.xy ;","   mapCords.y *= -1.0;","   mapCords.y += 1.0;","   mapCords *= dimensions.xy / mapDimensions;","   vec4 original =  texture2D(uSampler, vTextureCoord);","   float maskAlpha =  texture2D(mask, mapCords).r;","   original *= maskAlpha;","   gl_FragColor =  original;","}"]},b.AlphaMaskFilter.prototype=Object.create(b.AbstractFilter.prototype),b.AlphaMaskFilter.prototype.constructor=b.AlphaMaskFilter,b.AlphaMaskFilter.prototype.onTextureLoaded=function(){this.uniforms.mapDimensions.value.x=this.uniforms.mask.value.width,this.uniforms.mapDimensions.value.y=this.uniforms.mask.value.height,this.uniforms.mask.value.baseTexture.off("loaded",this.boundLoadedFunction)},Object.defineProperty(b.AlphaMaskFilter.prototype,"map",{get:function(){return this.uniforms.mask.value},set:function(a){this.uniforms.mask.value=a}}),b.ColorMatrixFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={matrix:{type:"mat4",value:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform float invert;","uniform mat4 matrix;","uniform sampler2D uSampler;","void main(void) {","   gl_FragColor = texture2D(uSampler, vTextureCoord) * matrix;","}"]},b.ColorMatrixFilter.prototype=Object.create(b.AbstractFilter.prototype),b.ColorMatrixFilter.prototype.constructor=b.ColorMatrixFilter,Object.defineProperty(b.ColorMatrixFilter.prototype,"matrix",{get:function(){return this.uniforms.matrix.value},set:function(a){this.uniforms.matrix.value=a}}),b.GrayFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={gray:{type:"1f",value:1}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform sampler2D uSampler;","uniform float gray;","void main(void) {","   gl_FragColor = texture2D(uSampler, vTextureCoord);","   gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.2126*gl_FragColor.r + 0.7152*gl_FragColor.g + 0.0722*gl_FragColor.b), gray);","}"]},b.GrayFilter.prototype=Object.create(b.AbstractFilter.prototype),b.GrayFilter.prototype.constructor=b.GrayFilter,Object.defineProperty(b.GrayFilter.prototype,"gray",{get:function(){return this.uniforms.gray.value},set:function(a){this.uniforms.gray.value=a}}),b.DisplacementFilter=function(a){b.AbstractFilter.call(this),this.passes=[this],a.baseTexture._powerOf2=!0,this.uniforms={displacementMap:{type:"sampler2D",value:a},scale:{type:"2f",value:{x:30,y:30}},offset:{type:"2f",value:{x:0,y:0}},mapDimensions:{type:"2f",value:{x:1,y:5112}},dimensions:{type:"4fv",value:[0,0,0,0]}},a.baseTexture.hasLoaded?(this.uniforms.mapDimensions.value.x=a.width,this.uniforms.mapDimensions.value.y=a.height):(this.boundLoadedFunction=this.onTextureLoaded.bind(this),a.baseTexture.on("loaded",this.boundLoadedFunction)),this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform sampler2D displacementMap;","uniform sampler2D uSampler;","uniform vec2 scale;","uniform vec2 offset;","uniform vec4 dimensions;","uniform vec2 mapDimensions;","void main(void) {","   vec2 mapCords = vTextureCoord.xy;","   mapCords += (dimensions.zw + offset)/ dimensions.xy ;","   mapCords.y *= -1.0;","   mapCords.y += 1.0;","   vec2 matSample = texture2D(displacementMap, mapCords).xy;","   matSample -= 0.5;","   matSample *= scale;","   matSample /= mapDimensions;","   gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x + matSample.x, vTextureCoord.y + matSample.y));","   gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb, 1.0);","   vec2 cord = vTextureCoord;","}"]},b.DisplacementFilter.prototype=Object.create(b.AbstractFilter.prototype),b.DisplacementFilter.prototype.constructor=b.DisplacementFilter,b.DisplacementFilter.prototype.onTextureLoaded=function(){this.uniforms.mapDimensions.value.x=this.uniforms.displacementMap.value.width,this.uniforms.mapDimensions.value.y=this.uniforms.displacementMap.value.height,this.uniforms.displacementMap.value.baseTexture.off("loaded",this.boundLoadedFunction)},Object.defineProperty(b.DisplacementFilter.prototype,"map",{get:function(){return this.uniforms.displacementMap.value},set:function(a){this.uniforms.displacementMap.value=a}}),Object.defineProperty(b.DisplacementFilter.prototype,"scale",{get:function(){return this.uniforms.scale.value},set:function(a){this.uniforms.scale.value=a}}),Object.defineProperty(b.DisplacementFilter.prototype,"offset",{get:function(){return this.uniforms.offset.value},set:function(a){this.uniforms.offset.value=a}}),b.PixelateFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={invert:{type:"1f",value:0},dimensions:{type:"4fv",value:new Float32Array([1e4,100,10,10])},pixelSize:{type:"2f",value:{x:10,y:10}}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform vec2 testDim;","uniform vec4 dimensions;","uniform vec2 pixelSize;","uniform sampler2D uSampler;","void main(void) {","   vec2 coord = vTextureCoord;","   vec2 size = dimensions.xy/pixelSize;","   vec2 color = floor( ( vTextureCoord * size ) ) / size + pixelSize/dimensions.xy * 0.5;","   gl_FragColor = texture2D(uSampler, color);","}"]},b.PixelateFilter.prototype=Object.create(b.AbstractFilter.prototype),b.PixelateFilter.prototype.constructor=b.PixelateFilter,Object.defineProperty(b.PixelateFilter.prototype,"size",{get:function(){return this.uniforms.pixelSize.value},set:function(a){this.dirty=!0,this.uniforms.pixelSize.value=a}}),b.BlurXFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={blur:{type:"1f",value:1/512}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform float blur;","uniform sampler2D uSampler;","void main(void) {","   vec4 sum = vec4(0.0);","   sum += texture2D(uSampler, vec2(vTextureCoord.x - 4.0*blur, vTextureCoord.y)) * 0.05;","   sum += texture2D(uSampler, vec2(vTextureCoord.x - 3.0*blur, vTextureCoord.y)) * 0.09;","   sum += texture2D(uSampler, vec2(vTextureCoord.x - 2.0*blur, vTextureCoord.y)) * 0.12;","   sum += texture2D(uSampler, vec2(vTextureCoord.x - blur, vTextureCoord.y)) * 0.15;","   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y)) * 0.16;","   sum += texture2D(uSampler, vec2(vTextureCoord.x + blur, vTextureCoord.y)) * 0.15;","   sum += texture2D(uSampler, vec2(vTextureCoord.x + 2.0*blur, vTextureCoord.y)) * 0.12;","   sum += texture2D(uSampler, vec2(vTextureCoord.x + 3.0*blur, vTextureCoord.y)) * 0.09;","   sum += texture2D(uSampler, vec2(vTextureCoord.x + 4.0*blur, vTextureCoord.y)) * 0.05;","   gl_FragColor = sum;","}"]},b.BlurXFilter.prototype=Object.create(b.AbstractFilter.prototype),b.BlurXFilter.prototype.constructor=b.BlurXFilter,Object.defineProperty(b.BlurXFilter.prototype,"blur",{get:function(){return this.uniforms.blur.value/(1/7e3)},set:function(a){this.dirty=!0,this.uniforms.blur.value=1/7e3*a}}),b.BlurYFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={blur:{type:"1f",value:1/512}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform float blur;","uniform sampler2D uSampler;","void main(void) {","   vec4 sum = vec4(0.0);","   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 4.0*blur)) * 0.05;","   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 3.0*blur)) * 0.09;","   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 2.0*blur)) * 0.12;","   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - blur)) * 0.15;","   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y)) * 0.16;","   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + blur)) * 0.15;","   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 2.0*blur)) * 0.12;","   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 3.0*blur)) * 0.09;","   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 4.0*blur)) * 0.05;","   gl_FragColor = sum;","}"]},b.BlurYFilter.prototype=Object.create(b.AbstractFilter.prototype),b.BlurYFilter.prototype.constructor=b.BlurYFilter,Object.defineProperty(b.BlurYFilter.prototype,"blur",{get:function(){return this.uniforms.blur.value/(1/7e3)},set:function(a){this.uniforms.blur.value=1/7e3*a}}),b.BlurFilter=function(){this.blurXFilter=new b.BlurXFilter,this.blurYFilter=new b.BlurYFilter,this.passes=[this.blurXFilter,this.blurYFilter]},Object.defineProperty(b.BlurFilter.prototype,"blur",{get:function(){return this.blurXFilter.blur},set:function(a){this.blurXFilter.blur=this.blurYFilter.blur=a}}),Object.defineProperty(b.BlurFilter.prototype,"blurX",{get:function(){return this.blurXFilter.blur},set:function(a){this.blurXFilter.blur=a}}),Object.defineProperty(b.BlurFilter.prototype,"blurY",{get:function(){return this.blurYFilter.blur},set:function(a){this.blurYFilter.blur=a}}),b.InvertFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={invert:{type:"1f",value:1}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform float invert;","uniform sampler2D uSampler;","void main(void) {","   gl_FragColor = texture2D(uSampler, vTextureCoord);","   gl_FragColor.rgb = mix( (vec3(1)-gl_FragColor.rgb) * gl_FragColor.a, gl_FragColor.rgb, 1.0 - invert);","}"]},b.InvertFilter.prototype=Object.create(b.AbstractFilter.prototype),b.InvertFilter.prototype.constructor=b.InvertFilter,Object.defineProperty(b.InvertFilter.prototype,"invert",{get:function(){return this.uniforms.invert.value},set:function(a){this.uniforms.invert.value=a}}),b.SepiaFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={sepia:{type:"1f",value:1}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform float sepia;","uniform sampler2D uSampler;","const mat3 sepiaMatrix = mat3(0.3588, 0.7044, 0.1368, 0.2990, 0.5870, 0.1140, 0.2392, 0.4696, 0.0912);","void main(void) {","   gl_FragColor = texture2D(uSampler, vTextureCoord);","   gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * sepiaMatrix, sepia);","}"]},b.SepiaFilter.prototype=Object.create(b.AbstractFilter.prototype),b.SepiaFilter.prototype.constructor=b.SepiaFilter,Object.defineProperty(b.SepiaFilter.prototype,"sepia",{get:function(){return this.uniforms.sepia.value},set:function(a){this.uniforms.sepia.value=a}}),b.TwistFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={radius:{type:"1f",value:.5},angle:{type:"1f",value:5},offset:{type:"2f",value:{x:.5,y:.5}}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform vec4 dimensions;","uniform sampler2D uSampler;","uniform float radius;","uniform float angle;","uniform vec2 offset;","void main(void) {","   vec2 coord = vTextureCoord - offset;","   float distance = length(coord);","   if (distance < radius) {","       float ratio = (radius - distance) / radius;","       float angleMod = ratio * ratio * angle;","       float s = sin(angleMod);","       float c = cos(angleMod);","       coord = vec2(coord.x * c - coord.y * s, coord.x * s + coord.y * c);","   }","   gl_FragColor = texture2D(uSampler, coord+offset);","}"]},b.TwistFilter.prototype=Object.create(b.AbstractFilter.prototype),b.TwistFilter.prototype.constructor=b.TwistFilter,Object.defineProperty(b.TwistFilter.prototype,"offset",{get:function(){return this.uniforms.offset.value},set:function(a){this.dirty=!0,this.uniforms.offset.value=a}}),Object.defineProperty(b.TwistFilter.prototype,"radius",{get:function(){return this.uniforms.radius.value},set:function(a){this.dirty=!0,this.uniforms.radius.value=a}}),Object.defineProperty(b.TwistFilter.prototype,"angle",{get:function(){return this.uniforms.angle.value},set:function(a){this.dirty=!0,this.uniforms.angle.value=a}}),b.ColorStepFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={step:{type:"1f",value:5}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform sampler2D uSampler;","uniform float step;","void main(void) {","   vec4 color = texture2D(uSampler, vTextureCoord);","   color = floor(color * step) / step;","   gl_FragColor = color;","}"]},b.ColorStepFilter.prototype=Object.create(b.AbstractFilter.prototype),b.ColorStepFilter.prototype.constructor=b.ColorStepFilter,Object.defineProperty(b.ColorStepFilter.prototype,"step",{get:function(){return this.uniforms.step.value},set:function(a){this.uniforms.step.value=a}}),b.DotScreenFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={scale:{type:"1f",value:1},angle:{type:"1f",value:5},dimensions:{type:"4fv",value:[0,0,0,0]}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform vec4 dimensions;","uniform sampler2D uSampler;","uniform float angle;","uniform float scale;","float pattern() {","   float s = sin(angle), c = cos(angle);","   vec2 tex = vTextureCoord * dimensions.xy;","   vec2 point = vec2(","       c * tex.x - s * tex.y,","       s * tex.x + c * tex.y","   ) * scale;","   return (sin(point.x) * sin(point.y)) * 4.0;","}","void main() {","   vec4 color = texture2D(uSampler, vTextureCoord);","   float average = (color.r + color.g + color.b) / 3.0;","   gl_FragColor = vec4(vec3(average * 10.0 - 5.0 + pattern()), color.a);","}"]},b.DotScreenFilter.prototype=Object.create(b.AbstractFilter.prototype),b.DotScreenFilter.prototype.constructor=b.DotScreenFilter,Object.defineProperty(b.DotScreenFilter.prototype,"scale",{get:function(){return this.uniforms.scale.value},set:function(a){this.dirty=!0,this.uniforms.scale.value=a}}),Object.defineProperty(b.DotScreenFilter.prototype,"angle",{get:function(){return this.uniforms.angle.value},set:function(a){this.dirty=!0,this.uniforms.angle.value=a}}),b.CrossHatchFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={blur:{type:"1f",value:1/512}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform float blur;","uniform sampler2D uSampler;","void main(void) {","    float lum = length(texture2D(uSampler, vTextureCoord.xy).rgb);","    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);","    if (lum < 1.00) {","        if (mod(gl_FragCoord.x + gl_FragCoord.y, 10.0) == 0.0) {","            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);","        }","    }","    if (lum < 0.75) {","        if (mod(gl_FragCoord.x - gl_FragCoord.y, 10.0) == 0.0) {","            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);","        }","    }","    if (lum < 0.50) {","        if (mod(gl_FragCoord.x + gl_FragCoord.y - 5.0, 10.0) == 0.0) {","            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);","        }","    }","    if (lum < 0.3) {","        if (mod(gl_FragCoord.x - gl_FragCoord.y - 5.0, 10.0) == 0.0) {","            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);","        }","    }","}"]},b.CrossHatchFilter.prototype=Object.create(b.AbstractFilter.prototype),b.CrossHatchFilter.prototype.constructor=b.BlurYFilter,Object.defineProperty(b.CrossHatchFilter.prototype,"blur",{get:function(){return this.uniforms.blur.value/(1/7e3)},set:function(a){this.uniforms.blur.value=1/7e3*a}}),b.RGBSplitFilter=function(){b.AbstractFilter.call(this),this.passes=[this],this.uniforms={red:{type:"2f",value:{x:20,y:20}},green:{type:"2f",value:{x:-20,y:20}},blue:{type:"2f",value:{x:20,y:-20}},dimensions:{type:"4fv",value:[0,0,0,0]}},this.fragmentSrc=["precision mediump float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform vec2 red;","uniform vec2 green;","uniform vec2 blue;","uniform vec4 dimensions;","uniform sampler2D uSampler;","void main(void) {","   gl_FragColor.r = texture2D(uSampler, vTextureCoord + red/dimensions.xy).r;","   gl_FragColor.g = texture2D(uSampler, vTextureCoord + green/dimensions.xy).g;","   gl_FragColor.b = texture2D(uSampler, vTextureCoord + blue/dimensions.xy).b;","   gl_FragColor.a = texture2D(uSampler, vTextureCoord).a;","}"]},b.RGBSplitFilter.prototype=Object.create(b.AbstractFilter.prototype),b.RGBSplitFilter.prototype.constructor=b.RGBSplitFilter,Object.defineProperty(b.RGBSplitFilter.prototype,"angle",{get:function(){return this.uniforms.blur.value/(1/7e3)},set:function(a){this.uniforms.blur.value=1/7e3*a}}),"undefined"!=typeof exports?("undefined"!=typeof module&&module.exports&&(exports=module.exports=b),exports.PIXI=b):"undefined"!=typeof define&&define.amd?define(b):a.PIXI=b}).call(this);
}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../bower_components/pixi/bin/pixi.js","/../bower_components/pixi/bin")
},{"1YiZ5S":14,"buffer":11}],3:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
//     Underscore.js 1.6.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.6.0';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return obj;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      var keys = _.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
      }
    }
    return obj;
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    any(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(predicate, context);
    each(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, function(value, index, list) {
      return !predicate.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(predicate, context);
    each(obj, function(value, index, list) {
      if (!(result = result && predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(predicate, context);
    each(obj, function(value, index, list) {
      if (result || (result = predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    var result = -Infinity, lastComputed = -Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed > lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    var result = Infinity, lastComputed = Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed < lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Shuffle an array, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return value;
    return _.property(value);
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, iterator, context) {
    iterator = lookupIterator(iterator);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iterator, context) {
      var result = {};
      iterator = lookupIterator(iterator);
      each(obj, function(value, index) {
        var key = iterator.call(context, value, index, obj);
        behavior(result, key, value);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, key, value) {
    _.has(result, key) ? result[key].push(value) : result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, key, value) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, key) {
    _.has(result, key) ? result[key]++ : result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    each(input, function(value) {
      if (_.isArray(value) || _.isArguments(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Split an array into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(array, predicate) {
    var pass = [], fail = [];
    each(array, function(elem) {
      (predicate(elem) ? pass : fail).push(elem);
    });
    return [pass, fail];
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.contains(other, item);
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var length = _.max(_.pluck(arguments, 'length').concat(0));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, '' + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, length + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(length);

    while(idx < length) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) throw new Error('bindAll must be passed function names');
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    options || (options = {});
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;
      if (last < wait) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = new Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = new Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] === void 0) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                             _.isFunction(bCtor) && (bCtor instanceof bCtor))
                        && ('constructor' in a && 'constructor' in b)) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  _.constant = function(value) {
    return function () {
      return value;
    };
  };

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    return function(obj) {
      if (obj === attrs) return true; //avoid comparing an object to itself.
      for (var key in attrs) {
        if (attrs[key] !== obj[key])
          return false;
      }
      return true;
    }
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(Math.max(0, n));
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() { return new Date().getTime(); };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}).call(this);

}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../bower_components/underscore/underscore.js","/../bower_components/underscore")
},{"1YiZ5S":14,"buffer":11}],4:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/**
 * Created by arlando on 7/26/14.
 */
'use strict';
var async = require('../bower_components/async/lib/async');
var _ = require('../bower_components/underscore/underscore');

function AdjacencyList(graphics, grid) {
        if (graphics === void 0) throw new Error('Must have a graphics!');
        if (grid === void 0) throw new Error('Must have a grid!');
        this.setup(graphics, grid);
}

AdjacencyList.prototype = {
    setup: function (graphics, grid) {
        this.list = {};
        this.nodeList = [];
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
        this.nodeList.push(node);
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
        if (this.graphics === void 0) {
            throw new Error("Cannot draw without graphics.");
        }

        var self = this;
        var drawList = _.clone(this.nodeList); //Do not want to mutate actual list.
        _.forEach(drawList, this._removeNodeFromOtherLists, this);
        async.series({
//            removeNodesFromOtherLists: function () {
//
//                async.each(self.drawList, self._removeNodeFromOtherLists, function (err) {
//                    if (err) throw err;
//                });
//            },
            drawEdges: function (callback) {
                async.each(drawList, self._drawEdge.bind(self), function (err) {
                    if (err) throw err;
                    //console.log('z');
                });

                callback(null, drawList);
            },
            drawNodes: function (callback) {
                async.each(drawList, self._drawNode.bind(self), function (err) {
                    if (err) throw err;
                });
                callback(null, drawList)
            }
        },
        function (err) {
            if (err) throw err;
        });
        //_.forEach(this.drawList, this.removeNodeFromOtherLists, this);
        //_.forEach(this.drawList, this._drawEdge, this);
        //_.forEach(this.drawList, this._drawNode, this);
    },

    _removeNodeFromOtherLists: function (node, callback) {
        _.each(node.getConnections(), function (connectedNode) {
            //remove the current node from the connect node's list of connections
            connectedNode.removeConnection(node);
        }, this);
        //callback();
    },

    //TODO BETTER PRIVATE FUNCTIONS
    _drawNode: function (node, callback) {
        node.draw(this.graphics);
        callback();
    },

    //TODO BETTER PRIVATE FUNCTIONS
    _drawEdge: function (node, callback) {
        _.each(node.getConnections(), function(connectedNode) {
            this.drawConnection(node, connectedNode);
        }, this);
        callback();
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
        this.grid.draw(this.graphics);
    }

};

module.exports = AdjacencyList;
}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/AdjacencyList.js","/")
},{"../bower_components/async/lib/async":1,"../bower_components/underscore/underscore":3,"1YiZ5S":14,"buffer":11}],5:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
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
    },

    draw: function (graphics) {
        for(var i in this.nodes) {
            graphics.drawCircle(this.nodes[i].location.x, this.nodes[i].location.y, 50);
        }
    }
};

module.exports = Grid;
}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Grid.js","/")
},{"./SETTINGS":7,"./Vector":8,"1YiZ5S":14,"buffer":11}],6:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
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

    draw: function (graphics) {
        var nodeLocation = this.getLocation();
        graphics.drawCircle(nodeLocation.x, nodeLocation.y, SETTINGS.RADIUS);
    }
};

module.exports = Node;
}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Node.js","/")
},{"./SETTINGS":7,"./Vector":8,"1YiZ5S":14,"buffer":11}],7:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/**
 * Created by arlando on 7/26/14.
 */
'use strict';

module.exports.NODE = Object.freeze({
    RADIUS: 25
});

module.exports.GRID = Object.freeze({
    STEP_X: 100,
    STEP_Y : 100,
    MAX_NODES_X: 3,
    MAX_NODES_Y: 3
});
}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/SETTINGS.js","/")
},{"1YiZ5S":14,"buffer":11}],8:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/**
 * Created by arlando on 7/26/14.
 */
'use strict';

function Vector(x, y) {
    this.x = x || 0;
    this.y = y || 0;
}

Vector.prototype.add = function (x, y) {
    this.x += x;
    this.y += y;
    return this;
};

module.exports = Vector;
}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Vector.js","/")
},{"1YiZ5S":14,"buffer":11}],9:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
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
}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_440286d4.js","/")
},{"../bower_components/pixi/bin/pixi.js":2,"./AdjacencyList":4,"./Grid":5,"./Node":6,"1YiZ5S":14,"buffer":11,"domready":10}],10:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
  * domready (c) Dustin Diaz 2014 - License MIT
  */
!function (name, definition) {

  if (typeof module != 'undefined') module.exports = definition()
  else if (typeof define == 'function' && typeof define.amd == 'object') define(definition)
  else this[name] = definition()

}('domready', function () {

  var fns = [], listener
    , doc = document
    , domContentLoaded = 'DOMContentLoaded'
    , loaded = /^loaded|^i|^c/.test(doc.readyState)

  if (!loaded)
  doc.addEventListener(domContentLoaded, listener = function () {
    doc.removeEventListener(domContentLoaded, listener)
    loaded = 1
    while (listener = fns.shift()) listener()
  })

  return function (fn) {
    loaded ? fn() : fns.push(fn)
  }

});

}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/domready/ready.js","/../node_modules/domready")
},{"1YiZ5S":14,"buffer":11}],11:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/index.js","/../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer")
},{"1YiZ5S":14,"base64-js":12,"buffer":11,"ieee754":13}],12:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js","/../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib")
},{"1YiZ5S":14,"buffer":11}],13:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js","/../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/ieee754")
},{"1YiZ5S":14,"buffer":11}],14:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/gulp-browserify/node_modules/browserify/node_modules/process/browser.js","/../node_modules/gulp-browserify/node_modules/browserify/node_modules/process")
},{"1YiZ5S":14,"buffer":11}]},{},[9])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9hcmxhbmRvL3NpZGVwcm9qZWN0cy9waXh4aS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvYXJsYW5kby9zaWRlcHJvamVjdHMvcGl4eGkvYm93ZXJfY29tcG9uZW50cy9hc3luYy9saWIvYXN5bmMuanMiLCIvVXNlcnMvYXJsYW5kby9zaWRlcHJvamVjdHMvcGl4eGkvYm93ZXJfY29tcG9uZW50cy9waXhpL2Jpbi9waXhpLmpzIiwiL1VzZXJzL2FybGFuZG8vc2lkZXByb2plY3RzL3BpeHhpL2Jvd2VyX2NvbXBvbmVudHMvdW5kZXJzY29yZS91bmRlcnNjb3JlLmpzIiwiL1VzZXJzL2FybGFuZG8vc2lkZXByb2plY3RzL3BpeHhpL2pzL0FkamFjZW5jeUxpc3QuanMiLCIvVXNlcnMvYXJsYW5kby9zaWRlcHJvamVjdHMvcGl4eGkvanMvR3JpZC5qcyIsIi9Vc2Vycy9hcmxhbmRvL3NpZGVwcm9qZWN0cy9waXh4aS9qcy9Ob2RlLmpzIiwiL1VzZXJzL2FybGFuZG8vc2lkZXByb2plY3RzL3BpeHhpL2pzL1NFVFRJTkdTLmpzIiwiL1VzZXJzL2FybGFuZG8vc2lkZXByb2plY3RzL3BpeHhpL2pzL1ZlY3Rvci5qcyIsIi9Vc2Vycy9hcmxhbmRvL3NpZGVwcm9qZWN0cy9waXh4aS9qcy9mYWtlXzQ0MDI4NmQ0LmpzIiwiL1VzZXJzL2FybGFuZG8vc2lkZXByb2plY3RzL3BpeHhpL25vZGVfbW9kdWxlcy9kb21yZWFkeS9yZWFkeS5qcyIsIi9Vc2Vycy9hcmxhbmRvL3NpZGVwcm9qZWN0cy9waXh4aS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCIvVXNlcnMvYXJsYW5kby9zaWRlcHJvamVjdHMvcGl4eGkvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi9Vc2Vycy9hcmxhbmRvL3NpZGVwcm9qZWN0cy9waXh4aS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCIvVXNlcnMvYXJsYW5kby9zaWRlcHJvamVjdHMvcGl4eGkvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcm1DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqMENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmxDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8qIVxuICogYXN5bmNcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9jYW9sYW4vYXN5bmNcbiAqXG4gKiBDb3B5cmlnaHQgMjAxMC0yMDE0IENhb2xhbiBNY01haG9uXG4gKiBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2VcbiAqL1xuLypqc2hpbnQgb25ldmFyOiBmYWxzZSwgaW5kZW50OjQgKi9cbi8qZ2xvYmFsIHNldEltbWVkaWF0ZTogZmFsc2UsIHNldFRpbWVvdXQ6IGZhbHNlLCBjb25zb2xlOiBmYWxzZSAqL1xuKGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBhc3luYyA9IHt9O1xuXG4gICAgLy8gZ2xvYmFsIG9uIHRoZSBzZXJ2ZXIsIHdpbmRvdyBpbiB0aGUgYnJvd3NlclxuICAgIHZhciByb290LCBwcmV2aW91c19hc3luYztcblxuICAgIHJvb3QgPSB0aGlzO1xuICAgIGlmIChyb290ICE9IG51bGwpIHtcbiAgICAgIHByZXZpb3VzX2FzeW5jID0gcm9vdC5hc3luYztcbiAgICB9XG5cbiAgICBhc3luYy5ub0NvbmZsaWN0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByb290LmFzeW5jID0gcHJldmlvdXNfYXN5bmM7XG4gICAgICAgIHJldHVybiBhc3luYztcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gb25seV9vbmNlKGZuKSB7XG4gICAgICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKGNhbGxlZCkgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgd2FzIGFscmVhZHkgY2FsbGVkLlwiKTtcbiAgICAgICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICBmbi5hcHBseShyb290LCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8vLyBjcm9zcy1icm93c2VyIGNvbXBhdGlibGl0eSBmdW5jdGlvbnMgLy8vL1xuXG4gICAgdmFyIF90b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbiAgICB2YXIgX2lzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIF90b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgfTtcblxuICAgIHZhciBfZWFjaCA9IGZ1bmN0aW9uIChhcnIsIGl0ZXJhdG9yKSB7XG4gICAgICAgIGlmIChhcnIuZm9yRWFjaCkge1xuICAgICAgICAgICAgcmV0dXJuIGFyci5mb3JFYWNoKGl0ZXJhdG9yKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgaXRlcmF0b3IoYXJyW2ldLCBpLCBhcnIpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHZhciBfbWFwID0gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IpIHtcbiAgICAgICAgaWYgKGFyci5tYXApIHtcbiAgICAgICAgICAgIHJldHVybiBhcnIubWFwKGl0ZXJhdG9yKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBfZWFjaChhcnIsIGZ1bmN0aW9uICh4LCBpLCBhKSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IoeCwgaSwgYSkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfTtcblxuICAgIHZhciBfcmVkdWNlID0gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IsIG1lbW8pIHtcbiAgICAgICAgaWYgKGFyci5yZWR1Y2UpIHtcbiAgICAgICAgICAgIHJldHVybiBhcnIucmVkdWNlKGl0ZXJhdG9yLCBtZW1vKTtcbiAgICAgICAgfVxuICAgICAgICBfZWFjaChhcnIsIGZ1bmN0aW9uICh4LCBpLCBhKSB7XG4gICAgICAgICAgICBtZW1vID0gaXRlcmF0b3IobWVtbywgeCwgaSwgYSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9O1xuXG4gICAgdmFyIF9rZXlzID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgICB9XG4gICAgICAgIHZhciBrZXlzID0gW107XG4gICAgICAgIGZvciAodmFyIGsgaW4gb2JqKSB7XG4gICAgICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGspKSB7XG4gICAgICAgICAgICAgICAga2V5cy5wdXNoKGspO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBrZXlzO1xuICAgIH07XG5cbiAgICAvLy8vIGV4cG9ydGVkIGFzeW5jIG1vZHVsZSBmdW5jdGlvbnMgLy8vL1xuXG4gICAgLy8vLyBuZXh0VGljayBpbXBsZW1lbnRhdGlvbiB3aXRoIGJyb3dzZXItY29tcGF0aWJsZSBmYWxsYmFjayAvLy8vXG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzID09PSAndW5kZWZpbmVkJyB8fCAhKHByb2Nlc3MubmV4dFRpY2spKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBhc3luYy5uZXh0VGljayA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgICAgIC8vIG5vdCBhIGRpcmVjdCBhbGlhcyBmb3IgSUUxMCBjb21wYXRpYmlsaXR5XG4gICAgICAgICAgICAgICAgc2V0SW1tZWRpYXRlKGZuKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUgPSBhc3luYy5uZXh0VGljaztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGFzeW5jLm5leHRUaWNrID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYXN5bmMuc2V0SW1tZWRpYXRlID0gYXN5bmMubmV4dFRpY2s7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGFzeW5jLm5leHRUaWNrID0gcHJvY2Vzcy5uZXh0VGljaztcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRJbW1lZGlhdGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgICAgLy8gbm90IGEgZGlyZWN0IGFsaWFzIGZvciBJRTEwIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAgICAgc2V0SW1tZWRpYXRlKGZuKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUgPSBhc3luYy5uZXh0VGljaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jLmVhY2ggPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKCFhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY29tcGxldGVkID0gMDtcbiAgICAgICAgX2VhY2goYXJyLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgaXRlcmF0b3IoeCwgb25seV9vbmNlKGRvbmUpICk7XG4gICAgICAgIH0pO1xuICAgICAgICBmdW5jdGlvbiBkb25lKGVycikge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuICAgIGFzeW5jLmZvckVhY2ggPSBhc3luYy5lYWNoO1xuXG4gICAgYXN5bmMuZWFjaFNlcmllcyA9IGZ1bmN0aW9uIChhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgICAgICB2YXIgaXRlcmF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKGFycltjb21wbGV0ZWRdLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb21wbGV0ZWQgPj0gYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZXJhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBpdGVyYXRlKCk7XG4gICAgfTtcbiAgICBhc3luYy5mb3JFYWNoU2VyaWVzID0gYXN5bmMuZWFjaFNlcmllcztcblxuICAgIGFzeW5jLmVhY2hMaW1pdCA9IGZ1bmN0aW9uIChhcnIsIGxpbWl0LCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGZuID0gX2VhY2hMaW1pdChsaW1pdCk7XG4gICAgICAgIGZuLmFwcGx5KG51bGwsIFthcnIsIGl0ZXJhdG9yLCBjYWxsYmFja10pO1xuICAgIH07XG4gICAgYXN5bmMuZm9yRWFjaExpbWl0ID0gYXN5bmMuZWFjaExpbWl0O1xuXG4gICAgdmFyIF9lYWNoTGltaXQgPSBmdW5jdGlvbiAobGltaXQpIHtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgaWYgKCFhcnIubGVuZ3RoIHx8IGxpbWl0IDw9IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgICAgICAgICAgdmFyIHN0YXJ0ZWQgPSAwO1xuICAgICAgICAgICAgdmFyIHJ1bm5pbmcgPSAwO1xuXG4gICAgICAgICAgICAoZnVuY3Rpb24gcmVwbGVuaXNoICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgd2hpbGUgKHJ1bm5pbmcgPCBsaW1pdCAmJiBzdGFydGVkIDwgYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBzdGFydGVkICs9IDE7XG4gICAgICAgICAgICAgICAgICAgIHJ1bm5pbmcgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgaXRlcmF0b3IoYXJyW3N0YXJ0ZWQgLSAxXSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bm5pbmcgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxlbmlzaCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkoKTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG5cbiAgICB2YXIgZG9QYXJhbGxlbCA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFthc3luYy5lYWNoXS5jb25jYXQoYXJncykpO1xuICAgICAgICB9O1xuICAgIH07XG4gICAgdmFyIGRvUGFyYWxsZWxMaW1pdCA9IGZ1bmN0aW9uKGxpbWl0LCBmbikge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFtfZWFjaExpbWl0KGxpbWl0KV0uY29uY2F0KGFyZ3MpKTtcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIHZhciBkb1NlcmllcyA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFthc3luYy5lYWNoU2VyaWVzXS5jb25jYXQoYXJncykpO1xuICAgICAgICB9O1xuICAgIH07XG5cblxuICAgIHZhciBfYXN5bmNNYXAgPSBmdW5jdGlvbiAoZWFjaGZuLCBhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBhcnIgPSBfbWFwKGFyciwgZnVuY3Rpb24gKHgsIGkpIHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGksIHZhbHVlOiB4fTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1t4LmluZGV4XSA9IHY7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBhc3luYy5tYXAgPSBkb1BhcmFsbGVsKF9hc3luY01hcCk7XG4gICAgYXN5bmMubWFwU2VyaWVzID0gZG9TZXJpZXMoX2FzeW5jTWFwKTtcbiAgICBhc3luYy5tYXBMaW1pdCA9IGZ1bmN0aW9uIChhcnIsIGxpbWl0LCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgcmV0dXJuIF9tYXBMaW1pdChsaW1pdCkoYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spO1xuICAgIH07XG5cbiAgICB2YXIgX21hcExpbWl0ID0gZnVuY3Rpb24obGltaXQpIHtcbiAgICAgICAgcmV0dXJuIGRvUGFyYWxsZWxMaW1pdChsaW1pdCwgX2FzeW5jTWFwKTtcbiAgICB9O1xuXG4gICAgLy8gcmVkdWNlIG9ubHkgaGFzIGEgc2VyaWVzIHZlcnNpb24sIGFzIGRvaW5nIHJlZHVjZSBpbiBwYXJhbGxlbCB3b24ndFxuICAgIC8vIHdvcmsgaW4gbWFueSBzaXR1YXRpb25zLlxuICAgIGFzeW5jLnJlZHVjZSA9IGZ1bmN0aW9uIChhcnIsIG1lbW8sIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBhc3luYy5lYWNoU2VyaWVzKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihtZW1vLCB4LCBmdW5jdGlvbiAoZXJyLCB2KSB7XG4gICAgICAgICAgICAgICAgbWVtbyA9IHY7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIG1lbW8pO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8vIGluamVjdCBhbGlhc1xuICAgIGFzeW5jLmluamVjdCA9IGFzeW5jLnJlZHVjZTtcbiAgICAvLyBmb2xkbCBhbGlhc1xuICAgIGFzeW5jLmZvbGRsID0gYXN5bmMucmVkdWNlO1xuXG4gICAgYXN5bmMucmVkdWNlUmlnaHQgPSBmdW5jdGlvbiAoYXJyLCBtZW1vLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHJldmVyc2VkID0gX21hcChhcnIsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICByZXR1cm4geDtcbiAgICAgICAgfSkucmV2ZXJzZSgpO1xuICAgICAgICBhc3luYy5yZWR1Y2UocmV2ZXJzZWQsIG1lbW8sIGl0ZXJhdG9yLCBjYWxsYmFjayk7XG4gICAgfTtcbiAgICAvLyBmb2xkciBhbGlhc1xuICAgIGFzeW5jLmZvbGRyID0gYXN5bmMucmVkdWNlUmlnaHQ7XG5cbiAgICB2YXIgX2ZpbHRlciA9IGZ1bmN0aW9uIChlYWNoZm4sIGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIGFyciA9IF9tYXAoYXJyLCBmdW5jdGlvbiAoeCwgaSkge1xuICAgICAgICAgICAgcmV0dXJuIHtpbmRleDogaSwgdmFsdWU6IHh9O1xuICAgICAgICB9KTtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh4KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhfbWFwKHJlc3VsdHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhLmluZGV4IC0gYi5pbmRleDtcbiAgICAgICAgICAgIH0pLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB4LnZhbHVlO1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIGFzeW5jLmZpbHRlciA9IGRvUGFyYWxsZWwoX2ZpbHRlcik7XG4gICAgYXN5bmMuZmlsdGVyU2VyaWVzID0gZG9TZXJpZXMoX2ZpbHRlcik7XG4gICAgLy8gc2VsZWN0IGFsaWFzXG4gICAgYXN5bmMuc2VsZWN0ID0gYXN5bmMuZmlsdGVyO1xuICAgIGFzeW5jLnNlbGVjdFNlcmllcyA9IGFzeW5jLmZpbHRlclNlcmllcztcblxuICAgIHZhciBfcmVqZWN0ID0gZnVuY3Rpb24gKGVhY2hmbiwgYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgYXJyID0gX21hcChhcnIsIGZ1bmN0aW9uICh4LCBpKSB7XG4gICAgICAgICAgICByZXR1cm4ge2luZGV4OiBpLCB2YWx1ZTogeH07XG4gICAgICAgIH0pO1xuICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgaWYgKCF2KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh4KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhfbWFwKHJlc3VsdHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhLmluZGV4IC0gYi5pbmRleDtcbiAgICAgICAgICAgIH0pLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB4LnZhbHVlO1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIGFzeW5jLnJlamVjdCA9IGRvUGFyYWxsZWwoX3JlamVjdCk7XG4gICAgYXN5bmMucmVqZWN0U2VyaWVzID0gZG9TZXJpZXMoX3JlamVjdCk7XG5cbiAgICB2YXIgX2RldGVjdCA9IGZ1bmN0aW9uIChlYWNoZm4sIGFyciwgaXRlcmF0b3IsIG1haW5fY2FsbGJhY2spIHtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LCBmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICBtYWluX2NhbGxiYWNrKHgpO1xuICAgICAgICAgICAgICAgICAgICBtYWluX2NhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBtYWluX2NhbGxiYWNrKCk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgYXN5bmMuZGV0ZWN0ID0gZG9QYXJhbGxlbChfZGV0ZWN0KTtcbiAgICBhc3luYy5kZXRlY3RTZXJpZXMgPSBkb1NlcmllcyhfZGV0ZWN0KTtcblxuICAgIGFzeW5jLnNvbWUgPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgbWFpbl9jYWxsYmFjaykge1xuICAgICAgICBhc3luYy5lYWNoKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LCBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIG1haW5fY2FsbGJhY2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIG1haW5fY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBtYWluX2NhbGxiYWNrKGZhbHNlKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICAvLyBhbnkgYWxpYXNcbiAgICBhc3luYy5hbnkgPSBhc3luYy5zb21lO1xuXG4gICAgYXN5bmMuZXZlcnkgPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgbWFpbl9jYWxsYmFjaykge1xuICAgICAgICBhc3luYy5lYWNoKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LCBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIGlmICghdikge1xuICAgICAgICAgICAgICAgICAgICBtYWluX2NhbGxiYWNrKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgbWFpbl9jYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIG1haW5fY2FsbGJhY2sodHJ1ZSk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgLy8gYWxsIGFsaWFzXG4gICAgYXN5bmMuYWxsID0gYXN5bmMuZXZlcnk7XG5cbiAgICBhc3luYy5zb3J0QnkgPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgYXN5bmMubWFwKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LCBmdW5jdGlvbiAoZXJyLCBjcml0ZXJpYSkge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHt2YWx1ZTogeCwgY3JpdGVyaWE6IGNyaXRlcmlhfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBmbiA9IGZ1bmN0aW9uIChsZWZ0LCByaWdodCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYSA9IGxlZnQuY3JpdGVyaWEsIGIgPSByaWdodC5jcml0ZXJpYTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGEgPCBiID8gLTEgOiBhID4gYiA/IDEgOiAwO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgX21hcChyZXN1bHRzLnNvcnQoZm4pLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geC52YWx1ZTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBhc3luYy5hdXRvID0gZnVuY3Rpb24gKHRhc2tzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICB2YXIga2V5cyA9IF9rZXlzKHRhc2tzKTtcbiAgICAgICAgdmFyIHJlbWFpbmluZ1Rhc2tzID0ga2V5cy5sZW5ndGhcbiAgICAgICAgaWYgKCFyZW1haW5pbmdUYXNrcykge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuXG4gICAgICAgIHZhciBsaXN0ZW5lcnMgPSBbXTtcbiAgICAgICAgdmFyIGFkZExpc3RlbmVyID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnMudW5zaGlmdChmbik7XG4gICAgICAgIH07XG4gICAgICAgIHZhciByZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBpZiAobGlzdGVuZXJzW2ldID09PSBmbikge1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB2YXIgdGFza0NvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmVtYWluaW5nVGFza3MtLVxuICAgICAgICAgICAgX2VhY2gobGlzdGVuZXJzLnNsaWNlKDApLCBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgYWRkTGlzdGVuZXIoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCFyZW1haW5pbmdUYXNrcykge1xuICAgICAgICAgICAgICAgIHZhciB0aGVDYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgICAgIC8vIHByZXZlbnQgZmluYWwgY2FsbGJhY2sgZnJvbSBjYWxsaW5nIGl0c2VsZiBpZiBpdCBlcnJvcnNcbiAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuXG4gICAgICAgICAgICAgICAgdGhlQ2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIF9lYWNoKGtleXMsIGZ1bmN0aW9uIChrKSB7XG4gICAgICAgICAgICB2YXIgdGFzayA9IF9pc0FycmF5KHRhc2tzW2tdKSA/IHRhc2tzW2tdOiBbdGFza3Nba11dO1xuICAgICAgICAgICAgdmFyIHRhc2tDYWxsYmFjayA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNhZmVSZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgIF9lYWNoKF9rZXlzKHJlc3VsdHMpLCBmdW5jdGlvbihya2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzYWZlUmVzdWx0c1tya2V5XSA9IHJlc3VsdHNbcmtleV07XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzYWZlUmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgc2FmZVJlc3VsdHMpO1xuICAgICAgICAgICAgICAgICAgICAvLyBzdG9wIHN1YnNlcXVlbnQgZXJyb3JzIGhpdHRpbmcgY2FsbGJhY2sgbXVsdGlwbGUgdGltZXNcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUodGFza0NvbXBsZXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIHJlcXVpcmVzID0gdGFzay5zbGljZSgwLCBNYXRoLmFicyh0YXNrLmxlbmd0aCAtIDEpKSB8fCBbXTtcbiAgICAgICAgICAgIHZhciByZWFkeSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gX3JlZHVjZShyZXF1aXJlcywgZnVuY3Rpb24gKGEsIHgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChhICYmIHJlc3VsdHMuaGFzT3duUHJvcGVydHkoeCkpO1xuICAgICAgICAgICAgICAgIH0sIHRydWUpICYmICFyZXN1bHRzLmhhc093blByb3BlcnR5KGspO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChyZWFkeSgpKSB7XG4gICAgICAgICAgICAgICAgdGFza1t0YXNrLmxlbmd0aCAtIDFdKHRhc2tDYWxsYmFjaywgcmVzdWx0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWFkeSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVMaXN0ZW5lcihsaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXNrW3Rhc2subGVuZ3RoIC0gMV0odGFza0NhbGxiYWNrLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYWRkTGlzdGVuZXIobGlzdGVuZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMucmV0cnkgPSBmdW5jdGlvbih0aW1lcywgdGFzaywgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIERFRkFVTFRfVElNRVMgPSA1O1xuICAgICAgICB2YXIgYXR0ZW1wdHMgPSBbXTtcbiAgICAgICAgLy8gVXNlIGRlZmF1bHRzIGlmIHRpbWVzIG5vdCBwYXNzZWRcbiAgICAgICAgaWYgKHR5cGVvZiB0aW1lcyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FsbGJhY2sgPSB0YXNrO1xuICAgICAgICAgICAgdGFzayA9IHRpbWVzO1xuICAgICAgICAgICAgdGltZXMgPSBERUZBVUxUX1RJTUVTO1xuICAgICAgICB9XG4gICAgICAgIC8vIE1ha2Ugc3VyZSB0aW1lcyBpcyBhIG51bWJlclxuICAgICAgICB0aW1lcyA9IHBhcnNlSW50KHRpbWVzLCAxMCkgfHwgREVGQVVMVF9USU1FUztcbiAgICAgICAgdmFyIHdyYXBwZWRUYXNrID0gZnVuY3Rpb24od3JhcHBlZENhbGxiYWNrLCB3cmFwcGVkUmVzdWx0cykge1xuICAgICAgICAgICAgdmFyIHJldHJ5QXR0ZW1wdCA9IGZ1bmN0aW9uKHRhc2ssIGZpbmFsQXR0ZW1wdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihzZXJpZXNDYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICB0YXNrKGZ1bmN0aW9uKGVyciwgcmVzdWx0KXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0NhbGxiYWNrKCFlcnIgfHwgZmluYWxBdHRlbXB0LCB7ZXJyOiBlcnIsIHJlc3VsdDogcmVzdWx0fSk7XG4gICAgICAgICAgICAgICAgICAgIH0sIHdyYXBwZWRSZXN1bHRzKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHdoaWxlICh0aW1lcykge1xuICAgICAgICAgICAgICAgIGF0dGVtcHRzLnB1c2gocmV0cnlBdHRlbXB0KHRhc2ssICEodGltZXMtPTEpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhc3luYy5zZXJpZXMoYXR0ZW1wdHMsIGZ1bmN0aW9uKGRvbmUsIGRhdGEpe1xuICAgICAgICAgICAgICAgIGRhdGEgPSBkYXRhW2RhdGEubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgKHdyYXBwZWRDYWxsYmFjayB8fCBjYWxsYmFjaykoZGF0YS5lcnIsIGRhdGEucmVzdWx0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIElmIGEgY2FsbGJhY2sgaXMgcGFzc2VkLCBydW4gdGhpcyBhcyBhIGNvbnRyb2xsIGZsb3dcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrID8gd3JhcHBlZFRhc2soKSA6IHdyYXBwZWRUYXNrXG4gICAgfTtcblxuICAgIGFzeW5jLndhdGVyZmFsbCA9IGZ1bmN0aW9uICh0YXNrcywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKCFfaXNBcnJheSh0YXNrcykpIHtcbiAgICAgICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdGaXJzdCBhcmd1bWVudCB0byB3YXRlcmZhbGwgbXVzdCBiZSBhbiBhcnJheSBvZiBmdW5jdGlvbnMnKTtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRhc2tzLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHdyYXBJdGVyYXRvciA9IGZ1bmN0aW9uIChpdGVyYXRvcikge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBuZXh0ID0gaXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobmV4dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJncy5wdXNoKHdyYXBJdGVyYXRvcihuZXh0KSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGFzeW5jLnNldEltbWVkaWF0ZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVyYXRvci5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICAgICAgd3JhcEl0ZXJhdG9yKGFzeW5jLml0ZXJhdG9yKHRhc2tzKSkoKTtcbiAgICB9O1xuXG4gICAgdmFyIF9wYXJhbGxlbCA9IGZ1bmN0aW9uKGVhY2hmbiwgdGFza3MsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgICAgIGlmIChfaXNBcnJheSh0YXNrcykpIHtcbiAgICAgICAgICAgIGVhY2hmbi5tYXAodGFza3MsIGZ1bmN0aW9uIChmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm4oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgIGVhY2hmbi5lYWNoKF9rZXlzKHRhc2tzKSwgZnVuY3Rpb24gKGssIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgdGFza3Nba10oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzW2tdID0gYXJncztcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgYXN5bmMucGFyYWxsZWwgPSBmdW5jdGlvbiAodGFza3MsIGNhbGxiYWNrKSB7XG4gICAgICAgIF9wYXJhbGxlbCh7IG1hcDogYXN5bmMubWFwLCBlYWNoOiBhc3luYy5lYWNoIH0sIHRhc2tzLCBjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIGFzeW5jLnBhcmFsbGVsTGltaXQgPSBmdW5jdGlvbih0YXNrcywgbGltaXQsIGNhbGxiYWNrKSB7XG4gICAgICAgIF9wYXJhbGxlbCh7IG1hcDogX21hcExpbWl0KGxpbWl0KSwgZWFjaDogX2VhY2hMaW1pdChsaW1pdCkgfSwgdGFza3MsIGNhbGxiYWNrKTtcbiAgICB9O1xuXG4gICAgYXN5bmMuc2VyaWVzID0gZnVuY3Rpb24gKHRhc2tzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAoX2lzQXJyYXkodGFza3MpKSB7XG4gICAgICAgICAgICBhc3luYy5tYXBTZXJpZXModGFza3MsIGZ1bmN0aW9uIChmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm4oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgIGFzeW5jLmVhY2hTZXJpZXMoX2tleXModGFza3MpLCBmdW5jdGlvbiAoaywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB0YXNrc1trXShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYy5pdGVyYXRvciA9IGZ1bmN0aW9uICh0YXNrcykge1xuICAgICAgICB2YXIgbWFrZUNhbGxiYWNrID0gZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgICAgICAgICB2YXIgZm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRhc2tzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB0YXNrc1tpbmRleF0uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZuLm5leHQoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBmbi5uZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAoaW5kZXggPCB0YXNrcy5sZW5ndGggLSAxKSA/IG1ha2VDYWxsYmFjayhpbmRleCArIDEpOiBudWxsO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBmbjtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIG1ha2VDYWxsYmFjaygwKTtcbiAgICB9O1xuXG4gICAgYXN5bmMuYXBwbHkgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KFxuICAgICAgICAgICAgICAgIG51bGwsIGFyZ3MuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpXG4gICAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICB2YXIgX2NvbmNhdCA9IGZ1bmN0aW9uIChlYWNoZm4sIGFyciwgZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciByID0gW107XG4gICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYikge1xuICAgICAgICAgICAgZm4oeCwgZnVuY3Rpb24gKGVyciwgeSkge1xuICAgICAgICAgICAgICAgIHIgPSByLmNvbmNhdCh5IHx8IFtdKTtcbiAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcik7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgYXN5bmMuY29uY2F0ID0gZG9QYXJhbGxlbChfY29uY2F0KTtcbiAgICBhc3luYy5jb25jYXRTZXJpZXMgPSBkb1NlcmllcyhfY29uY2F0KTtcblxuICAgIGFzeW5jLndoaWxzdCA9IGZ1bmN0aW9uICh0ZXN0LCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHRlc3QoKSkge1xuICAgICAgICAgICAgaXRlcmF0b3IoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFzeW5jLndoaWxzdCh0ZXN0LCBpdGVyYXRvciwgY2FsbGJhY2spO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGFzeW5jLmRvV2hpbHN0ID0gZnVuY3Rpb24gKGl0ZXJhdG9yLCB0ZXN0LCBjYWxsYmFjaykge1xuICAgICAgICBpdGVyYXRvcihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICBpZiAodGVzdC5hcHBseShudWxsLCBhcmdzKSkge1xuICAgICAgICAgICAgICAgIGFzeW5jLmRvV2hpbHN0KGl0ZXJhdG9yLCB0ZXN0LCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMudW50aWwgPSBmdW5jdGlvbiAodGVzdCwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGVzdCgpKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYXN5bmMudW50aWwodGVzdCwgaXRlcmF0b3IsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYy5kb1VudGlsID0gZnVuY3Rpb24gKGl0ZXJhdG9yLCB0ZXN0LCBjYWxsYmFjaykge1xuICAgICAgICBpdGVyYXRvcihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICBpZiAoIXRlc3QuYXBwbHkobnVsbCwgYXJncykpIHtcbiAgICAgICAgICAgICAgICBhc3luYy5kb1VudGlsKGl0ZXJhdG9yLCB0ZXN0LCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMucXVldWUgPSBmdW5jdGlvbiAod29ya2VyLCBjb25jdXJyZW5jeSkge1xuICAgICAgICBpZiAoY29uY3VycmVuY3kgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uY3VycmVuY3kgPSAxO1xuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uIF9pbnNlcnQocSwgZGF0YSwgcG9zLCBjYWxsYmFjaykge1xuICAgICAgICAgIGlmICghcS5zdGFydGVkKXtcbiAgICAgICAgICAgIHEuc3RhcnRlZCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghX2lzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgICAgZGF0YSA9IFtkYXRhXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZGF0YS5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgIC8vIGNhbGwgZHJhaW4gaW1tZWRpYXRlbHkgaWYgdGhlcmUgYXJlIG5vIHRhc2tzXG4gICAgICAgICAgICAgcmV0dXJuIGFzeW5jLnNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgaWYgKHEuZHJhaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgIHEuZHJhaW4oKTtcbiAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBfZWFjaChkYXRhLCBmdW5jdGlvbih0YXNrKSB7XG4gICAgICAgICAgICAgIHZhciBpdGVtID0ge1xuICAgICAgICAgICAgICAgICAgZGF0YTogdGFzayxcbiAgICAgICAgICAgICAgICAgIGNhbGxiYWNrOiB0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicgPyBjYWxsYmFjayA6IG51bGxcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICBpZiAocG9zKSB7XG4gICAgICAgICAgICAgICAgcS50YXNrcy51bnNoaWZ0KGl0ZW0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHEudGFza3MucHVzaChpdGVtKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlmIChxLnNhdHVyYXRlZCAmJiBxLnRhc2tzLmxlbmd0aCA9PT0gcS5jb25jdXJyZW5jeSkge1xuICAgICAgICAgICAgICAgICAgcS5zYXR1cmF0ZWQoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUocS5wcm9jZXNzKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB3b3JrZXJzID0gMDtcbiAgICAgICAgdmFyIHEgPSB7XG4gICAgICAgICAgICB0YXNrczogW10sXG4gICAgICAgICAgICBjb25jdXJyZW5jeTogY29uY3VycmVuY3ksXG4gICAgICAgICAgICBzYXR1cmF0ZWQ6IG51bGwsXG4gICAgICAgICAgICBlbXB0eTogbnVsbCxcbiAgICAgICAgICAgIGRyYWluOiBudWxsLFxuICAgICAgICAgICAgc3RhcnRlZDogZmFsc2UsXG4gICAgICAgICAgICBwYXVzZWQ6IGZhbHNlLFxuICAgICAgICAgICAgcHVzaDogZnVuY3Rpb24gKGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIF9pbnNlcnQocSwgZGF0YSwgZmFsc2UsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBraWxsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHEuZHJhaW4gPSBudWxsO1xuICAgICAgICAgICAgICBxLnRhc2tzID0gW107XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdW5zaGlmdDogZnVuY3Rpb24gKGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIF9pbnNlcnQocSwgZGF0YSwgdHJ1ZSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb2Nlc3M6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXEucGF1c2VkICYmIHdvcmtlcnMgPCBxLmNvbmN1cnJlbmN5ICYmIHEudGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXNrID0gcS50YXNrcy5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocS5lbXB0eSAmJiBxLnRhc2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcS5lbXB0eSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHdvcmtlcnMgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JrZXJzIC09IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFzay5jYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhc2suY2FsbGJhY2suYXBwbHkodGFzaywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChxLmRyYWluICYmIHEudGFza3MubGVuZ3RoICsgd29ya2VycyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHEuZHJhaW4oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHEucHJvY2VzcygpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2IgPSBvbmx5X29uY2UobmV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHdvcmtlcih0YXNrLmRhdGEsIGNiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGVuZ3RoOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHEudGFza3MubGVuZ3RoO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJ1bm5pbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gd29ya2VycztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpZGxlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcS50YXNrcy5sZW5ndGggKyB3b3JrZXJzID09PSAwO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhdXNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHEucGF1c2VkID09PSB0cnVlKSB7IHJldHVybjsgfVxuICAgICAgICAgICAgICAgIHEucGF1c2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBxLnByb2Nlc3MoKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXN1bWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAocS5wYXVzZWQgPT09IGZhbHNlKSB7IHJldHVybjsgfVxuICAgICAgICAgICAgICAgIHEucGF1c2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcS5wcm9jZXNzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBxO1xuICAgIH07XG4gICAgXG4gICAgYXN5bmMucHJpb3JpdHlRdWV1ZSA9IGZ1bmN0aW9uICh3b3JrZXIsIGNvbmN1cnJlbmN5KSB7XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBfY29tcGFyZVRhc2tzKGEsIGIpe1xuICAgICAgICAgIHJldHVybiBhLnByaW9yaXR5IC0gYi5wcmlvcml0eTtcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIF9iaW5hcnlTZWFyY2goc2VxdWVuY2UsIGl0ZW0sIGNvbXBhcmUpIHtcbiAgICAgICAgICB2YXIgYmVnID0gLTEsXG4gICAgICAgICAgICAgIGVuZCA9IHNlcXVlbmNlLmxlbmd0aCAtIDE7XG4gICAgICAgICAgd2hpbGUgKGJlZyA8IGVuZCkge1xuICAgICAgICAgICAgdmFyIG1pZCA9IGJlZyArICgoZW5kIC0gYmVnICsgMSkgPj4+IDEpO1xuICAgICAgICAgICAgaWYgKGNvbXBhcmUoaXRlbSwgc2VxdWVuY2VbbWlkXSkgPj0gMCkge1xuICAgICAgICAgICAgICBiZWcgPSBtaWQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBlbmQgPSBtaWQgLSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYmVnO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBfaW5zZXJ0KHEsIGRhdGEsIHByaW9yaXR5LCBjYWxsYmFjaykge1xuICAgICAgICAgIGlmICghcS5zdGFydGVkKXtcbiAgICAgICAgICAgIHEuc3RhcnRlZCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghX2lzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgICAgZGF0YSA9IFtkYXRhXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZGF0YS5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgIC8vIGNhbGwgZHJhaW4gaW1tZWRpYXRlbHkgaWYgdGhlcmUgYXJlIG5vIHRhc2tzXG4gICAgICAgICAgICAgcmV0dXJuIGFzeW5jLnNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgaWYgKHEuZHJhaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgIHEuZHJhaW4oKTtcbiAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBfZWFjaChkYXRhLCBmdW5jdGlvbih0YXNrKSB7XG4gICAgICAgICAgICAgIHZhciBpdGVtID0ge1xuICAgICAgICAgICAgICAgICAgZGF0YTogdGFzayxcbiAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiBwcmlvcml0eSxcbiAgICAgICAgICAgICAgICAgIGNhbGxiYWNrOiB0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicgPyBjYWxsYmFjayA6IG51bGxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHEudGFza3Muc3BsaWNlKF9iaW5hcnlTZWFyY2gocS50YXNrcywgaXRlbSwgX2NvbXBhcmVUYXNrcykgKyAxLCAwLCBpdGVtKTtcblxuICAgICAgICAgICAgICBpZiAocS5zYXR1cmF0ZWQgJiYgcS50YXNrcy5sZW5ndGggPT09IHEuY29uY3VycmVuY3kpIHtcbiAgICAgICAgICAgICAgICAgIHEuc2F0dXJhdGVkKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYXN5bmMuc2V0SW1tZWRpYXRlKHEucHJvY2Vzcyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFN0YXJ0IHdpdGggYSBub3JtYWwgcXVldWVcbiAgICAgICAgdmFyIHEgPSBhc3luYy5xdWV1ZSh3b3JrZXIsIGNvbmN1cnJlbmN5KTtcbiAgICAgICAgXG4gICAgICAgIC8vIE92ZXJyaWRlIHB1c2ggdG8gYWNjZXB0IHNlY29uZCBwYXJhbWV0ZXIgcmVwcmVzZW50aW5nIHByaW9yaXR5XG4gICAgICAgIHEucHVzaCA9IGZ1bmN0aW9uIChkYXRhLCBwcmlvcml0eSwgY2FsbGJhY2spIHtcbiAgICAgICAgICBfaW5zZXJ0KHEsIGRhdGEsIHByaW9yaXR5LCBjYWxsYmFjayk7XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICAvLyBSZW1vdmUgdW5zaGlmdCBmdW5jdGlvblxuICAgICAgICBkZWxldGUgcS51bnNoaWZ0O1xuXG4gICAgICAgIHJldHVybiBxO1xuICAgIH07XG5cbiAgICBhc3luYy5jYXJnbyA9IGZ1bmN0aW9uICh3b3JrZXIsIHBheWxvYWQpIHtcbiAgICAgICAgdmFyIHdvcmtpbmcgICAgID0gZmFsc2UsXG4gICAgICAgICAgICB0YXNrcyAgICAgICA9IFtdO1xuXG4gICAgICAgIHZhciBjYXJnbyA9IHtcbiAgICAgICAgICAgIHRhc2tzOiB0YXNrcyxcbiAgICAgICAgICAgIHBheWxvYWQ6IHBheWxvYWQsXG4gICAgICAgICAgICBzYXR1cmF0ZWQ6IG51bGwsXG4gICAgICAgICAgICBlbXB0eTogbnVsbCxcbiAgICAgICAgICAgIGRyYWluOiBudWxsLFxuICAgICAgICAgICAgZHJhaW5lZDogdHJ1ZSxcbiAgICAgICAgICAgIHB1c2g6IGZ1bmN0aW9uIChkYXRhLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGlmICghX2lzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IFtkYXRhXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgX2VhY2goZGF0YSwgZnVuY3Rpb24odGFzaykge1xuICAgICAgICAgICAgICAgICAgICB0YXNrcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHRhc2ssXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjazogdHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nID8gY2FsbGJhY2sgOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjYXJnby5kcmFpbmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYXJnby5zYXR1cmF0ZWQgJiYgdGFza3MubGVuZ3RoID09PSBwYXlsb2FkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXJnby5zYXR1cmF0ZWQoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGFzeW5jLnNldEltbWVkaWF0ZShjYXJnby5wcm9jZXNzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9jZXNzOiBmdW5jdGlvbiBwcm9jZXNzKCkge1xuICAgICAgICAgICAgICAgIGlmICh3b3JraW5nKSByZXR1cm47XG4gICAgICAgICAgICAgICAgaWYgKHRhc2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBpZihjYXJnby5kcmFpbiAmJiAhY2FyZ28uZHJhaW5lZCkgY2FyZ28uZHJhaW4oKTtcbiAgICAgICAgICAgICAgICAgICAgY2FyZ28uZHJhaW5lZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgdHMgPSB0eXBlb2YgcGF5bG9hZCA9PT0gJ251bWJlcidcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IHRhc2tzLnNwbGljZSgwLCBwYXlsb2FkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogdGFza3Muc3BsaWNlKDAsIHRhc2tzLmxlbmd0aCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgZHMgPSBfbWFwKHRzLCBmdW5jdGlvbiAodGFzaykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGFzay5kYXRhO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYoY2FyZ28uZW1wdHkpIGNhcmdvLmVtcHR5KCk7XG4gICAgICAgICAgICAgICAgd29ya2luZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgd29ya2VyKGRzLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHdvcmtpbmcgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgICAgICAgICAgICAgICAgX2VhY2godHMsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5jYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEuY2FsbGJhY2suYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIHByb2Nlc3MoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsZW5ndGg6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFza3MubGVuZ3RoO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJ1bm5pbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gd29ya2luZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGNhcmdvO1xuICAgIH07XG5cbiAgICB2YXIgX2NvbnNvbGVfZm4gPSBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzLmNvbmNhdChbZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25zb2xlLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvbnNvbGVbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9lYWNoKGFyZ3MsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZVtuYW1lXSh4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfV0pKTtcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIGFzeW5jLmxvZyA9IF9jb25zb2xlX2ZuKCdsb2cnKTtcbiAgICBhc3luYy5kaXIgPSBfY29uc29sZV9mbignZGlyJyk7XG4gICAgLyphc3luYy5pbmZvID0gX2NvbnNvbGVfZm4oJ2luZm8nKTtcbiAgICBhc3luYy53YXJuID0gX2NvbnNvbGVfZm4oJ3dhcm4nKTtcbiAgICBhc3luYy5lcnJvciA9IF9jb25zb2xlX2ZuKCdlcnJvcicpOyovXG5cbiAgICBhc3luYy5tZW1vaXplID0gZnVuY3Rpb24gKGZuLCBoYXNoZXIpIHtcbiAgICAgICAgdmFyIG1lbW8gPSB7fTtcbiAgICAgICAgdmFyIHF1ZXVlcyA9IHt9O1xuICAgICAgICBoYXNoZXIgPSBoYXNoZXIgfHwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4O1xuICAgICAgICB9O1xuICAgICAgICB2YXIgbWVtb2l6ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzLnBvcCgpO1xuICAgICAgICAgICAgdmFyIGtleSA9IGhhc2hlci5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgICAgICAgIGlmIChrZXkgaW4gbWVtbykge1xuICAgICAgICAgICAgICAgIGFzeW5jLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkobnVsbCwgbWVtb1trZXldKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGtleSBpbiBxdWV1ZXMpIHtcbiAgICAgICAgICAgICAgICBxdWV1ZXNba2V5XS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHF1ZXVlc1trZXldID0gW2NhbGxiYWNrXTtcbiAgICAgICAgICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzLmNvbmNhdChbZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2tleV0gPSBhcmd1bWVudHM7XG4gICAgICAgICAgICAgICAgICAgIHZhciBxID0gcXVldWVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBxdWV1ZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBxLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgIHFbaV0uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1dKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIG1lbW9pemVkLm1lbW8gPSBtZW1vO1xuICAgICAgICBtZW1vaXplZC51bm1lbW9pemVkID0gZm47XG4gICAgICAgIHJldHVybiBtZW1vaXplZDtcbiAgICB9O1xuXG4gICAgYXN5bmMudW5tZW1vaXplID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gKGZuLnVubWVtb2l6ZWQgfHwgZm4pLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH07XG5cbiAgICBhc3luYy50aW1lcyA9IGZ1bmN0aW9uIChjb3VudCwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBjb3VudGVyID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY291bnRlci5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhc3luYy5tYXAoY291bnRlciwgaXRlcmF0b3IsIGNhbGxiYWNrKTtcbiAgICB9O1xuXG4gICAgYXN5bmMudGltZXNTZXJpZXMgPSBmdW5jdGlvbiAoY291bnQsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgY291bnRlciA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvdW50ZXIucHVzaChpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXN5bmMubWFwU2VyaWVzKGNvdW50ZXIsIGl0ZXJhdG9yLCBjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIGFzeW5jLnNlcSA9IGZ1bmN0aW9uICgvKiBmdW5jdGlvbnMuLi4gKi8pIHtcbiAgICAgICAgdmFyIGZucyA9IGFyZ3VtZW50cztcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgICAgICAgICBhc3luYy5yZWR1Y2UoZm5zLCBhcmdzLCBmdW5jdGlvbiAobmV3YXJncywgZm4sIGNiKSB7XG4gICAgICAgICAgICAgICAgZm4uYXBwbHkodGhhdCwgbmV3YXJncy5jb25jYXQoW2Z1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5leHRhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyLCBuZXh0YXJncyk7XG4gICAgICAgICAgICAgICAgfV0pKVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGF0LCBbZXJyXS5jb25jYXQocmVzdWx0cykpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIGFzeW5jLmNvbXBvc2UgPSBmdW5jdGlvbiAoLyogZnVuY3Rpb25zLi4uICovKSB7XG4gICAgICByZXR1cm4gYXN5bmMuc2VxLmFwcGx5KG51bGwsIEFycmF5LnByb3RvdHlwZS5yZXZlcnNlLmNhbGwoYXJndW1lbnRzKSk7XG4gICAgfTtcblxuICAgIHZhciBfYXBwbHlFYWNoID0gZnVuY3Rpb24gKGVhY2hmbiwgZm5zIC8qYXJncy4uLiovKSB7XG4gICAgICAgIHZhciBnbyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgICAgICAgICByZXR1cm4gZWFjaGZuKGZucywgZnVuY3Rpb24gKGZuLCBjYikge1xuICAgICAgICAgICAgICAgIGZuLmFwcGx5KHRoYXQsIGFyZ3MuY29uY2F0KFtjYl0pKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjYWxsYmFjayk7XG4gICAgICAgIH07XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICAgICAgcmV0dXJuIGdvLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGdvO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBhc3luYy5hcHBseUVhY2ggPSBkb1BhcmFsbGVsKF9hcHBseUVhY2gpO1xuICAgIGFzeW5jLmFwcGx5RWFjaFNlcmllcyA9IGRvU2VyaWVzKF9hcHBseUVhY2gpO1xuXG4gICAgYXN5bmMuZm9yZXZlciA9IGZ1bmN0aW9uIChmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgZnVuY3Rpb24gbmV4dChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZuKG5leHQpO1xuICAgICAgICB9XG4gICAgICAgIG5leHQoKTtcbiAgICB9O1xuXG4gICAgLy8gTm9kZS5qc1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGFzeW5jO1xuICAgIH1cbiAgICAvLyBBTUQgLyBSZXF1aXJlSlNcbiAgICBlbHNlIGlmICh0eXBlb2YgZGVmaW5lICE9PSAndW5kZWZpbmVkJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIGRlZmluZShbXSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGFzeW5jO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgLy8gaW5jbHVkZWQgZGlyZWN0bHkgdmlhIDxzY3JpcHQ+IHRhZ1xuICAgIGVsc2Uge1xuICAgICAgICByb290LmFzeW5jID0gYXN5bmM7XG4gICAgfVxuXG59KCkpO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIjFZaVo1U1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uL2Jvd2VyX2NvbXBvbmVudHMvYXN5bmMvbGliL2FzeW5jLmpzXCIsXCIvLi4vYm93ZXJfY29tcG9uZW50cy9hc3luYy9saWJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKipcbiAqIEBsaWNlbnNlXG4gKiBwaXhpLmpzIC0gdjEuNi4wXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTItMjAxNCwgTWF0IEdyb3Zlc1xuICogaHR0cDovL2dvb2Rib3lkaWdpdGFsLmNvbS9cbiAqXG4gKiBDb21waWxlZDogMjAxNC0wNy0xOFxuICpcbiAqIHBpeGkuanMgaXMgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHBcbiAqL1xuKGZ1bmN0aW9uKCl7dmFyIGE9dGhpcyxiPWJ8fHt9O2IuV0VCR0xfUkVOREVSRVI9MCxiLkNBTlZBU19SRU5ERVJFUj0xLGIuVkVSU0lPTj1cInYxLjYuMVwiLGIuYmxlbmRNb2Rlcz17Tk9STUFMOjAsQUREOjEsTVVMVElQTFk6MixTQ1JFRU46MyxPVkVSTEFZOjQsREFSS0VOOjUsTElHSFRFTjo2LENPTE9SX0RPREdFOjcsQ09MT1JfQlVSTjo4LEhBUkRfTElHSFQ6OSxTT0ZUX0xJR0hUOjEwLERJRkZFUkVOQ0U6MTEsRVhDTFVTSU9OOjEyLEhVRToxMyxTQVRVUkFUSU9OOjE0LENPTE9SOjE1LExVTUlOT1NJVFk6MTZ9LGIuc2NhbGVNb2Rlcz17REVGQVVMVDowLExJTkVBUjowLE5FQVJFU1Q6MX0sYi5fVUlEPTAsXCJ1bmRlZmluZWRcIiE9dHlwZW9mIEZsb2F0MzJBcnJheT8oYi5GbG9hdDMyQXJyYXk9RmxvYXQzMkFycmF5LGIuVWludDE2QXJyYXk9VWludDE2QXJyYXkpOihiLkZsb2F0MzJBcnJheT1BcnJheSxiLlVpbnQxNkFycmF5PUFycmF5KSxiLklOVEVSQUNUSU9OX0ZSRVFVRU5DWT0zMCxiLkFVVE9fUFJFVkVOVF9ERUZBVUxUPSEwLGIuUkFEX1RPX0RFRz0xODAvTWF0aC5QSSxiLkRFR19UT19SQUQ9TWF0aC5QSS8xODAsYi5kb250U2F5SGVsbG89ITEsYi5zYXlIZWxsbz1mdW5jdGlvbihhKXtpZighYi5kb250U2F5SGVsbG8pe2lmKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKFwiY2hyb21lXCIpPi0xKXt2YXIgYz1bXCIlYyAlYyAlYyBQaXhpLmpzIFwiK2IuVkVSU0lPTitcIiAtIFwiK2ErXCIgICVjICAlYyAgaHR0cDovL3d3dy5waXhpanMuY29tLyAgJWMgJWMg4pmlJWPimaUlY+KZpSBcIixcImJhY2tncm91bmQ6ICNmZjY2YTVcIixcImJhY2tncm91bmQ6ICNmZjY2YTVcIixcImNvbG9yOiAjZmY2NmE1OyBiYWNrZ3JvdW5kOiAjMDMwMzA3O1wiLFwiYmFja2dyb3VuZDogI2ZmNjZhNVwiLFwiYmFja2dyb3VuZDogI2ZmYzNkY1wiLFwiYmFja2dyb3VuZDogI2ZmNjZhNVwiLFwiY29sb3I6ICNmZjI0MjQ7IGJhY2tncm91bmQ6ICNmZmZcIixcImNvbG9yOiAjZmYyNDI0OyBiYWNrZ3JvdW5kOiAjZmZmXCIsXCJjb2xvcjogI2ZmMjQyNDsgYmFja2dyb3VuZDogI2ZmZlwiXTtjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLGMpfWVsc2Ugd2luZG93LmNvbnNvbGUmJmNvbnNvbGUubG9nKFwiUGl4aS5qcyBcIitiLlZFUlNJT04rXCIgLSBodHRwOi8vd3d3LnBpeGlqcy5jb20vXCIpO2IuZG9udFNheUhlbGxvPSEwfX0sYi5Qb2ludD1mdW5jdGlvbihhLGIpe3RoaXMueD1hfHwwLHRoaXMueT1ifHwwfSxiLlBvaW50LnByb3RvdHlwZS5jbG9uZT1mdW5jdGlvbigpe3JldHVybiBuZXcgYi5Qb2ludCh0aGlzLngsdGhpcy55KX0sYi5Qb2ludC5wcm90b3R5cGUuc2V0PWZ1bmN0aW9uKGEsYil7dGhpcy54PWF8fDAsdGhpcy55PWJ8fCgwIT09Yj90aGlzLng6MCl9LGIuUG9pbnQucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuUG9pbnQsYi5SZWN0YW5nbGU9ZnVuY3Rpb24oYSxiLGMsZCl7dGhpcy54PWF8fDAsdGhpcy55PWJ8fDAsdGhpcy53aWR0aD1jfHwwLHRoaXMuaGVpZ2h0PWR8fDB9LGIuUmVjdGFuZ2xlLnByb3RvdHlwZS5jbG9uZT1mdW5jdGlvbigpe3JldHVybiBuZXcgYi5SZWN0YW5nbGUodGhpcy54LHRoaXMueSx0aGlzLndpZHRoLHRoaXMuaGVpZ2h0KX0sYi5SZWN0YW5nbGUucHJvdG90eXBlLmNvbnRhaW5zPWZ1bmN0aW9uKGEsYil7aWYodGhpcy53aWR0aDw9MHx8dGhpcy5oZWlnaHQ8PTApcmV0dXJuITE7dmFyIGM9dGhpcy54O2lmKGE+PWMmJmE8PWMrdGhpcy53aWR0aCl7dmFyIGQ9dGhpcy55O2lmKGI+PWQmJmI8PWQrdGhpcy5oZWlnaHQpcmV0dXJuITB9cmV0dXJuITF9LGIuUmVjdGFuZ2xlLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLlJlY3RhbmdsZSxiLkVtcHR5UmVjdGFuZ2xlPW5ldyBiLlJlY3RhbmdsZSgwLDAsMCwwKSxiLlBvbHlnb249ZnVuY3Rpb24oYSl7aWYoYSBpbnN0YW5jZW9mIEFycmF5fHwoYT1BcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKSxcIm51bWJlclwiPT10eXBlb2YgYVswXSl7Zm9yKHZhciBjPVtdLGQ9MCxlPWEubGVuZ3RoO2U+ZDtkKz0yKWMucHVzaChuZXcgYi5Qb2ludChhW2RdLGFbZCsxXSkpO2E9Y310aGlzLnBvaW50cz1hfSxiLlBvbHlnb24ucHJvdG90eXBlLmNsb25lPWZ1bmN0aW9uKCl7Zm9yKHZhciBhPVtdLGM9MDtjPHRoaXMucG9pbnRzLmxlbmd0aDtjKyspYS5wdXNoKHRoaXMucG9pbnRzW2NdLmNsb25lKCkpO3JldHVybiBuZXcgYi5Qb2x5Z29uKGEpfSxiLlBvbHlnb24ucHJvdG90eXBlLmNvbnRhaW5zPWZ1bmN0aW9uKGEsYil7Zm9yKHZhciBjPSExLGQ9MCxlPXRoaXMucG9pbnRzLmxlbmd0aC0xO2Q8dGhpcy5wb2ludHMubGVuZ3RoO2U9ZCsrKXt2YXIgZj10aGlzLnBvaW50c1tkXS54LGc9dGhpcy5wb2ludHNbZF0ueSxoPXRoaXMucG9pbnRzW2VdLngsaT10aGlzLnBvaW50c1tlXS55LGo9Zz5iIT1pPmImJihoLWYpKihiLWcpLyhpLWcpK2Y+YTtqJiYoYz0hYyl9cmV0dXJuIGN9LGIuUG9seWdvbi5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5Qb2x5Z29uLGIuQ2lyY2xlPWZ1bmN0aW9uKGEsYixjKXt0aGlzLng9YXx8MCx0aGlzLnk9Ynx8MCx0aGlzLnJhZGl1cz1jfHwwfSxiLkNpcmNsZS5wcm90b3R5cGUuY2xvbmU9ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IGIuQ2lyY2xlKHRoaXMueCx0aGlzLnksdGhpcy5yYWRpdXMpfSxiLkNpcmNsZS5wcm90b3R5cGUuY29udGFpbnM9ZnVuY3Rpb24oYSxiKXtpZih0aGlzLnJhZGl1czw9MClyZXR1cm4hMTt2YXIgYz10aGlzLngtYSxkPXRoaXMueS1iLGU9dGhpcy5yYWRpdXMqdGhpcy5yYWRpdXM7cmV0dXJuIGMqPWMsZCo9ZCxlPj1jK2R9LGIuQ2lyY2xlLnByb3RvdHlwZS5nZXRCb3VuZHM9ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IGIuUmVjdGFuZ2xlKHRoaXMueC10aGlzLnJhZGl1cyx0aGlzLnktdGhpcy5yYWRpdXMsdGhpcy53aWR0aCx0aGlzLmhlaWdodCl9LGIuQ2lyY2xlLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLkNpcmNsZSxiLkVsbGlwc2U9ZnVuY3Rpb24oYSxiLGMsZCl7dGhpcy54PWF8fDAsdGhpcy55PWJ8fDAsdGhpcy53aWR0aD1jfHwwLHRoaXMuaGVpZ2h0PWR8fDB9LGIuRWxsaXBzZS5wcm90b3R5cGUuY2xvbmU9ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IGIuRWxsaXBzZSh0aGlzLngsdGhpcy55LHRoaXMud2lkdGgsdGhpcy5oZWlnaHQpfSxiLkVsbGlwc2UucHJvdG90eXBlLmNvbnRhaW5zPWZ1bmN0aW9uKGEsYil7aWYodGhpcy53aWR0aDw9MHx8dGhpcy5oZWlnaHQ8PTApcmV0dXJuITE7dmFyIGM9KGEtdGhpcy54KS90aGlzLndpZHRoLGQ9KGItdGhpcy55KS90aGlzLmhlaWdodDtyZXR1cm4gYyo9YyxkKj1kLDE+PWMrZH0sYi5FbGxpcHNlLnByb3RvdHlwZS5nZXRCb3VuZHM9ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IGIuUmVjdGFuZ2xlKHRoaXMueC10aGlzLndpZHRoLHRoaXMueS10aGlzLmhlaWdodCx0aGlzLndpZHRoLHRoaXMuaGVpZ2h0KX0sYi5FbGxpcHNlLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLkVsbGlwc2UsYi5NYXRyaXg9ZnVuY3Rpb24oKXt0aGlzLmE9MSx0aGlzLmI9MCx0aGlzLmM9MCx0aGlzLmQ9MSx0aGlzLnR4PTAsdGhpcy50eT0wfSxiLk1hdHJpeC5wcm90b3R5cGUuZnJvbUFycmF5PWZ1bmN0aW9uKGEpe3RoaXMuYT1hWzBdLHRoaXMuYj1hWzFdLHRoaXMuYz1hWzNdLHRoaXMuZD1hWzRdLHRoaXMudHg9YVsyXSx0aGlzLnR5PWFbNV19LGIuTWF0cml4LnByb3RvdHlwZS50b0FycmF5PWZ1bmN0aW9uKGEpe3RoaXMuYXJyYXl8fCh0aGlzLmFycmF5PW5ldyBGbG9hdDMyQXJyYXkoOSkpO3ZhciBiPXRoaXMuYXJyYXk7cmV0dXJuIGE/KGJbMF09dGhpcy5hLGJbMV09dGhpcy5jLGJbMl09MCxiWzNdPXRoaXMuYixiWzRdPXRoaXMuZCxiWzVdPTAsYls2XT10aGlzLnR4LGJbN109dGhpcy50eSxiWzhdPTEpOihiWzBdPXRoaXMuYSxiWzFdPXRoaXMuYixiWzJdPXRoaXMudHgsYlszXT10aGlzLmMsYls0XT10aGlzLmQsYls1XT10aGlzLnR5LGJbNl09MCxiWzddPTAsYls4XT0xKSxifSxiLmlkZW50aXR5TWF0cml4PW5ldyBiLk1hdHJpeCxiLmRldGVybWluZU1hdHJpeEFycmF5VHlwZT1mdW5jdGlvbigpe3JldHVyblwidW5kZWZpbmVkXCIhPXR5cGVvZiBGbG9hdDMyQXJyYXk/RmxvYXQzMkFycmF5OkFycmF5fSxiLk1hdHJpeDI9Yi5kZXRlcm1pbmVNYXRyaXhBcnJheVR5cGUoKSxiLkRpc3BsYXlPYmplY3Q9ZnVuY3Rpb24oKXt0aGlzLnBvc2l0aW9uPW5ldyBiLlBvaW50LHRoaXMuc2NhbGU9bmV3IGIuUG9pbnQoMSwxKSx0aGlzLnBpdm90PW5ldyBiLlBvaW50KDAsMCksdGhpcy5yb3RhdGlvbj0wLHRoaXMuYWxwaGE9MSx0aGlzLnZpc2libGU9ITAsdGhpcy5oaXRBcmVhPW51bGwsdGhpcy5idXR0b25Nb2RlPSExLHRoaXMucmVuZGVyYWJsZT0hMSx0aGlzLnBhcmVudD1udWxsLHRoaXMuc3RhZ2U9bnVsbCx0aGlzLndvcmxkQWxwaGE9MSx0aGlzLl9pbnRlcmFjdGl2ZT0hMSx0aGlzLmRlZmF1bHRDdXJzb3I9XCJwb2ludGVyXCIsdGhpcy53b3JsZFRyYW5zZm9ybT1uZXcgYi5NYXRyaXgsdGhpcy5jb2xvcj1bXSx0aGlzLmR5bmFtaWM9ITAsdGhpcy5fc3I9MCx0aGlzLl9jcj0xLHRoaXMuZmlsdGVyQXJlYT1udWxsLHRoaXMuX2JvdW5kcz1uZXcgYi5SZWN0YW5nbGUoMCwwLDEsMSksdGhpcy5fY3VycmVudEJvdW5kcz1udWxsLHRoaXMuX21hc2s9bnVsbCx0aGlzLl9jYWNoZUFzQml0bWFwPSExLHRoaXMuX2NhY2hlSXNEaXJ0eT0hMX0sYi5EaXNwbGF5T2JqZWN0LnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLkRpc3BsYXlPYmplY3QsYi5EaXNwbGF5T2JqZWN0LnByb3RvdHlwZS5zZXRJbnRlcmFjdGl2ZT1mdW5jdGlvbihhKXt0aGlzLmludGVyYWN0aXZlPWF9LE9iamVjdC5kZWZpbmVQcm9wZXJ0eShiLkRpc3BsYXlPYmplY3QucHJvdG90eXBlLFwiaW50ZXJhY3RpdmVcIix7Z2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX2ludGVyYWN0aXZlfSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy5faW50ZXJhY3RpdmU9YSx0aGlzLnN0YWdlJiYodGhpcy5zdGFnZS5kaXJ0eT0hMCl9fSksT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuRGlzcGxheU9iamVjdC5wcm90b3R5cGUsXCJ3b3JsZFZpc2libGVcIix7Z2V0OmZ1bmN0aW9uKCl7dmFyIGE9dGhpcztkb3tpZighYS52aXNpYmxlKXJldHVybiExO2E9YS5wYXJlbnR9d2hpbGUoYSk7cmV0dXJuITB9fSksT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuRGlzcGxheU9iamVjdC5wcm90b3R5cGUsXCJtYXNrXCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9tYXNrfSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy5fbWFzayYmKHRoaXMuX21hc2suaXNNYXNrPSExKSx0aGlzLl9tYXNrPWEsdGhpcy5fbWFzayYmKHRoaXMuX21hc2suaXNNYXNrPSEwKX19KSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5EaXNwbGF5T2JqZWN0LnByb3RvdHlwZSxcImZpbHRlcnNcIix7Z2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX2ZpbHRlcnN9LHNldDpmdW5jdGlvbihhKXtpZihhKXtmb3IodmFyIGI9W10sYz0wO2M8YS5sZW5ndGg7YysrKWZvcih2YXIgZD1hW2NdLnBhc3NlcyxlPTA7ZTxkLmxlbmd0aDtlKyspYi5wdXNoKGRbZV0pO3RoaXMuX2ZpbHRlckJsb2NrPXt0YXJnZXQ6dGhpcyxmaWx0ZXJQYXNzZXM6Yn19dGhpcy5fZmlsdGVycz1hfX0pLE9iamVjdC5kZWZpbmVQcm9wZXJ0eShiLkRpc3BsYXlPYmplY3QucHJvdG90eXBlLFwiY2FjaGVBc0JpdG1hcFwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fY2FjaGVBc0JpdG1hcH0sc2V0OmZ1bmN0aW9uKGEpe3RoaXMuX2NhY2hlQXNCaXRtYXAhPT1hJiYoYT90aGlzLl9nZW5lcmF0ZUNhY2hlZFNwcml0ZSgpOnRoaXMuX2Rlc3Ryb3lDYWNoZWRTcHJpdGUoKSx0aGlzLl9jYWNoZUFzQml0bWFwPWEpfX0pLGIuRGlzcGxheU9iamVjdC5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtPWZ1bmN0aW9uKCl7dGhpcy5yb3RhdGlvbiE9PXRoaXMucm90YXRpb25DYWNoZSYmKHRoaXMucm90YXRpb25DYWNoZT10aGlzLnJvdGF0aW9uLHRoaXMuX3NyPU1hdGguc2luKHRoaXMucm90YXRpb24pLHRoaXMuX2NyPU1hdGguY29zKHRoaXMucm90YXRpb24pKTt2YXIgYT10aGlzLnBhcmVudC53b3JsZFRyYW5zZm9ybSxiPXRoaXMud29ybGRUcmFuc2Zvcm0sYz10aGlzLnBpdm90LngsZD10aGlzLnBpdm90LnksZT10aGlzLl9jcip0aGlzLnNjYWxlLngsZj0tdGhpcy5fc3IqdGhpcy5zY2FsZS55LGc9dGhpcy5fc3IqdGhpcy5zY2FsZS54LGg9dGhpcy5fY3IqdGhpcy5zY2FsZS55LGk9dGhpcy5wb3NpdGlvbi54LWUqYy1kKmYsaj10aGlzLnBvc2l0aW9uLnktaCpkLWMqZyxrPWEuYSxsPWEuYixtPWEuYyxuPWEuZDtiLmE9ayplK2wqZyxiLmI9aypmK2wqaCxiLnR4PWsqaStsKmorYS50eCxiLmM9bSplK24qZyxiLmQ9bSpmK24qaCxiLnR5PW0qaStuKmorYS50eSx0aGlzLndvcmxkQWxwaGE9dGhpcy5hbHBoYSp0aGlzLnBhcmVudC53b3JsZEFscGhhfSxiLkRpc3BsYXlPYmplY3QucHJvdG90eXBlLmdldEJvdW5kcz1mdW5jdGlvbihhKXtyZXR1cm4gYT1hLGIuRW1wdHlSZWN0YW5nbGV9LGIuRGlzcGxheU9iamVjdC5wcm90b3R5cGUuZ2V0TG9jYWxCb3VuZHM9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5nZXRCb3VuZHMoYi5pZGVudGl0eU1hdHJpeCl9LGIuRGlzcGxheU9iamVjdC5wcm90b3R5cGUuc2V0U3RhZ2VSZWZlcmVuY2U9ZnVuY3Rpb24oYSl7dGhpcy5zdGFnZT1hLHRoaXMuX2ludGVyYWN0aXZlJiYodGhpcy5zdGFnZS5kaXJ0eT0hMCl9LGIuRGlzcGxheU9iamVjdC5wcm90b3R5cGUuZ2VuZXJhdGVUZXh0dXJlPWZ1bmN0aW9uKGEpe3ZhciBjPXRoaXMuZ2V0TG9jYWxCb3VuZHMoKSxkPW5ldyBiLlJlbmRlclRleHR1cmUoMHxjLndpZHRoLDB8Yy5oZWlnaHQsYSk7cmV0dXJuIGQucmVuZGVyKHRoaXMsbmV3IGIuUG9pbnQoLWMueCwtYy55KSksZH0sYi5EaXNwbGF5T2JqZWN0LnByb3RvdHlwZS51cGRhdGVDYWNoZT1mdW5jdGlvbigpe3RoaXMuX2dlbmVyYXRlQ2FjaGVkU3ByaXRlKCl9LGIuRGlzcGxheU9iamVjdC5wcm90b3R5cGUuX3JlbmRlckNhY2hlZFNwcml0ZT1mdW5jdGlvbihhKXt0aGlzLl9jYWNoZWRTcHJpdGUud29ybGRBbHBoYT10aGlzLndvcmxkQWxwaGEsYS5nbD9iLlNwcml0ZS5wcm90b3R5cGUuX3JlbmRlcldlYkdMLmNhbGwodGhpcy5fY2FjaGVkU3ByaXRlLGEpOmIuU3ByaXRlLnByb3RvdHlwZS5fcmVuZGVyQ2FudmFzLmNhbGwodGhpcy5fY2FjaGVkU3ByaXRlLGEpfSxiLkRpc3BsYXlPYmplY3QucHJvdG90eXBlLl9nZW5lcmF0ZUNhY2hlZFNwcml0ZT1mdW5jdGlvbigpe3RoaXMuX2NhY2hlQXNCaXRtYXA9ITE7dmFyIGE9dGhpcy5nZXRMb2NhbEJvdW5kcygpO2lmKHRoaXMuX2NhY2hlZFNwcml0ZSl0aGlzLl9jYWNoZWRTcHJpdGUudGV4dHVyZS5yZXNpemUoMHxhLndpZHRoLDB8YS5oZWlnaHQpO2Vsc2V7dmFyIGM9bmV3IGIuUmVuZGVyVGV4dHVyZSgwfGEud2lkdGgsMHxhLmhlaWdodCk7dGhpcy5fY2FjaGVkU3ByaXRlPW5ldyBiLlNwcml0ZShjKSx0aGlzLl9jYWNoZWRTcHJpdGUud29ybGRUcmFuc2Zvcm09dGhpcy53b3JsZFRyYW5zZm9ybX12YXIgZD10aGlzLl9maWx0ZXJzO3RoaXMuX2ZpbHRlcnM9bnVsbCx0aGlzLl9jYWNoZWRTcHJpdGUuZmlsdGVycz1kLHRoaXMuX2NhY2hlZFNwcml0ZS50ZXh0dXJlLnJlbmRlcih0aGlzLG5ldyBiLlBvaW50KC1hLngsLWEueSkpLHRoaXMuX2NhY2hlZFNwcml0ZS5hbmNob3IueD0tKGEueC9hLndpZHRoKSx0aGlzLl9jYWNoZWRTcHJpdGUuYW5jaG9yLnk9LShhLnkvYS5oZWlnaHQpLHRoaXMuX2ZpbHRlcnM9ZCx0aGlzLl9jYWNoZUFzQml0bWFwPSEwfSxiLkRpc3BsYXlPYmplY3QucHJvdG90eXBlLl9kZXN0cm95Q2FjaGVkU3ByaXRlPWZ1bmN0aW9uKCl7dGhpcy5fY2FjaGVkU3ByaXRlJiYodGhpcy5fY2FjaGVkU3ByaXRlLnRleHR1cmUuZGVzdHJveSghMCksdGhpcy5fY2FjaGVkU3ByaXRlPW51bGwpfSxiLkRpc3BsYXlPYmplY3QucHJvdG90eXBlLl9yZW5kZXJXZWJHTD1mdW5jdGlvbihhKXthPWF9LGIuRGlzcGxheU9iamVjdC5wcm90b3R5cGUuX3JlbmRlckNhbnZhcz1mdW5jdGlvbihhKXthPWF9LE9iamVjdC5kZWZpbmVQcm9wZXJ0eShiLkRpc3BsYXlPYmplY3QucHJvdG90eXBlLFwieFwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5wb3NpdGlvbi54fSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy5wb3NpdGlvbi54PWF9fSksT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuRGlzcGxheU9iamVjdC5wcm90b3R5cGUsXCJ5XCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnBvc2l0aW9uLnl9LHNldDpmdW5jdGlvbihhKXt0aGlzLnBvc2l0aW9uLnk9YX19KSxiLkRpc3BsYXlPYmplY3RDb250YWluZXI9ZnVuY3Rpb24oKXtiLkRpc3BsYXlPYmplY3QuY2FsbCh0aGlzKSx0aGlzLmNoaWxkcmVuPVtdfSxiLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoYi5EaXNwbGF5T2JqZWN0LnByb3RvdHlwZSksYi5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLkRpc3BsYXlPYmplY3RDb250YWluZXIsT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUsXCJ3aWR0aFwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5zY2FsZS54KnRoaXMuZ2V0TG9jYWxCb3VuZHMoKS53aWR0aH0sc2V0OmZ1bmN0aW9uKGEpe3ZhciBiPXRoaXMuZ2V0TG9jYWxCb3VuZHMoKS53aWR0aDt0aGlzLnNjYWxlLng9MCE9PWI/YS8oYi90aGlzLnNjYWxlLngpOjEsdGhpcy5fd2lkdGg9YX19KSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSxcImhlaWdodFwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5zY2FsZS55KnRoaXMuZ2V0TG9jYWxCb3VuZHMoKS5oZWlnaHR9LHNldDpmdW5jdGlvbihhKXt2YXIgYj10aGlzLmdldExvY2FsQm91bmRzKCkuaGVpZ2h0O3RoaXMuc2NhbGUueT0wIT09Yj9hLyhiL3RoaXMuc2NhbGUueSk6MSx0aGlzLl9oZWlnaHQ9YX19KSxiLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLmFkZENoaWxkPWZ1bmN0aW9uKGEpe3JldHVybiB0aGlzLmFkZENoaWxkQXQoYSx0aGlzLmNoaWxkcmVuLmxlbmd0aCl9LGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUuYWRkQ2hpbGRBdD1mdW5jdGlvbihhLGIpe2lmKGI+PTAmJmI8PXRoaXMuY2hpbGRyZW4ubGVuZ3RoKXJldHVybiBhLnBhcmVudCYmYS5wYXJlbnQucmVtb3ZlQ2hpbGQoYSksYS5wYXJlbnQ9dGhpcyx0aGlzLmNoaWxkcmVuLnNwbGljZShiLDAsYSksdGhpcy5zdGFnZSYmYS5zZXRTdGFnZVJlZmVyZW5jZSh0aGlzLnN0YWdlKSxhO3Rocm93IG5ldyBFcnJvcihhK1wiIFRoZSBpbmRleCBcIitiK1wiIHN1cHBsaWVkIGlzIG91dCBvZiBib3VuZHMgXCIrdGhpcy5jaGlsZHJlbi5sZW5ndGgpfSxiLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLnN3YXBDaGlsZHJlbj1mdW5jdGlvbihhLGIpe2lmKGEhPT1iKXt2YXIgYz10aGlzLmNoaWxkcmVuLmluZGV4T2YoYSksZD10aGlzLmNoaWxkcmVuLmluZGV4T2YoYik7aWYoMD5jfHwwPmQpdGhyb3cgbmV3IEVycm9yKFwic3dhcENoaWxkcmVuOiBCb3RoIHRoZSBzdXBwbGllZCBEaXNwbGF5T2JqZWN0cyBtdXN0IGJlIGEgY2hpbGQgb2YgdGhlIGNhbGxlci5cIik7dGhpcy5jaGlsZHJlbltjXT1iLHRoaXMuY2hpbGRyZW5bZF09YX19LGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUuZ2V0Q2hpbGRBdD1mdW5jdGlvbihhKXtpZihhPj0wJiZhPHRoaXMuY2hpbGRyZW4ubGVuZ3RoKXJldHVybiB0aGlzLmNoaWxkcmVuW2FdO3Rocm93IG5ldyBFcnJvcihcIlN1cHBsaWVkIGluZGV4IGRvZXMgbm90IGV4aXN0IGluIHRoZSBjaGlsZCBsaXN0LCBvciB0aGUgc3VwcGxpZWQgRGlzcGxheU9iamVjdCBtdXN0IGJlIGEgY2hpbGQgb2YgdGhlIGNhbGxlclwiKX0sYi5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZS5yZW1vdmVDaGlsZD1mdW5jdGlvbihhKXtyZXR1cm4gdGhpcy5yZW1vdmVDaGlsZEF0KHRoaXMuY2hpbGRyZW4uaW5kZXhPZihhKSl9LGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUucmVtb3ZlQ2hpbGRBdD1mdW5jdGlvbihhKXt2YXIgYj10aGlzLmdldENoaWxkQXQoYSk7cmV0dXJuIHRoaXMuc3RhZ2UmJmIucmVtb3ZlU3RhZ2VSZWZlcmVuY2UoKSxiLnBhcmVudD12b2lkIDAsdGhpcy5jaGlsZHJlbi5zcGxpY2UoYSwxKSxifSxiLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLnJlbW92ZUNoaWxkcmVuPWZ1bmN0aW9uKGEsYil7dmFyIGM9YXx8MCxkPVwibnVtYmVyXCI9PXR5cGVvZiBiP2I6dGhpcy5jaGlsZHJlbi5sZW5ndGgsZT1kLWM7aWYoZT4wJiZkPj1lKXtmb3IodmFyIGY9dGhpcy5jaGlsZHJlbi5zcGxpY2UoYyxlKSxnPTA7ZzxmLmxlbmd0aDtnKyspe3ZhciBoPWZbZ107dGhpcy5zdGFnZSYmaC5yZW1vdmVTdGFnZVJlZmVyZW5jZSgpLGgucGFyZW50PXZvaWQgMH1yZXR1cm4gZn10aHJvdyBuZXcgRXJyb3IoXCJSYW5nZSBFcnJvciwgbnVtZXJpYyB2YWx1ZXMgYXJlIG91dHNpZGUgdGhlIGFjY2VwdGFibGUgcmFuZ2VcIil9LGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtPWZ1bmN0aW9uKCl7aWYodGhpcy52aXNpYmxlJiYoYi5EaXNwbGF5T2JqZWN0LnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm0uY2FsbCh0aGlzKSwhdGhpcy5fY2FjaGVBc0JpdG1hcCkpZm9yKHZhciBhPTAsYz10aGlzLmNoaWxkcmVuLmxlbmd0aDtjPmE7YSsrKXRoaXMuY2hpbGRyZW5bYV0udXBkYXRlVHJhbnNmb3JtKCl9LGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUuZ2V0Qm91bmRzPWZ1bmN0aW9uKGEpe2lmKDA9PT10aGlzLmNoaWxkcmVuLmxlbmd0aClyZXR1cm4gYi5FbXB0eVJlY3RhbmdsZTtpZihhKXt2YXIgYz10aGlzLndvcmxkVHJhbnNmb3JtO3RoaXMud29ybGRUcmFuc2Zvcm09YSx0aGlzLnVwZGF0ZVRyYW5zZm9ybSgpLHRoaXMud29ybGRUcmFuc2Zvcm09Y31mb3IodmFyIGQsZSxmLGc9MS8wLGg9MS8wLGk9LTEvMCxqPS0xLzAsaz0hMSxsPTAsbT10aGlzLmNoaWxkcmVuLmxlbmd0aDttPmw7bCsrKXt2YXIgbj10aGlzLmNoaWxkcmVuW2xdO24udmlzaWJsZSYmKGs9ITAsZD10aGlzLmNoaWxkcmVuW2xdLmdldEJvdW5kcyhhKSxnPWc8ZC54P2c6ZC54LGg9aDxkLnk/aDpkLnksZT1kLndpZHRoK2QueCxmPWQuaGVpZ2h0K2QueSxpPWk+ZT9pOmUsaj1qPmY/ajpmKX1pZighaylyZXR1cm4gYi5FbXB0eVJlY3RhbmdsZTt2YXIgbz10aGlzLl9ib3VuZHM7cmV0dXJuIG8ueD1nLG8ueT1oLG8ud2lkdGg9aS1nLG8uaGVpZ2h0PWotaCxvfSxiLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLmdldExvY2FsQm91bmRzPWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy53b3JsZFRyYW5zZm9ybTt0aGlzLndvcmxkVHJhbnNmb3JtPWIuaWRlbnRpdHlNYXRyaXg7Zm9yKHZhciBjPTAsZD10aGlzLmNoaWxkcmVuLmxlbmd0aDtkPmM7YysrKXRoaXMuY2hpbGRyZW5bY10udXBkYXRlVHJhbnNmb3JtKCk7dmFyIGU9dGhpcy5nZXRCb3VuZHMoKTtyZXR1cm4gdGhpcy53b3JsZFRyYW5zZm9ybT1hLGV9LGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUuc2V0U3RhZ2VSZWZlcmVuY2U9ZnVuY3Rpb24oYSl7dGhpcy5zdGFnZT1hLHRoaXMuX2ludGVyYWN0aXZlJiYodGhpcy5zdGFnZS5kaXJ0eT0hMCk7Zm9yKHZhciBiPTAsYz10aGlzLmNoaWxkcmVuLmxlbmd0aDtjPmI7YisrKXt2YXIgZD10aGlzLmNoaWxkcmVuW2JdO2Quc2V0U3RhZ2VSZWZlcmVuY2UoYSl9fSxiLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLnJlbW92ZVN0YWdlUmVmZXJlbmNlPWZ1bmN0aW9uKCl7Zm9yKHZhciBhPTAsYj10aGlzLmNoaWxkcmVuLmxlbmd0aDtiPmE7YSsrKXt2YXIgYz10aGlzLmNoaWxkcmVuW2FdO2MucmVtb3ZlU3RhZ2VSZWZlcmVuY2UoKX10aGlzLl9pbnRlcmFjdGl2ZSYmKHRoaXMuc3RhZ2UuZGlydHk9ITApLHRoaXMuc3RhZ2U9bnVsbH0sYi5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZS5fcmVuZGVyV2ViR0w9ZnVuY3Rpb24oYSl7aWYodGhpcy52aXNpYmxlJiYhKHRoaXMuYWxwaGE8PTApKXtpZih0aGlzLl9jYWNoZUFzQml0bWFwKXJldHVybiB0aGlzLl9yZW5kZXJDYWNoZWRTcHJpdGUoYSksdm9pZCAwO3ZhciBiLGM7aWYodGhpcy5fbWFza3x8dGhpcy5fZmlsdGVycyl7Zm9yKHRoaXMuX2ZpbHRlcnMmJihhLnNwcml0ZUJhdGNoLmZsdXNoKCksYS5maWx0ZXJNYW5hZ2VyLnB1c2hGaWx0ZXIodGhpcy5fZmlsdGVyQmxvY2spKSx0aGlzLl9tYXNrJiYoYS5zcHJpdGVCYXRjaC5zdG9wKCksYS5tYXNrTWFuYWdlci5wdXNoTWFzayh0aGlzLm1hc2ssYSksYS5zcHJpdGVCYXRjaC5zdGFydCgpKSxiPTAsYz10aGlzLmNoaWxkcmVuLmxlbmd0aDtjPmI7YisrKXRoaXMuY2hpbGRyZW5bYl0uX3JlbmRlcldlYkdMKGEpO2Euc3ByaXRlQmF0Y2guc3RvcCgpLHRoaXMuX21hc2smJmEubWFza01hbmFnZXIucG9wTWFzayh0aGlzLl9tYXNrLGEpLHRoaXMuX2ZpbHRlcnMmJmEuZmlsdGVyTWFuYWdlci5wb3BGaWx0ZXIoKSxhLnNwcml0ZUJhdGNoLnN0YXJ0KCl9ZWxzZSBmb3IoYj0wLGM9dGhpcy5jaGlsZHJlbi5sZW5ndGg7Yz5iO2IrKyl0aGlzLmNoaWxkcmVuW2JdLl9yZW5kZXJXZWJHTChhKX19LGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUuX3JlbmRlckNhbnZhcz1mdW5jdGlvbihhKXtpZih0aGlzLnZpc2libGUhPT0hMSYmMCE9PXRoaXMuYWxwaGEpe2lmKHRoaXMuX2NhY2hlQXNCaXRtYXApcmV0dXJuIHRoaXMuX3JlbmRlckNhY2hlZFNwcml0ZShhKSx2b2lkIDA7dGhpcy5fbWFzayYmYS5tYXNrTWFuYWdlci5wdXNoTWFzayh0aGlzLl9tYXNrLGEuY29udGV4dCk7Zm9yKHZhciBiPTAsYz10aGlzLmNoaWxkcmVuLmxlbmd0aDtjPmI7YisrKXt2YXIgZD10aGlzLmNoaWxkcmVuW2JdO2QuX3JlbmRlckNhbnZhcyhhKX10aGlzLl9tYXNrJiZhLm1hc2tNYW5hZ2VyLnBvcE1hc2soYS5jb250ZXh0KX19LGIuU3ByaXRlPWZ1bmN0aW9uKGEpe2IuRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKHRoaXMpLHRoaXMuYW5jaG9yPW5ldyBiLlBvaW50LHRoaXMudGV4dHVyZT1hLHRoaXMuX3dpZHRoPTAsdGhpcy5faGVpZ2h0PTAsdGhpcy50aW50PTE2Nzc3MjE1LHRoaXMuYmxlbmRNb2RlPWIuYmxlbmRNb2Rlcy5OT1JNQUwsYS5iYXNlVGV4dHVyZS5oYXNMb2FkZWQ/dGhpcy5vblRleHR1cmVVcGRhdGUoKToodGhpcy5vblRleHR1cmVVcGRhdGVCaW5kPXRoaXMub25UZXh0dXJlVXBkYXRlLmJpbmQodGhpcyksdGhpcy50ZXh0dXJlLmFkZEV2ZW50TGlzdGVuZXIoXCJ1cGRhdGVcIix0aGlzLm9uVGV4dHVyZVVwZGF0ZUJpbmQpKSx0aGlzLnJlbmRlcmFibGU9ITB9LGIuU3ByaXRlLnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUpLGIuU3ByaXRlLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLlNwcml0ZSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5TcHJpdGUucHJvdG90eXBlLFwid2lkdGhcIix7Z2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuc2NhbGUueCp0aGlzLnRleHR1cmUuZnJhbWUud2lkdGh9LHNldDpmdW5jdGlvbihhKXt0aGlzLnNjYWxlLng9YS90aGlzLnRleHR1cmUuZnJhbWUud2lkdGgsdGhpcy5fd2lkdGg9YX19KSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5TcHJpdGUucHJvdG90eXBlLFwiaGVpZ2h0XCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnNjYWxlLnkqdGhpcy50ZXh0dXJlLmZyYW1lLmhlaWdodH0sc2V0OmZ1bmN0aW9uKGEpe3RoaXMuc2NhbGUueT1hL3RoaXMudGV4dHVyZS5mcmFtZS5oZWlnaHQsdGhpcy5faGVpZ2h0PWF9fSksYi5TcHJpdGUucHJvdG90eXBlLnNldFRleHR1cmU9ZnVuY3Rpb24oYSl7dGhpcy50ZXh0dXJlPWEsdGhpcy5jYWNoZWRUaW50PTE2Nzc3MjE1fSxiLlNwcml0ZS5wcm90b3R5cGUub25UZXh0dXJlVXBkYXRlPWZ1bmN0aW9uKCl7dGhpcy5fd2lkdGgmJih0aGlzLnNjYWxlLng9dGhpcy5fd2lkdGgvdGhpcy50ZXh0dXJlLmZyYW1lLndpZHRoKSx0aGlzLl9oZWlnaHQmJih0aGlzLnNjYWxlLnk9dGhpcy5faGVpZ2h0L3RoaXMudGV4dHVyZS5mcmFtZS5oZWlnaHQpfSxiLlNwcml0ZS5wcm90b3R5cGUuZ2V0Qm91bmRzPWZ1bmN0aW9uKGEpe3ZhciBiPXRoaXMudGV4dHVyZS5mcmFtZS53aWR0aCxjPXRoaXMudGV4dHVyZS5mcmFtZS5oZWlnaHQsZD1iKigxLXRoaXMuYW5jaG9yLngpLGU9YiotdGhpcy5hbmNob3IueCxmPWMqKDEtdGhpcy5hbmNob3IueSksZz1jKi10aGlzLmFuY2hvci55LGg9YXx8dGhpcy53b3JsZFRyYW5zZm9ybSxpPWguYSxqPWguYyxrPWguYixsPWguZCxtPWgudHgsbj1oLnR5LG89aSplK2sqZyttLHA9bCpnK2oqZStuLHE9aSpkK2sqZyttLHI9bCpnK2oqZCtuLHM9aSpkK2sqZittLHQ9bCpmK2oqZCtuLHU9aSplK2sqZittLHY9bCpmK2oqZStuLHc9LTEvMCx4PS0xLzAseT0xLzAsej0xLzA7eT15Pm8/bzp5LHk9eT5xP3E6eSx5PXk+cz9zOnkseT15PnU/dTp5LHo9ej5wP3A6eix6PXo+cj9yOnosej16PnQ/dDp6LHo9ej52P3Y6eix3PW8+dz9vOncsdz1xPnc/cTp3LHc9cz53P3M6dyx3PXU+dz91OncseD1wPng/cDp4LHg9cj54P3I6eCx4PXQ+eD90OngseD12Png/djp4O3ZhciBBPXRoaXMuX2JvdW5kcztyZXR1cm4gQS54PXksQS53aWR0aD13LXksQS55PXosQS5oZWlnaHQ9eC16LHRoaXMuX2N1cnJlbnRCb3VuZHM9QSxBfSxiLlNwcml0ZS5wcm90b3R5cGUuX3JlbmRlcldlYkdMPWZ1bmN0aW9uKGEpe2lmKHRoaXMudmlzaWJsZSYmISh0aGlzLmFscGhhPD0wKSl7dmFyIGIsYztpZih0aGlzLl9tYXNrfHx0aGlzLl9maWx0ZXJzKXt2YXIgZD1hLnNwcml0ZUJhdGNoO2Zvcih0aGlzLl9maWx0ZXJzJiYoZC5mbHVzaCgpLGEuZmlsdGVyTWFuYWdlci5wdXNoRmlsdGVyKHRoaXMuX2ZpbHRlckJsb2NrKSksdGhpcy5fbWFzayYmKGQuc3RvcCgpLGEubWFza01hbmFnZXIucHVzaE1hc2sodGhpcy5tYXNrLGEpLGQuc3RhcnQoKSksZC5yZW5kZXIodGhpcyksYj0wLGM9dGhpcy5jaGlsZHJlbi5sZW5ndGg7Yz5iO2IrKyl0aGlzLmNoaWxkcmVuW2JdLl9yZW5kZXJXZWJHTChhKTtkLnN0b3AoKSx0aGlzLl9tYXNrJiZhLm1hc2tNYW5hZ2VyLnBvcE1hc2sodGhpcy5fbWFzayxhKSx0aGlzLl9maWx0ZXJzJiZhLmZpbHRlck1hbmFnZXIucG9wRmlsdGVyKCksZC5zdGFydCgpfWVsc2UgZm9yKGEuc3ByaXRlQmF0Y2gucmVuZGVyKHRoaXMpLGI9MCxjPXRoaXMuY2hpbGRyZW4ubGVuZ3RoO2M+YjtiKyspdGhpcy5jaGlsZHJlbltiXS5fcmVuZGVyV2ViR0woYSl9fSxiLlNwcml0ZS5wcm90b3R5cGUuX3JlbmRlckNhbnZhcz1mdW5jdGlvbihhKXtpZih0aGlzLnZpc2libGUhPT0hMSYmMCE9PXRoaXMuYWxwaGEpe2lmKHRoaXMuYmxlbmRNb2RlIT09YS5jdXJyZW50QmxlbmRNb2RlJiYoYS5jdXJyZW50QmxlbmRNb2RlPXRoaXMuYmxlbmRNb2RlLGEuY29udGV4dC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb249Yi5ibGVuZE1vZGVzQ2FudmFzW2EuY3VycmVudEJsZW5kTW9kZV0pLHRoaXMuX21hc2smJmEubWFza01hbmFnZXIucHVzaE1hc2sodGhpcy5fbWFzayxhLmNvbnRleHQpLHRoaXMudGV4dHVyZS52YWxpZCl7YS5jb250ZXh0Lmdsb2JhbEFscGhhPXRoaXMud29ybGRBbHBoYSxhLnJvdW5kUGl4ZWxzP2EuY29udGV4dC5zZXRUcmFuc2Zvcm0odGhpcy53b3JsZFRyYW5zZm9ybS5hLHRoaXMud29ybGRUcmFuc2Zvcm0uYyx0aGlzLndvcmxkVHJhbnNmb3JtLmIsdGhpcy53b3JsZFRyYW5zZm9ybS5kLDB8dGhpcy53b3JsZFRyYW5zZm9ybS50eCwwfHRoaXMud29ybGRUcmFuc2Zvcm0udHkpOmEuY29udGV4dC5zZXRUcmFuc2Zvcm0odGhpcy53b3JsZFRyYW5zZm9ybS5hLHRoaXMud29ybGRUcmFuc2Zvcm0uYyx0aGlzLndvcmxkVHJhbnNmb3JtLmIsdGhpcy53b3JsZFRyYW5zZm9ybS5kLHRoaXMud29ybGRUcmFuc2Zvcm0udHgsdGhpcy53b3JsZFRyYW5zZm9ybS50eSksYS5zbW9vdGhQcm9wZXJ0eSYmYS5zY2FsZU1vZGUhPT10aGlzLnRleHR1cmUuYmFzZVRleHR1cmUuc2NhbGVNb2RlJiYoYS5zY2FsZU1vZGU9dGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLnNjYWxlTW9kZSxhLmNvbnRleHRbYS5zbW9vdGhQcm9wZXJ0eV09YS5zY2FsZU1vZGU9PT1iLnNjYWxlTW9kZXMuTElORUFSKTt2YXIgYz10aGlzLnRleHR1cmUudHJpbT90aGlzLnRleHR1cmUudHJpbS54LXRoaXMuYW5jaG9yLngqdGhpcy50ZXh0dXJlLnRyaW0ud2lkdGg6dGhpcy5hbmNob3IueCotdGhpcy50ZXh0dXJlLmZyYW1lLndpZHRoLGQ9dGhpcy50ZXh0dXJlLnRyaW0/dGhpcy50ZXh0dXJlLnRyaW0ueS10aGlzLmFuY2hvci55KnRoaXMudGV4dHVyZS50cmltLmhlaWdodDp0aGlzLmFuY2hvci55Ki10aGlzLnRleHR1cmUuZnJhbWUuaGVpZ2h0OzE2Nzc3MjE1IT09dGhpcy50aW50Pyh0aGlzLmNhY2hlZFRpbnQhPT10aGlzLnRpbnQmJih0aGlzLmNhY2hlZFRpbnQ9dGhpcy50aW50LHRoaXMudGludGVkVGV4dHVyZT1iLkNhbnZhc1RpbnRlci5nZXRUaW50ZWRUZXh0dXJlKHRoaXMsdGhpcy50aW50KSksYS5jb250ZXh0LmRyYXdJbWFnZSh0aGlzLnRpbnRlZFRleHR1cmUsMCwwLHRoaXMudGV4dHVyZS5jcm9wLndpZHRoLHRoaXMudGV4dHVyZS5jcm9wLmhlaWdodCxjLGQsdGhpcy50ZXh0dXJlLmNyb3Aud2lkdGgsdGhpcy50ZXh0dXJlLmNyb3AuaGVpZ2h0KSk6YS5jb250ZXh0LmRyYXdJbWFnZSh0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUuc291cmNlLHRoaXMudGV4dHVyZS5jcm9wLngsdGhpcy50ZXh0dXJlLmNyb3AueSx0aGlzLnRleHR1cmUuY3JvcC53aWR0aCx0aGlzLnRleHR1cmUuY3JvcC5oZWlnaHQsYyxkLHRoaXMudGV4dHVyZS5jcm9wLndpZHRoLHRoaXMudGV4dHVyZS5jcm9wLmhlaWdodCl9Zm9yKHZhciBlPTAsZj10aGlzLmNoaWxkcmVuLmxlbmd0aDtmPmU7ZSsrKXRoaXMuY2hpbGRyZW5bZV0uX3JlbmRlckNhbnZhcyhhKTt0aGlzLl9tYXNrJiZhLm1hc2tNYW5hZ2VyLnBvcE1hc2soYS5jb250ZXh0KX19LGIuU3ByaXRlLmZyb21GcmFtZT1mdW5jdGlvbihhKXt2YXIgYz1iLlRleHR1cmVDYWNoZVthXTtpZighYyl0aHJvdyBuZXcgRXJyb3IoJ1RoZSBmcmFtZUlkIFwiJythKydcIiBkb2VzIG5vdCBleGlzdCBpbiB0aGUgdGV4dHVyZSBjYWNoZScrdGhpcyk7cmV0dXJuIG5ldyBiLlNwcml0ZShjKX0sYi5TcHJpdGUuZnJvbUltYWdlPWZ1bmN0aW9uKGEsYyxkKXt2YXIgZT1iLlRleHR1cmUuZnJvbUltYWdlKGEsYyxkKTtyZXR1cm4gbmV3IGIuU3ByaXRlKGUpfSxiLlNwcml0ZUJhdGNoPWZ1bmN0aW9uKGEpe2IuRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKHRoaXMpLHRoaXMudGV4dHVyZVRoaW5nPWEsdGhpcy5yZWFkeT0hMX0sYi5TcHJpdGVCYXRjaC5wcm90b3R5cGU9T2JqZWN0LmNyZWF0ZShiLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlKSxiLlNwcml0ZUJhdGNoLmNvbnN0cnVjdG9yPWIuU3ByaXRlQmF0Y2gsYi5TcHJpdGVCYXRjaC5wcm90b3R5cGUuaW5pdFdlYkdMPWZ1bmN0aW9uKGEpe3RoaXMuZmFzdFNwcml0ZUJhdGNoPW5ldyBiLldlYkdMRmFzdFNwcml0ZUJhdGNoKGEpLHRoaXMucmVhZHk9ITB9LGIuU3ByaXRlQmF0Y2gucHJvdG90eXBlLnVwZGF0ZVRyYW5zZm9ybT1mdW5jdGlvbigpe2IuRGlzcGxheU9iamVjdC5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwodGhpcyl9LGIuU3ByaXRlQmF0Y2gucHJvdG90eXBlLl9yZW5kZXJXZWJHTD1mdW5jdGlvbihhKXshdGhpcy52aXNpYmxlfHx0aGlzLmFscGhhPD0wfHwhdGhpcy5jaGlsZHJlbi5sZW5ndGh8fCh0aGlzLnJlYWR5fHx0aGlzLmluaXRXZWJHTChhLmdsKSxhLnNwcml0ZUJhdGNoLnN0b3AoKSxhLnNoYWRlck1hbmFnZXIuc2V0U2hhZGVyKGEuc2hhZGVyTWFuYWdlci5mYXN0U2hhZGVyKSx0aGlzLmZhc3RTcHJpdGVCYXRjaC5iZWdpbih0aGlzLGEpLHRoaXMuZmFzdFNwcml0ZUJhdGNoLnJlbmRlcih0aGlzKSxhLnNwcml0ZUJhdGNoLnN0YXJ0KCkpfSxiLlNwcml0ZUJhdGNoLnByb3RvdHlwZS5fcmVuZGVyQ2FudmFzPWZ1bmN0aW9uKGEpe3ZhciBjPWEuY29udGV4dDtjLmdsb2JhbEFscGhhPXRoaXMud29ybGRBbHBoYSxiLkRpc3BsYXlPYmplY3QucHJvdG90eXBlLnVwZGF0ZVRyYW5zZm9ybS5jYWxsKHRoaXMpO2Zvcih2YXIgZD10aGlzLndvcmxkVHJhbnNmb3JtLGU9ITAsZj0wO2Y8dGhpcy5jaGlsZHJlbi5sZW5ndGg7ZisrKXt2YXIgZz10aGlzLmNoaWxkcmVuW2ZdO2lmKGcudmlzaWJsZSl7dmFyIGg9Zy50ZXh0dXJlLGk9aC5mcmFtZTtpZihjLmdsb2JhbEFscGhhPXRoaXMud29ybGRBbHBoYSpnLmFscGhhLGcucm90YXRpb24lKDIqTWF0aC5QSSk9PT0wKWUmJihjLnNldFRyYW5zZm9ybShkLmEsZC5jLGQuYixkLmQsZC50eCxkLnR5KSxlPSExKSxjLmRyYXdJbWFnZShoLmJhc2VUZXh0dXJlLnNvdXJjZSxpLngsaS55LGkud2lkdGgsaS5oZWlnaHQsZy5hbmNob3IueCotaS53aWR0aCpnLnNjYWxlLngrZy5wb3NpdGlvbi54Ky41fDAsZy5hbmNob3IueSotaS5oZWlnaHQqZy5zY2FsZS55K2cucG9zaXRpb24ueSsuNXwwLGkud2lkdGgqZy5zY2FsZS54LGkuaGVpZ2h0Kmcuc2NhbGUueSk7ZWxzZXtlfHwoZT0hMCksYi5EaXNwbGF5T2JqZWN0LnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm0uY2FsbChnKTt2YXIgaj1nLndvcmxkVHJhbnNmb3JtO2Eucm91bmRQaXhlbHM/Yy5zZXRUcmFuc2Zvcm0oai5hLGouYyxqLmIsai5kLDB8ai50eCwwfGoudHkpOmMuc2V0VHJhbnNmb3JtKGouYSxqLmMsai5iLGouZCxqLnR4LGoudHkpLGMuZHJhd0ltYWdlKGguYmFzZVRleHR1cmUuc291cmNlLGkueCxpLnksaS53aWR0aCxpLmhlaWdodCxnLmFuY2hvci54Ki1pLndpZHRoKy41fDAsZy5hbmNob3IueSotaS5oZWlnaHQrLjV8MCxpLndpZHRoLGkuaGVpZ2h0KX19fX0sYi5Nb3ZpZUNsaXA9ZnVuY3Rpb24oYSl7Yi5TcHJpdGUuY2FsbCh0aGlzLGFbMF0pLHRoaXMudGV4dHVyZXM9YSx0aGlzLmFuaW1hdGlvblNwZWVkPTEsdGhpcy5sb29wPSEwLHRoaXMub25Db21wbGV0ZT1udWxsLHRoaXMuY3VycmVudEZyYW1lPTAsdGhpcy5wbGF5aW5nPSExfSxiLk1vdmllQ2xpcC5wcm90b3R5cGU9T2JqZWN0LmNyZWF0ZShiLlNwcml0ZS5wcm90b3R5cGUpLGIuTW92aWVDbGlwLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLk1vdmllQ2xpcCxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5Nb3ZpZUNsaXAucHJvdG90eXBlLFwidG90YWxGcmFtZXNcIix7Z2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMudGV4dHVyZXMubGVuZ3RofX0pLGIuTW92aWVDbGlwLnByb3RvdHlwZS5zdG9wPWZ1bmN0aW9uKCl7dGhpcy5wbGF5aW5nPSExfSxiLk1vdmllQ2xpcC5wcm90b3R5cGUucGxheT1mdW5jdGlvbigpe3RoaXMucGxheWluZz0hMH0sYi5Nb3ZpZUNsaXAucHJvdG90eXBlLmdvdG9BbmRTdG9wPWZ1bmN0aW9uKGEpe3RoaXMucGxheWluZz0hMSx0aGlzLmN1cnJlbnRGcmFtZT1hO3ZhciBiPXRoaXMuY3VycmVudEZyYW1lKy41fDA7dGhpcy5zZXRUZXh0dXJlKHRoaXMudGV4dHVyZXNbYiV0aGlzLnRleHR1cmVzLmxlbmd0aF0pfSxiLk1vdmllQ2xpcC5wcm90b3R5cGUuZ290b0FuZFBsYXk9ZnVuY3Rpb24oYSl7dGhpcy5jdXJyZW50RnJhbWU9YSx0aGlzLnBsYXlpbmc9ITB9LGIuTW92aWVDbGlwLnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm09ZnVuY3Rpb24oKXtpZihiLlNwcml0ZS5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwodGhpcyksdGhpcy5wbGF5aW5nKXt0aGlzLmN1cnJlbnRGcmFtZSs9dGhpcy5hbmltYXRpb25TcGVlZDt2YXIgYT10aGlzLmN1cnJlbnRGcmFtZSsuNXwwO3RoaXMuY3VycmVudEZyYW1lPXRoaXMuY3VycmVudEZyYW1lJXRoaXMudGV4dHVyZXMubGVuZ3RoLHRoaXMubG9vcHx8YTx0aGlzLnRleHR1cmVzLmxlbmd0aD90aGlzLnNldFRleHR1cmUodGhpcy50ZXh0dXJlc1thJXRoaXMudGV4dHVyZXMubGVuZ3RoXSk6YT49dGhpcy50ZXh0dXJlcy5sZW5ndGgmJih0aGlzLmdvdG9BbmRTdG9wKHRoaXMudGV4dHVyZXMubGVuZ3RoLTEpLHRoaXMub25Db21wbGV0ZSYmdGhpcy5vbkNvbXBsZXRlKCkpfX0sYi5Nb3ZpZUNsaXAuZnJvbUZyYW1lcz1mdW5jdGlvbihhKXtmb3IodmFyIGM9W10sZD0wO2Q8YS5sZW5ndGg7ZCsrKWMucHVzaChuZXcgYi5UZXh0dXJlLmZyb21GcmFtZShhW2RdKSk7cmV0dXJuIG5ldyBiLk1vdmllQ2xpcChjKX0sYi5Nb3ZpZUNsaXAuZnJvbUltYWdlcz1mdW5jdGlvbihhKXtmb3IodmFyIGM9W10sZD0wO2Q8YS5sZW5ndGg7ZCsrKWMucHVzaChuZXcgYi5UZXh0dXJlLmZyb21JbWFnZShhW2RdKSk7cmV0dXJuIG5ldyBiLk1vdmllQ2xpcChjKX0sYi5GaWx0ZXJCbG9jaz1mdW5jdGlvbigpe3RoaXMudmlzaWJsZT0hMCx0aGlzLnJlbmRlcmFibGU9ITB9LGIuVGV4dD1mdW5jdGlvbihhLGMpe3RoaXMuY2FudmFzPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIiksdGhpcy5jb250ZXh0PXRoaXMuY2FudmFzLmdldENvbnRleHQoXCIyZFwiKSxiLlNwcml0ZS5jYWxsKHRoaXMsYi5UZXh0dXJlLmZyb21DYW52YXModGhpcy5jYW52YXMpKSx0aGlzLnNldFRleHQoYSksdGhpcy5zZXRTdHlsZShjKX0sYi5UZXh0LnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGIuU3ByaXRlLnByb3RvdHlwZSksYi5UZXh0LnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLlRleHQsT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuVGV4dC5wcm90b3R5cGUsXCJ3aWR0aFwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kaXJ0eSYmKHRoaXMudXBkYXRlVGV4dCgpLHRoaXMuZGlydHk9ITEpLHRoaXMuc2NhbGUueCp0aGlzLnRleHR1cmUuZnJhbWUud2lkdGh9LHNldDpmdW5jdGlvbihhKXt0aGlzLnNjYWxlLng9YS90aGlzLnRleHR1cmUuZnJhbWUud2lkdGgsdGhpcy5fd2lkdGg9YX19KSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5UZXh0LnByb3RvdHlwZSxcImhlaWdodFwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kaXJ0eSYmKHRoaXMudXBkYXRlVGV4dCgpLHRoaXMuZGlydHk9ITEpLHRoaXMuc2NhbGUueSp0aGlzLnRleHR1cmUuZnJhbWUuaGVpZ2h0fSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy5zY2FsZS55PWEvdGhpcy50ZXh0dXJlLmZyYW1lLmhlaWdodCx0aGlzLl9oZWlnaHQ9YX19KSxiLlRleHQucHJvdG90eXBlLnNldFN0eWxlPWZ1bmN0aW9uKGEpe2E9YXx8e30sYS5mb250PWEuZm9udHx8XCJib2xkIDIwcHQgQXJpYWxcIixhLmZpbGw9YS5maWxsfHxcImJsYWNrXCIsYS5hbGlnbj1hLmFsaWdufHxcImxlZnRcIixhLnN0cm9rZT1hLnN0cm9rZXx8XCJibGFja1wiLGEuc3Ryb2tlVGhpY2tuZXNzPWEuc3Ryb2tlVGhpY2tuZXNzfHwwLGEud29yZFdyYXA9YS53b3JkV3JhcHx8ITEsYS53b3JkV3JhcFdpZHRoPWEud29yZFdyYXBXaWR0aHx8MTAwLGEud29yZFdyYXBXaWR0aD1hLndvcmRXcmFwV2lkdGh8fDEwMCxhLmRyb3BTaGFkb3c9YS5kcm9wU2hhZG93fHwhMSxhLmRyb3BTaGFkb3dBbmdsZT1hLmRyb3BTaGFkb3dBbmdsZXx8TWF0aC5QSS82LGEuZHJvcFNoYWRvd0Rpc3RhbmNlPWEuZHJvcFNoYWRvd0Rpc3RhbmNlfHw0LGEuZHJvcFNoYWRvd0NvbG9yPWEuZHJvcFNoYWRvd0NvbG9yfHxcImJsYWNrXCIsdGhpcy5zdHlsZT1hLHRoaXMuZGlydHk9ITB9LGIuVGV4dC5wcm90b3R5cGUuc2V0VGV4dD1mdW5jdGlvbihhKXt0aGlzLnRleHQ9YS50b1N0cmluZygpfHxcIiBcIix0aGlzLmRpcnR5PSEwfSxiLlRleHQucHJvdG90eXBlLnVwZGF0ZVRleHQ9ZnVuY3Rpb24oKXt0aGlzLmNvbnRleHQuZm9udD10aGlzLnN0eWxlLmZvbnQ7dmFyIGE9dGhpcy50ZXh0O3RoaXMuc3R5bGUud29yZFdyYXAmJihhPXRoaXMud29yZFdyYXAodGhpcy50ZXh0KSk7Zm9yKHZhciBiPWEuc3BsaXQoLyg/OlxcclxcbnxcXHJ8XFxuKS8pLGM9W10sZD0wLGU9MDtlPGIubGVuZ3RoO2UrKyl7dmFyIGY9dGhpcy5jb250ZXh0Lm1lYXN1cmVUZXh0KGJbZV0pLndpZHRoO2NbZV09ZixkPU1hdGgubWF4KGQsZil9dmFyIGc9ZCt0aGlzLnN0eWxlLnN0cm9rZVRoaWNrbmVzczt0aGlzLnN0eWxlLmRyb3BTaGFkb3cmJihnKz10aGlzLnN0eWxlLmRyb3BTaGFkb3dEaXN0YW5jZSksdGhpcy5jYW52YXMud2lkdGg9Zyt0aGlzLmNvbnRleHQubGluZVdpZHRoO3ZhciBoPXRoaXMuZGV0ZXJtaW5lRm9udEhlaWdodChcImZvbnQ6IFwiK3RoaXMuc3R5bGUuZm9udCtcIjtcIikrdGhpcy5zdHlsZS5zdHJva2VUaGlja25lc3MsaT1oKmIubGVuZ3RoO3RoaXMuc3R5bGUuZHJvcFNoYWRvdyYmKGkrPXRoaXMuc3R5bGUuZHJvcFNoYWRvd0Rpc3RhbmNlKSx0aGlzLmNhbnZhcy5oZWlnaHQ9aSxuYXZpZ2F0b3IuaXNDb2Nvb25KUyYmdGhpcy5jb250ZXh0LmNsZWFyUmVjdCgwLDAsdGhpcy5jYW52YXMud2lkdGgsdGhpcy5jYW52YXMuaGVpZ2h0KSx0aGlzLmNvbnRleHQuZm9udD10aGlzLnN0eWxlLmZvbnQsdGhpcy5jb250ZXh0LnN0cm9rZVN0eWxlPXRoaXMuc3R5bGUuc3Ryb2tlLHRoaXMuY29udGV4dC5saW5lV2lkdGg9dGhpcy5zdHlsZS5zdHJva2VUaGlja25lc3MsdGhpcy5jb250ZXh0LnRleHRCYXNlbGluZT1cInRvcFwiO3ZhciBqLGs7aWYodGhpcy5zdHlsZS5kcm9wU2hhZG93KXt0aGlzLmNvbnRleHQuZmlsbFN0eWxlPXRoaXMuc3R5bGUuZHJvcFNoYWRvd0NvbG9yO3ZhciBsPU1hdGguc2luKHRoaXMuc3R5bGUuZHJvcFNoYWRvd0FuZ2xlKSp0aGlzLnN0eWxlLmRyb3BTaGFkb3dEaXN0YW5jZSxtPU1hdGguY29zKHRoaXMuc3R5bGUuZHJvcFNoYWRvd0FuZ2xlKSp0aGlzLnN0eWxlLmRyb3BTaGFkb3dEaXN0YW5jZTtmb3IoZT0wO2U8Yi5sZW5ndGg7ZSsrKWo9dGhpcy5zdHlsZS5zdHJva2VUaGlja25lc3MvMixrPXRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzLzIrZSpoLFwicmlnaHRcIj09PXRoaXMuc3R5bGUuYWxpZ24/ais9ZC1jW2VdOlwiY2VudGVyXCI9PT10aGlzLnN0eWxlLmFsaWduJiYoais9KGQtY1tlXSkvMiksdGhpcy5zdHlsZS5maWxsJiZ0aGlzLmNvbnRleHQuZmlsbFRleHQoYltlXSxqK2wsayttKX1mb3IodGhpcy5jb250ZXh0LmZpbGxTdHlsZT10aGlzLnN0eWxlLmZpbGwsZT0wO2U8Yi5sZW5ndGg7ZSsrKWo9dGhpcy5zdHlsZS5zdHJva2VUaGlja25lc3MvMixrPXRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzLzIrZSpoLFwicmlnaHRcIj09PXRoaXMuc3R5bGUuYWxpZ24/ais9ZC1jW2VdOlwiY2VudGVyXCI9PT10aGlzLnN0eWxlLmFsaWduJiYoais9KGQtY1tlXSkvMiksdGhpcy5zdHlsZS5zdHJva2UmJnRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzJiZ0aGlzLmNvbnRleHQuc3Ryb2tlVGV4dChiW2VdLGosayksdGhpcy5zdHlsZS5maWxsJiZ0aGlzLmNvbnRleHQuZmlsbFRleHQoYltlXSxqLGspO3RoaXMudXBkYXRlVGV4dHVyZSgpfSxiLlRleHQucHJvdG90eXBlLnVwZGF0ZVRleHR1cmU9ZnVuY3Rpb24oKXt0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUud2lkdGg9dGhpcy5jYW52YXMud2lkdGgsdGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLmhlaWdodD10aGlzLmNhbnZhcy5oZWlnaHQsdGhpcy50ZXh0dXJlLmNyb3Aud2lkdGg9dGhpcy50ZXh0dXJlLmZyYW1lLndpZHRoPXRoaXMuY2FudmFzLndpZHRoLHRoaXMudGV4dHVyZS5jcm9wLmhlaWdodD10aGlzLnRleHR1cmUuZnJhbWUuaGVpZ2h0PXRoaXMuY2FudmFzLmhlaWdodCx0aGlzLl93aWR0aD10aGlzLmNhbnZhcy53aWR0aCx0aGlzLl9oZWlnaHQ9dGhpcy5jYW52YXMuaGVpZ2h0LHRoaXMucmVxdWlyZXNVcGRhdGU9ITB9LGIuVGV4dC5wcm90b3R5cGUuX3JlbmRlcldlYkdMPWZ1bmN0aW9uKGEpe3RoaXMucmVxdWlyZXNVcGRhdGUmJih0aGlzLnJlcXVpcmVzVXBkYXRlPSExLGIudXBkYXRlV2ViR0xUZXh0dXJlKHRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZSxhLmdsKSksYi5TcHJpdGUucHJvdG90eXBlLl9yZW5kZXJXZWJHTC5jYWxsKHRoaXMsYSl9LGIuVGV4dC5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtPWZ1bmN0aW9uKCl7dGhpcy5kaXJ0eSYmKHRoaXMudXBkYXRlVGV4dCgpLHRoaXMuZGlydHk9ITEpLGIuU3ByaXRlLnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm0uY2FsbCh0aGlzKX0sYi5UZXh0LnByb3RvdHlwZS5kZXRlcm1pbmVGb250SGVpZ2h0PWZ1bmN0aW9uKGEpe3ZhciBjPWIuVGV4dC5oZWlnaHRDYWNoZVthXTtpZighYyl7dmFyIGQ9ZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdLGU9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKSxmPWRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiTVwiKTtlLmFwcGVuZENoaWxkKGYpLGUuc2V0QXR0cmlidXRlKFwic3R5bGVcIixhK1wiO3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MFwiKSxkLmFwcGVuZENoaWxkKGUpLGM9ZS5vZmZzZXRIZWlnaHQsYi5UZXh0LmhlaWdodENhY2hlW2FdPWMsZC5yZW1vdmVDaGlsZChlKX1yZXR1cm4gY30sYi5UZXh0LnByb3RvdHlwZS53b3JkV3JhcD1mdW5jdGlvbihhKXtmb3IodmFyIGI9XCJcIixjPWEuc3BsaXQoXCJcXG5cIiksZD0wO2Q8Yy5sZW5ndGg7ZCsrKXtmb3IodmFyIGU9dGhpcy5zdHlsZS53b3JkV3JhcFdpZHRoLGY9Y1tkXS5zcGxpdChcIiBcIiksZz0wO2c8Zi5sZW5ndGg7ZysrKXt2YXIgaD10aGlzLmNvbnRleHQubWVhc3VyZVRleHQoZltnXSkud2lkdGgsaT1oK3RoaXMuY29udGV4dC5tZWFzdXJlVGV4dChcIiBcIikud2lkdGg7MD09PWd8fGk+ZT8oZz4wJiYoYis9XCJcXG5cIiksYis9ZltnXSxlPXRoaXMuc3R5bGUud29yZFdyYXBXaWR0aC1oKTooZS09aSxiKz1cIiBcIitmW2ddKX1kPGMubGVuZ3RoLTEmJihiKz1cIlxcblwiKX1yZXR1cm4gYn0sYi5UZXh0LnByb3RvdHlwZS5kZXN0cm95PWZ1bmN0aW9uKGEpe3RoaXMuY29udGV4dD1udWxsLHRoaXMuY2FudmFzPW51bGwsdGhpcy50ZXh0dXJlLmRlc3Ryb3kodm9pZCAwPT09YT8hMDphKX0sYi5UZXh0LmhlaWdodENhY2hlPXt9LGIuQml0bWFwVGV4dD1mdW5jdGlvbihhLGMpe2IuRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKHRoaXMpLHRoaXMuX3Bvb2w9W10sdGhpcy5zZXRUZXh0KGEpLHRoaXMuc2V0U3R5bGUoYyksdGhpcy51cGRhdGVUZXh0KCksdGhpcy5kaXJ0eT0hMX0sYi5CaXRtYXBUZXh0LnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUpLGIuQml0bWFwVGV4dC5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5CaXRtYXBUZXh0LGIuQml0bWFwVGV4dC5wcm90b3R5cGUuc2V0VGV4dD1mdW5jdGlvbihhKXt0aGlzLnRleHQ9YXx8XCIgXCIsdGhpcy5kaXJ0eT0hMH0sYi5CaXRtYXBUZXh0LnByb3RvdHlwZS5zZXRTdHlsZT1mdW5jdGlvbihhKXthPWF8fHt9LGEuYWxpZ249YS5hbGlnbnx8XCJsZWZ0XCIsdGhpcy5zdHlsZT1hO3ZhciBjPWEuZm9udC5zcGxpdChcIiBcIik7dGhpcy5mb250TmFtZT1jW2MubGVuZ3RoLTFdLHRoaXMuZm9udFNpemU9Yy5sZW5ndGg+PTI/cGFyc2VJbnQoY1tjLmxlbmd0aC0yXSwxMCk6Yi5CaXRtYXBUZXh0LmZvbnRzW3RoaXMuZm9udE5hbWVdLnNpemUsdGhpcy5kaXJ0eT0hMCx0aGlzLnRpbnQ9YS50aW50fSxiLkJpdG1hcFRleHQucHJvdG90eXBlLnVwZGF0ZVRleHQ9ZnVuY3Rpb24oKXtmb3IodmFyIGE9Yi5CaXRtYXBUZXh0LmZvbnRzW3RoaXMuZm9udE5hbWVdLGM9bmV3IGIuUG9pbnQsZD1udWxsLGU9W10sZj0wLGc9W10saD0wLGk9dGhpcy5mb250U2l6ZS9hLnNpemUsaj0wO2o8dGhpcy50ZXh0Lmxlbmd0aDtqKyspe3ZhciBrPXRoaXMudGV4dC5jaGFyQ29kZUF0KGopO2lmKC8oPzpcXHJcXG58XFxyfFxcbikvLnRlc3QodGhpcy50ZXh0LmNoYXJBdChqKSkpZy5wdXNoKGMueCksZj1NYXRoLm1heChmLGMueCksaCsrLGMueD0wLGMueSs9YS5saW5lSGVpZ2h0LGQ9bnVsbDtlbHNle3ZhciBsPWEuY2hhcnNba107bCYmKGQmJmxbZF0mJihjLngrPWwua2VybmluZ1tkXSksZS5wdXNoKHt0ZXh0dXJlOmwudGV4dHVyZSxsaW5lOmgsY2hhckNvZGU6ayxwb3NpdGlvbjpuZXcgYi5Qb2ludChjLngrbC54T2Zmc2V0LGMueStsLnlPZmZzZXQpfSksYy54Kz1sLnhBZHZhbmNlLGQ9ayl9fWcucHVzaChjLngpLGY9TWF0aC5tYXgoZixjLngpO3ZhciBtPVtdO2ZvcihqPTA7aD49ajtqKyspe3ZhciBuPTA7XCJyaWdodFwiPT09dGhpcy5zdHlsZS5hbGlnbj9uPWYtZ1tqXTpcImNlbnRlclwiPT09dGhpcy5zdHlsZS5hbGlnbiYmKG49KGYtZ1tqXSkvMiksbS5wdXNoKG4pfXZhciBvPXRoaXMuY2hpbGRyZW4ubGVuZ3RoLHA9ZS5sZW5ndGgscT10aGlzLnRpbnR8fDE2Nzc3MjE1O2ZvcihqPTA7cD5qO2orKyl7dmFyIHI9bz5qP3RoaXMuY2hpbGRyZW5bal06dGhpcy5fcG9vbC5wb3AoKTtyP3Iuc2V0VGV4dHVyZShlW2pdLnRleHR1cmUpOnI9bmV3IGIuU3ByaXRlKGVbal0udGV4dHVyZSksci5wb3NpdGlvbi54PShlW2pdLnBvc2l0aW9uLngrbVtlW2pdLmxpbmVdKSppLHIucG9zaXRpb24ueT1lW2pdLnBvc2l0aW9uLnkqaSxyLnNjYWxlLng9ci5zY2FsZS55PWksci50aW50PXEsci5wYXJlbnR8fHRoaXMuYWRkQ2hpbGQocil9Zm9yKDt0aGlzLmNoaWxkcmVuLmxlbmd0aD5wOyl7dmFyIHM9dGhpcy5nZXRDaGlsZEF0KHRoaXMuY2hpbGRyZW4ubGVuZ3RoLTEpO3RoaXMuX3Bvb2wucHVzaChzKSx0aGlzLnJlbW92ZUNoaWxkKHMpfXRoaXMudGV4dFdpZHRoPWYqaSx0aGlzLnRleHRIZWlnaHQ9KGMueSthLmxpbmVIZWlnaHQpKml9LGIuQml0bWFwVGV4dC5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtPWZ1bmN0aW9uKCl7dGhpcy5kaXJ0eSYmKHRoaXMudXBkYXRlVGV4dCgpLHRoaXMuZGlydHk9ITEpLGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwodGhpcyl9LGIuQml0bWFwVGV4dC5mb250cz17fSxiLkludGVyYWN0aW9uRGF0YT1mdW5jdGlvbigpe3RoaXMuZ2xvYmFsPW5ldyBiLlBvaW50LHRoaXMudGFyZ2V0PW51bGwsdGhpcy5vcmlnaW5hbEV2ZW50PW51bGx9LGIuSW50ZXJhY3Rpb25EYXRhLnByb3RvdHlwZS5nZXRMb2NhbFBvc2l0aW9uPWZ1bmN0aW9uKGEpe3ZhciBjPWEud29ybGRUcmFuc2Zvcm0sZD10aGlzLmdsb2JhbCxlPWMuYSxmPWMuYixnPWMudHgsaD1jLmMsaT1jLmQsaj1jLnR5LGs9MS8oZSppK2YqLWgpO3JldHVybiBuZXcgYi5Qb2ludChpKmsqZC54Ky1mKmsqZC55KyhqKmYtZyppKSprLGUqaypkLnkrLWgqaypkLngrKC1qKmUrZypoKSprKX0sYi5JbnRlcmFjdGlvbkRhdGEucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuSW50ZXJhY3Rpb25EYXRhLGIuSW50ZXJhY3Rpb25NYW5hZ2VyPWZ1bmN0aW9uKGEpe3RoaXMuc3RhZ2U9YSx0aGlzLm1vdXNlPW5ldyBiLkludGVyYWN0aW9uRGF0YSx0aGlzLnRvdWNocz17fSx0aGlzLnRlbXBQb2ludD1uZXcgYi5Qb2ludCx0aGlzLm1vdXNlb3ZlckVuYWJsZWQ9ITAsdGhpcy5wb29sPVtdLHRoaXMuaW50ZXJhY3RpdmVJdGVtcz1bXSx0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudD1udWxsLHRoaXMub25Nb3VzZU1vdmU9dGhpcy5vbk1vdXNlTW92ZS5iaW5kKHRoaXMpLHRoaXMub25Nb3VzZURvd249dGhpcy5vbk1vdXNlRG93bi5iaW5kKHRoaXMpLHRoaXMub25Nb3VzZU91dD10aGlzLm9uTW91c2VPdXQuYmluZCh0aGlzKSx0aGlzLm9uTW91c2VVcD10aGlzLm9uTW91c2VVcC5iaW5kKHRoaXMpLHRoaXMub25Ub3VjaFN0YXJ0PXRoaXMub25Ub3VjaFN0YXJ0LmJpbmQodGhpcyksdGhpcy5vblRvdWNoRW5kPXRoaXMub25Ub3VjaEVuZC5iaW5kKHRoaXMpLHRoaXMub25Ub3VjaE1vdmU9dGhpcy5vblRvdWNoTW92ZS5iaW5kKHRoaXMpLHRoaXMubGFzdD0wLHRoaXMuY3VycmVudEN1cnNvclN0eWxlPVwiaW5oZXJpdFwiLHRoaXMubW91c2VPdXQ9ITF9LGIuSW50ZXJhY3Rpb25NYW5hZ2VyLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLkludGVyYWN0aW9uTWFuYWdlcixiLkludGVyYWN0aW9uTWFuYWdlci5wcm90b3R5cGUuY29sbGVjdEludGVyYWN0aXZlU3ByaXRlPWZ1bmN0aW9uKGEsYil7Zm9yKHZhciBjPWEuY2hpbGRyZW4sZD1jLmxlbmd0aCxlPWQtMTtlPj0wO2UtLSl7dmFyIGY9Y1tlXTtmLl9pbnRlcmFjdGl2ZT8oYi5pbnRlcmFjdGl2ZUNoaWxkcmVuPSEwLHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5wdXNoKGYpLGYuY2hpbGRyZW4ubGVuZ3RoPjAmJnRoaXMuY29sbGVjdEludGVyYWN0aXZlU3ByaXRlKGYsZikpOihmLl9faVBhcmVudD1udWxsLGYuY2hpbGRyZW4ubGVuZ3RoPjAmJnRoaXMuY29sbGVjdEludGVyYWN0aXZlU3ByaXRlKGYsYikpfX0sYi5JbnRlcmFjdGlvbk1hbmFnZXIucHJvdG90eXBlLnNldFRhcmdldD1mdW5jdGlvbihhKXt0aGlzLnRhcmdldD1hLG51bGw9PT10aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudCYmdGhpcy5zZXRUYXJnZXREb21FbGVtZW50KGEudmlldyl9LGIuSW50ZXJhY3Rpb25NYW5hZ2VyLnByb3RvdHlwZS5zZXRUYXJnZXREb21FbGVtZW50PWZ1bmN0aW9uKGEpe3RoaXMucmVtb3ZlRXZlbnRzKCksd2luZG93Lm5hdmlnYXRvci5tc1BvaW50ZXJFbmFibGVkJiYoYS5zdHlsZVtcIi1tcy1jb250ZW50LXpvb21pbmdcIl09XCJub25lXCIsYS5zdHlsZVtcIi1tcy10b3VjaC1hY3Rpb25cIl09XCJub25lXCIpLHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50PWEsYS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsdGhpcy5vbk1vdXNlTW92ZSwhMCksYS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsdGhpcy5vbk1vdXNlRG93biwhMCksYS5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIix0aGlzLm9uTW91c2VPdXQsITApLGEuYWRkRXZlbnRMaXN0ZW5lcihcInRvdWNoc3RhcnRcIix0aGlzLm9uVG91Y2hTdGFydCwhMCksYS5hZGRFdmVudExpc3RlbmVyKFwidG91Y2hlbmRcIix0aGlzLm9uVG91Y2hFbmQsITApLGEuYWRkRXZlbnRMaXN0ZW5lcihcInRvdWNobW92ZVwiLHRoaXMub25Ub3VjaE1vdmUsITApLHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLHRoaXMub25Nb3VzZVVwLCEwKX0sYi5JbnRlcmFjdGlvbk1hbmFnZXIucHJvdG90eXBlLnJlbW92ZUV2ZW50cz1mdW5jdGlvbigpe3RoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50JiYodGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuc3R5bGVbXCItbXMtY29udGVudC16b29taW5nXCJdPVwiXCIsdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuc3R5bGVbXCItbXMtdG91Y2gtYWN0aW9uXCJdPVwiXCIsdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLHRoaXMub25Nb3VzZU1vdmUsITApLHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIix0aGlzLm9uTW91c2VEb3duLCEwKSx0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIix0aGlzLm9uTW91c2VPdXQsITApLHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ0b3VjaHN0YXJ0XCIsdGhpcy5vblRvdWNoU3RhcnQsITApLHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ0b3VjaGVuZFwiLHRoaXMub25Ub3VjaEVuZCwhMCksdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInRvdWNobW92ZVwiLHRoaXMub25Ub3VjaE1vdmUsITApLHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50PW51bGwsd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsdGhpcy5vbk1vdXNlVXAsITApKX0sYi5JbnRlcmFjdGlvbk1hbmFnZXIucHJvdG90eXBlLnVwZGF0ZT1mdW5jdGlvbigpe2lmKHRoaXMudGFyZ2V0KXt2YXIgYT1EYXRlLm5vdygpLGM9YS10aGlzLmxhc3Q7aWYoYz1jKmIuSU5URVJBQ1RJT05fRlJFUVVFTkNZLzFlMywhKDE+Yykpe3RoaXMubGFzdD1hO3ZhciBkPTA7dGhpcy5kaXJ0eSYmdGhpcy5yZWJ1aWxkSW50ZXJhY3RpdmVHcmFwaCgpO3ZhciBlPXRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGgsZj1cImluaGVyaXRcIixnPSExO2ZvcihkPTA7ZT5kO2QrKyl7dmFyIGg9dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2RdO2guX19oaXQ9dGhpcy5oaXRUZXN0KGgsdGhpcy5tb3VzZSksdGhpcy5tb3VzZS50YXJnZXQ9aCxoLl9faGl0JiYhZz8oaC5idXR0b25Nb2RlJiYoZj1oLmRlZmF1bHRDdXJzb3IpLGguaW50ZXJhY3RpdmVDaGlsZHJlbnx8KGc9ITApLGguX19pc092ZXJ8fChoLm1vdXNlb3ZlciYmaC5tb3VzZW92ZXIodGhpcy5tb3VzZSksaC5fX2lzT3Zlcj0hMCkpOmguX19pc092ZXImJihoLm1vdXNlb3V0JiZoLm1vdXNlb3V0KHRoaXMubW91c2UpLGguX19pc092ZXI9ITEpfXRoaXMuY3VycmVudEN1cnNvclN0eWxlIT09ZiYmKHRoaXMuY3VycmVudEN1cnNvclN0eWxlPWYsdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuc3R5bGUuY3Vyc29yPWYpfX19LGIuSW50ZXJhY3Rpb25NYW5hZ2VyLnByb3RvdHlwZS5yZWJ1aWxkSW50ZXJhY3RpdmVHcmFwaD1mdW5jdGlvbigpe3RoaXMuZGlydHk9ITE7Zm9yKHZhciBhPXRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGgsYj0wO2E+YjtiKyspdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2JdLmludGVyYWN0aXZlQ2hpbGRyZW49ITE7dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zPVtdLHRoaXMuc3RhZ2UuaW50ZXJhY3RpdmUmJnRoaXMuaW50ZXJhY3RpdmVJdGVtcy5wdXNoKHRoaXMuc3RhZ2UpLHRoaXMuY29sbGVjdEludGVyYWN0aXZlU3ByaXRlKHRoaXMuc3RhZ2UsdGhpcy5zdGFnZSl9LGIuSW50ZXJhY3Rpb25NYW5hZ2VyLnByb3RvdHlwZS5vbk1vdXNlTW92ZT1mdW5jdGlvbihhKXt0aGlzLmRpcnR5JiZ0aGlzLnJlYnVpbGRJbnRlcmFjdGl2ZUdyYXBoKCksdGhpcy5tb3VzZS5vcmlnaW5hbEV2ZW50PWF8fHdpbmRvdy5ldmVudDt2YXIgYj10aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTt0aGlzLm1vdXNlLmdsb2JhbC54PShhLmNsaWVudFgtYi5sZWZ0KSoodGhpcy50YXJnZXQud2lkdGgvYi53aWR0aCksdGhpcy5tb3VzZS5nbG9iYWwueT0oYS5jbGllbnRZLWIudG9wKSoodGhpcy50YXJnZXQuaGVpZ2h0L2IuaGVpZ2h0KTtmb3IodmFyIGM9dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLmxlbmd0aCxkPTA7Yz5kO2QrKyl7dmFyIGU9dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2RdO2UubW91c2Vtb3ZlJiZlLm1vdXNlbW92ZSh0aGlzLm1vdXNlKX19LGIuSW50ZXJhY3Rpb25NYW5hZ2VyLnByb3RvdHlwZS5vbk1vdXNlRG93bj1mdW5jdGlvbihhKXt0aGlzLmRpcnR5JiZ0aGlzLnJlYnVpbGRJbnRlcmFjdGl2ZUdyYXBoKCksdGhpcy5tb3VzZS5vcmlnaW5hbEV2ZW50PWF8fHdpbmRvdy5ldmVudCxiLkFVVE9fUFJFVkVOVF9ERUZBVUxUJiZ0aGlzLm1vdXNlLm9yaWdpbmFsRXZlbnQucHJldmVudERlZmF1bHQoKTtmb3IodmFyIGM9dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLmxlbmd0aCxkPTA7Yz5kO2QrKyl7dmFyIGU9dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2RdO2lmKChlLm1vdXNlZG93bnx8ZS5jbGljaykmJihlLl9fbW91c2VJc0Rvd249ITAsZS5fX2hpdD10aGlzLmhpdFRlc3QoZSx0aGlzLm1vdXNlKSxlLl9faGl0JiYoZS5tb3VzZWRvd24mJmUubW91c2Vkb3duKHRoaXMubW91c2UpLGUuX19pc0Rvd249ITAsIWUuaW50ZXJhY3RpdmVDaGlsZHJlbikpKWJyZWFrfX0sYi5JbnRlcmFjdGlvbk1hbmFnZXIucHJvdG90eXBlLm9uTW91c2VPdXQ9ZnVuY3Rpb24oKXt0aGlzLmRpcnR5JiZ0aGlzLnJlYnVpbGRJbnRlcmFjdGl2ZUdyYXBoKCk7dmFyIGE9dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLmxlbmd0aDt0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5zdHlsZS5jdXJzb3I9XCJpbmhlcml0XCI7Zm9yKHZhciBiPTA7YT5iO2IrKyl7dmFyIGM9dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2JdO2MuX19pc092ZXImJih0aGlzLm1vdXNlLnRhcmdldD1jLGMubW91c2VvdXQmJmMubW91c2VvdXQodGhpcy5tb3VzZSksYy5fX2lzT3Zlcj0hMSl9dGhpcy5tb3VzZU91dD0hMCx0aGlzLm1vdXNlLmdsb2JhbC54PS0xZTQsdGhpcy5tb3VzZS5nbG9iYWwueT0tMWU0fSxiLkludGVyYWN0aW9uTWFuYWdlci5wcm90b3R5cGUub25Nb3VzZVVwPWZ1bmN0aW9uKGEpe3RoaXMuZGlydHkmJnRoaXMucmVidWlsZEludGVyYWN0aXZlR3JhcGgoKSx0aGlzLm1vdXNlLm9yaWdpbmFsRXZlbnQ9YXx8d2luZG93LmV2ZW50O1xuZm9yKHZhciBiPXRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGgsYz0hMSxkPTA7Yj5kO2QrKyl7dmFyIGU9dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2RdO2UuX19oaXQ9dGhpcy5oaXRUZXN0KGUsdGhpcy5tb3VzZSksZS5fX2hpdCYmIWM/KGUubW91c2V1cCYmZS5tb3VzZXVwKHRoaXMubW91c2UpLGUuX19pc0Rvd24mJmUuY2xpY2smJmUuY2xpY2sodGhpcy5tb3VzZSksZS5pbnRlcmFjdGl2ZUNoaWxkcmVufHwoYz0hMCkpOmUuX19pc0Rvd24mJmUubW91c2V1cG91dHNpZGUmJmUubW91c2V1cG91dHNpZGUodGhpcy5tb3VzZSksZS5fX2lzRG93bj0hMX19LGIuSW50ZXJhY3Rpb25NYW5hZ2VyLnByb3RvdHlwZS5oaXRUZXN0PWZ1bmN0aW9uKGEsYyl7dmFyIGQ9Yy5nbG9iYWw7aWYoIWEud29ybGRWaXNpYmxlKXJldHVybiExO3ZhciBlPWEgaW5zdGFuY2VvZiBiLlNwcml0ZSxmPWEud29ybGRUcmFuc2Zvcm0sZz1mLmEsaD1mLmIsaT1mLnR4LGo9Zi5jLGs9Zi5kLGw9Zi50eSxtPTEvKGcqaytoKi1qKSxuPWsqbSpkLngrLWgqbSpkLnkrKGwqaC1pKmspKm0sbz1nKm0qZC55Ky1qKm0qZC54KygtbCpnK2kqaikqbTtpZihjLnRhcmdldD1hLGEuaGl0QXJlYSYmYS5oaXRBcmVhLmNvbnRhaW5zKXJldHVybiBhLmhpdEFyZWEuY29udGFpbnMobixvKT8oYy50YXJnZXQ9YSwhMCk6ITE7aWYoZSl7dmFyIHAscT1hLnRleHR1cmUuZnJhbWUud2lkdGgscj1hLnRleHR1cmUuZnJhbWUuaGVpZ2h0LHM9LXEqYS5hbmNob3IueDtpZihuPnMmJnMrcT5uJiYocD0tciphLmFuY2hvci55LG8+cCYmcCtyPm8pKXJldHVybiBjLnRhcmdldD1hLCEwfWZvcih2YXIgdD1hLmNoaWxkcmVuLmxlbmd0aCx1PTA7dD51O3UrKyl7dmFyIHY9YS5jaGlsZHJlblt1XSx3PXRoaXMuaGl0VGVzdCh2LGMpO2lmKHcpcmV0dXJuIGMudGFyZ2V0PWEsITB9cmV0dXJuITF9LGIuSW50ZXJhY3Rpb25NYW5hZ2VyLnByb3RvdHlwZS5vblRvdWNoTW92ZT1mdW5jdGlvbihhKXt0aGlzLmRpcnR5JiZ0aGlzLnJlYnVpbGRJbnRlcmFjdGl2ZUdyYXBoKCk7dmFyIGIsYz10aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxkPWEuY2hhbmdlZFRvdWNoZXMsZT0wO2ZvcihlPTA7ZTxkLmxlbmd0aDtlKyspe3ZhciBmPWRbZV07Yj10aGlzLnRvdWNoc1tmLmlkZW50aWZpZXJdLGIub3JpZ2luYWxFdmVudD1hfHx3aW5kb3cuZXZlbnQsYi5nbG9iYWwueD0oZi5jbGllbnRYLWMubGVmdCkqKHRoaXMudGFyZ2V0LndpZHRoL2Mud2lkdGgpLGIuZ2xvYmFsLnk9KGYuY2xpZW50WS1jLnRvcCkqKHRoaXMudGFyZ2V0LmhlaWdodC9jLmhlaWdodCksbmF2aWdhdG9yLmlzQ29jb29uSlMmJihiLmdsb2JhbC54PWYuY2xpZW50WCxiLmdsb2JhbC55PWYuY2xpZW50WSk7Zm9yKHZhciBnPTA7Zzx0aGlzLmludGVyYWN0aXZlSXRlbXMubGVuZ3RoO2crKyl7dmFyIGg9dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2ddO2gudG91Y2htb3ZlJiZoLl9fdG91Y2hEYXRhJiZoLl9fdG91Y2hEYXRhW2YuaWRlbnRpZmllcl0mJmgudG91Y2htb3ZlKGIpfX19LGIuSW50ZXJhY3Rpb25NYW5hZ2VyLnByb3RvdHlwZS5vblRvdWNoU3RhcnQ9ZnVuY3Rpb24oYSl7dGhpcy5kaXJ0eSYmdGhpcy5yZWJ1aWxkSW50ZXJhY3RpdmVHcmFwaCgpO3ZhciBjPXRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO2IuQVVUT19QUkVWRU5UX0RFRkFVTFQmJmEucHJldmVudERlZmF1bHQoKTtmb3IodmFyIGQ9YS5jaGFuZ2VkVG91Y2hlcyxlPTA7ZTxkLmxlbmd0aDtlKyspe3ZhciBmPWRbZV0sZz10aGlzLnBvb2wucG9wKCk7Z3x8KGc9bmV3IGIuSW50ZXJhY3Rpb25EYXRhKSxnLm9yaWdpbmFsRXZlbnQ9YXx8d2luZG93LmV2ZW50LHRoaXMudG91Y2hzW2YuaWRlbnRpZmllcl09ZyxnLmdsb2JhbC54PShmLmNsaWVudFgtYy5sZWZ0KSoodGhpcy50YXJnZXQud2lkdGgvYy53aWR0aCksZy5nbG9iYWwueT0oZi5jbGllbnRZLWMudG9wKSoodGhpcy50YXJnZXQuaGVpZ2h0L2MuaGVpZ2h0KSxuYXZpZ2F0b3IuaXNDb2Nvb25KUyYmKGcuZ2xvYmFsLng9Zi5jbGllbnRYLGcuZ2xvYmFsLnk9Zi5jbGllbnRZKTtmb3IodmFyIGg9dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLmxlbmd0aCxpPTA7aD5pO2krKyl7dmFyIGo9dGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2ldO2lmKChqLnRvdWNoc3RhcnR8fGoudGFwKSYmKGouX19oaXQ9dGhpcy5oaXRUZXN0KGosZyksai5fX2hpdCYmKGoudG91Y2hzdGFydCYmai50b3VjaHN0YXJ0KGcpLGouX19pc0Rvd249ITAsai5fX3RvdWNoRGF0YT1qLl9fdG91Y2hEYXRhfHx7fSxqLl9fdG91Y2hEYXRhW2YuaWRlbnRpZmllcl09Zywhai5pbnRlcmFjdGl2ZUNoaWxkcmVuKSkpYnJlYWt9fX0sYi5JbnRlcmFjdGlvbk1hbmFnZXIucHJvdG90eXBlLm9uVG91Y2hFbmQ9ZnVuY3Rpb24oYSl7dGhpcy5kaXJ0eSYmdGhpcy5yZWJ1aWxkSW50ZXJhY3RpdmVHcmFwaCgpO2Zvcih2YXIgYj10aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxjPWEuY2hhbmdlZFRvdWNoZXMsZD0wO2Q8Yy5sZW5ndGg7ZCsrKXt2YXIgZT1jW2RdLGY9dGhpcy50b3VjaHNbZS5pZGVudGlmaWVyXSxnPSExO2YuZ2xvYmFsLng9KGUuY2xpZW50WC1iLmxlZnQpKih0aGlzLnRhcmdldC53aWR0aC9iLndpZHRoKSxmLmdsb2JhbC55PShlLmNsaWVudFktYi50b3ApKih0aGlzLnRhcmdldC5oZWlnaHQvYi5oZWlnaHQpLG5hdmlnYXRvci5pc0NvY29vbkpTJiYoZi5nbG9iYWwueD1lLmNsaWVudFgsZi5nbG9iYWwueT1lLmNsaWVudFkpO2Zvcih2YXIgaD10aGlzLmludGVyYWN0aXZlSXRlbXMubGVuZ3RoLGk9MDtoPmk7aSsrKXt2YXIgaj10aGlzLmludGVyYWN0aXZlSXRlbXNbaV07ai5fX3RvdWNoRGF0YSYmai5fX3RvdWNoRGF0YVtlLmlkZW50aWZpZXJdJiYoai5fX2hpdD10aGlzLmhpdFRlc3QoaixqLl9fdG91Y2hEYXRhW2UuaWRlbnRpZmllcl0pLGYub3JpZ2luYWxFdmVudD1hfHx3aW5kb3cuZXZlbnQsKGoudG91Y2hlbmR8fGoudGFwKSYmKGouX19oaXQmJiFnPyhqLnRvdWNoZW5kJiZqLnRvdWNoZW5kKGYpLGouX19pc0Rvd24mJmoudGFwJiZqLnRhcChmKSxqLmludGVyYWN0aXZlQ2hpbGRyZW58fChnPSEwKSk6ai5fX2lzRG93biYmai50b3VjaGVuZG91dHNpZGUmJmoudG91Y2hlbmRvdXRzaWRlKGYpLGouX19pc0Rvd249ITEpLGouX190b3VjaERhdGFbZS5pZGVudGlmaWVyXT1udWxsKX10aGlzLnBvb2wucHVzaChmKSx0aGlzLnRvdWNoc1tlLmlkZW50aWZpZXJdPW51bGx9fSxiLlN0YWdlPWZ1bmN0aW9uKGEpe2IuRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKHRoaXMpLHRoaXMud29ybGRUcmFuc2Zvcm09bmV3IGIuTWF0cml4LHRoaXMuaW50ZXJhY3RpdmU9ITAsdGhpcy5pbnRlcmFjdGlvbk1hbmFnZXI9bmV3IGIuSW50ZXJhY3Rpb25NYW5hZ2VyKHRoaXMpLHRoaXMuZGlydHk9ITAsdGhpcy5zdGFnZT10aGlzLHRoaXMuc3RhZ2UuaGl0QXJlYT1uZXcgYi5SZWN0YW5nbGUoMCwwLDFlNSwxZTUpLHRoaXMuc2V0QmFja2dyb3VuZENvbG9yKGEpfSxiLlN0YWdlLnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUpLGIuU3RhZ2UucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuU3RhZ2UsYi5TdGFnZS5wcm90b3R5cGUuc2V0SW50ZXJhY3Rpb25EZWxlZ2F0ZT1mdW5jdGlvbihhKXt0aGlzLmludGVyYWN0aW9uTWFuYWdlci5zZXRUYXJnZXREb21FbGVtZW50KGEpfSxiLlN0YWdlLnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm09ZnVuY3Rpb24oKXt0aGlzLndvcmxkQWxwaGE9MTtmb3IodmFyIGE9MCxiPXRoaXMuY2hpbGRyZW4ubGVuZ3RoO2I+YTthKyspdGhpcy5jaGlsZHJlblthXS51cGRhdGVUcmFuc2Zvcm0oKTt0aGlzLmRpcnR5JiYodGhpcy5kaXJ0eT0hMSx0aGlzLmludGVyYWN0aW9uTWFuYWdlci5kaXJ0eT0hMCksdGhpcy5pbnRlcmFjdGl2ZSYmdGhpcy5pbnRlcmFjdGlvbk1hbmFnZXIudXBkYXRlKCl9LGIuU3RhZ2UucHJvdG90eXBlLnNldEJhY2tncm91bmRDb2xvcj1mdW5jdGlvbihhKXt0aGlzLmJhY2tncm91bmRDb2xvcj1hfHwwLHRoaXMuYmFja2dyb3VuZENvbG9yU3BsaXQ9Yi5oZXgycmdiKHRoaXMuYmFja2dyb3VuZENvbG9yKTt2YXIgYz10aGlzLmJhY2tncm91bmRDb2xvci50b1N0cmluZygxNik7Yz1cIjAwMDAwMFwiLnN1YnN0cigwLDYtYy5sZW5ndGgpK2MsdGhpcy5iYWNrZ3JvdW5kQ29sb3JTdHJpbmc9XCIjXCIrY30sYi5TdGFnZS5wcm90b3R5cGUuZ2V0TW91c2VQb3NpdGlvbj1mdW5jdGlvbigpe3JldHVybiB0aGlzLmludGVyYWN0aW9uTWFuYWdlci5tb3VzZS5nbG9iYWx9O2Zvcih2YXIgYz0wLGQ9W1wibXNcIixcIm1velwiLFwid2Via2l0XCIsXCJvXCJdLGU9MDtlPGQubGVuZ3RoJiYhd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZTsrK2Upd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZT13aW5kb3dbZFtlXStcIlJlcXVlc3RBbmltYXRpb25GcmFtZVwiXSx3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWU9d2luZG93W2RbZV0rXCJDYW5jZWxBbmltYXRpb25GcmFtZVwiXXx8d2luZG93W2RbZV0rXCJDYW5jZWxSZXF1ZXN0QW5pbWF0aW9uRnJhbWVcIl07d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZXx8KHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWU9ZnVuY3Rpb24oYSl7dmFyIGI9KG5ldyBEYXRlKS5nZXRUaW1lKCksZD1NYXRoLm1heCgwLDE2LShiLWMpKSxlPXdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7YShiK2QpfSxkKTtyZXR1cm4gYz1iK2QsZX0pLHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZXx8KHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZT1mdW5jdGlvbihhKXtjbGVhclRpbWVvdXQoYSl9KSx3aW5kb3cucmVxdWVzdEFuaW1GcmFtZT13aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLGIuaGV4MnJnYj1mdW5jdGlvbihhKXtyZXR1cm5bKGE+PjE2JjI1NSkvMjU1LChhPj44JjI1NSkvMjU1LCgyNTUmYSkvMjU1XX0sYi5yZ2IyaGV4PWZ1bmN0aW9uKGEpe3JldHVybigyNTUqYVswXTw8MTYpKygyNTUqYVsxXTw8OCkrMjU1KmFbMl19LFwiZnVuY3Rpb25cIiE9dHlwZW9mIEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kJiYoRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQ9ZnVuY3Rpb24oKXt2YXIgYT1BcnJheS5wcm90b3R5cGUuc2xpY2U7cmV0dXJuIGZ1bmN0aW9uKGIpe2Z1bmN0aW9uIGMoKXt2YXIgZj1lLmNvbmNhdChhLmNhbGwoYXJndW1lbnRzKSk7ZC5hcHBseSh0aGlzIGluc3RhbmNlb2YgYz90aGlzOmIsZil9dmFyIGQ9dGhpcyxlPWEuY2FsbChhcmd1bWVudHMsMSk7aWYoXCJmdW5jdGlvblwiIT10eXBlb2YgZCl0aHJvdyBuZXcgVHlwZUVycm9yO3JldHVybiBjLnByb3RvdHlwZT1mdW5jdGlvbiBmKGEpe3JldHVybiBhJiYoZi5wcm90b3R5cGU9YSksdGhpcyBpbnN0YW5jZW9mIGY/dm9pZCAwOm5ldyBmfShkLnByb3RvdHlwZSksY319KCkpLGIuQWpheFJlcXVlc3Q9ZnVuY3Rpb24oKXt2YXIgYT1bXCJNc3htbDIuWE1MSFRUUC42LjBcIixcIk1zeG1sMi5YTUxIVFRQLjMuMFwiLFwiTWljcm9zb2Z0LlhNTEhUVFBcIl07aWYoIXdpbmRvdy5BY3RpdmVYT2JqZWN0KXJldHVybiB3aW5kb3cuWE1MSHR0cFJlcXVlc3Q/bmV3IHdpbmRvdy5YTUxIdHRwUmVxdWVzdDohMTtmb3IodmFyIGI9MDtiPGEubGVuZ3RoO2IrKyl0cnl7cmV0dXJuIG5ldyB3aW5kb3cuQWN0aXZlWE9iamVjdChhW2JdKX1jYXRjaChjKXt9fSxiLmNhblVzZU5ld0NhbnZhc0JsZW5kTW9kZXM9ZnVuY3Rpb24oKXt2YXIgYT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO2Eud2lkdGg9MSxhLmhlaWdodD0xO3ZhciBiPWEuZ2V0Q29udGV4dChcIjJkXCIpO3JldHVybiBiLmZpbGxTdHlsZT1cIiMwMDBcIixiLmZpbGxSZWN0KDAsMCwxLDEpLGIuZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uPVwibXVsdGlwbHlcIixiLmZpbGxTdHlsZT1cIiNmZmZcIixiLmZpbGxSZWN0KDAsMCwxLDEpLDA9PT1iLmdldEltYWdlRGF0YSgwLDAsMSwxKS5kYXRhWzBdfSxiLmdldE5leHRQb3dlck9mVHdvPWZ1bmN0aW9uKGEpe2lmKGE+MCYmMD09PShhJmEtMSkpcmV0dXJuIGE7Zm9yKHZhciBiPTE7YT5iOyliPDw9MTtyZXR1cm4gYn0sYi5FdmVudFRhcmdldD1mdW5jdGlvbigpe3ZhciBhPXt9O3RoaXMuYWRkRXZlbnRMaXN0ZW5lcj10aGlzLm9uPWZ1bmN0aW9uKGIsYyl7dm9pZCAwPT09YVtiXSYmKGFbYl09W10pLC0xPT09YVtiXS5pbmRleE9mKGMpJiZhW2JdLnVuc2hpZnQoYyl9LHRoaXMuZGlzcGF0Y2hFdmVudD10aGlzLmVtaXQ9ZnVuY3Rpb24oYil7aWYoYVtiLnR5cGVdJiZhW2IudHlwZV0ubGVuZ3RoKWZvcih2YXIgYz1hW2IudHlwZV0ubGVuZ3RoLTE7Yz49MDtjLS0pYVtiLnR5cGVdW2NdKGIpfSx0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXI9dGhpcy5vZmY9ZnVuY3Rpb24oYixjKXtpZih2b2lkIDAhPT1hW2JdKXt2YXIgZD1hW2JdLmluZGV4T2YoYyk7LTEhPT1kJiZhW2JdLnNwbGljZShkLDEpfX0sdGhpcy5yZW1vdmVBbGxFdmVudExpc3RlbmVycz1mdW5jdGlvbihiKXt2YXIgYz1hW2JdO2MmJihjLmxlbmd0aD0wKX19LGIuYXV0b0RldGVjdFJlbmRlcmVyPWZ1bmN0aW9uKGEsYyxkLGUsZil7YXx8KGE9ODAwKSxjfHwoYz02MDApO3ZhciBnPWZ1bmN0aW9uKCl7dHJ5e3ZhciBhPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7cmV0dXJuISF3aW5kb3cuV2ViR0xSZW5kZXJpbmdDb250ZXh0JiYoYS5nZXRDb250ZXh0KFwid2ViZ2xcIil8fGEuZ2V0Q29udGV4dChcImV4cGVyaW1lbnRhbC13ZWJnbFwiKSl9Y2F0Y2goYil7cmV0dXJuITF9fSgpO3JldHVybiBnP25ldyBiLldlYkdMUmVuZGVyZXIoYSxjLGQsZSxmKTpuZXcgYi5DYW52YXNSZW5kZXJlcihhLGMsZCxlKX0sYi5hdXRvRGV0ZWN0UmVjb21tZW5kZWRSZW5kZXJlcj1mdW5jdGlvbihhLGMsZCxlLGYpe2F8fChhPTgwMCksY3x8KGM9NjAwKTt2YXIgZz1mdW5jdGlvbigpe3RyeXt2YXIgYT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO3JldHVybiEhd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCYmKGEuZ2V0Q29udGV4dChcIndlYmdsXCIpfHxhLmdldENvbnRleHQoXCJleHBlcmltZW50YWwtd2ViZ2xcIikpfWNhdGNoKGIpe3JldHVybiExfX0oKSxoPS9BbmRyb2lkL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtyZXR1cm4gZyYmIWg/bmV3IGIuV2ViR0xSZW5kZXJlcihhLGMsZCxlLGYpOm5ldyBiLkNhbnZhc1JlbmRlcmVyKGEsYyxkLGUpfSxiLlBvbHlLPXt9LGIuUG9seUsuVHJpYW5ndWxhdGU9ZnVuY3Rpb24oYSl7dmFyIGM9ITAsZD1hLmxlbmd0aD4+MTtpZigzPmQpcmV0dXJuW107Zm9yKHZhciBlPVtdLGY9W10sZz0wO2Q+ZztnKyspZi5wdXNoKGcpO2c9MDtmb3IodmFyIGg9ZDtoPjM7KXt2YXIgaT1mWyhnKzApJWhdLGo9ZlsoZysxKSVoXSxrPWZbKGcrMiklaF0sbD1hWzIqaV0sbT1hWzIqaSsxXSxuPWFbMipqXSxvPWFbMipqKzFdLHA9YVsyKmtdLHE9YVsyKmsrMV0scj0hMTtpZihiLlBvbHlLLl9jb252ZXgobCxtLG4sbyxwLHEsYykpe3I9ITA7Zm9yKHZhciBzPTA7aD5zO3MrKyl7dmFyIHQ9ZltzXTtpZih0IT09aSYmdCE9PWomJnQhPT1rJiZiLlBvbHlLLl9Qb2ludEluVHJpYW5nbGUoYVsyKnRdLGFbMip0KzFdLGwsbSxuLG8scCxxKSl7cj0hMTticmVha319fWlmKHIpZS5wdXNoKGksaixrKSxmLnNwbGljZSgoZysxKSVoLDEpLGgtLSxnPTA7ZWxzZSBpZihnKys+MypoKXtpZighYylyZXR1cm4gd2luZG93LmNvbnNvbGUubG9nKFwiUElYSSBXYXJuaW5nOiBzaGFwZSB0b28gY29tcGxleCB0byBmaWxsXCIpLFtdO2ZvcihlPVtdLGY9W10sZz0wO2Q+ZztnKyspZi5wdXNoKGcpO2c9MCxoPWQsYz0hMX19cmV0dXJuIGUucHVzaChmWzBdLGZbMV0sZlsyXSksZX0sYi5Qb2x5Sy5fUG9pbnRJblRyaWFuZ2xlPWZ1bmN0aW9uKGEsYixjLGQsZSxmLGcsaCl7dmFyIGk9Zy1jLGo9aC1kLGs9ZS1jLGw9Zi1kLG09YS1jLG49Yi1kLG89aSppK2oqaixwPWkqaytqKmwscT1pKm0raipuLHI9ayprK2wqbCxzPWsqbStsKm4sdD0xLyhvKnItcCpwKSx1PShyKnEtcCpzKSp0LHY9KG8qcy1wKnEpKnQ7cmV0dXJuIHU+PTAmJnY+PTAmJjE+dSt2fSxiLlBvbHlLLl9jb252ZXg9ZnVuY3Rpb24oYSxiLGMsZCxlLGYsZyl7cmV0dXJuKGItZCkqKGUtYykrKGMtYSkqKGYtZCk+PTA9PT1nfSxiLmluaXREZWZhdWx0U2hhZGVycz1mdW5jdGlvbigpe30sYi5Db21waWxlVmVydGV4U2hhZGVyPWZ1bmN0aW9uKGEsYyl7cmV0dXJuIGIuX0NvbXBpbGVTaGFkZXIoYSxjLGEuVkVSVEVYX1NIQURFUil9LGIuQ29tcGlsZUZyYWdtZW50U2hhZGVyPWZ1bmN0aW9uKGEsYyl7cmV0dXJuIGIuX0NvbXBpbGVTaGFkZXIoYSxjLGEuRlJBR01FTlRfU0hBREVSKX0sYi5fQ29tcGlsZVNoYWRlcj1mdW5jdGlvbihhLGIsYyl7dmFyIGQ9Yi5qb2luKFwiXFxuXCIpLGU9YS5jcmVhdGVTaGFkZXIoYyk7cmV0dXJuIGEuc2hhZGVyU291cmNlKGUsZCksYS5jb21waWxlU2hhZGVyKGUpLGEuZ2V0U2hhZGVyUGFyYW1ldGVyKGUsYS5DT01QSUxFX1NUQVRVUyk/ZTood2luZG93LmNvbnNvbGUubG9nKGEuZ2V0U2hhZGVySW5mb0xvZyhlKSksbnVsbCl9LGIuY29tcGlsZVByb2dyYW09ZnVuY3Rpb24oYSxjLGQpe3ZhciBlPWIuQ29tcGlsZUZyYWdtZW50U2hhZGVyKGEsZCksZj1iLkNvbXBpbGVWZXJ0ZXhTaGFkZXIoYSxjKSxnPWEuY3JlYXRlUHJvZ3JhbSgpO3JldHVybiBhLmF0dGFjaFNoYWRlcihnLGYpLGEuYXR0YWNoU2hhZGVyKGcsZSksYS5saW5rUHJvZ3JhbShnKSxhLmdldFByb2dyYW1QYXJhbWV0ZXIoZyxhLkxJTktfU1RBVFVTKXx8d2luZG93LmNvbnNvbGUubG9nKFwiQ291bGQgbm90IGluaXRpYWxpc2Ugc2hhZGVyc1wiKSxnfSxiLlBpeGlTaGFkZXI9ZnVuY3Rpb24oYSl7dGhpcy5fVUlEPWIuX1VJRCsrLHRoaXMuZ2w9YSx0aGlzLnByb2dyYW09bnVsbCx0aGlzLmZyYWdtZW50U3JjPVtcInByZWNpc2lvbiBsb3dwIGZsb2F0O1wiLFwidmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7XCIsXCJ2YXJ5aW5nIHZlYzQgdkNvbG9yO1wiLFwidW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7XCIsXCJ2b2lkIG1haW4odm9pZCkge1wiLFwiICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkKSAqIHZDb2xvciA7XCIsXCJ9XCJdLHRoaXMudGV4dHVyZUNvdW50PTAsdGhpcy5hdHRyaWJ1dGVzPVtdLHRoaXMuaW5pdCgpfSxiLlBpeGlTaGFkZXIucHJvdG90eXBlLmluaXQ9ZnVuY3Rpb24oKXt2YXIgYT10aGlzLmdsLGM9Yi5jb21waWxlUHJvZ3JhbShhLHRoaXMudmVydGV4U3JjfHxiLlBpeGlTaGFkZXIuZGVmYXVsdFZlcnRleFNyYyx0aGlzLmZyYWdtZW50U3JjKTthLnVzZVByb2dyYW0oYyksdGhpcy51U2FtcGxlcj1hLmdldFVuaWZvcm1Mb2NhdGlvbihjLFwidVNhbXBsZXJcIiksdGhpcy5wcm9qZWN0aW9uVmVjdG9yPWEuZ2V0VW5pZm9ybUxvY2F0aW9uKGMsXCJwcm9qZWN0aW9uVmVjdG9yXCIpLHRoaXMub2Zmc2V0VmVjdG9yPWEuZ2V0VW5pZm9ybUxvY2F0aW9uKGMsXCJvZmZzZXRWZWN0b3JcIiksdGhpcy5kaW1lbnNpb25zPWEuZ2V0VW5pZm9ybUxvY2F0aW9uKGMsXCJkaW1lbnNpb25zXCIpLHRoaXMuYVZlcnRleFBvc2l0aW9uPWEuZ2V0QXR0cmliTG9jYXRpb24oYyxcImFWZXJ0ZXhQb3NpdGlvblwiKSx0aGlzLmFUZXh0dXJlQ29vcmQ9YS5nZXRBdHRyaWJMb2NhdGlvbihjLFwiYVRleHR1cmVDb29yZFwiKSx0aGlzLmNvbG9yQXR0cmlidXRlPWEuZ2V0QXR0cmliTG9jYXRpb24oYyxcImFDb2xvclwiKSwtMT09PXRoaXMuY29sb3JBdHRyaWJ1dGUmJih0aGlzLmNvbG9yQXR0cmlidXRlPTIpLHRoaXMuYXR0cmlidXRlcz1bdGhpcy5hVmVydGV4UG9zaXRpb24sdGhpcy5hVGV4dHVyZUNvb3JkLHRoaXMuY29sb3JBdHRyaWJ1dGVdO2Zvcih2YXIgZCBpbiB0aGlzLnVuaWZvcm1zKXRoaXMudW5pZm9ybXNbZF0udW5pZm9ybUxvY2F0aW9uPWEuZ2V0VW5pZm9ybUxvY2F0aW9uKGMsZCk7dGhpcy5pbml0VW5pZm9ybXMoKSx0aGlzLnByb2dyYW09Y30sYi5QaXhpU2hhZGVyLnByb3RvdHlwZS5pbml0VW5pZm9ybXM9ZnVuY3Rpb24oKXt0aGlzLnRleHR1cmVDb3VudD0xO3ZhciBhLGI9dGhpcy5nbDtmb3IodmFyIGMgaW4gdGhpcy51bmlmb3Jtcyl7YT10aGlzLnVuaWZvcm1zW2NdO3ZhciBkPWEudHlwZTtcInNhbXBsZXIyRFwiPT09ZD8oYS5faW5pdD0hMSxudWxsIT09YS52YWx1ZSYmdGhpcy5pbml0U2FtcGxlcjJEKGEpKTpcIm1hdDJcIj09PWR8fFwibWF0M1wiPT09ZHx8XCJtYXQ0XCI9PT1kPyhhLmdsTWF0cml4PSEwLGEuZ2xWYWx1ZUxlbmd0aD0xLFwibWF0MlwiPT09ZD9hLmdsRnVuYz1iLnVuaWZvcm1NYXRyaXgyZnY6XCJtYXQzXCI9PT1kP2EuZ2xGdW5jPWIudW5pZm9ybU1hdHJpeDNmdjpcIm1hdDRcIj09PWQmJihhLmdsRnVuYz1iLnVuaWZvcm1NYXRyaXg0ZnYpKTooYS5nbEZ1bmM9YltcInVuaWZvcm1cIitkXSxhLmdsVmFsdWVMZW5ndGg9XCIyZlwiPT09ZHx8XCIyaVwiPT09ZD8yOlwiM2ZcIj09PWR8fFwiM2lcIj09PWQ/MzpcIjRmXCI9PT1kfHxcIjRpXCI9PT1kPzQ6MSl9fSxiLlBpeGlTaGFkZXIucHJvdG90eXBlLmluaXRTYW1wbGVyMkQ9ZnVuY3Rpb24oYSl7aWYoYS52YWx1ZSYmYS52YWx1ZS5iYXNlVGV4dHVyZSYmYS52YWx1ZS5iYXNlVGV4dHVyZS5oYXNMb2FkZWQpe3ZhciBiPXRoaXMuZ2w7aWYoYi5hY3RpdmVUZXh0dXJlKGJbXCJURVhUVVJFXCIrdGhpcy50ZXh0dXJlQ291bnRdKSxiLmJpbmRUZXh0dXJlKGIuVEVYVFVSRV8yRCxhLnZhbHVlLmJhc2VUZXh0dXJlLl9nbFRleHR1cmVzW2IuaWRdKSxhLnRleHR1cmVEYXRhKXt2YXIgYz1hLnRleHR1cmVEYXRhLGQ9Yy5tYWdGaWx0ZXI/Yy5tYWdGaWx0ZXI6Yi5MSU5FQVIsZT1jLm1pbkZpbHRlcj9jLm1pbkZpbHRlcjpiLkxJTkVBUixmPWMud3JhcFM/Yy53cmFwUzpiLkNMQU1QX1RPX0VER0UsZz1jLndyYXBUP2Mud3JhcFQ6Yi5DTEFNUF9UT19FREdFLGg9Yy5sdW1pbmFuY2U/Yi5MVU1JTkFOQ0U6Yi5SR0JBO2lmKGMucmVwZWF0JiYoZj1iLlJFUEVBVCxnPWIuUkVQRUFUKSxiLnBpeGVsU3RvcmVpKGIuVU5QQUNLX0ZMSVBfWV9XRUJHTCwhIWMuZmxpcFkpLGMud2lkdGgpe3ZhciBpPWMud2lkdGg/Yy53aWR0aDo1MTIsaj1jLmhlaWdodD9jLmhlaWdodDoyLGs9Yy5ib3JkZXI/Yy5ib3JkZXI6MDtiLnRleEltYWdlMkQoYi5URVhUVVJFXzJELDAsaCxpLGosayxoLGIuVU5TSUdORURfQllURSxudWxsKX1lbHNlIGIudGV4SW1hZ2UyRChiLlRFWFRVUkVfMkQsMCxoLGIuUkdCQSxiLlVOU0lHTkVEX0JZVEUsYS52YWx1ZS5iYXNlVGV4dHVyZS5zb3VyY2UpO2IudGV4UGFyYW1ldGVyaShiLlRFWFRVUkVfMkQsYi5URVhUVVJFX01BR19GSUxURVIsZCksYi50ZXhQYXJhbWV0ZXJpKGIuVEVYVFVSRV8yRCxiLlRFWFRVUkVfTUlOX0ZJTFRFUixlKSxiLnRleFBhcmFtZXRlcmkoYi5URVhUVVJFXzJELGIuVEVYVFVSRV9XUkFQX1MsZiksYi50ZXhQYXJhbWV0ZXJpKGIuVEVYVFVSRV8yRCxiLlRFWFRVUkVfV1JBUF9ULGcpfWIudW5pZm9ybTFpKGEudW5pZm9ybUxvY2F0aW9uLHRoaXMudGV4dHVyZUNvdW50KSxhLl9pbml0PSEwLHRoaXMudGV4dHVyZUNvdW50Kyt9fSxiLlBpeGlTaGFkZXIucHJvdG90eXBlLnN5bmNVbmlmb3Jtcz1mdW5jdGlvbigpe3RoaXMudGV4dHVyZUNvdW50PTE7dmFyIGEsYz10aGlzLmdsO2Zvcih2YXIgZCBpbiB0aGlzLnVuaWZvcm1zKWE9dGhpcy51bmlmb3Jtc1tkXSwxPT09YS5nbFZhbHVlTGVuZ3RoP2EuZ2xNYXRyaXg9PT0hMD9hLmdsRnVuYy5jYWxsKGMsYS51bmlmb3JtTG9jYXRpb24sYS50cmFuc3Bvc2UsYS52YWx1ZSk6YS5nbEZ1bmMuY2FsbChjLGEudW5pZm9ybUxvY2F0aW9uLGEudmFsdWUpOjI9PT1hLmdsVmFsdWVMZW5ndGg/YS5nbEZ1bmMuY2FsbChjLGEudW5pZm9ybUxvY2F0aW9uLGEudmFsdWUueCxhLnZhbHVlLnkpOjM9PT1hLmdsVmFsdWVMZW5ndGg/YS5nbEZ1bmMuY2FsbChjLGEudW5pZm9ybUxvY2F0aW9uLGEudmFsdWUueCxhLnZhbHVlLnksYS52YWx1ZS56KTo0PT09YS5nbFZhbHVlTGVuZ3RoP2EuZ2xGdW5jLmNhbGwoYyxhLnVuaWZvcm1Mb2NhdGlvbixhLnZhbHVlLngsYS52YWx1ZS55LGEudmFsdWUueixhLnZhbHVlLncpOlwic2FtcGxlcjJEXCI9PT1hLnR5cGUmJihhLl9pbml0PyhjLmFjdGl2ZVRleHR1cmUoY1tcIlRFWFRVUkVcIit0aGlzLnRleHR1cmVDb3VudF0pLGMuYmluZFRleHR1cmUoYy5URVhUVVJFXzJELGEudmFsdWUuYmFzZVRleHR1cmUuX2dsVGV4dHVyZXNbYy5pZF18fGIuY3JlYXRlV2ViR0xUZXh0dXJlKGEudmFsdWUuYmFzZVRleHR1cmUsYykpLGMudW5pZm9ybTFpKGEudW5pZm9ybUxvY2F0aW9uLHRoaXMudGV4dHVyZUNvdW50KSx0aGlzLnRleHR1cmVDb3VudCsrKTp0aGlzLmluaXRTYW1wbGVyMkQoYSkpfSxiLlBpeGlTaGFkZXIucHJvdG90eXBlLmRlc3Ryb3k9ZnVuY3Rpb24oKXt0aGlzLmdsLmRlbGV0ZVByb2dyYW0odGhpcy5wcm9ncmFtKSx0aGlzLnVuaWZvcm1zPW51bGwsdGhpcy5nbD1udWxsLHRoaXMuYXR0cmlidXRlcz1udWxsfSxiLlBpeGlTaGFkZXIuZGVmYXVsdFZlcnRleFNyYz1bXCJhdHRyaWJ1dGUgdmVjMiBhVmVydGV4UG9zaXRpb247XCIsXCJhdHRyaWJ1dGUgdmVjMiBhVGV4dHVyZUNvb3JkO1wiLFwiYXR0cmlidXRlIHZlYzIgYUNvbG9yO1wiLFwidW5pZm9ybSB2ZWMyIHByb2plY3Rpb25WZWN0b3I7XCIsXCJ1bmlmb3JtIHZlYzIgb2Zmc2V0VmVjdG9yO1wiLFwidmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7XCIsXCJ2YXJ5aW5nIHZlYzQgdkNvbG9yO1wiLFwiY29uc3QgdmVjMiBjZW50ZXIgPSB2ZWMyKC0xLjAsIDEuMCk7XCIsXCJ2b2lkIG1haW4odm9pZCkge1wiLFwiICAgZ2xfUG9zaXRpb24gPSB2ZWM0KCAoKGFWZXJ0ZXhQb3NpdGlvbiArIG9mZnNldFZlY3RvcikgLyBwcm9qZWN0aW9uVmVjdG9yKSArIGNlbnRlciAsIDAuMCwgMS4wKTtcIixcIiAgIHZUZXh0dXJlQ29vcmQgPSBhVGV4dHVyZUNvb3JkO1wiLFwiICAgdmVjMyBjb2xvciA9IG1vZCh2ZWMzKGFDb2xvci55LzY1NTM2LjAsIGFDb2xvci55LzI1Ni4wLCBhQ29sb3IueSksIDI1Ni4wKSAvIDI1Ni4wO1wiLFwiICAgdkNvbG9yID0gdmVjNChjb2xvciAqIGFDb2xvci54LCBhQ29sb3IueCk7XCIsXCJ9XCJdLGIuUGl4aUZhc3RTaGFkZXI9ZnVuY3Rpb24oYSl7dGhpcy5fVUlEPWIuX1VJRCsrLHRoaXMuZ2w9YSx0aGlzLnByb2dyYW09bnVsbCx0aGlzLmZyYWdtZW50U3JjPVtcInByZWNpc2lvbiBsb3dwIGZsb2F0O1wiLFwidmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7XCIsXCJ2YXJ5aW5nIGZsb2F0IHZDb2xvcjtcIixcInVuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyO1wiLFwidm9pZCBtYWluKHZvaWQpIHtcIixcIiAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCkgKiB2Q29sb3IgO1wiLFwifVwiXSx0aGlzLnZlcnRleFNyYz1bXCJhdHRyaWJ1dGUgdmVjMiBhVmVydGV4UG9zaXRpb247XCIsXCJhdHRyaWJ1dGUgdmVjMiBhUG9zaXRpb25Db29yZDtcIixcImF0dHJpYnV0ZSB2ZWMyIGFTY2FsZTtcIixcImF0dHJpYnV0ZSBmbG9hdCBhUm90YXRpb247XCIsXCJhdHRyaWJ1dGUgdmVjMiBhVGV4dHVyZUNvb3JkO1wiLFwiYXR0cmlidXRlIGZsb2F0IGFDb2xvcjtcIixcInVuaWZvcm0gdmVjMiBwcm9qZWN0aW9uVmVjdG9yO1wiLFwidW5pZm9ybSB2ZWMyIG9mZnNldFZlY3RvcjtcIixcInVuaWZvcm0gbWF0MyB1TWF0cml4O1wiLFwidmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7XCIsXCJ2YXJ5aW5nIGZsb2F0IHZDb2xvcjtcIixcImNvbnN0IHZlYzIgY2VudGVyID0gdmVjMigtMS4wLCAxLjApO1wiLFwidm9pZCBtYWluKHZvaWQpIHtcIixcIiAgIHZlYzIgdjtcIixcIiAgIHZlYzIgc3YgPSBhVmVydGV4UG9zaXRpb24gKiBhU2NhbGU7XCIsXCIgICB2LnggPSAoc3YueCkgKiBjb3MoYVJvdGF0aW9uKSAtIChzdi55KSAqIHNpbihhUm90YXRpb24pO1wiLFwiICAgdi55ID0gKHN2LngpICogc2luKGFSb3RhdGlvbikgKyAoc3YueSkgKiBjb3MoYVJvdGF0aW9uKTtcIixcIiAgIHYgPSAoIHVNYXRyaXggKiB2ZWMzKHYgKyBhUG9zaXRpb25Db29yZCAsIDEuMCkgKS54eSA7XCIsXCIgICBnbF9Qb3NpdGlvbiA9IHZlYzQoICggdiAvIHByb2plY3Rpb25WZWN0b3IpICsgY2VudGVyICwgMC4wLCAxLjApO1wiLFwiICAgdlRleHR1cmVDb29yZCA9IGFUZXh0dXJlQ29vcmQ7XCIsXCIgICB2Q29sb3IgPSBhQ29sb3I7XCIsXCJ9XCJdLHRoaXMudGV4dHVyZUNvdW50PTAsdGhpcy5pbml0KCl9LGIuUGl4aUZhc3RTaGFkZXIucHJvdG90eXBlLmluaXQ9ZnVuY3Rpb24oKXt2YXIgYT10aGlzLmdsLGM9Yi5jb21waWxlUHJvZ3JhbShhLHRoaXMudmVydGV4U3JjLHRoaXMuZnJhZ21lbnRTcmMpO2EudXNlUHJvZ3JhbShjKSx0aGlzLnVTYW1wbGVyPWEuZ2V0VW5pZm9ybUxvY2F0aW9uKGMsXCJ1U2FtcGxlclwiKSx0aGlzLnByb2plY3Rpb25WZWN0b3I9YS5nZXRVbmlmb3JtTG9jYXRpb24oYyxcInByb2plY3Rpb25WZWN0b3JcIiksdGhpcy5vZmZzZXRWZWN0b3I9YS5nZXRVbmlmb3JtTG9jYXRpb24oYyxcIm9mZnNldFZlY3RvclwiKSx0aGlzLmRpbWVuc2lvbnM9YS5nZXRVbmlmb3JtTG9jYXRpb24oYyxcImRpbWVuc2lvbnNcIiksdGhpcy51TWF0cml4PWEuZ2V0VW5pZm9ybUxvY2F0aW9uKGMsXCJ1TWF0cml4XCIpLHRoaXMuYVZlcnRleFBvc2l0aW9uPWEuZ2V0QXR0cmliTG9jYXRpb24oYyxcImFWZXJ0ZXhQb3NpdGlvblwiKSx0aGlzLmFQb3NpdGlvbkNvb3JkPWEuZ2V0QXR0cmliTG9jYXRpb24oYyxcImFQb3NpdGlvbkNvb3JkXCIpLHRoaXMuYVNjYWxlPWEuZ2V0QXR0cmliTG9jYXRpb24oYyxcImFTY2FsZVwiKSx0aGlzLmFSb3RhdGlvbj1hLmdldEF0dHJpYkxvY2F0aW9uKGMsXCJhUm90YXRpb25cIiksdGhpcy5hVGV4dHVyZUNvb3JkPWEuZ2V0QXR0cmliTG9jYXRpb24oYyxcImFUZXh0dXJlQ29vcmRcIiksdGhpcy5jb2xvckF0dHJpYnV0ZT1hLmdldEF0dHJpYkxvY2F0aW9uKGMsXCJhQ29sb3JcIiksLTE9PT10aGlzLmNvbG9yQXR0cmlidXRlJiYodGhpcy5jb2xvckF0dHJpYnV0ZT0yKSx0aGlzLmF0dHJpYnV0ZXM9W3RoaXMuYVZlcnRleFBvc2l0aW9uLHRoaXMuYVBvc2l0aW9uQ29vcmQsdGhpcy5hU2NhbGUsdGhpcy5hUm90YXRpb24sdGhpcy5hVGV4dHVyZUNvb3JkLHRoaXMuY29sb3JBdHRyaWJ1dGVdLHRoaXMucHJvZ3JhbT1jfSxiLlBpeGlGYXN0U2hhZGVyLnByb3RvdHlwZS5kZXN0cm95PWZ1bmN0aW9uKCl7dGhpcy5nbC5kZWxldGVQcm9ncmFtKHRoaXMucHJvZ3JhbSksdGhpcy51bmlmb3Jtcz1udWxsLHRoaXMuZ2w9bnVsbCx0aGlzLmF0dHJpYnV0ZXM9bnVsbH0sYi5TdHJpcFNoYWRlcj1mdW5jdGlvbihhKXt0aGlzLl9VSUQ9Yi5fVUlEKyssdGhpcy5nbD1hLHRoaXMucHJvZ3JhbT1udWxsLHRoaXMuZnJhZ21lbnRTcmM9W1wicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XCIsXCJ2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDtcIixcInVuaWZvcm0gZmxvYXQgYWxwaGE7XCIsXCJ1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjtcIixcInZvaWQgbWFpbih2b2lkKSB7XCIsXCIgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkpKTtcIixcIn1cIl0sdGhpcy52ZXJ0ZXhTcmM9W1wiYXR0cmlidXRlIHZlYzIgYVZlcnRleFBvc2l0aW9uO1wiLFwiYXR0cmlidXRlIHZlYzIgYVRleHR1cmVDb29yZDtcIixcInVuaWZvcm0gbWF0MyB0cmFuc2xhdGlvbk1hdHJpeDtcIixcInVuaWZvcm0gdmVjMiBwcm9qZWN0aW9uVmVjdG9yO1wiLFwidW5pZm9ybSB2ZWMyIG9mZnNldFZlY3RvcjtcIixcInZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkO1wiLFwidm9pZCBtYWluKHZvaWQpIHtcIixcIiAgIHZlYzMgdiA9IHRyYW5zbGF0aW9uTWF0cml4ICogdmVjMyhhVmVydGV4UG9zaXRpb24gLCAxLjApO1wiLFwiICAgdiAtPSBvZmZzZXRWZWN0b3IueHl4O1wiLFwiICAgZ2xfUG9zaXRpb24gPSB2ZWM0KCB2LnggLyBwcm9qZWN0aW9uVmVjdG9yLnggLTEuMCwgdi55IC8gLXByb2plY3Rpb25WZWN0b3IueSArIDEuMCAsIDAuMCwgMS4wKTtcIixcIiAgIHZUZXh0dXJlQ29vcmQgPSBhVGV4dHVyZUNvb3JkO1wiLFwifVwiXSx0aGlzLmluaXQoKX0sYi5TdHJpcFNoYWRlci5wcm90b3R5cGUuaW5pdD1mdW5jdGlvbigpe3ZhciBhPXRoaXMuZ2wsYz1iLmNvbXBpbGVQcm9ncmFtKGEsdGhpcy52ZXJ0ZXhTcmMsdGhpcy5mcmFnbWVudFNyYyk7YS51c2VQcm9ncmFtKGMpLHRoaXMudVNhbXBsZXI9YS5nZXRVbmlmb3JtTG9jYXRpb24oYyxcInVTYW1wbGVyXCIpLHRoaXMucHJvamVjdGlvblZlY3Rvcj1hLmdldFVuaWZvcm1Mb2NhdGlvbihjLFwicHJvamVjdGlvblZlY3RvclwiKSx0aGlzLm9mZnNldFZlY3Rvcj1hLmdldFVuaWZvcm1Mb2NhdGlvbihjLFwib2Zmc2V0VmVjdG9yXCIpLHRoaXMuY29sb3JBdHRyaWJ1dGU9YS5nZXRBdHRyaWJMb2NhdGlvbihjLFwiYUNvbG9yXCIpLHRoaXMuYVZlcnRleFBvc2l0aW9uPWEuZ2V0QXR0cmliTG9jYXRpb24oYyxcImFWZXJ0ZXhQb3NpdGlvblwiKSx0aGlzLmFUZXh0dXJlQ29vcmQ9YS5nZXRBdHRyaWJMb2NhdGlvbihjLFwiYVRleHR1cmVDb29yZFwiKSx0aGlzLmF0dHJpYnV0ZXM9W3RoaXMuYVZlcnRleFBvc2l0aW9uLHRoaXMuYVRleHR1cmVDb29yZF0sdGhpcy50cmFuc2xhdGlvbk1hdHJpeD1hLmdldFVuaWZvcm1Mb2NhdGlvbihjLFwidHJhbnNsYXRpb25NYXRyaXhcIiksdGhpcy5hbHBoYT1hLmdldFVuaWZvcm1Mb2NhdGlvbihjLFwiYWxwaGFcIiksdGhpcy5wcm9ncmFtPWN9LGIuUHJpbWl0aXZlU2hhZGVyPWZ1bmN0aW9uKGEpe3RoaXMuX1VJRD1iLl9VSUQrKyx0aGlzLmdsPWEsdGhpcy5wcm9ncmFtPW51bGwsdGhpcy5mcmFnbWVudFNyYz1bXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcIixcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXCJ2b2lkIG1haW4odm9pZCkge1wiLFwiICAgZ2xfRnJhZ0NvbG9yID0gdkNvbG9yO1wiLFwifVwiXSx0aGlzLnZlcnRleFNyYz1bXCJhdHRyaWJ1dGUgdmVjMiBhVmVydGV4UG9zaXRpb247XCIsXCJhdHRyaWJ1dGUgdmVjNCBhQ29sb3I7XCIsXCJ1bmlmb3JtIG1hdDMgdHJhbnNsYXRpb25NYXRyaXg7XCIsXCJ1bmlmb3JtIHZlYzIgcHJvamVjdGlvblZlY3RvcjtcIixcInVuaWZvcm0gdmVjMiBvZmZzZXRWZWN0b3I7XCIsXCJ1bmlmb3JtIGZsb2F0IGFscGhhO1wiLFwidW5pZm9ybSB2ZWMzIHRpbnQ7XCIsXCJ2YXJ5aW5nIHZlYzQgdkNvbG9yO1wiLFwidm9pZCBtYWluKHZvaWQpIHtcIixcIiAgIHZlYzMgdiA9IHRyYW5zbGF0aW9uTWF0cml4ICogdmVjMyhhVmVydGV4UG9zaXRpb24gLCAxLjApO1wiLFwiICAgdiAtPSBvZmZzZXRWZWN0b3IueHl4O1wiLFwiICAgZ2xfUG9zaXRpb24gPSB2ZWM0KCB2LnggLyBwcm9qZWN0aW9uVmVjdG9yLnggLTEuMCwgdi55IC8gLXByb2plY3Rpb25WZWN0b3IueSArIDEuMCAsIDAuMCwgMS4wKTtcIixcIiAgIHZDb2xvciA9IGFDb2xvciAqIHZlYzQodGludCAqIGFscGhhLCBhbHBoYSk7XCIsXCJ9XCJdLHRoaXMuaW5pdCgpfSxiLlByaW1pdGl2ZVNoYWRlci5wcm90b3R5cGUuaW5pdD1mdW5jdGlvbigpe3ZhciBhPXRoaXMuZ2wsYz1iLmNvbXBpbGVQcm9ncmFtKGEsdGhpcy52ZXJ0ZXhTcmMsdGhpcy5mcmFnbWVudFNyYyk7YS51c2VQcm9ncmFtKGMpLHRoaXMucHJvamVjdGlvblZlY3Rvcj1hLmdldFVuaWZvcm1Mb2NhdGlvbihjLFwicHJvamVjdGlvblZlY3RvclwiKSx0aGlzLm9mZnNldFZlY3Rvcj1hLmdldFVuaWZvcm1Mb2NhdGlvbihjLFwib2Zmc2V0VmVjdG9yXCIpLHRoaXMudGludENvbG9yPWEuZ2V0VW5pZm9ybUxvY2F0aW9uKGMsXCJ0aW50XCIpLHRoaXMuYVZlcnRleFBvc2l0aW9uPWEuZ2V0QXR0cmliTG9jYXRpb24oYyxcImFWZXJ0ZXhQb3NpdGlvblwiKSx0aGlzLmNvbG9yQXR0cmlidXRlPWEuZ2V0QXR0cmliTG9jYXRpb24oYyxcImFDb2xvclwiKSx0aGlzLmF0dHJpYnV0ZXM9W3RoaXMuYVZlcnRleFBvc2l0aW9uLHRoaXMuY29sb3JBdHRyaWJ1dGVdLHRoaXMudHJhbnNsYXRpb25NYXRyaXg9YS5nZXRVbmlmb3JtTG9jYXRpb24oYyxcInRyYW5zbGF0aW9uTWF0cml4XCIpLHRoaXMuYWxwaGE9YS5nZXRVbmlmb3JtTG9jYXRpb24oYyxcImFscGhhXCIpLHRoaXMucHJvZ3JhbT1jfSxiLlByaW1pdGl2ZVNoYWRlci5wcm90b3R5cGUuZGVzdHJveT1mdW5jdGlvbigpe3RoaXMuZ2wuZGVsZXRlUHJvZ3JhbSh0aGlzLnByb2dyYW0pLHRoaXMudW5pZm9ybXM9bnVsbCx0aGlzLmdsPW51bGwsdGhpcy5hdHRyaWJ1dGU9bnVsbH0sYi5Db21wbGV4UHJpbWl0aXZlU2hhZGVyPWZ1bmN0aW9uKGEpe3RoaXMuX1VJRD1iLl9VSUQrKyx0aGlzLmdsPWEsdGhpcy5wcm9ncmFtPW51bGwsdGhpcy5mcmFnbWVudFNyYz1bXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcIixcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXCJ2b2lkIG1haW4odm9pZCkge1wiLFwiICAgZ2xfRnJhZ0NvbG9yID0gdkNvbG9yO1wiLFwifVwiXSx0aGlzLnZlcnRleFNyYz1bXCJhdHRyaWJ1dGUgdmVjMiBhVmVydGV4UG9zaXRpb247XCIsXCJ1bmlmb3JtIG1hdDMgdHJhbnNsYXRpb25NYXRyaXg7XCIsXCJ1bmlmb3JtIHZlYzIgcHJvamVjdGlvblZlY3RvcjtcIixcInVuaWZvcm0gdmVjMiBvZmZzZXRWZWN0b3I7XCIsXCJ1bmlmb3JtIHZlYzMgdGludDtcIixcInVuaWZvcm0gZmxvYXQgYWxwaGE7XCIsXCJ1bmlmb3JtIHZlYzMgY29sb3I7XCIsXCJ2YXJ5aW5nIHZlYzQgdkNvbG9yO1wiLFwidm9pZCBtYWluKHZvaWQpIHtcIixcIiAgIHZlYzMgdiA9IHRyYW5zbGF0aW9uTWF0cml4ICogdmVjMyhhVmVydGV4UG9zaXRpb24gLCAxLjApO1wiLFwiICAgdiAtPSBvZmZzZXRWZWN0b3IueHl4O1wiLFwiICAgZ2xfUG9zaXRpb24gPSB2ZWM0KCB2LnggLyBwcm9qZWN0aW9uVmVjdG9yLnggLTEuMCwgdi55IC8gLXByb2plY3Rpb25WZWN0b3IueSArIDEuMCAsIDAuMCwgMS4wKTtcIixcIiAgIHZDb2xvciA9IHZlYzQoY29sb3IgKiBhbHBoYSAqIHRpbnQsIGFscGhhKTtcIixcIn1cIl0sdGhpcy5pbml0KCl9LGIuQ29tcGxleFByaW1pdGl2ZVNoYWRlci5wcm90b3R5cGUuaW5pdD1mdW5jdGlvbigpe3ZhciBhPXRoaXMuZ2wsYz1iLmNvbXBpbGVQcm9ncmFtKGEsdGhpcy52ZXJ0ZXhTcmMsdGhpcy5mcmFnbWVudFNyYyk7YS51c2VQcm9ncmFtKGMpLHRoaXMucHJvamVjdGlvblZlY3Rvcj1hLmdldFVuaWZvcm1Mb2NhdGlvbihjLFwicHJvamVjdGlvblZlY3RvclwiKSx0aGlzLm9mZnNldFZlY3Rvcj1hLmdldFVuaWZvcm1Mb2NhdGlvbihjLFwib2Zmc2V0VmVjdG9yXCIpLHRoaXMudGludENvbG9yPWEuZ2V0VW5pZm9ybUxvY2F0aW9uKGMsXCJ0aW50XCIpLHRoaXMuY29sb3I9YS5nZXRVbmlmb3JtTG9jYXRpb24oYyxcImNvbG9yXCIpLHRoaXMuYVZlcnRleFBvc2l0aW9uPWEuZ2V0QXR0cmliTG9jYXRpb24oYyxcImFWZXJ0ZXhQb3NpdGlvblwiKSx0aGlzLmF0dHJpYnV0ZXM9W3RoaXMuYVZlcnRleFBvc2l0aW9uLHRoaXMuY29sb3JBdHRyaWJ1dGVdLHRoaXMudHJhbnNsYXRpb25NYXRyaXg9YS5nZXRVbmlmb3JtTG9jYXRpb24oYyxcInRyYW5zbGF0aW9uTWF0cml4XCIpLHRoaXMuYWxwaGE9YS5nZXRVbmlmb3JtTG9jYXRpb24oYyxcImFscGhhXCIpLHRoaXMucHJvZ3JhbT1jfSxiLkNvbXBsZXhQcmltaXRpdmVTaGFkZXIucHJvdG90eXBlLmRlc3Ryb3k9ZnVuY3Rpb24oKXt0aGlzLmdsLmRlbGV0ZVByb2dyYW0odGhpcy5wcm9ncmFtKSx0aGlzLnVuaWZvcm1zPW51bGwsdGhpcy5nbD1udWxsLHRoaXMuYXR0cmlidXRlPW51bGx9LGIuV2ViR0xHcmFwaGljcz1mdW5jdGlvbigpe30sYi5XZWJHTEdyYXBoaWNzLnJlbmRlckdyYXBoaWNzPWZ1bmN0aW9uKGEsYyl7dmFyIGQsZT1jLmdsLGY9Yy5wcm9qZWN0aW9uLGc9Yy5vZmZzZXQsaD1jLnNoYWRlck1hbmFnZXIucHJpbWl0aXZlU2hhZGVyO2EuZGlydHkmJmIuV2ViR0xHcmFwaGljcy51cGRhdGVHcmFwaGljcyhhLGUpO2Zvcih2YXIgaT1hLl93ZWJHTFtlLmlkXSxqPTA7ajxpLmRhdGEubGVuZ3RoO2orKykxPT09aS5kYXRhW2pdLm1vZGU/KGQ9aS5kYXRhW2pdLGMuc3RlbmNpbE1hbmFnZXIucHVzaFN0ZW5jaWwoYSxkLGMpLGUuZHJhd0VsZW1lbnRzKGUuVFJJQU5HTEVfRkFOLDQsZS5VTlNJR05FRF9TSE9SVCwyKihkLmluZGljZXMubGVuZ3RoLTQpKSxjLnN0ZW5jaWxNYW5hZ2VyLnBvcFN0ZW5jaWwoYSxkLGMpLHRoaXMubGFzdD1kLm1vZGUpOihkPWkuZGF0YVtqXSxjLnNoYWRlck1hbmFnZXIuc2V0U2hhZGVyKGgpLGg9Yy5zaGFkZXJNYW5hZ2VyLnByaW1pdGl2ZVNoYWRlcixlLnVuaWZvcm1NYXRyaXgzZnYoaC50cmFuc2xhdGlvbk1hdHJpeCwhMSxhLndvcmxkVHJhbnNmb3JtLnRvQXJyYXkoITApKSxlLnVuaWZvcm0yZihoLnByb2plY3Rpb25WZWN0b3IsZi54LC1mLnkpLGUudW5pZm9ybTJmKGgub2Zmc2V0VmVjdG9yLC1nLngsLWcueSksZS51bmlmb3JtM2Z2KGgudGludENvbG9yLGIuaGV4MnJnYihhLnRpbnQpKSxlLnVuaWZvcm0xZihoLmFscGhhLGEud29ybGRBbHBoYSksZS5iaW5kQnVmZmVyKGUuQVJSQVlfQlVGRkVSLGQuYnVmZmVyKSxlLnZlcnRleEF0dHJpYlBvaW50ZXIoaC5hVmVydGV4UG9zaXRpb24sMixlLkZMT0FULCExLDI0LDApLGUudmVydGV4QXR0cmliUG9pbnRlcihoLmNvbG9yQXR0cmlidXRlLDQsZS5GTE9BVCwhMSwyNCw4KSxlLmJpbmRCdWZmZXIoZS5FTEVNRU5UX0FSUkFZX0JVRkZFUixkLmluZGV4QnVmZmVyKSxlLmRyYXdFbGVtZW50cyhlLlRSSUFOR0xFX1NUUklQLGQuaW5kaWNlcy5sZW5ndGgsZS5VTlNJR05FRF9TSE9SVCwwKSl9LGIuV2ViR0xHcmFwaGljcy51cGRhdGVHcmFwaGljcz1mdW5jdGlvbihhLGMpe3ZhciBkPWEuX3dlYkdMW2MuaWRdO2R8fChkPWEuX3dlYkdMW2MuaWRdPXtsYXN0SW5kZXg6MCxkYXRhOltdLGdsOmN9KSxhLmRpcnR5PSExO3ZhciBlO2lmKGEuY2xlYXJEaXJ0eSl7Zm9yKGEuY2xlYXJEaXJ0eT0hMSxlPTA7ZTxkLmRhdGEubGVuZ3RoO2UrKyl7dmFyIGY9ZC5kYXRhW2VdO2YucmVzZXQoKSxiLldlYkdMR3JhcGhpY3MuZ3JhcGhpY3NEYXRhUG9vbC5wdXNoKGYpfWQuZGF0YT1bXSxkLmxhc3RJbmRleD0wfXZhciBnO2ZvcihlPWQubGFzdEluZGV4O2U8YS5ncmFwaGljc0RhdGEubGVuZ3RoO2UrKyl7dmFyIGg9YS5ncmFwaGljc0RhdGFbZV07aC50eXBlPT09Yi5HcmFwaGljcy5QT0xZPyhoLmZpbGwmJmgucG9pbnRzLmxlbmd0aD42JiYoaC5wb2ludHMubGVuZ3RoPjEwPyhnPWIuV2ViR0xHcmFwaGljcy5zd2l0Y2hNb2RlKGQsMSksYi5XZWJHTEdyYXBoaWNzLmJ1aWxkQ29tcGxleFBvbHkoaCxnKSk6KGc9Yi5XZWJHTEdyYXBoaWNzLnN3aXRjaE1vZGUoZCwwKSxiLldlYkdMR3JhcGhpY3MuYnVpbGRQb2x5KGgsZykpKSxoLmxpbmVXaWR0aD4wJiYoZz1iLldlYkdMR3JhcGhpY3Muc3dpdGNoTW9kZShkLDApLGIuV2ViR0xHcmFwaGljcy5idWlsZExpbmUoaCxnKSkpOihnPWIuV2ViR0xHcmFwaGljcy5zd2l0Y2hNb2RlKGQsMCksaC50eXBlPT09Yi5HcmFwaGljcy5SRUNUP2IuV2ViR0xHcmFwaGljcy5idWlsZFJlY3RhbmdsZShoLGcpOmgudHlwZT09PWIuR3JhcGhpY3MuQ0lSQ3x8aC50eXBlPT09Yi5HcmFwaGljcy5FTElQP2IuV2ViR0xHcmFwaGljcy5idWlsZENpcmNsZShoLGcpOmgudHlwZT09PWIuR3JhcGhpY3MuUlJFQyYmYi5XZWJHTEdyYXBoaWNzLmJ1aWxkUm91bmRlZFJlY3RhbmdsZShoLGcpKSxkLmxhc3RJbmRleCsrfWZvcihlPTA7ZTxkLmRhdGEubGVuZ3RoO2UrKylnPWQuZGF0YVtlXSxnLmRpcnR5JiZnLnVwbG9hZCgpfSxiLldlYkdMR3JhcGhpY3Muc3dpdGNoTW9kZT1mdW5jdGlvbihhLGMpe3ZhciBkO3JldHVybiBhLmRhdGEubGVuZ3RoPyhkPWEuZGF0YVthLmRhdGEubGVuZ3RoLTFdLChkLm1vZGUhPT1jfHwxPT09YykmJihkPWIuV2ViR0xHcmFwaGljcy5ncmFwaGljc0RhdGFQb29sLnBvcCgpfHxuZXcgYi5XZWJHTEdyYXBoaWNzRGF0YShhLmdsKSxkLm1vZGU9YyxhLmRhdGEucHVzaChkKSkpOihkPWIuV2ViR0xHcmFwaGljcy5ncmFwaGljc0RhdGFQb29sLnBvcCgpfHxuZXcgYi5XZWJHTEdyYXBoaWNzRGF0YShhLmdsKSxkLm1vZGU9YyxhLmRhdGEucHVzaChkKSksZC5kaXJ0eT0hMCxkfSxiLldlYkdMR3JhcGhpY3MuYnVpbGRSZWN0YW5nbGU9ZnVuY3Rpb24oYSxjKXt2YXIgZD1hLnBvaW50cyxlPWRbMF0sZj1kWzFdLGc9ZFsyXSxoPWRbM107aWYoYS5maWxsKXt2YXIgaT1iLmhleDJyZ2IoYS5maWxsQ29sb3IpLGo9YS5maWxsQWxwaGEsaz1pWzBdKmosbD1pWzFdKmosbT1pWzJdKmosbj1jLnBvaW50cyxvPWMuaW5kaWNlcyxwPW4ubGVuZ3RoLzY7bi5wdXNoKGUsZiksbi5wdXNoKGssbCxtLGopLG4ucHVzaChlK2csZiksbi5wdXNoKGssbCxtLGopLG4ucHVzaChlLGYraCksbi5wdXNoKGssbCxtLGopLG4ucHVzaChlK2csZitoKSxuLnB1c2goayxsLG0saiksby5wdXNoKHAscCxwKzEscCsyLHArMyxwKzMpfWlmKGEubGluZVdpZHRoKXt2YXIgcT1hLnBvaW50czthLnBvaW50cz1bZSxmLGUrZyxmLGUrZyxmK2gsZSxmK2gsZSxmXSxiLldlYkdMR3JhcGhpY3MuYnVpbGRMaW5lKGEsYyksYS5wb2ludHM9cX19LGIuV2ViR0xHcmFwaGljcy5idWlsZFJvdW5kZWRSZWN0YW5nbGU9ZnVuY3Rpb24oYSxjKXt2YXIgZD1hLnBvaW50cyxlPWRbMF0sZj1kWzFdLGc9ZFsyXSxoPWRbM10saT1kWzRdLGo9W107aWYoai5wdXNoKGUsZitpKSxqPWouY29uY2F0KGIuV2ViR0xHcmFwaGljcy5xdWFkcmF0aWNCZXppZXJDdXJ2ZShlLGYraC1pLGUsZitoLGUraSxmK2gpKSxqPWouY29uY2F0KGIuV2ViR0xHcmFwaGljcy5xdWFkcmF0aWNCZXppZXJDdXJ2ZShlK2ctaSxmK2gsZStnLGYraCxlK2csZitoLWkpKSxqPWouY29uY2F0KGIuV2ViR0xHcmFwaGljcy5xdWFkcmF0aWNCZXppZXJDdXJ2ZShlK2csZitpLGUrZyxmLGUrZy1pLGYpKSxqPWouY29uY2F0KGIuV2ViR0xHcmFwaGljcy5xdWFkcmF0aWNCZXppZXJDdXJ2ZShlK2ksZixlLGYsZSxmK2kpKSxhLmZpbGwpe3ZhciBrPWIuaGV4MnJnYihhLmZpbGxDb2xvciksbD1hLmZpbGxBbHBoYSxtPWtbMF0qbCxuPWtbMV0qbCxvPWtbMl0qbCxwPWMucG9pbnRzLHE9Yy5pbmRpY2VzLHI9cC5sZW5ndGgvNixzPWIuUG9seUsuVHJpYW5ndWxhdGUoaiksdD0wO2Zvcih0PTA7dDxzLmxlbmd0aDt0Kz0zKXEucHVzaChzW3RdK3IpLHEucHVzaChzW3RdK3IpLHEucHVzaChzW3QrMV0rcikscS5wdXNoKHNbdCsyXStyKSxxLnB1c2goc1t0KzJdK3IpO2Zvcih0PTA7dDxqLmxlbmd0aDt0KyspcC5wdXNoKGpbdF0salsrK3RdLG0sbixvLGwpfWlmKGEubGluZVdpZHRoKXt2YXIgdT1hLnBvaW50czthLnBvaW50cz1qLGIuV2ViR0xHcmFwaGljcy5idWlsZExpbmUoYSxjKSxhLnBvaW50cz11fX0sYi5XZWJHTEdyYXBoaWNzLnF1YWRyYXRpY0JlemllckN1cnZlPWZ1bmN0aW9uKGEsYixjLGQsZSxmKXtmdW5jdGlvbiBnKGEsYixjKXt2YXIgZD1iLWE7cmV0dXJuIGErZCpjfWZvcih2YXIgaCxpLGosayxsLG0sbj0yMCxvPVtdLHA9MCxxPTA7bj49cTtxKyspcD1xL24saD1nKGEsYyxwKSxpPWcoYixkLHApLGo9ZyhjLGUscCksaz1nKGQsZixwKSxsPWcoaCxqLHApLG09ZyhpLGsscCksby5wdXNoKGwsbSk7cmV0dXJuIG99LGIuV2ViR0xHcmFwaGljcy5idWlsZENpcmNsZT1mdW5jdGlvbihhLGMpe3ZhciBkPWEucG9pbnRzLGU9ZFswXSxmPWRbMV0sZz1kWzJdLGg9ZFszXSxpPTQwLGo9MipNYXRoLlBJL2ksaz0wO2lmKGEuZmlsbCl7dmFyIGw9Yi5oZXgycmdiKGEuZmlsbENvbG9yKSxtPWEuZmlsbEFscGhhLG49bFswXSptLG89bFsxXSptLHA9bFsyXSptLHE9Yy5wb2ludHMscj1jLmluZGljZXMscz1xLmxlbmd0aC82O2ZvcihyLnB1c2gocyksaz0wO2krMT5rO2srKylxLnB1c2goZSxmLG4sbyxwLG0pLHEucHVzaChlK01hdGguc2luKGoqaykqZyxmK01hdGguY29zKGoqaykqaCxuLG8scCxtKSxyLnB1c2gocysrLHMrKyk7ci5wdXNoKHMtMSl9aWYoYS5saW5lV2lkdGgpe3ZhciB0PWEucG9pbnRzO2ZvcihhLnBvaW50cz1bXSxrPTA7aSsxPms7aysrKWEucG9pbnRzLnB1c2goZStNYXRoLnNpbihqKmspKmcsZitNYXRoLmNvcyhqKmspKmgpO2IuV2ViR0xHcmFwaGljcy5idWlsZExpbmUoYSxjKSxhLnBvaW50cz10fX0sYi5XZWJHTEdyYXBoaWNzLmJ1aWxkTGluZT1mdW5jdGlvbihhLGMpe3ZhciBkPTAsZT1hLnBvaW50cztpZigwIT09ZS5sZW5ndGgpe2lmKGEubGluZVdpZHRoJTIpZm9yKGQ9MDtkPGUubGVuZ3RoO2QrKyllW2RdKz0uNTt2YXIgZj1uZXcgYi5Qb2ludChlWzBdLGVbMV0pLGc9bmV3IGIuUG9pbnQoZVtlLmxlbmd0aC0yXSxlW2UubGVuZ3RoLTFdKTtpZihmLng9PT1nLngmJmYueT09PWcueSl7ZT1lLnNsaWNlKCksZS5wb3AoKSxlLnBvcCgpLGc9bmV3IGIuUG9pbnQoZVtlLmxlbmd0aC0yXSxlW2UubGVuZ3RoLTFdKTt2YXIgaD1nLngrLjUqKGYueC1nLngpLGk9Zy55Ky41KihmLnktZy55KTtlLnVuc2hpZnQoaCxpKSxlLnB1c2goaCxpKX12YXIgaixrLGwsbSxuLG8scCxxLHIscyx0LHUsdix3LHgseSx6LEEsQixDLEQsRSxGLEc9Yy5wb2ludHMsSD1jLmluZGljZXMsST1lLmxlbmd0aC8yLEo9ZS5sZW5ndGgsSz1HLmxlbmd0aC82LEw9YS5saW5lV2lkdGgvMixNPWIuaGV4MnJnYihhLmxpbmVDb2xvciksTj1hLmxpbmVBbHBoYSxPPU1bMF0qTixQPU1bMV0qTixRPU1bMl0qTjtmb3IobD1lWzBdLG09ZVsxXSxuPWVbMl0sbz1lWzNdLHI9LShtLW8pLHM9bC1uLEY9TWF0aC5zcXJ0KHIqcitzKnMpLHIvPUYscy89RixyKj1MLHMqPUwsRy5wdXNoKGwtcixtLXMsTyxQLFEsTiksRy5wdXNoKGwrcixtK3MsTyxQLFEsTiksZD0xO0ktMT5kO2QrKylsPWVbMiooZC0xKV0sbT1lWzIqKGQtMSkrMV0sbj1lWzIqZF0sbz1lWzIqZCsxXSxwPWVbMiooZCsxKV0scT1lWzIqKGQrMSkrMV0scj0tKG0tbykscz1sLW4sRj1NYXRoLnNxcnQocipyK3Mqcyksci89RixzLz1GLHIqPUwscyo9TCx0PS0oby1xKSx1PW4tcCxGPU1hdGguc3FydCh0KnQrdSp1KSx0Lz1GLHUvPUYsdCo9TCx1Kj1MLHg9LXMrbS0oLXMrbykseT0tcituLSgtcitsKSx6PSgtcitsKSooLXMrbyktKC1yK24pKigtcyttKSxBPS11K3EtKC11K28pLEI9LXQrbi0oLXQrcCksQz0oLXQrcCkqKC11K28pLSgtdCtuKSooLXUrcSksRD14KkItQSp5LE1hdGguYWJzKEQpPC4xPyhEKz0xMC4xLEcucHVzaChuLXIsby1zLE8sUCxRLE4pLEcucHVzaChuK3IsbytzLE8sUCxRLE4pKTooaj0oeSpDLUIqeikvRCxrPShBKnoteCpDKS9ELEU9KGotbikqKGotbikrKGstbykrKGstbyksRT4xOTYwMD8odj1yLXQsdz1zLXUsRj1NYXRoLnNxcnQodip2K3cqdyksdi89Rix3Lz1GLHYqPUwsdyo9TCxHLnB1c2gobi12LG8tdyksRy5wdXNoKE8sUCxRLE4pLEcucHVzaChuK3Ysbyt3KSxHLnB1c2goTyxQLFEsTiksRy5wdXNoKG4tdixvLXcpLEcucHVzaChPLFAsUSxOKSxKKyspOihHLnB1c2goaixrKSxHLnB1c2goTyxQLFEsTiksRy5wdXNoKG4tKGotbiksby0oay1vKSksRy5wdXNoKE8sUCxRLE4pKSk7Zm9yKGw9ZVsyKihJLTIpXSxtPWVbMiooSS0yKSsxXSxuPWVbMiooSS0xKV0sbz1lWzIqKEktMSkrMV0scj0tKG0tbykscz1sLW4sRj1NYXRoLnNxcnQocipyK3Mqcyksci89RixzLz1GLHIqPUwscyo9TCxHLnB1c2gobi1yLG8tcyksRy5wdXNoKE8sUCxRLE4pLEcucHVzaChuK3IsbytzKSxHLnB1c2goTyxQLFEsTiksSC5wdXNoKEspLGQ9MDtKPmQ7ZCsrKUgucHVzaChLKyspO0gucHVzaChLLTEpfX0sYi5XZWJHTEdyYXBoaWNzLmJ1aWxkQ29tcGxleFBvbHk9ZnVuY3Rpb24oYSxjKXt2YXIgZD1hLnBvaW50cy5zbGljZSgpO2lmKCEoZC5sZW5ndGg8Nikpe3ZhciBlPWMuaW5kaWNlcztjLnBvaW50cz1kLGMuYWxwaGE9YS5maWxsQWxwaGEsYy5jb2xvcj1iLmhleDJyZ2IoYS5maWxsQ29sb3IpO2Zvcih2YXIgZixnLGg9MS8wLGk9LTEvMCxqPTEvMCxrPS0xLzAsbD0wO2w8ZC5sZW5ndGg7bCs9MilmPWRbbF0sZz1kW2wrMV0saD1oPmY/ZjpoLGk9Zj5pP2Y6aSxqPWo+Zz9nOmosaz1nPms/ZzprO2QucHVzaChoLGosaSxqLGksayxoLGspO3ZhciBtPWQubGVuZ3RoLzI7Zm9yKGw9MDttPmw7bCsrKWUucHVzaChsKX19LGIuV2ViR0xHcmFwaGljcy5idWlsZFBvbHk9ZnVuY3Rpb24oYSxjKXt2YXIgZD1hLnBvaW50cztpZighKGQubGVuZ3RoPDYpKXt2YXIgZT1jLnBvaW50cyxmPWMuaW5kaWNlcyxnPWQubGVuZ3RoLzIsaD1iLmhleDJyZ2IoYS5maWxsQ29sb3IpLGk9YS5maWxsQWxwaGEsaj1oWzBdKmksaz1oWzFdKmksbD1oWzJdKmksbT1iLlBvbHlLLlRyaWFuZ3VsYXRlKGQpLG49ZS5sZW5ndGgvNixvPTA7Zm9yKG89MDtvPG0ubGVuZ3RoO28rPTMpZi5wdXNoKG1bb10rbiksZi5wdXNoKG1bb10rbiksZi5wdXNoKG1bbysxXStuKSxmLnB1c2gobVtvKzJdK24pLGYucHVzaChtW28rMl0rbik7Zm9yKG89MDtnPm87bysrKWUucHVzaChkWzIqb10sZFsyKm8rMV0saixrLGwsaSl9fSxiLldlYkdMR3JhcGhpY3MuZ3JhcGhpY3NEYXRhUG9vbD1bXSxiLldlYkdMR3JhcGhpY3NEYXRhPWZ1bmN0aW9uKGEpe3RoaXMuZ2w9YSx0aGlzLmNvbG9yPVswLDAsMF0sdGhpcy5wb2ludHM9W10sdGhpcy5pbmRpY2VzPVtdLHRoaXMubGFzdEluZGV4PTAsdGhpcy5idWZmZXI9YS5jcmVhdGVCdWZmZXIoKSx0aGlzLmluZGV4QnVmZmVyPWEuY3JlYXRlQnVmZmVyKCksdGhpcy5tb2RlPTEsdGhpcy5hbHBoYT0xLHRoaXMuZGlydHk9ITB9LGIuV2ViR0xHcmFwaGljc0RhdGEucHJvdG90eXBlLnJlc2V0PWZ1bmN0aW9uKCl7dGhpcy5wb2ludHM9W10sdGhpcy5pbmRpY2VzPVtdLHRoaXMubGFzdEluZGV4PTB9LGIuV2ViR0xHcmFwaGljc0RhdGEucHJvdG90eXBlLnVwbG9hZD1mdW5jdGlvbigpe3ZhciBhPXRoaXMuZ2w7dGhpcy5nbFBvaW50cz1uZXcgRmxvYXQzMkFycmF5KHRoaXMucG9pbnRzKSxhLmJpbmRCdWZmZXIoYS5BUlJBWV9CVUZGRVIsdGhpcy5idWZmZXIpLGEuYnVmZmVyRGF0YShhLkFSUkFZX0JVRkZFUix0aGlzLmdsUG9pbnRzLGEuU1RBVElDX0RSQVcpLHRoaXMuZ2xJbmRpY2llcz1uZXcgVWludDE2QXJyYXkodGhpcy5pbmRpY2VzKSxhLmJpbmRCdWZmZXIoYS5FTEVNRU5UX0FSUkFZX0JVRkZFUix0aGlzLmluZGV4QnVmZmVyKSxhLmJ1ZmZlckRhdGEoYS5FTEVNRU5UX0FSUkFZX0JVRkZFUix0aGlzLmdsSW5kaWNpZXMsYS5TVEFUSUNfRFJBVyksdGhpcy5kaXJ0eT0hMX0sYi5nbENvbnRleHRzPVtdLGIuV2ViR0xSZW5kZXJlcj1mdW5jdGlvbihhLGMsZCxlLGYsZyl7Yi5kZWZhdWx0UmVuZGVyZXJ8fChiLnNheUhlbGxvKFwid2ViR0xcIiksYi5kZWZhdWx0UmVuZGVyZXI9dGhpcyksdGhpcy50eXBlPWIuV0VCR0xfUkVOREVSRVIsdGhpcy50cmFuc3BhcmVudD0hIWUsdGhpcy5wcmVzZXJ2ZURyYXdpbmdCdWZmZXI9Zyx0aGlzLndpZHRoPWF8fDgwMCx0aGlzLmhlaWdodD1jfHw2MDAsdGhpcy52aWV3PWR8fGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIiksdGhpcy52aWV3LndpZHRoPXRoaXMud2lkdGgsdGhpcy52aWV3LmhlaWdodD10aGlzLmhlaWdodCx0aGlzLmNvbnRleHRMb3N0PXRoaXMuaGFuZGxlQ29udGV4dExvc3QuYmluZCh0aGlzKSx0aGlzLmNvbnRleHRSZXN0b3JlZExvc3Q9dGhpcy5oYW5kbGVDb250ZXh0UmVzdG9yZWQuYmluZCh0aGlzKSx0aGlzLnZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmdsY29udGV4dGxvc3RcIix0aGlzLmNvbnRleHRMb3N0LCExKSx0aGlzLnZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmdsY29udGV4dHJlc3RvcmVkXCIsdGhpcy5jb250ZXh0UmVzdG9yZWRMb3N0LCExKSx0aGlzLm9wdGlvbnM9e2FscGhhOnRoaXMudHJhbnNwYXJlbnQsYW50aWFsaWFzOiEhZixwcmVtdWx0aXBsaWVkQWxwaGE6ISFlLHN0ZW5jaWw6ITAscHJlc2VydmVEcmF3aW5nQnVmZmVyOmd9O3ZhciBoPW51bGw7aWYoW1wiZXhwZXJpbWVudGFsLXdlYmdsXCIsXCJ3ZWJnbFwiXS5mb3JFYWNoKGZ1bmN0aW9uKGEpe3RyeXtoPWh8fHRoaXMudmlldy5nZXRDb250ZXh0KGEsdGhpcy5vcHRpb25zKX1jYXRjaChiKXt9fSx0aGlzKSwhaCl0aHJvdyBuZXcgRXJyb3IoXCJUaGlzIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCB3ZWJHTC4gVHJ5IHVzaW5nIHRoZSBjYW52YXMgcmVuZGVyZXJcIit0aGlzKTt0aGlzLmdsPWgsdGhpcy5nbENvbnRleHRJZD1oLmlkPWIuV2ViR0xSZW5kZXJlci5nbENvbnRleHRJZCsrLGIuZ2xDb250ZXh0c1t0aGlzLmdsQ29udGV4dElkXT1oLGIuYmxlbmRNb2Rlc1dlYkdMfHwoYi5ibGVuZE1vZGVzV2ViR0w9W10sYi5ibGVuZE1vZGVzV2ViR0xbYi5ibGVuZE1vZGVzLk5PUk1BTF09W2guT05FLGguT05FX01JTlVTX1NSQ19BTFBIQV0sYi5ibGVuZE1vZGVzV2ViR0xbYi5ibGVuZE1vZGVzLkFERF09W2guU1JDX0FMUEhBLGguRFNUX0FMUEhBXSxiLmJsZW5kTW9kZXNXZWJHTFtiLmJsZW5kTW9kZXMuTVVMVElQTFldPVtoLkRTVF9DT0xPUixoLk9ORV9NSU5VU19TUkNfQUxQSEFdLGIuYmxlbmRNb2Rlc1dlYkdMW2IuYmxlbmRNb2Rlcy5TQ1JFRU5dPVtoLlNSQ19BTFBIQSxoLk9ORV0sYi5ibGVuZE1vZGVzV2ViR0xbYi5ibGVuZE1vZGVzLk9WRVJMQVldPVtoLk9ORSxoLk9ORV9NSU5VU19TUkNfQUxQSEFdLGIuYmxlbmRNb2Rlc1dlYkdMW2IuYmxlbmRNb2Rlcy5EQVJLRU5dPVtoLk9ORSxoLk9ORV9NSU5VU19TUkNfQUxQSEFdLGIuYmxlbmRNb2Rlc1dlYkdMW2IuYmxlbmRNb2Rlcy5MSUdIVEVOXT1baC5PTkUsaC5PTkVfTUlOVVNfU1JDX0FMUEhBXSxiLmJsZW5kTW9kZXNXZWJHTFtiLmJsZW5kTW9kZXMuQ09MT1JfRE9ER0VdPVtoLk9ORSxoLk9ORV9NSU5VU19TUkNfQUxQSEFdLGIuYmxlbmRNb2Rlc1dlYkdMW2IuYmxlbmRNb2Rlcy5DT0xPUl9CVVJOXT1baC5PTkUsaC5PTkVfTUlOVVNfU1JDX0FMUEhBXSxiLmJsZW5kTW9kZXNXZWJHTFtiLmJsZW5kTW9kZXMuSEFSRF9MSUdIVF09W2guT05FLGguT05FX01JTlVTX1NSQ19BTFBIQV0sYi5ibGVuZE1vZGVzV2ViR0xbYi5ibGVuZE1vZGVzLlNPRlRfTElHSFRdPVtoLk9ORSxoLk9ORV9NSU5VU19TUkNfQUxQSEFdLGIuYmxlbmRNb2Rlc1dlYkdMW2IuYmxlbmRNb2Rlcy5ESUZGRVJFTkNFXT1baC5PTkUsaC5PTkVfTUlOVVNfU1JDX0FMUEhBXSxiLmJsZW5kTW9kZXNXZWJHTFtiLmJsZW5kTW9kZXMuRVhDTFVTSU9OXT1baC5PTkUsaC5PTkVfTUlOVVNfU1JDX0FMUEhBXSxiLmJsZW5kTW9kZXNXZWJHTFtiLmJsZW5kTW9kZXMuSFVFXT1baC5PTkUsaC5PTkVfTUlOVVNfU1JDX0FMUEhBXSxiLmJsZW5kTW9kZXNXZWJHTFtiLmJsZW5kTW9kZXMuU0FUVVJBVElPTl09W2guT05FLGguT05FX01JTlVTX1NSQ19BTFBIQV0sYi5ibGVuZE1vZGVzV2ViR0xbYi5ibGVuZE1vZGVzLkNPTE9SXT1baC5PTkUsaC5PTkVfTUlOVVNfU1JDX0FMUEhBXSxiLmJsZW5kTW9kZXNXZWJHTFtiLmJsZW5kTW9kZXMuTFVNSU5PU0lUWV09W2guT05FLGguT05FX01JTlVTX1NSQ19BTFBIQV0pLHRoaXMucHJvamVjdGlvbj1uZXcgYi5Qb2ludCx0aGlzLnByb2plY3Rpb24ueD10aGlzLndpZHRoLzIsdGhpcy5wcm9qZWN0aW9uLnk9LXRoaXMuaGVpZ2h0LzIsdGhpcy5vZmZzZXQ9bmV3IGIuUG9pbnQoMCwwKSx0aGlzLnJlc2l6ZSh0aGlzLndpZHRoLHRoaXMuaGVpZ2h0KSx0aGlzLmNvbnRleHRMb3N0PSExLHRoaXMuc2hhZGVyTWFuYWdlcj1uZXcgYi5XZWJHTFNoYWRlck1hbmFnZXIoaCksdGhpcy5zcHJpdGVCYXRjaD1uZXcgYi5XZWJHTFNwcml0ZUJhdGNoKGgpLHRoaXMubWFza01hbmFnZXI9bmV3IGIuV2ViR0xNYXNrTWFuYWdlcihoKSx0aGlzLmZpbHRlck1hbmFnZXI9bmV3IGIuV2ViR0xGaWx0ZXJNYW5hZ2VyKGgsdGhpcy50cmFuc3BhcmVudCksdGhpcy5zdGVuY2lsTWFuYWdlcj1uZXcgYi5XZWJHTFN0ZW5jaWxNYW5hZ2VyKGgpLHRoaXMuYmxlbmRNb2RlTWFuYWdlcj1uZXcgYi5XZWJHTEJsZW5kTW9kZU1hbmFnZXIoaCksdGhpcy5yZW5kZXJTZXNzaW9uPXt9LHRoaXMucmVuZGVyU2Vzc2lvbi5nbD10aGlzLmdsLHRoaXMucmVuZGVyU2Vzc2lvbi5kcmF3Q291bnQ9MCx0aGlzLnJlbmRlclNlc3Npb24uc2hhZGVyTWFuYWdlcj10aGlzLnNoYWRlck1hbmFnZXIsdGhpcy5yZW5kZXJTZXNzaW9uLm1hc2tNYW5hZ2VyPXRoaXMubWFza01hbmFnZXIsdGhpcy5yZW5kZXJTZXNzaW9uLmZpbHRlck1hbmFnZXI9dGhpcy5maWx0ZXJNYW5hZ2VyLHRoaXMucmVuZGVyU2Vzc2lvbi5ibGVuZE1vZGVNYW5hZ2VyPXRoaXMuYmxlbmRNb2RlTWFuYWdlcix0aGlzLnJlbmRlclNlc3Npb24uc3ByaXRlQmF0Y2g9dGhpcy5zcHJpdGVCYXRjaCx0aGlzLnJlbmRlclNlc3Npb24uc3RlbmNpbE1hbmFnZXI9dGhpcy5zdGVuY2lsTWFuYWdlcix0aGlzLnJlbmRlclNlc3Npb24ucmVuZGVyZXI9dGhpcyxoLnVzZVByb2dyYW0odGhpcy5zaGFkZXJNYW5hZ2VyLmRlZmF1bHRTaGFkZXIucHJvZ3JhbSksaC5kaXNhYmxlKGguREVQVEhfVEVTVCksaC5kaXNhYmxlKGguQ1VMTF9GQUNFKSxoLmVuYWJsZShoLkJMRU5EKSxoLmNvbG9yTWFzayghMCwhMCwhMCx0aGlzLnRyYW5zcGFyZW50KX0sYi5XZWJHTFJlbmRlcmVyLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLldlYkdMUmVuZGVyZXIsYi5XZWJHTFJlbmRlcmVyLnByb3RvdHlwZS5yZW5kZXI9ZnVuY3Rpb24oYSl7aWYoIXRoaXMuY29udGV4dExvc3Qpe3RoaXMuX19zdGFnZSE9PWEmJihhLmludGVyYWN0aXZlJiZhLmludGVyYWN0aW9uTWFuYWdlci5yZW1vdmVFdmVudHMoKSx0aGlzLl9fc3RhZ2U9YSksYi5XZWJHTFJlbmRlcmVyLnVwZGF0ZVRleHR1cmVzKCksYS51cGRhdGVUcmFuc2Zvcm0oKSxhLl9pbnRlcmFjdGl2ZSYmKGEuX2ludGVyYWN0aXZlRXZlbnRzQWRkZWR8fChhLl9pbnRlcmFjdGl2ZUV2ZW50c0FkZGVkPSEwLGEuaW50ZXJhY3Rpb25NYW5hZ2VyLnNldFRhcmdldCh0aGlzKSkpO3ZhciBjPXRoaXMuZ2w7Yy52aWV3cG9ydCgwLDAsdGhpcy53aWR0aCx0aGlzLmhlaWdodCksYy5iaW5kRnJhbWVidWZmZXIoYy5GUkFNRUJVRkZFUixudWxsKSx0aGlzLnRyYW5zcGFyZW50P2MuY2xlYXJDb2xvcigwLDAsMCwwKTpjLmNsZWFyQ29sb3IoYS5iYWNrZ3JvdW5kQ29sb3JTcGxpdFswXSxhLmJhY2tncm91bmRDb2xvclNwbGl0WzFdLGEuYmFja2dyb3VuZENvbG9yU3BsaXRbMl0sMSksYy5jbGVhcihjLkNPTE9SX0JVRkZFUl9CSVQpLHRoaXMucmVuZGVyRGlzcGxheU9iamVjdChhLHRoaXMucHJvamVjdGlvbiksYS5pbnRlcmFjdGl2ZT9hLl9pbnRlcmFjdGl2ZUV2ZW50c0FkZGVkfHwoYS5faW50ZXJhY3RpdmVFdmVudHNBZGRlZD0hMCxhLmludGVyYWN0aW9uTWFuYWdlci5zZXRUYXJnZXQodGhpcykpOmEuX2ludGVyYWN0aXZlRXZlbnRzQWRkZWQmJihhLl9pbnRlcmFjdGl2ZUV2ZW50c0FkZGVkPSExLGEuaW50ZXJhY3Rpb25NYW5hZ2VyLnNldFRhcmdldCh0aGlzKSl9fSxiLldlYkdMUmVuZGVyZXIucHJvdG90eXBlLnJlbmRlckRpc3BsYXlPYmplY3Q9ZnVuY3Rpb24oYSxjLGQpe3RoaXMucmVuZGVyU2Vzc2lvbi5ibGVuZE1vZGVNYW5hZ2VyLnNldEJsZW5kTW9kZShiLmJsZW5kTW9kZXMuTk9STUFMKSx0aGlzLnJlbmRlclNlc3Npb24uZHJhd0NvdW50PTAsdGhpcy5yZW5kZXJTZXNzaW9uLmN1cnJlbnRCbGVuZE1vZGU9OTk5OSx0aGlzLnJlbmRlclNlc3Npb24ucHJvamVjdGlvbj1jLHRoaXMucmVuZGVyU2Vzc2lvbi5vZmZzZXQ9dGhpcy5vZmZzZXQsdGhpcy5zcHJpdGVCYXRjaC5iZWdpbih0aGlzLnJlbmRlclNlc3Npb24pLHRoaXMuZmlsdGVyTWFuYWdlci5iZWdpbih0aGlzLnJlbmRlclNlc3Npb24sZCksYS5fcmVuZGVyV2ViR0wodGhpcy5yZW5kZXJTZXNzaW9uKSx0aGlzLnNwcml0ZUJhdGNoLmVuZCgpfSxiLldlYkdMUmVuZGVyZXIudXBkYXRlVGV4dHVyZXM9ZnVuY3Rpb24oKXt2YXIgYT0wO2ZvcihhPTA7YTxiLlRleHR1cmUuZnJhbWVVcGRhdGVzLmxlbmd0aDthKyspYi5XZWJHTFJlbmRlcmVyLnVwZGF0ZVRleHR1cmVGcmFtZShiLlRleHR1cmUuZnJhbWVVcGRhdGVzW2FdKTtmb3IoYT0wO2E8Yi50ZXh0dXJlc1RvRGVzdHJveS5sZW5ndGg7YSsrKWIuV2ViR0xSZW5kZXJlci5kZXN0cm95VGV4dHVyZShiLnRleHR1cmVzVG9EZXN0cm95W2FdKTtiLnRleHR1cmVzVG9VcGRhdGUubGVuZ3RoPTAsYi50ZXh0dXJlc1RvRGVzdHJveS5sZW5ndGg9MCxiLlRleHR1cmUuZnJhbWVVcGRhdGVzLmxlbmd0aD0wfSxiLldlYkdMUmVuZGVyZXIuZGVzdHJveVRleHR1cmU9ZnVuY3Rpb24oYSl7Zm9yKHZhciBjPWEuX2dsVGV4dHVyZXMubGVuZ3RoLTE7Yz49MDtjLS0pe3ZhciBkPWEuX2dsVGV4dHVyZXNbY10sZT1iLmdsQ29udGV4dHNbY107XG5lJiZkJiZlLmRlbGV0ZVRleHR1cmUoZCl9YS5fZ2xUZXh0dXJlcy5sZW5ndGg9MH0sYi5XZWJHTFJlbmRlcmVyLnVwZGF0ZVRleHR1cmVGcmFtZT1mdW5jdGlvbihhKXthLl91cGRhdGVXZWJHTHV2cygpfSxiLldlYkdMUmVuZGVyZXIucHJvdG90eXBlLnJlc2l6ZT1mdW5jdGlvbihhLGIpe3RoaXMud2lkdGg9YSx0aGlzLmhlaWdodD1iLHRoaXMudmlldy53aWR0aD1hLHRoaXMudmlldy5oZWlnaHQ9Yix0aGlzLmdsLnZpZXdwb3J0KDAsMCx0aGlzLndpZHRoLHRoaXMuaGVpZ2h0KSx0aGlzLnByb2plY3Rpb24ueD10aGlzLndpZHRoLzIsdGhpcy5wcm9qZWN0aW9uLnk9LXRoaXMuaGVpZ2h0LzJ9LGIuY3JlYXRlV2ViR0xUZXh0dXJlPWZ1bmN0aW9uKGEsYyl7cmV0dXJuIGEuaGFzTG9hZGVkJiYoYS5fZ2xUZXh0dXJlc1tjLmlkXT1jLmNyZWF0ZVRleHR1cmUoKSxjLmJpbmRUZXh0dXJlKGMuVEVYVFVSRV8yRCxhLl9nbFRleHR1cmVzW2MuaWRdKSxjLnBpeGVsU3RvcmVpKGMuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMLGEucHJlbXVsdGlwbGllZEFscGhhKSxjLnRleEltYWdlMkQoYy5URVhUVVJFXzJELDAsYy5SR0JBLGMuUkdCQSxjLlVOU0lHTkVEX0JZVEUsYS5zb3VyY2UpLGMudGV4UGFyYW1ldGVyaShjLlRFWFRVUkVfMkQsYy5URVhUVVJFX01BR19GSUxURVIsYS5zY2FsZU1vZGU9PT1iLnNjYWxlTW9kZXMuTElORUFSP2MuTElORUFSOmMuTkVBUkVTVCksYy50ZXhQYXJhbWV0ZXJpKGMuVEVYVFVSRV8yRCxjLlRFWFRVUkVfTUlOX0ZJTFRFUixhLnNjYWxlTW9kZT09PWIuc2NhbGVNb2Rlcy5MSU5FQVI/Yy5MSU5FQVI6Yy5ORUFSRVNUKSxhLl9wb3dlck9mMj8oYy50ZXhQYXJhbWV0ZXJpKGMuVEVYVFVSRV8yRCxjLlRFWFRVUkVfV1JBUF9TLGMuUkVQRUFUKSxjLnRleFBhcmFtZXRlcmkoYy5URVhUVVJFXzJELGMuVEVYVFVSRV9XUkFQX1QsYy5SRVBFQVQpKTooYy50ZXhQYXJhbWV0ZXJpKGMuVEVYVFVSRV8yRCxjLlRFWFRVUkVfV1JBUF9TLGMuQ0xBTVBfVE9fRURHRSksYy50ZXhQYXJhbWV0ZXJpKGMuVEVYVFVSRV8yRCxjLlRFWFRVUkVfV1JBUF9ULGMuQ0xBTVBfVE9fRURHRSkpLGMuYmluZFRleHR1cmUoYy5URVhUVVJFXzJELG51bGwpLGEuX2RpcnR5W2MuaWRdPSExKSxhLl9nbFRleHR1cmVzW2MuaWRdfSxiLnVwZGF0ZVdlYkdMVGV4dHVyZT1mdW5jdGlvbihhLGMpe2EuX2dsVGV4dHVyZXNbYy5pZF0mJihjLmJpbmRUZXh0dXJlKGMuVEVYVFVSRV8yRCxhLl9nbFRleHR1cmVzW2MuaWRdKSxjLnBpeGVsU3RvcmVpKGMuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMLGEucHJlbXVsdGlwbGllZEFscGhhKSxjLnRleEltYWdlMkQoYy5URVhUVVJFXzJELDAsYy5SR0JBLGMuUkdCQSxjLlVOU0lHTkVEX0JZVEUsYS5zb3VyY2UpLGMudGV4UGFyYW1ldGVyaShjLlRFWFRVUkVfMkQsYy5URVhUVVJFX01BR19GSUxURVIsYS5zY2FsZU1vZGU9PT1iLnNjYWxlTW9kZXMuTElORUFSP2MuTElORUFSOmMuTkVBUkVTVCksYy50ZXhQYXJhbWV0ZXJpKGMuVEVYVFVSRV8yRCxjLlRFWFRVUkVfTUlOX0ZJTFRFUixhLnNjYWxlTW9kZT09PWIuc2NhbGVNb2Rlcy5MSU5FQVI/Yy5MSU5FQVI6Yy5ORUFSRVNUKSxhLl9wb3dlck9mMj8oYy50ZXhQYXJhbWV0ZXJpKGMuVEVYVFVSRV8yRCxjLlRFWFRVUkVfV1JBUF9TLGMuUkVQRUFUKSxjLnRleFBhcmFtZXRlcmkoYy5URVhUVVJFXzJELGMuVEVYVFVSRV9XUkFQX1QsYy5SRVBFQVQpKTooYy50ZXhQYXJhbWV0ZXJpKGMuVEVYVFVSRV8yRCxjLlRFWFRVUkVfV1JBUF9TLGMuQ0xBTVBfVE9fRURHRSksYy50ZXhQYXJhbWV0ZXJpKGMuVEVYVFVSRV8yRCxjLlRFWFRVUkVfV1JBUF9ULGMuQ0xBTVBfVE9fRURHRSkpLGEuX2RpcnR5W2MuaWRdPSExKX0sYi5XZWJHTFJlbmRlcmVyLnByb3RvdHlwZS5oYW5kbGVDb250ZXh0TG9zdD1mdW5jdGlvbihhKXthLnByZXZlbnREZWZhdWx0KCksdGhpcy5jb250ZXh0TG9zdD0hMH0sYi5XZWJHTFJlbmRlcmVyLnByb3RvdHlwZS5oYW5kbGVDb250ZXh0UmVzdG9yZWQ9ZnVuY3Rpb24oKXt0cnl7dGhpcy5nbD10aGlzLnZpZXcuZ2V0Q29udGV4dChcImV4cGVyaW1lbnRhbC13ZWJnbFwiLHRoaXMub3B0aW9ucyl9Y2F0Y2goYSl7dHJ5e3RoaXMuZ2w9dGhpcy52aWV3LmdldENvbnRleHQoXCJ3ZWJnbFwiLHRoaXMub3B0aW9ucyl9Y2F0Y2goYyl7dGhyb3cgbmV3IEVycm9yKFwiIFRoaXMgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHdlYkdMLiBUcnkgdXNpbmcgdGhlIGNhbnZhcyByZW5kZXJlclwiK3RoaXMpfX12YXIgZD10aGlzLmdsO2QuaWQ9Yi5XZWJHTFJlbmRlcmVyLmdsQ29udGV4dElkKyssdGhpcy5zaGFkZXJNYW5hZ2VyLnNldENvbnRleHQoZCksdGhpcy5zcHJpdGVCYXRjaC5zZXRDb250ZXh0KGQpLHRoaXMucHJpbWl0aXZlQmF0Y2guc2V0Q29udGV4dChkKSx0aGlzLm1hc2tNYW5hZ2VyLnNldENvbnRleHQoZCksdGhpcy5maWx0ZXJNYW5hZ2VyLnNldENvbnRleHQoZCksdGhpcy5yZW5kZXJTZXNzaW9uLmdsPXRoaXMuZ2wsZC5kaXNhYmxlKGQuREVQVEhfVEVTVCksZC5kaXNhYmxlKGQuQ1VMTF9GQUNFKSxkLmVuYWJsZShkLkJMRU5EKSxkLmNvbG9yTWFzayghMCwhMCwhMCx0aGlzLnRyYW5zcGFyZW50KSx0aGlzLmdsLnZpZXdwb3J0KDAsMCx0aGlzLndpZHRoLHRoaXMuaGVpZ2h0KTtmb3IodmFyIGUgaW4gYi5UZXh0dXJlQ2FjaGUpe3ZhciBmPWIuVGV4dHVyZUNhY2hlW2VdLmJhc2VUZXh0dXJlO2YuX2dsVGV4dHVyZXM9W119dGhpcy5jb250ZXh0TG9zdD0hMX0sYi5XZWJHTFJlbmRlcmVyLnByb3RvdHlwZS5kZXN0cm95PWZ1bmN0aW9uKCl7dGhpcy52aWV3LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRsb3N0XCIsdGhpcy5jb250ZXh0TG9zdCksdGhpcy52aWV3LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRyZXN0b3JlZFwiLHRoaXMuY29udGV4dFJlc3RvcmVkTG9zdCksYi5nbENvbnRleHRzW3RoaXMuZ2xDb250ZXh0SWRdPW51bGwsdGhpcy5wcm9qZWN0aW9uPW51bGwsdGhpcy5vZmZzZXQ9bnVsbCx0aGlzLnNoYWRlck1hbmFnZXIuZGVzdHJveSgpLHRoaXMuc3ByaXRlQmF0Y2guZGVzdHJveSgpLHRoaXMucHJpbWl0aXZlQmF0Y2guZGVzdHJveSgpLHRoaXMubWFza01hbmFnZXIuZGVzdHJveSgpLHRoaXMuZmlsdGVyTWFuYWdlci5kZXN0cm95KCksdGhpcy5zaGFkZXJNYW5hZ2VyPW51bGwsdGhpcy5zcHJpdGVCYXRjaD1udWxsLHRoaXMubWFza01hbmFnZXI9bnVsbCx0aGlzLmZpbHRlck1hbmFnZXI9bnVsbCx0aGlzLmdsPW51bGwsdGhpcy5yZW5kZXJTZXNzaW9uPW51bGx9LGIuV2ViR0xSZW5kZXJlci5nbENvbnRleHRJZD0wLGIuV2ViR0xCbGVuZE1vZGVNYW5hZ2VyPWZ1bmN0aW9uKGEpe3RoaXMuZ2w9YSx0aGlzLmN1cnJlbnRCbGVuZE1vZGU9OTk5OTl9LGIuV2ViR0xCbGVuZE1vZGVNYW5hZ2VyLnByb3RvdHlwZS5zZXRCbGVuZE1vZGU9ZnVuY3Rpb24oYSl7aWYodGhpcy5jdXJyZW50QmxlbmRNb2RlPT09YSlyZXR1cm4hMTt0aGlzLmN1cnJlbnRCbGVuZE1vZGU9YTt2YXIgYz1iLmJsZW5kTW9kZXNXZWJHTFt0aGlzLmN1cnJlbnRCbGVuZE1vZGVdO3JldHVybiB0aGlzLmdsLmJsZW5kRnVuYyhjWzBdLGNbMV0pLCEwfSxiLldlYkdMQmxlbmRNb2RlTWFuYWdlci5wcm90b3R5cGUuZGVzdHJveT1mdW5jdGlvbigpe3RoaXMuZ2w9bnVsbH0sYi5XZWJHTE1hc2tNYW5hZ2VyPWZ1bmN0aW9uKGEpe3RoaXMubWFza1N0YWNrPVtdLHRoaXMubWFza1Bvc2l0aW9uPTAsdGhpcy5zZXRDb250ZXh0KGEpLHRoaXMucmV2ZXJzZT0hMSx0aGlzLmNvdW50PTB9LGIuV2ViR0xNYXNrTWFuYWdlci5wcm90b3R5cGUuc2V0Q29udGV4dD1mdW5jdGlvbihhKXt0aGlzLmdsPWF9LGIuV2ViR0xNYXNrTWFuYWdlci5wcm90b3R5cGUucHVzaE1hc2s9ZnVuY3Rpb24oYSxjKXt2YXIgZD1jLmdsO2EuZGlydHkmJmIuV2ViR0xHcmFwaGljcy51cGRhdGVHcmFwaGljcyhhLGQpLGEuX3dlYkdMW2QuaWRdLmRhdGEubGVuZ3RoJiZjLnN0ZW5jaWxNYW5hZ2VyLnB1c2hTdGVuY2lsKGEsYS5fd2ViR0xbZC5pZF0uZGF0YVswXSxjKX0sYi5XZWJHTE1hc2tNYW5hZ2VyLnByb3RvdHlwZS5wb3BNYXNrPWZ1bmN0aW9uKGEsYil7dmFyIGM9dGhpcy5nbDtiLnN0ZW5jaWxNYW5hZ2VyLnBvcFN0ZW5jaWwoYSxhLl93ZWJHTFtjLmlkXS5kYXRhWzBdLGIpfSxiLldlYkdMTWFza01hbmFnZXIucHJvdG90eXBlLmRlc3Ryb3k9ZnVuY3Rpb24oKXt0aGlzLm1hc2tTdGFjaz1udWxsLHRoaXMuZ2w9bnVsbH0sYi5XZWJHTFN0ZW5jaWxNYW5hZ2VyPWZ1bmN0aW9uKGEpe3RoaXMuc3RlbmNpbFN0YWNrPVtdLHRoaXMuc2V0Q29udGV4dChhKSx0aGlzLnJldmVyc2U9ITAsdGhpcy5jb3VudD0wfSxiLldlYkdMU3RlbmNpbE1hbmFnZXIucHJvdG90eXBlLnNldENvbnRleHQ9ZnVuY3Rpb24oYSl7dGhpcy5nbD1hfSxiLldlYkdMU3RlbmNpbE1hbmFnZXIucHJvdG90eXBlLnB1c2hTdGVuY2lsPWZ1bmN0aW9uKGEsYixjKXt2YXIgZD10aGlzLmdsO3RoaXMuYmluZEdyYXBoaWNzKGEsYixjKSwwPT09dGhpcy5zdGVuY2lsU3RhY2subGVuZ3RoJiYoZC5lbmFibGUoZC5TVEVOQ0lMX1RFU1QpLGQuY2xlYXIoZC5TVEVOQ0lMX0JVRkZFUl9CSVQpLHRoaXMucmV2ZXJzZT0hMCx0aGlzLmNvdW50PTApLHRoaXMuc3RlbmNpbFN0YWNrLnB1c2goYik7dmFyIGU9dGhpcy5jb3VudDtkLmNvbG9yTWFzayghMSwhMSwhMSwhMSksZC5zdGVuY2lsRnVuYyhkLkFMV0FZUywwLDI1NSksZC5zdGVuY2lsT3AoZC5LRUVQLGQuS0VFUCxkLklOVkVSVCksMT09PWIubW9kZT8oZC5kcmF3RWxlbWVudHMoZC5UUklBTkdMRV9GQU4sYi5pbmRpY2VzLmxlbmd0aC00LGQuVU5TSUdORURfU0hPUlQsMCksdGhpcy5yZXZlcnNlPyhkLnN0ZW5jaWxGdW5jKGQuRVFVQUwsMjU1LWUsMjU1KSxkLnN0ZW5jaWxPcChkLktFRVAsZC5LRUVQLGQuREVDUikpOihkLnN0ZW5jaWxGdW5jKGQuRVFVQUwsZSwyNTUpLGQuc3RlbmNpbE9wKGQuS0VFUCxkLktFRVAsZC5JTkNSKSksZC5kcmF3RWxlbWVudHMoZC5UUklBTkdMRV9GQU4sNCxkLlVOU0lHTkVEX1NIT1JULDIqKGIuaW5kaWNlcy5sZW5ndGgtNCkpLHRoaXMucmV2ZXJzZT9kLnN0ZW5jaWxGdW5jKGQuRVFVQUwsMjU1LShlKzEpLDI1NSk6ZC5zdGVuY2lsRnVuYyhkLkVRVUFMLGUrMSwyNTUpLHRoaXMucmV2ZXJzZT0hdGhpcy5yZXZlcnNlKToodGhpcy5yZXZlcnNlPyhkLnN0ZW5jaWxGdW5jKGQuRVFVQUwsZSwyNTUpLGQuc3RlbmNpbE9wKGQuS0VFUCxkLktFRVAsZC5JTkNSKSk6KGQuc3RlbmNpbEZ1bmMoZC5FUVVBTCwyNTUtZSwyNTUpLGQuc3RlbmNpbE9wKGQuS0VFUCxkLktFRVAsZC5ERUNSKSksZC5kcmF3RWxlbWVudHMoZC5UUklBTkdMRV9TVFJJUCxiLmluZGljZXMubGVuZ3RoLGQuVU5TSUdORURfU0hPUlQsMCksdGhpcy5yZXZlcnNlP2Quc3RlbmNpbEZ1bmMoZC5FUVVBTCxlKzEsMjU1KTpkLnN0ZW5jaWxGdW5jKGQuRVFVQUwsMjU1LShlKzEpLDI1NSkpLGQuY29sb3JNYXNrKCEwLCEwLCEwLCEwKSxkLnN0ZW5jaWxPcChkLktFRVAsZC5LRUVQLGQuS0VFUCksdGhpcy5jb3VudCsrfSxiLldlYkdMU3RlbmNpbE1hbmFnZXIucHJvdG90eXBlLmJpbmRHcmFwaGljcz1mdW5jdGlvbihhLGMsZCl7dGhpcy5fY3VycmVudEdyYXBoaWNzPWE7dmFyIGUsZj10aGlzLmdsLGc9ZC5wcm9qZWN0aW9uLGg9ZC5vZmZzZXQ7MT09PWMubW9kZT8oZT1kLnNoYWRlck1hbmFnZXIuY29tcGxleFByaW1hdGl2ZVNoYWRlcixkLnNoYWRlck1hbmFnZXIuc2V0U2hhZGVyKGUpLGYudW5pZm9ybU1hdHJpeDNmdihlLnRyYW5zbGF0aW9uTWF0cml4LCExLGEud29ybGRUcmFuc2Zvcm0udG9BcnJheSghMCkpLGYudW5pZm9ybTJmKGUucHJvamVjdGlvblZlY3RvcixnLngsLWcueSksZi51bmlmb3JtMmYoZS5vZmZzZXRWZWN0b3IsLWgueCwtaC55KSxmLnVuaWZvcm0zZnYoZS50aW50Q29sb3IsYi5oZXgycmdiKGEudGludCkpLGYudW5pZm9ybTNmdihlLmNvbG9yLGMuY29sb3IpLGYudW5pZm9ybTFmKGUuYWxwaGEsYS53b3JsZEFscGhhKmMuYWxwaGEpLGYuYmluZEJ1ZmZlcihmLkFSUkFZX0JVRkZFUixjLmJ1ZmZlciksZi52ZXJ0ZXhBdHRyaWJQb2ludGVyKGUuYVZlcnRleFBvc2l0aW9uLDIsZi5GTE9BVCwhMSw4LDApLGYuYmluZEJ1ZmZlcihmLkVMRU1FTlRfQVJSQVlfQlVGRkVSLGMuaW5kZXhCdWZmZXIpKTooZT1kLnNoYWRlck1hbmFnZXIucHJpbWl0aXZlU2hhZGVyLGQuc2hhZGVyTWFuYWdlci5zZXRTaGFkZXIoZSksZi51bmlmb3JtTWF0cml4M2Z2KGUudHJhbnNsYXRpb25NYXRyaXgsITEsYS53b3JsZFRyYW5zZm9ybS50b0FycmF5KCEwKSksZi51bmlmb3JtMmYoZS5wcm9qZWN0aW9uVmVjdG9yLGcueCwtZy55KSxmLnVuaWZvcm0yZihlLm9mZnNldFZlY3RvciwtaC54LC1oLnkpLGYudW5pZm9ybTNmdihlLnRpbnRDb2xvcixiLmhleDJyZ2IoYS50aW50KSksZi51bmlmb3JtMWYoZS5hbHBoYSxhLndvcmxkQWxwaGEpLGYuYmluZEJ1ZmZlcihmLkFSUkFZX0JVRkZFUixjLmJ1ZmZlciksZi52ZXJ0ZXhBdHRyaWJQb2ludGVyKGUuYVZlcnRleFBvc2l0aW9uLDIsZi5GTE9BVCwhMSwyNCwwKSxmLnZlcnRleEF0dHJpYlBvaW50ZXIoZS5jb2xvckF0dHJpYnV0ZSw0LGYuRkxPQVQsITEsMjQsOCksZi5iaW5kQnVmZmVyKGYuRUxFTUVOVF9BUlJBWV9CVUZGRVIsYy5pbmRleEJ1ZmZlcikpfSxiLldlYkdMU3RlbmNpbE1hbmFnZXIucHJvdG90eXBlLnBvcFN0ZW5jaWw9ZnVuY3Rpb24oYSxiLGMpe3ZhciBkPXRoaXMuZ2w7aWYodGhpcy5zdGVuY2lsU3RhY2sucG9wKCksdGhpcy5jb3VudC0tLDA9PT10aGlzLnN0ZW5jaWxTdGFjay5sZW5ndGgpZC5kaXNhYmxlKGQuU1RFTkNJTF9URVNUKTtlbHNle3ZhciBlPXRoaXMuY291bnQ7dGhpcy5iaW5kR3JhcGhpY3MoYSxiLGMpLGQuY29sb3JNYXNrKCExLCExLCExLCExKSwxPT09Yi5tb2RlPyh0aGlzLnJldmVyc2U9IXRoaXMucmV2ZXJzZSx0aGlzLnJldmVyc2U/KGQuc3RlbmNpbEZ1bmMoZC5FUVVBTCwyNTUtKGUrMSksMjU1KSxkLnN0ZW5jaWxPcChkLktFRVAsZC5LRUVQLGQuSU5DUikpOihkLnN0ZW5jaWxGdW5jKGQuRVFVQUwsZSsxLDI1NSksZC5zdGVuY2lsT3AoZC5LRUVQLGQuS0VFUCxkLkRFQ1IpKSxkLmRyYXdFbGVtZW50cyhkLlRSSUFOR0xFX0ZBTiw0LGQuVU5TSUdORURfU0hPUlQsMiooYi5pbmRpY2VzLmxlbmd0aC00KSksZC5zdGVuY2lsRnVuYyhkLkFMV0FZUywwLDI1NSksZC5zdGVuY2lsT3AoZC5LRUVQLGQuS0VFUCxkLklOVkVSVCksZC5kcmF3RWxlbWVudHMoZC5UUklBTkdMRV9GQU4sYi5pbmRpY2VzLmxlbmd0aC00LGQuVU5TSUdORURfU0hPUlQsMCksdGhpcy5yZXZlcnNlP2Quc3RlbmNpbEZ1bmMoZC5FUVVBTCxlLDI1NSk6ZC5zdGVuY2lsRnVuYyhkLkVRVUFMLDI1NS1lLDI1NSkpOih0aGlzLnJldmVyc2U/KGQuc3RlbmNpbEZ1bmMoZC5FUVVBTCxlKzEsMjU1KSxkLnN0ZW5jaWxPcChkLktFRVAsZC5LRUVQLGQuREVDUikpOihkLnN0ZW5jaWxGdW5jKGQuRVFVQUwsMjU1LShlKzEpLDI1NSksZC5zdGVuY2lsT3AoZC5LRUVQLGQuS0VFUCxkLklOQ1IpKSxkLmRyYXdFbGVtZW50cyhkLlRSSUFOR0xFX1NUUklQLGIuaW5kaWNlcy5sZW5ndGgsZC5VTlNJR05FRF9TSE9SVCwwKSx0aGlzLnJldmVyc2U/ZC5zdGVuY2lsRnVuYyhkLkVRVUFMLGUsMjU1KTpkLnN0ZW5jaWxGdW5jKGQuRVFVQUwsMjU1LWUsMjU1KSksZC5jb2xvck1hc2soITAsITAsITAsITApLGQuc3RlbmNpbE9wKGQuS0VFUCxkLktFRVAsZC5LRUVQKX19LGIuV2ViR0xTdGVuY2lsTWFuYWdlci5wcm90b3R5cGUuZGVzdHJveT1mdW5jdGlvbigpe3RoaXMubWFza1N0YWNrPW51bGwsdGhpcy5nbD1udWxsfSxiLldlYkdMU2hhZGVyTWFuYWdlcj1mdW5jdGlvbihhKXt0aGlzLm1heEF0dGlicz0xMCx0aGlzLmF0dHJpYlN0YXRlPVtdLHRoaXMudGVtcEF0dHJpYlN0YXRlPVtdLHRoaXMuc2hhZGVyTWFwPVtdO2Zvcih2YXIgYj0wO2I8dGhpcy5tYXhBdHRpYnM7YisrKXRoaXMuYXR0cmliU3RhdGVbYl09ITE7dGhpcy5zZXRDb250ZXh0KGEpfSxiLldlYkdMU2hhZGVyTWFuYWdlci5wcm90b3R5cGUuc2V0Q29udGV4dD1mdW5jdGlvbihhKXt0aGlzLmdsPWEsdGhpcy5wcmltaXRpdmVTaGFkZXI9bmV3IGIuUHJpbWl0aXZlU2hhZGVyKGEpLHRoaXMuY29tcGxleFByaW1hdGl2ZVNoYWRlcj1uZXcgYi5Db21wbGV4UHJpbWl0aXZlU2hhZGVyKGEpLHRoaXMuZGVmYXVsdFNoYWRlcj1uZXcgYi5QaXhpU2hhZGVyKGEpLHRoaXMuZmFzdFNoYWRlcj1uZXcgYi5QaXhpRmFzdFNoYWRlcihhKSx0aGlzLnN0cmlwU2hhZGVyPW5ldyBiLlN0cmlwU2hhZGVyKGEpLHRoaXMuc2V0U2hhZGVyKHRoaXMuZGVmYXVsdFNoYWRlcil9LGIuV2ViR0xTaGFkZXJNYW5hZ2VyLnByb3RvdHlwZS5zZXRBdHRyaWJzPWZ1bmN0aW9uKGEpe3ZhciBiO2ZvcihiPTA7Yjx0aGlzLnRlbXBBdHRyaWJTdGF0ZS5sZW5ndGg7YisrKXRoaXMudGVtcEF0dHJpYlN0YXRlW2JdPSExO2ZvcihiPTA7YjxhLmxlbmd0aDtiKyspe3ZhciBjPWFbYl07dGhpcy50ZW1wQXR0cmliU3RhdGVbY109ITB9dmFyIGQ9dGhpcy5nbDtmb3IoYj0wO2I8dGhpcy5hdHRyaWJTdGF0ZS5sZW5ndGg7YisrKXRoaXMuYXR0cmliU3RhdGVbYl0hPT10aGlzLnRlbXBBdHRyaWJTdGF0ZVtiXSYmKHRoaXMuYXR0cmliU3RhdGVbYl09dGhpcy50ZW1wQXR0cmliU3RhdGVbYl0sdGhpcy50ZW1wQXR0cmliU3RhdGVbYl0/ZC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShiKTpkLmRpc2FibGVWZXJ0ZXhBdHRyaWJBcnJheShiKSl9LGIuV2ViR0xTaGFkZXJNYW5hZ2VyLnByb3RvdHlwZS5zZXRTaGFkZXI9ZnVuY3Rpb24oYSl7cmV0dXJuIHRoaXMuX2N1cnJlbnRJZD09PWEuX1VJRD8hMToodGhpcy5fY3VycmVudElkPWEuX1VJRCx0aGlzLmN1cnJlbnRTaGFkZXI9YSx0aGlzLmdsLnVzZVByb2dyYW0oYS5wcm9ncmFtKSx0aGlzLnNldEF0dHJpYnMoYS5hdHRyaWJ1dGVzKSwhMCl9LGIuV2ViR0xTaGFkZXJNYW5hZ2VyLnByb3RvdHlwZS5kZXN0cm95PWZ1bmN0aW9uKCl7dGhpcy5hdHRyaWJTdGF0ZT1udWxsLHRoaXMudGVtcEF0dHJpYlN0YXRlPW51bGwsdGhpcy5wcmltaXRpdmVTaGFkZXIuZGVzdHJveSgpLHRoaXMuZGVmYXVsdFNoYWRlci5kZXN0cm95KCksdGhpcy5mYXN0U2hhZGVyLmRlc3Ryb3koKSx0aGlzLnN0cmlwU2hhZGVyLmRlc3Ryb3koKSx0aGlzLmdsPW51bGx9LGIuV2ViR0xTcHJpdGVCYXRjaD1mdW5jdGlvbihhKXt0aGlzLnZlcnRTaXplPTYsdGhpcy5zaXplPTJlMzt2YXIgYj00KnRoaXMuc2l6ZSp0aGlzLnZlcnRTaXplLGM9Nip0aGlzLnNpemU7dGhpcy52ZXJ0aWNlcz1uZXcgRmxvYXQzMkFycmF5KGIpLHRoaXMuaW5kaWNlcz1uZXcgVWludDE2QXJyYXkoYyksdGhpcy5sYXN0SW5kZXhDb3VudD0wO2Zvcih2YXIgZD0wLGU9MDtjPmQ7ZCs9NixlKz00KXRoaXMuaW5kaWNlc1tkKzBdPWUrMCx0aGlzLmluZGljZXNbZCsxXT1lKzEsdGhpcy5pbmRpY2VzW2QrMl09ZSsyLHRoaXMuaW5kaWNlc1tkKzNdPWUrMCx0aGlzLmluZGljZXNbZCs0XT1lKzIsdGhpcy5pbmRpY2VzW2QrNV09ZSszO3RoaXMuZHJhd2luZz0hMSx0aGlzLmN1cnJlbnRCYXRjaFNpemU9MCx0aGlzLmN1cnJlbnRCYXNlVGV4dHVyZT1udWxsLHRoaXMuc2V0Q29udGV4dChhKSx0aGlzLmRpcnR5PSEwLHRoaXMudGV4dHVyZXM9W10sdGhpcy5ibGVuZE1vZGVzPVtdfSxiLldlYkdMU3ByaXRlQmF0Y2gucHJvdG90eXBlLnNldENvbnRleHQ9ZnVuY3Rpb24oYSl7dGhpcy5nbD1hLHRoaXMudmVydGV4QnVmZmVyPWEuY3JlYXRlQnVmZmVyKCksdGhpcy5pbmRleEJ1ZmZlcj1hLmNyZWF0ZUJ1ZmZlcigpLGEuYmluZEJ1ZmZlcihhLkVMRU1FTlRfQVJSQVlfQlVGRkVSLHRoaXMuaW5kZXhCdWZmZXIpLGEuYnVmZmVyRGF0YShhLkVMRU1FTlRfQVJSQVlfQlVGRkVSLHRoaXMuaW5kaWNlcyxhLlNUQVRJQ19EUkFXKSxhLmJpbmRCdWZmZXIoYS5BUlJBWV9CVUZGRVIsdGhpcy52ZXJ0ZXhCdWZmZXIpLGEuYnVmZmVyRGF0YShhLkFSUkFZX0JVRkZFUix0aGlzLnZlcnRpY2VzLGEuRFlOQU1JQ19EUkFXKSx0aGlzLmN1cnJlbnRCbGVuZE1vZGU9OTk5OTl9LGIuV2ViR0xTcHJpdGVCYXRjaC5wcm90b3R5cGUuYmVnaW49ZnVuY3Rpb24oYSl7dGhpcy5yZW5kZXJTZXNzaW9uPWEsdGhpcy5zaGFkZXI9dGhpcy5yZW5kZXJTZXNzaW9uLnNoYWRlck1hbmFnZXIuZGVmYXVsdFNoYWRlcix0aGlzLnN0YXJ0KCl9LGIuV2ViR0xTcHJpdGVCYXRjaC5wcm90b3R5cGUuZW5kPWZ1bmN0aW9uKCl7dGhpcy5mbHVzaCgpfSxiLldlYkdMU3ByaXRlQmF0Y2gucHJvdG90eXBlLnJlbmRlcj1mdW5jdGlvbihhKXt2YXIgYj1hLnRleHR1cmU7dGhpcy5jdXJyZW50QmF0Y2hTaXplPj10aGlzLnNpemUmJih0aGlzLmZsdXNoKCksdGhpcy5jdXJyZW50QmFzZVRleHR1cmU9Yi5iYXNlVGV4dHVyZSk7dmFyIGM9Yi5fdXZzO2lmKGMpe3ZhciBkLGUsZixnLGg9YS53b3JsZEFscGhhLGk9YS50aW50LGo9dGhpcy52ZXJ0aWNlcyxrPWEuYW5jaG9yLngsbD1hLmFuY2hvci55O2lmKGIudHJpbSl7dmFyIG09Yi50cmltO2U9bS54LWsqbS53aWR0aCxkPWUrYi5jcm9wLndpZHRoLGc9bS55LWwqbS5oZWlnaHQsZj1nK2IuY3JvcC5oZWlnaHR9ZWxzZSBkPWIuZnJhbWUud2lkdGgqKDEtayksZT1iLmZyYW1lLndpZHRoKi1rLGY9Yi5mcmFtZS5oZWlnaHQqKDEtbCksZz1iLmZyYW1lLmhlaWdodCotbDt2YXIgbj00KnRoaXMuY3VycmVudEJhdGNoU2l6ZSp0aGlzLnZlcnRTaXplLG89YS53b3JsZFRyYW5zZm9ybSxwPW8uYSxxPW8uYyxyPW8uYixzPW8uZCx0PW8udHgsdT1vLnR5O2pbbisrXT1wKmUrcipnK3QsaltuKytdPXMqZytxKmUrdSxqW24rK109Yy54MCxqW24rK109Yy55MCxqW24rK109aCxqW24rK109aSxqW24rK109cCpkK3IqZyt0LGpbbisrXT1zKmcrcSpkK3UsaltuKytdPWMueDEsaltuKytdPWMueTEsaltuKytdPWgsaltuKytdPWksaltuKytdPXAqZCtyKmYrdCxqW24rK109cypmK3EqZCt1LGpbbisrXT1jLngyLGpbbisrXT1jLnkyLGpbbisrXT1oLGpbbisrXT1pLGpbbisrXT1wKmUrcipmK3QsaltuKytdPXMqZitxKmUrdSxqW24rK109Yy54MyxqW24rK109Yy55MyxqW24rK109aCxqW24rK109aSx0aGlzLnRleHR1cmVzW3RoaXMuY3VycmVudEJhdGNoU2l6ZV09YS50ZXh0dXJlLmJhc2VUZXh0dXJlLHRoaXMuYmxlbmRNb2Rlc1t0aGlzLmN1cnJlbnRCYXRjaFNpemVdPWEuYmxlbmRNb2RlLHRoaXMuY3VycmVudEJhdGNoU2l6ZSsrfX0sYi5XZWJHTFNwcml0ZUJhdGNoLnByb3RvdHlwZS5yZW5kZXJUaWxpbmdTcHJpdGU9ZnVuY3Rpb24oYSl7dmFyIGM9YS50aWxpbmdUZXh0dXJlO3RoaXMuY3VycmVudEJhdGNoU2l6ZT49dGhpcy5zaXplJiYodGhpcy5mbHVzaCgpLHRoaXMuY3VycmVudEJhc2VUZXh0dXJlPWMuYmFzZVRleHR1cmUpLGEuX3V2c3x8KGEuX3V2cz1uZXcgYi5UZXh0dXJlVXZzKTt2YXIgZD1hLl91dnM7YS50aWxlUG9zaXRpb24ueCU9Yy5iYXNlVGV4dHVyZS53aWR0aCphLnRpbGVTY2FsZU9mZnNldC54LGEudGlsZVBvc2l0aW9uLnklPWMuYmFzZVRleHR1cmUuaGVpZ2h0KmEudGlsZVNjYWxlT2Zmc2V0Lnk7dmFyIGU9YS50aWxlUG9zaXRpb24ueC8oYy5iYXNlVGV4dHVyZS53aWR0aCphLnRpbGVTY2FsZU9mZnNldC54KSxmPWEudGlsZVBvc2l0aW9uLnkvKGMuYmFzZVRleHR1cmUuaGVpZ2h0KmEudGlsZVNjYWxlT2Zmc2V0LnkpLGc9YS53aWR0aC9jLmJhc2VUZXh0dXJlLndpZHRoLyhhLnRpbGVTY2FsZS54KmEudGlsZVNjYWxlT2Zmc2V0LngpLGg9YS5oZWlnaHQvYy5iYXNlVGV4dHVyZS5oZWlnaHQvKGEudGlsZVNjYWxlLnkqYS50aWxlU2NhbGVPZmZzZXQueSk7ZC54MD0wLWUsZC55MD0wLWYsZC54MT0xKmctZSxkLnkxPTAtZixkLngyPTEqZy1lLGQueTI9MSpoLWYsZC54Mz0wLWUsZC55Mz0xKmgtZjt2YXIgaT1hLndvcmxkQWxwaGEsaj1hLnRpbnQsaz10aGlzLnZlcnRpY2VzLGw9YS53aWR0aCxtPWEuaGVpZ2h0LG49YS5hbmNob3IueCxvPWEuYW5jaG9yLnkscD1sKigxLW4pLHE9bCotbixyPW0qKDEtbykscz1tKi1vLHQ9NCp0aGlzLmN1cnJlbnRCYXRjaFNpemUqdGhpcy52ZXJ0U2l6ZSx1PWEud29ybGRUcmFuc2Zvcm0sdj11LmEsdz11LmMseD11LmIseT11LmQsej11LnR4LEE9dS50eTtrW3QrK109dipxK3gqcyt6LGtbdCsrXT15KnMrdypxK0Esa1t0KytdPWQueDAsa1t0KytdPWQueTAsa1t0KytdPWksa1t0KytdPWosa1t0KytdPXYqcCt4KnMreixrW3QrK109eSpzK3cqcCtBLGtbdCsrXT1kLngxLGtbdCsrXT1kLnkxLGtbdCsrXT1pLGtbdCsrXT1qLGtbdCsrXT12KnAreCpyK3osa1t0KytdPXkqcit3KnArQSxrW3QrK109ZC54MixrW3QrK109ZC55MixrW3QrK109aSxrW3QrK109aixrW3QrK109dipxK3gqcit6LGtbdCsrXT15KnIrdypxK0Esa1t0KytdPWQueDMsa1t0KytdPWQueTMsa1t0KytdPWksa1t0KytdPWosdGhpcy50ZXh0dXJlc1t0aGlzLmN1cnJlbnRCYXRjaFNpemVdPWMuYmFzZVRleHR1cmUsdGhpcy5ibGVuZE1vZGVzW3RoaXMuY3VycmVudEJhdGNoU2l6ZV09YS5ibGVuZE1vZGUsdGhpcy5jdXJyZW50QmF0Y2hTaXplKyt9LGIuV2ViR0xTcHJpdGVCYXRjaC5wcm90b3R5cGUuZmx1c2g9ZnVuY3Rpb24oKXtpZigwIT09dGhpcy5jdXJyZW50QmF0Y2hTaXplKXt2YXIgYT10aGlzLmdsO2lmKHRoaXMucmVuZGVyU2Vzc2lvbi5zaGFkZXJNYW5hZ2VyLnNldFNoYWRlcih0aGlzLnJlbmRlclNlc3Npb24uc2hhZGVyTWFuYWdlci5kZWZhdWx0U2hhZGVyKSx0aGlzLmRpcnR5KXt0aGlzLmRpcnR5PSExLGEuYWN0aXZlVGV4dHVyZShhLlRFWFRVUkUwKSxhLmJpbmRCdWZmZXIoYS5BUlJBWV9CVUZGRVIsdGhpcy52ZXJ0ZXhCdWZmZXIpLGEuYmluZEJ1ZmZlcihhLkVMRU1FTlRfQVJSQVlfQlVGRkVSLHRoaXMuaW5kZXhCdWZmZXIpO3ZhciBiPXRoaXMucmVuZGVyU2Vzc2lvbi5wcm9qZWN0aW9uO2EudW5pZm9ybTJmKHRoaXMuc2hhZGVyLnByb2plY3Rpb25WZWN0b3IsYi54LGIueSk7dmFyIGM9NCp0aGlzLnZlcnRTaXplO2EudmVydGV4QXR0cmliUG9pbnRlcih0aGlzLnNoYWRlci5hVmVydGV4UG9zaXRpb24sMixhLkZMT0FULCExLGMsMCksYS52ZXJ0ZXhBdHRyaWJQb2ludGVyKHRoaXMuc2hhZGVyLmFUZXh0dXJlQ29vcmQsMixhLkZMT0FULCExLGMsOCksYS52ZXJ0ZXhBdHRyaWJQb2ludGVyKHRoaXMuc2hhZGVyLmNvbG9yQXR0cmlidXRlLDIsYS5GTE9BVCwhMSxjLDE2KX1pZih0aGlzLmN1cnJlbnRCYXRjaFNpemU+LjUqdGhpcy5zaXplKWEuYnVmZmVyU3ViRGF0YShhLkFSUkFZX0JVRkZFUiwwLHRoaXMudmVydGljZXMpO2Vsc2V7dmFyIGQ9dGhpcy52ZXJ0aWNlcy5zdWJhcnJheSgwLDQqdGhpcy5jdXJyZW50QmF0Y2hTaXplKnRoaXMudmVydFNpemUpO2EuYnVmZmVyU3ViRGF0YShhLkFSUkFZX0JVRkZFUiwwLGQpfWZvcih2YXIgZSxmLGc9MCxoPTAsaT1udWxsLGo9dGhpcy5yZW5kZXJTZXNzaW9uLmJsZW5kTW9kZU1hbmFnZXIuY3VycmVudEJsZW5kTW9kZSxrPTAsbD10aGlzLmN1cnJlbnRCYXRjaFNpemU7bD5rO2srKyllPXRoaXMudGV4dHVyZXNba10sZj10aGlzLmJsZW5kTW9kZXNba10sKGkhPT1lfHxqIT09ZikmJih0aGlzLnJlbmRlckJhdGNoKGksZyxoKSxoPWssZz0wLGk9ZSxqPWYsdGhpcy5yZW5kZXJTZXNzaW9uLmJsZW5kTW9kZU1hbmFnZXIuc2V0QmxlbmRNb2RlKGopKSxnKys7dGhpcy5yZW5kZXJCYXRjaChpLGcsaCksdGhpcy5jdXJyZW50QmF0Y2hTaXplPTB9fSxiLldlYkdMU3ByaXRlQmF0Y2gucHJvdG90eXBlLnJlbmRlckJhdGNoPWZ1bmN0aW9uKGEsYyxkKXtpZigwIT09Yyl7dmFyIGU9dGhpcy5nbDtlLmJpbmRUZXh0dXJlKGUuVEVYVFVSRV8yRCxhLl9nbFRleHR1cmVzW2UuaWRdfHxiLmNyZWF0ZVdlYkdMVGV4dHVyZShhLGUpKSxhLl9kaXJ0eVtlLmlkXSYmYi51cGRhdGVXZWJHTFRleHR1cmUodGhpcy5jdXJyZW50QmFzZVRleHR1cmUsZSksZS5kcmF3RWxlbWVudHMoZS5UUklBTkdMRVMsNipjLGUuVU5TSUdORURfU0hPUlQsNipkKjIpLHRoaXMucmVuZGVyU2Vzc2lvbi5kcmF3Q291bnQrK319LGIuV2ViR0xTcHJpdGVCYXRjaC5wcm90b3R5cGUuc3RvcD1mdW5jdGlvbigpe3RoaXMuZmx1c2goKX0sYi5XZWJHTFNwcml0ZUJhdGNoLnByb3RvdHlwZS5zdGFydD1mdW5jdGlvbigpe3RoaXMuZGlydHk9ITB9LGIuV2ViR0xTcHJpdGVCYXRjaC5wcm90b3R5cGUuZGVzdHJveT1mdW5jdGlvbigpe3RoaXMudmVydGljZXM9bnVsbCx0aGlzLmluZGljZXM9bnVsbCx0aGlzLmdsLmRlbGV0ZUJ1ZmZlcih0aGlzLnZlcnRleEJ1ZmZlciksdGhpcy5nbC5kZWxldGVCdWZmZXIodGhpcy5pbmRleEJ1ZmZlciksdGhpcy5jdXJyZW50QmFzZVRleHR1cmU9bnVsbCx0aGlzLmdsPW51bGx9LGIuV2ViR0xGYXN0U3ByaXRlQmF0Y2g9ZnVuY3Rpb24oYSl7dGhpcy52ZXJ0U2l6ZT0xMCx0aGlzLm1heFNpemU9NmUzLHRoaXMuc2l6ZT10aGlzLm1heFNpemU7dmFyIGI9NCp0aGlzLnNpemUqdGhpcy52ZXJ0U2l6ZSxjPTYqdGhpcy5tYXhTaXplO3RoaXMudmVydGljZXM9bmV3IEZsb2F0MzJBcnJheShiKSx0aGlzLmluZGljZXM9bmV3IFVpbnQxNkFycmF5KGMpLHRoaXMudmVydGV4QnVmZmVyPW51bGwsdGhpcy5pbmRleEJ1ZmZlcj1udWxsLHRoaXMubGFzdEluZGV4Q291bnQ9MDtmb3IodmFyIGQ9MCxlPTA7Yz5kO2QrPTYsZSs9NCl0aGlzLmluZGljZXNbZCswXT1lKzAsdGhpcy5pbmRpY2VzW2QrMV09ZSsxLHRoaXMuaW5kaWNlc1tkKzJdPWUrMix0aGlzLmluZGljZXNbZCszXT1lKzAsdGhpcy5pbmRpY2VzW2QrNF09ZSsyLHRoaXMuaW5kaWNlc1tkKzVdPWUrMzt0aGlzLmRyYXdpbmc9ITEsdGhpcy5jdXJyZW50QmF0Y2hTaXplPTAsdGhpcy5jdXJyZW50QmFzZVRleHR1cmU9bnVsbCx0aGlzLmN1cnJlbnRCbGVuZE1vZGU9MCx0aGlzLnJlbmRlclNlc3Npb249bnVsbCx0aGlzLnNoYWRlcj1udWxsLHRoaXMubWF0cml4PW51bGwsdGhpcy5zZXRDb250ZXh0KGEpfSxiLldlYkdMRmFzdFNwcml0ZUJhdGNoLnByb3RvdHlwZS5zZXRDb250ZXh0PWZ1bmN0aW9uKGEpe3RoaXMuZ2w9YSx0aGlzLnZlcnRleEJ1ZmZlcj1hLmNyZWF0ZUJ1ZmZlcigpLHRoaXMuaW5kZXhCdWZmZXI9YS5jcmVhdGVCdWZmZXIoKSxhLmJpbmRCdWZmZXIoYS5FTEVNRU5UX0FSUkFZX0JVRkZFUix0aGlzLmluZGV4QnVmZmVyKSxhLmJ1ZmZlckRhdGEoYS5FTEVNRU5UX0FSUkFZX0JVRkZFUix0aGlzLmluZGljZXMsYS5TVEFUSUNfRFJBVyksYS5iaW5kQnVmZmVyKGEuQVJSQVlfQlVGRkVSLHRoaXMudmVydGV4QnVmZmVyKSxhLmJ1ZmZlckRhdGEoYS5BUlJBWV9CVUZGRVIsdGhpcy52ZXJ0aWNlcyxhLkRZTkFNSUNfRFJBVyl9LGIuV2ViR0xGYXN0U3ByaXRlQmF0Y2gucHJvdG90eXBlLmJlZ2luPWZ1bmN0aW9uKGEsYil7dGhpcy5yZW5kZXJTZXNzaW9uPWIsdGhpcy5zaGFkZXI9dGhpcy5yZW5kZXJTZXNzaW9uLnNoYWRlck1hbmFnZXIuZmFzdFNoYWRlcix0aGlzLm1hdHJpeD1hLndvcmxkVHJhbnNmb3JtLnRvQXJyYXkoITApLHRoaXMuc3RhcnQoKX0sYi5XZWJHTEZhc3RTcHJpdGVCYXRjaC5wcm90b3R5cGUuZW5kPWZ1bmN0aW9uKCl7dGhpcy5mbHVzaCgpfSxiLldlYkdMRmFzdFNwcml0ZUJhdGNoLnByb3RvdHlwZS5yZW5kZXI9ZnVuY3Rpb24oYSl7dmFyIGI9YS5jaGlsZHJlbixjPWJbMF07aWYoYy50ZXh0dXJlLl91dnMpe3RoaXMuY3VycmVudEJhc2VUZXh0dXJlPWMudGV4dHVyZS5iYXNlVGV4dHVyZSxjLmJsZW5kTW9kZSE9PXRoaXMucmVuZGVyU2Vzc2lvbi5ibGVuZE1vZGVNYW5hZ2VyLmN1cnJlbnRCbGVuZE1vZGUmJih0aGlzLmZsdXNoKCksdGhpcy5yZW5kZXJTZXNzaW9uLmJsZW5kTW9kZU1hbmFnZXIuc2V0QmxlbmRNb2RlKGMuYmxlbmRNb2RlKSk7Zm9yKHZhciBkPTAsZT1iLmxlbmd0aDtlPmQ7ZCsrKXRoaXMucmVuZGVyU3ByaXRlKGJbZF0pO3RoaXMuZmx1c2goKX19LGIuV2ViR0xGYXN0U3ByaXRlQmF0Y2gucHJvdG90eXBlLnJlbmRlclNwcml0ZT1mdW5jdGlvbihhKXtpZihhLnZpc2libGUmJihhLnRleHR1cmUuYmFzZVRleHR1cmU9PT10aGlzLmN1cnJlbnRCYXNlVGV4dHVyZXx8KHRoaXMuZmx1c2goKSx0aGlzLmN1cnJlbnRCYXNlVGV4dHVyZT1hLnRleHR1cmUuYmFzZVRleHR1cmUsYS50ZXh0dXJlLl91dnMpKSl7dmFyIGIsYyxkLGUsZixnLGgsaSxqPXRoaXMudmVydGljZXM7aWYoYj1hLnRleHR1cmUuX3V2cyxjPWEudGV4dHVyZS5mcmFtZS53aWR0aCxkPWEudGV4dHVyZS5mcmFtZS5oZWlnaHQsYS50ZXh0dXJlLnRyaW0pe3ZhciBrPWEudGV4dHVyZS50cmltO2Y9ay54LWEuYW5jaG9yLngqay53aWR0aCxlPWYrYS50ZXh0dXJlLmNyb3Aud2lkdGgsaD1rLnktYS5hbmNob3IueSprLmhlaWdodCxnPWgrYS50ZXh0dXJlLmNyb3AuaGVpZ2h0fWVsc2UgZT1hLnRleHR1cmUuZnJhbWUud2lkdGgqKDEtYS5hbmNob3IueCksZj1hLnRleHR1cmUuZnJhbWUud2lkdGgqLWEuYW5jaG9yLngsZz1hLnRleHR1cmUuZnJhbWUuaGVpZ2h0KigxLWEuYW5jaG9yLnkpLGg9YS50ZXh0dXJlLmZyYW1lLmhlaWdodCotYS5hbmNob3IueTtpPTQqdGhpcy5jdXJyZW50QmF0Y2hTaXplKnRoaXMudmVydFNpemUsaltpKytdPWYsaltpKytdPWgsaltpKytdPWEucG9zaXRpb24ueCxqW2krK109YS5wb3NpdGlvbi55LGpbaSsrXT1hLnNjYWxlLngsaltpKytdPWEuc2NhbGUueSxqW2krK109YS5yb3RhdGlvbixqW2krK109Yi54MCxqW2krK109Yi55MSxqW2krK109YS5hbHBoYSxqW2krK109ZSxqW2krK109aCxqW2krK109YS5wb3NpdGlvbi54LGpbaSsrXT1hLnBvc2l0aW9uLnksaltpKytdPWEuc2NhbGUueCxqW2krK109YS5zY2FsZS55LGpbaSsrXT1hLnJvdGF0aW9uLGpbaSsrXT1iLngxLGpbaSsrXT1iLnkxLGpbaSsrXT1hLmFscGhhLGpbaSsrXT1lLGpbaSsrXT1nLGpbaSsrXT1hLnBvc2l0aW9uLngsaltpKytdPWEucG9zaXRpb24ueSxqW2krK109YS5zY2FsZS54LGpbaSsrXT1hLnNjYWxlLnksaltpKytdPWEucm90YXRpb24saltpKytdPWIueDIsaltpKytdPWIueTIsaltpKytdPWEuYWxwaGEsaltpKytdPWYsaltpKytdPWcsaltpKytdPWEucG9zaXRpb24ueCxqW2krK109YS5wb3NpdGlvbi55LGpbaSsrXT1hLnNjYWxlLngsaltpKytdPWEuc2NhbGUueSxqW2krK109YS5yb3RhdGlvbixqW2krK109Yi54MyxqW2krK109Yi55MyxqW2krK109YS5hbHBoYSx0aGlzLmN1cnJlbnRCYXRjaFNpemUrKyx0aGlzLmN1cnJlbnRCYXRjaFNpemU+PXRoaXMuc2l6ZSYmdGhpcy5mbHVzaCgpfX0sYi5XZWJHTEZhc3RTcHJpdGVCYXRjaC5wcm90b3R5cGUuZmx1c2g9ZnVuY3Rpb24oKXtpZigwIT09dGhpcy5jdXJyZW50QmF0Y2hTaXplKXt2YXIgYT10aGlzLmdsO2lmKHRoaXMuY3VycmVudEJhc2VUZXh0dXJlLl9nbFRleHR1cmVzW2EuaWRdfHxiLmNyZWF0ZVdlYkdMVGV4dHVyZSh0aGlzLmN1cnJlbnRCYXNlVGV4dHVyZSxhKSxhLmJpbmRUZXh0dXJlKGEuVEVYVFVSRV8yRCx0aGlzLmN1cnJlbnRCYXNlVGV4dHVyZS5fZ2xUZXh0dXJlc1thLmlkXSksdGhpcy5jdXJyZW50QmF0Y2hTaXplPi41KnRoaXMuc2l6ZSlhLmJ1ZmZlclN1YkRhdGEoYS5BUlJBWV9CVUZGRVIsMCx0aGlzLnZlcnRpY2VzKTtlbHNle3ZhciBjPXRoaXMudmVydGljZXMuc3ViYXJyYXkoMCw0KnRoaXMuY3VycmVudEJhdGNoU2l6ZSp0aGlzLnZlcnRTaXplKTthLmJ1ZmZlclN1YkRhdGEoYS5BUlJBWV9CVUZGRVIsMCxjKX1hLmRyYXdFbGVtZW50cyhhLlRSSUFOR0xFUyw2KnRoaXMuY3VycmVudEJhdGNoU2l6ZSxhLlVOU0lHTkVEX1NIT1JULDApLHRoaXMuY3VycmVudEJhdGNoU2l6ZT0wLHRoaXMucmVuZGVyU2Vzc2lvbi5kcmF3Q291bnQrK319LGIuV2ViR0xGYXN0U3ByaXRlQmF0Y2gucHJvdG90eXBlLnN0b3A9ZnVuY3Rpb24oKXt0aGlzLmZsdXNoKCl9LGIuV2ViR0xGYXN0U3ByaXRlQmF0Y2gucHJvdG90eXBlLnN0YXJ0PWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5nbDthLmFjdGl2ZVRleHR1cmUoYS5URVhUVVJFMCksYS5iaW5kQnVmZmVyKGEuQVJSQVlfQlVGRkVSLHRoaXMudmVydGV4QnVmZmVyKSxhLmJpbmRCdWZmZXIoYS5FTEVNRU5UX0FSUkFZX0JVRkZFUix0aGlzLmluZGV4QnVmZmVyKTt2YXIgYj10aGlzLnJlbmRlclNlc3Npb24ucHJvamVjdGlvbjthLnVuaWZvcm0yZih0aGlzLnNoYWRlci5wcm9qZWN0aW9uVmVjdG9yLGIueCxiLnkpLGEudW5pZm9ybU1hdHJpeDNmdih0aGlzLnNoYWRlci51TWF0cml4LCExLHRoaXMubWF0cml4KTt2YXIgYz00KnRoaXMudmVydFNpemU7YS52ZXJ0ZXhBdHRyaWJQb2ludGVyKHRoaXMuc2hhZGVyLmFWZXJ0ZXhQb3NpdGlvbiwyLGEuRkxPQVQsITEsYywwKSxhLnZlcnRleEF0dHJpYlBvaW50ZXIodGhpcy5zaGFkZXIuYVBvc2l0aW9uQ29vcmQsMixhLkZMT0FULCExLGMsOCksYS52ZXJ0ZXhBdHRyaWJQb2ludGVyKHRoaXMuc2hhZGVyLmFTY2FsZSwyLGEuRkxPQVQsITEsYywxNiksYS52ZXJ0ZXhBdHRyaWJQb2ludGVyKHRoaXMuc2hhZGVyLmFSb3RhdGlvbiwxLGEuRkxPQVQsITEsYywyNCksYS52ZXJ0ZXhBdHRyaWJQb2ludGVyKHRoaXMuc2hhZGVyLmFUZXh0dXJlQ29vcmQsMixhLkZMT0FULCExLGMsMjgpLGEudmVydGV4QXR0cmliUG9pbnRlcih0aGlzLnNoYWRlci5jb2xvckF0dHJpYnV0ZSwxLGEuRkxPQVQsITEsYywzNil9LGIuV2ViR0xGaWx0ZXJNYW5hZ2VyPWZ1bmN0aW9uKGEsYil7dGhpcy50cmFuc3BhcmVudD1iLHRoaXMuZmlsdGVyU3RhY2s9W10sdGhpcy5vZmZzZXRYPTAsdGhpcy5vZmZzZXRZPTAsdGhpcy5zZXRDb250ZXh0KGEpfSxiLldlYkdMRmlsdGVyTWFuYWdlci5wcm90b3R5cGUuc2V0Q29udGV4dD1mdW5jdGlvbihhKXt0aGlzLmdsPWEsdGhpcy50ZXh0dXJlUG9vbD1bXSx0aGlzLmluaXRTaGFkZXJCdWZmZXJzKCl9LGIuV2ViR0xGaWx0ZXJNYW5hZ2VyLnByb3RvdHlwZS5iZWdpbj1mdW5jdGlvbihhLGIpe3RoaXMucmVuZGVyU2Vzc2lvbj1hLHRoaXMuZGVmYXVsdFNoYWRlcj1hLnNoYWRlck1hbmFnZXIuZGVmYXVsdFNoYWRlcjt2YXIgYz10aGlzLnJlbmRlclNlc3Npb24ucHJvamVjdGlvbjt0aGlzLndpZHRoPTIqYy54LHRoaXMuaGVpZ2h0PTIqLWMueSx0aGlzLmJ1ZmZlcj1ifSxiLldlYkdMRmlsdGVyTWFuYWdlci5wcm90b3R5cGUucHVzaEZpbHRlcj1mdW5jdGlvbihhKXt2YXIgYz10aGlzLmdsLGQ9dGhpcy5yZW5kZXJTZXNzaW9uLnByb2plY3Rpb24sZT10aGlzLnJlbmRlclNlc3Npb24ub2Zmc2V0O2EuX2ZpbHRlckFyZWE9YS50YXJnZXQuZmlsdGVyQXJlYXx8YS50YXJnZXQuZ2V0Qm91bmRzKCksdGhpcy5maWx0ZXJTdGFjay5wdXNoKGEpO3ZhciBmPWEuZmlsdGVyUGFzc2VzWzBdO3RoaXMub2Zmc2V0WCs9YS5fZmlsdGVyQXJlYS54LHRoaXMub2Zmc2V0WSs9YS5fZmlsdGVyQXJlYS55O3ZhciBnPXRoaXMudGV4dHVyZVBvb2wucG9wKCk7Zz9nLnJlc2l6ZSh0aGlzLndpZHRoLHRoaXMuaGVpZ2h0KTpnPW5ldyBiLkZpbHRlclRleHR1cmUodGhpcy5nbCx0aGlzLndpZHRoLHRoaXMuaGVpZ2h0KSxjLmJpbmRUZXh0dXJlKGMuVEVYVFVSRV8yRCxnLnRleHR1cmUpO3ZhciBoPWEuX2ZpbHRlckFyZWEsaT1mLnBhZGRpbmc7aC54LT1pLGgueS09aSxoLndpZHRoKz0yKmksaC5oZWlnaHQrPTIqaSxoLng8MCYmKGgueD0wKSxoLndpZHRoPnRoaXMud2lkdGgmJihoLndpZHRoPXRoaXMud2lkdGgpLGgueTwwJiYoaC55PTApLGguaGVpZ2h0PnRoaXMuaGVpZ2h0JiYoaC5oZWlnaHQ9dGhpcy5oZWlnaHQpLGMuYmluZEZyYW1lYnVmZmVyKGMuRlJBTUVCVUZGRVIsZy5mcmFtZUJ1ZmZlciksYy52aWV3cG9ydCgwLDAsaC53aWR0aCxoLmhlaWdodCksZC54PWgud2lkdGgvMixkLnk9LWguaGVpZ2h0LzIsZS54PS1oLngsZS55PS1oLnksdGhpcy5yZW5kZXJTZXNzaW9uLnNoYWRlck1hbmFnZXIuc2V0U2hhZGVyKHRoaXMuZGVmYXVsdFNoYWRlciksYy51bmlmb3JtMmYodGhpcy5kZWZhdWx0U2hhZGVyLnByb2plY3Rpb25WZWN0b3IsaC53aWR0aC8yLC1oLmhlaWdodC8yKSxjLnVuaWZvcm0yZih0aGlzLmRlZmF1bHRTaGFkZXIub2Zmc2V0VmVjdG9yLC1oLngsLWgueSksYy5jb2xvck1hc2soITAsITAsITAsITApLGMuY2xlYXJDb2xvcigwLDAsMCwwKSxjLmNsZWFyKGMuQ09MT1JfQlVGRkVSX0JJVCksYS5fZ2xGaWx0ZXJUZXh0dXJlPWd9LGIuV2ViR0xGaWx0ZXJNYW5hZ2VyLnByb3RvdHlwZS5wb3BGaWx0ZXI9ZnVuY3Rpb24oKXt2YXIgYT10aGlzLmdsLGM9dGhpcy5maWx0ZXJTdGFjay5wb3AoKSxkPWMuX2ZpbHRlckFyZWEsZT1jLl9nbEZpbHRlclRleHR1cmUsZj10aGlzLnJlbmRlclNlc3Npb24ucHJvamVjdGlvbixnPXRoaXMucmVuZGVyU2Vzc2lvbi5vZmZzZXQ7aWYoYy5maWx0ZXJQYXNzZXMubGVuZ3RoPjEpe2Eudmlld3BvcnQoMCwwLGQud2lkdGgsZC5oZWlnaHQpLGEuYmluZEJ1ZmZlcihhLkFSUkFZX0JVRkZFUix0aGlzLnZlcnRleEJ1ZmZlciksdGhpcy52ZXJ0ZXhBcnJheVswXT0wLHRoaXMudmVydGV4QXJyYXlbMV09ZC5oZWlnaHQsdGhpcy52ZXJ0ZXhBcnJheVsyXT1kLndpZHRoLHRoaXMudmVydGV4QXJyYXlbM109ZC5oZWlnaHQsdGhpcy52ZXJ0ZXhBcnJheVs0XT0wLHRoaXMudmVydGV4QXJyYXlbNV09MCx0aGlzLnZlcnRleEFycmF5WzZdPWQud2lkdGgsdGhpcy52ZXJ0ZXhBcnJheVs3XT0wLGEuYnVmZmVyU3ViRGF0YShhLkFSUkFZX0JVRkZFUiwwLHRoaXMudmVydGV4QXJyYXkpLGEuYmluZEJ1ZmZlcihhLkFSUkFZX0JVRkZFUix0aGlzLnV2QnVmZmVyKSx0aGlzLnV2QXJyYXlbMl09ZC53aWR0aC90aGlzLndpZHRoLHRoaXMudXZBcnJheVs1XT1kLmhlaWdodC90aGlzLmhlaWdodCx0aGlzLnV2QXJyYXlbNl09ZC53aWR0aC90aGlzLndpZHRoLHRoaXMudXZBcnJheVs3XT1kLmhlaWdodC90aGlzLmhlaWdodCxhLmJ1ZmZlclN1YkRhdGEoYS5BUlJBWV9CVUZGRVIsMCx0aGlzLnV2QXJyYXkpO3ZhciBoPWUsaT10aGlzLnRleHR1cmVQb29sLnBvcCgpO2l8fChpPW5ldyBiLkZpbHRlclRleHR1cmUodGhpcy5nbCx0aGlzLndpZHRoLHRoaXMuaGVpZ2h0KSksaS5yZXNpemUodGhpcy53aWR0aCx0aGlzLmhlaWdodCksYS5iaW5kRnJhbWVidWZmZXIoYS5GUkFNRUJVRkZFUixpLmZyYW1lQnVmZmVyKSxhLmNsZWFyKGEuQ09MT1JfQlVGRkVSX0JJVCksYS5kaXNhYmxlKGEuQkxFTkQpO2Zvcih2YXIgaj0wO2o8Yy5maWx0ZXJQYXNzZXMubGVuZ3RoLTE7aisrKXt2YXIgaz1jLmZpbHRlclBhc3Nlc1tqXTthLmJpbmRGcmFtZWJ1ZmZlcihhLkZSQU1FQlVGRkVSLGkuZnJhbWVCdWZmZXIpLGEuYWN0aXZlVGV4dHVyZShhLlRFWFRVUkUwKSxhLmJpbmRUZXh0dXJlKGEuVEVYVFVSRV8yRCxoLnRleHR1cmUpLHRoaXMuYXBwbHlGaWx0ZXJQYXNzKGssZCxkLndpZHRoLGQuaGVpZ2h0KTt2YXIgbD1oO2g9aSxpPWx9YS5lbmFibGUoYS5CTEVORCksZT1oLHRoaXMudGV4dHVyZVBvb2wucHVzaChpKX12YXIgbT1jLmZpbHRlclBhc3Nlc1tjLmZpbHRlclBhc3Nlcy5sZW5ndGgtMV07dGhpcy5vZmZzZXRYLT1kLngsdGhpcy5vZmZzZXRZLT1kLnk7dmFyIG49dGhpcy53aWR0aCxvPXRoaXMuaGVpZ2h0LHA9MCxxPTAscj10aGlzLmJ1ZmZlcjtpZigwPT09dGhpcy5maWx0ZXJTdGFjay5sZW5ndGgpYS5jb2xvck1hc2soITAsITAsITAsITApO2Vsc2V7dmFyIHM9dGhpcy5maWx0ZXJTdGFja1t0aGlzLmZpbHRlclN0YWNrLmxlbmd0aC0xXTtkPXMuX2ZpbHRlckFyZWEsbj1kLndpZHRoLG89ZC5oZWlnaHQscD1kLngscT1kLnkscj1zLl9nbEZpbHRlclRleHR1cmUuZnJhbWVCdWZmZXJ9Zi54PW4vMixmLnk9LW8vMixnLng9cCxnLnk9cSxkPWMuX2ZpbHRlckFyZWE7dmFyIHQ9ZC54LXAsdT1kLnktcTthLmJpbmRCdWZmZXIoYS5BUlJBWV9CVUZGRVIsdGhpcy52ZXJ0ZXhCdWZmZXIpLHRoaXMudmVydGV4QXJyYXlbMF09dCx0aGlzLnZlcnRleEFycmF5WzFdPXUrZC5oZWlnaHQsdGhpcy52ZXJ0ZXhBcnJheVsyXT10K2Qud2lkdGgsdGhpcy52ZXJ0ZXhBcnJheVszXT11K2QuaGVpZ2h0LHRoaXMudmVydGV4QXJyYXlbNF09dCx0aGlzLnZlcnRleEFycmF5WzVdPXUsdGhpcy52ZXJ0ZXhBcnJheVs2XT10K2Qud2lkdGgsdGhpcy52ZXJ0ZXhBcnJheVs3XT11LGEuYnVmZmVyU3ViRGF0YShhLkFSUkFZX0JVRkZFUiwwLHRoaXMudmVydGV4QXJyYXkpLGEuYmluZEJ1ZmZlcihhLkFSUkFZX0JVRkZFUix0aGlzLnV2QnVmZmVyKSx0aGlzLnV2QXJyYXlbMl09ZC53aWR0aC90aGlzLndpZHRoLHRoaXMudXZBcnJheVs1XT1kLmhlaWdodC90aGlzLmhlaWdodCx0aGlzLnV2QXJyYXlbNl09ZC53aWR0aC90aGlzLndpZHRoLHRoaXMudXZBcnJheVs3XT1kLmhlaWdodC90aGlzLmhlaWdodCxhLmJ1ZmZlclN1YkRhdGEoYS5BUlJBWV9CVUZGRVIsMCx0aGlzLnV2QXJyYXkpLGEudmlld3BvcnQoMCwwLG4sbyksYS5iaW5kRnJhbWVidWZmZXIoYS5GUkFNRUJVRkZFUixyKSxhLmFjdGl2ZVRleHR1cmUoYS5URVhUVVJFMCksYS5iaW5kVGV4dHVyZShhLlRFWFRVUkVfMkQsZS50ZXh0dXJlKSx0aGlzLmFwcGx5RmlsdGVyUGFzcyhtLGQsbixvKSx0aGlzLnJlbmRlclNlc3Npb24uc2hhZGVyTWFuYWdlci5zZXRTaGFkZXIodGhpcy5kZWZhdWx0U2hhZGVyKSxhLnVuaWZvcm0yZih0aGlzLmRlZmF1bHRTaGFkZXIucHJvamVjdGlvblZlY3RvcixuLzIsLW8vMiksYS51bmlmb3JtMmYodGhpcy5kZWZhdWx0U2hhZGVyLm9mZnNldFZlY3RvciwtcCwtcSksdGhpcy50ZXh0dXJlUG9vbC5wdXNoKGUpLGMuX2dsRmlsdGVyVGV4dHVyZT1udWxsfSxiLldlYkdMRmlsdGVyTWFuYWdlci5wcm90b3R5cGUuYXBwbHlGaWx0ZXJQYXNzPWZ1bmN0aW9uKGEsYyxkLGUpe3ZhciBmPXRoaXMuZ2wsZz1hLnNoYWRlcnNbZi5pZF07Z3x8KGc9bmV3IGIuUGl4aVNoYWRlcihmKSxnLmZyYWdtZW50U3JjPWEuZnJhZ21lbnRTcmMsZy51bmlmb3Jtcz1hLnVuaWZvcm1zLGcuaW5pdCgpLGEuc2hhZGVyc1tmLmlkXT1nKSx0aGlzLnJlbmRlclNlc3Npb24uc2hhZGVyTWFuYWdlci5zZXRTaGFkZXIoZyksZi51bmlmb3JtMmYoZy5wcm9qZWN0aW9uVmVjdG9yLGQvMiwtZS8yKSxmLnVuaWZvcm0yZihnLm9mZnNldFZlY3RvciwwLDApLGEudW5pZm9ybXMuZGltZW5zaW9ucyYmKGEudW5pZm9ybXMuZGltZW5zaW9ucy52YWx1ZVswXT10aGlzLndpZHRoLGEudW5pZm9ybXMuZGltZW5zaW9ucy52YWx1ZVsxXT10aGlzLmhlaWdodCxhLnVuaWZvcm1zLmRpbWVuc2lvbnMudmFsdWVbMl09dGhpcy52ZXJ0ZXhBcnJheVswXSxhLnVuaWZvcm1zLmRpbWVuc2lvbnMudmFsdWVbM109dGhpcy52ZXJ0ZXhBcnJheVs1XSksZy5zeW5jVW5pZm9ybXMoKSxmLmJpbmRCdWZmZXIoZi5BUlJBWV9CVUZGRVIsdGhpcy52ZXJ0ZXhCdWZmZXIpLGYudmVydGV4QXR0cmliUG9pbnRlcihnLmFWZXJ0ZXhQb3NpdGlvbiwyLGYuRkxPQVQsITEsMCwwKSxmLmJpbmRCdWZmZXIoZi5BUlJBWV9CVUZGRVIsdGhpcy51dkJ1ZmZlciksZi52ZXJ0ZXhBdHRyaWJQb2ludGVyKGcuYVRleHR1cmVDb29yZCwyLGYuRkxPQVQsITEsMCwwKSxmLmJpbmRCdWZmZXIoZi5BUlJBWV9CVUZGRVIsdGhpcy5jb2xvckJ1ZmZlciksZi52ZXJ0ZXhBdHRyaWJQb2ludGVyKGcuY29sb3JBdHRyaWJ1dGUsMixmLkZMT0FULCExLDAsMCksZi5iaW5kQnVmZmVyKGYuRUxFTUVOVF9BUlJBWV9CVUZGRVIsdGhpcy5pbmRleEJ1ZmZlciksZi5kcmF3RWxlbWVudHMoZi5UUklBTkdMRVMsNixmLlVOU0lHTkVEX1NIT1JULDApLHRoaXMucmVuZGVyU2Vzc2lvbi5kcmF3Q291bnQrK30sYi5XZWJHTEZpbHRlck1hbmFnZXIucHJvdG90eXBlLmluaXRTaGFkZXJCdWZmZXJzPWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5nbDt0aGlzLnZlcnRleEJ1ZmZlcj1hLmNyZWF0ZUJ1ZmZlcigpLHRoaXMudXZCdWZmZXI9YS5jcmVhdGVCdWZmZXIoKSx0aGlzLmNvbG9yQnVmZmVyPWEuY3JlYXRlQnVmZmVyKCksdGhpcy5pbmRleEJ1ZmZlcj1hLmNyZWF0ZUJ1ZmZlcigpLHRoaXMudmVydGV4QXJyYXk9bmV3IEZsb2F0MzJBcnJheShbMCwwLDEsMCwwLDEsMSwxXSksYS5iaW5kQnVmZmVyKGEuQVJSQVlfQlVGRkVSLHRoaXMudmVydGV4QnVmZmVyKSxhLmJ1ZmZlckRhdGEoYS5BUlJBWV9CVUZGRVIsdGhpcy52ZXJ0ZXhBcnJheSxhLlNUQVRJQ19EUkFXKSx0aGlzLnV2QXJyYXk9bmV3IEZsb2F0MzJBcnJheShbMCwwLDEsMCwwLDEsMSwxXSksYS5iaW5kQnVmZmVyKGEuQVJSQVlfQlVGRkVSLHRoaXMudXZCdWZmZXIpLGEuYnVmZmVyRGF0YShhLkFSUkFZX0JVRkZFUix0aGlzLnV2QXJyYXksYS5TVEFUSUNfRFJBVyksdGhpcy5jb2xvckFycmF5PW5ldyBGbG9hdDMyQXJyYXkoWzEsMTY3NzcyMTUsMSwxNjc3NzIxNSwxLDE2Nzc3MjE1LDEsMTY3NzcyMTVdKSxhLmJpbmRCdWZmZXIoYS5BUlJBWV9CVUZGRVIsdGhpcy5jb2xvckJ1ZmZlciksYS5idWZmZXJEYXRhKGEuQVJSQVlfQlVGRkVSLHRoaXMuY29sb3JBcnJheSxhLlNUQVRJQ19EUkFXKSxhLmJpbmRCdWZmZXIoYS5FTEVNRU5UX0FSUkFZX0JVRkZFUix0aGlzLmluZGV4QnVmZmVyKSxhLmJ1ZmZlckRhdGEoYS5FTEVNRU5UX0FSUkFZX0JVRkZFUixuZXcgVWludDE2QXJyYXkoWzAsMSwyLDEsMywyXSksYS5TVEFUSUNfRFJBVyl9LGIuV2ViR0xGaWx0ZXJNYW5hZ2VyLnByb3RvdHlwZS5kZXN0cm95PWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5nbDt0aGlzLmZpbHRlclN0YWNrPW51bGwsdGhpcy5vZmZzZXRYPTAsdGhpcy5vZmZzZXRZPTA7Zm9yKHZhciBiPTA7Yjx0aGlzLnRleHR1cmVQb29sLmxlbmd0aDtiKyspdGhpcy50ZXh0dXJlUG9vbFtiXS5kZXN0cm95KCk7dGhpcy50ZXh0dXJlUG9vbD1udWxsLGEuZGVsZXRlQnVmZmVyKHRoaXMudmVydGV4QnVmZmVyKSxhLmRlbGV0ZUJ1ZmZlcih0aGlzLnV2QnVmZmVyKSxhLmRlbGV0ZUJ1ZmZlcih0aGlzLmNvbG9yQnVmZmVyKSxhLmRlbGV0ZUJ1ZmZlcih0aGlzLmluZGV4QnVmZmVyKX0sYi5GaWx0ZXJUZXh0dXJlPWZ1bmN0aW9uKGEsYyxkLGUpe3RoaXMuZ2w9YSx0aGlzLmZyYW1lQnVmZmVyPWEuY3JlYXRlRnJhbWVidWZmZXIoKSx0aGlzLnRleHR1cmU9YS5jcmVhdGVUZXh0dXJlKCksZT1lfHxiLnNjYWxlTW9kZXMuREVGQVVMVCxhLmJpbmRUZXh0dXJlKGEuVEVYVFVSRV8yRCx0aGlzLnRleHR1cmUpLGEudGV4UGFyYW1ldGVyaShhLlRFWFRVUkVfMkQsYS5URVhUVVJFX01BR19GSUxURVIsZT09PWIuc2NhbGVNb2Rlcy5MSU5FQVI/YS5MSU5FQVI6YS5ORUFSRVNUKSxhLnRleFBhcmFtZXRlcmkoYS5URVhUVVJFXzJELGEuVEVYVFVSRV9NSU5fRklMVEVSLGU9PT1iLnNjYWxlTW9kZXMuTElORUFSP2EuTElORUFSOmEuTkVBUkVTVCksYS50ZXhQYXJhbWV0ZXJpKGEuVEVYVFVSRV8yRCxhLlRFWFRVUkVfV1JBUF9TLGEuQ0xBTVBfVE9fRURHRSksYS50ZXhQYXJhbWV0ZXJpKGEuVEVYVFVSRV8yRCxhLlRFWFRVUkVfV1JBUF9ULGEuQ0xBTVBfVE9fRURHRSksYS5iaW5kRnJhbWVidWZmZXIoYS5GUkFNRUJVRkZFUix0aGlzLmZyYW1lYnVmZmVyKSxhLmJpbmRGcmFtZWJ1ZmZlcihhLkZSQU1FQlVGRkVSLHRoaXMuZnJhbWVCdWZmZXIpLGEuZnJhbWVidWZmZXJUZXh0dXJlMkQoYS5GUkFNRUJVRkZFUixhLkNPTE9SX0FUVEFDSE1FTlQwLGEuVEVYVFVSRV8yRCx0aGlzLnRleHR1cmUsMCksdGhpcy5yZW5kZXJCdWZmZXI9YS5jcmVhdGVSZW5kZXJidWZmZXIoKSxhLmJpbmRSZW5kZXJidWZmZXIoYS5SRU5ERVJCVUZGRVIsdGhpcy5yZW5kZXJCdWZmZXIpLGEuZnJhbWVidWZmZXJSZW5kZXJidWZmZXIoYS5GUkFNRUJVRkZFUixhLkRFUFRIX1NURU5DSUxfQVRUQUNITUVOVCxhLlJFTkRFUkJVRkZFUix0aGlzLnJlbmRlckJ1ZmZlciksdGhpcy5yZXNpemUoYyxkKX0sYi5GaWx0ZXJUZXh0dXJlLnByb3RvdHlwZS5jbGVhcj1mdW5jdGlvbigpe3ZhciBhPXRoaXMuZ2w7YS5jbGVhckNvbG9yKDAsMCwwLDApLGEuY2xlYXIoYS5DT0xPUl9CVUZGRVJfQklUKX0sYi5GaWx0ZXJUZXh0dXJlLnByb3RvdHlwZS5yZXNpemU9ZnVuY3Rpb24oYSxiKXtpZih0aGlzLndpZHRoIT09YXx8dGhpcy5oZWlnaHQhPT1iKXt0aGlzLndpZHRoPWEsdGhpcy5oZWlnaHQ9Yjt2YXIgYz10aGlzLmdsO2MuYmluZFRleHR1cmUoYy5URVhUVVJFXzJELHRoaXMudGV4dHVyZSksYy50ZXhJbWFnZTJEKGMuVEVYVFVSRV8yRCwwLGMuUkdCQSxhLGIsMCxjLlJHQkEsYy5VTlNJR05FRF9CWVRFLG51bGwpLGMuYmluZFJlbmRlcmJ1ZmZlcihjLlJFTkRFUkJVRkZFUix0aGlzLnJlbmRlckJ1ZmZlciksYy5yZW5kZXJidWZmZXJTdG9yYWdlKGMuUkVOREVSQlVGRkVSLGMuREVQVEhfU1RFTkNJTCxhLGIpfX0sYi5GaWx0ZXJUZXh0dXJlLnByb3RvdHlwZS5kZXN0cm95PWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5nbDthLmRlbGV0ZUZyYW1lYnVmZmVyKHRoaXMuZnJhbWVCdWZmZXIpLGEuZGVsZXRlVGV4dHVyZSh0aGlzLnRleHR1cmUpLHRoaXMuZnJhbWVCdWZmZXI9bnVsbCx0aGlzLnRleHR1cmU9bnVsbH0sYi5DYW52YXNNYXNrTWFuYWdlcj1mdW5jdGlvbigpe30sYi5DYW52YXNNYXNrTWFuYWdlci5wcm90b3R5cGUucHVzaE1hc2s9ZnVuY3Rpb24oYSxjKXtjLnNhdmUoKTt2YXIgZD1hLmFscGhhLGU9YS53b3JsZFRyYW5zZm9ybTtjLnNldFRyYW5zZm9ybShlLmEsZS5jLGUuYixlLmQsZS50eCxlLnR5KSxiLkNhbnZhc0dyYXBoaWNzLnJlbmRlckdyYXBoaWNzTWFzayhhLGMpLGMuY2xpcCgpLGEud29ybGRBbHBoYT1kfSxiLkNhbnZhc01hc2tNYW5hZ2VyLnByb3RvdHlwZS5wb3BNYXNrPWZ1bmN0aW9uKGEpe2EucmVzdG9yZSgpfSxiLkNhbnZhc1RpbnRlcj1mdW5jdGlvbigpe30sYi5DYW52YXNUaW50ZXIuZ2V0VGludGVkVGV4dHVyZT1mdW5jdGlvbihhLGMpe3ZhciBkPWEudGV4dHVyZTtjPWIuQ2FudmFzVGludGVyLnJvdW5kQ29sb3IoYyk7dmFyIGU9XCIjXCIrKFwiMDAwMDBcIisoMHxjKS50b1N0cmluZygxNikpLnN1YnN0cigtNik7aWYoZC50aW50Q2FjaGU9ZC50aW50Q2FjaGV8fHt9LGQudGludENhY2hlW2VdKXJldHVybiBkLnRpbnRDYWNoZVtlXTt2YXIgZj1iLkNhbnZhc1RpbnRlci5jYW52YXN8fGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7aWYoYi5DYW52YXNUaW50ZXIudGludE1ldGhvZChkLGMsZiksYi5DYW52YXNUaW50ZXIuY29udmVydFRpbnRUb0ltYWdlKXt2YXIgZz1uZXcgSW1hZ2U7Zy5zcmM9Zi50b0RhdGFVUkwoKSxkLnRpbnRDYWNoZVtlXT1nfWVsc2UgZC50aW50Q2FjaGVbZV09ZixiLkNhbnZhc1RpbnRlci5jYW52YXM9bnVsbDtyZXR1cm4gZn0sYi5DYW52YXNUaW50ZXIudGludFdpdGhNdWx0aXBseT1mdW5jdGlvbihhLGIsYyl7dmFyIGQ9Yy5nZXRDb250ZXh0KFwiMmRcIiksZT1hLmZyYW1lO2Mud2lkdGg9ZS53aWR0aCxjLmhlaWdodD1lLmhlaWdodCxkLmZpbGxTdHlsZT1cIiNcIisoXCIwMDAwMFwiKygwfGIpLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC02KSxkLmZpbGxSZWN0KDAsMCxlLndpZHRoLGUuaGVpZ2h0KSxkLmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbj1cIm11bHRpcGx5XCIsZC5kcmF3SW1hZ2UoYS5iYXNlVGV4dHVyZS5zb3VyY2UsZS54LGUueSxlLndpZHRoLGUuaGVpZ2h0LDAsMCxlLndpZHRoLGUuaGVpZ2h0KSxkLmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbj1cImRlc3RpbmF0aW9uLWF0b3BcIixkLmRyYXdJbWFnZShhLmJhc2VUZXh0dXJlLnNvdXJjZSxlLngsZS55LGUud2lkdGgsZS5oZWlnaHQsMCwwLGUud2lkdGgsZS5oZWlnaHQpfSxiLkNhbnZhc1RpbnRlci50aW50V2l0aE92ZXJsYXk9ZnVuY3Rpb24oYSxiLGMpe3ZhciBkPWMuZ2V0Q29udGV4dChcIjJkXCIpLGU9YS5mcmFtZTtjLndpZHRoPWUud2lkdGgsYy5oZWlnaHQ9ZS5oZWlnaHQsZC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb249XCJjb3B5XCIsZC5maWxsU3R5bGU9XCIjXCIrKFwiMDAwMDBcIisoMHxiKS50b1N0cmluZygxNikpLnN1YnN0cigtNiksZC5maWxsUmVjdCgwLDAsZS53aWR0aCxlLmhlaWdodCksZC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb249XCJkZXN0aW5hdGlvbi1hdG9wXCIsZC5kcmF3SW1hZ2UoYS5iYXNlVGV4dHVyZS5zb3VyY2UsZS54LGUueSxlLndpZHRoLGUuaGVpZ2h0LDAsMCxlLndpZHRoLGUuaGVpZ2h0KX0sYi5DYW52YXNUaW50ZXIudGludFdpdGhQZXJQaXhlbD1mdW5jdGlvbihhLGMsZCl7dmFyIGU9ZC5nZXRDb250ZXh0KFwiMmRcIiksZj1hLmZyYW1lO2Qud2lkdGg9Zi53aWR0aCxkLmhlaWdodD1mLmhlaWdodCxlLmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbj1cImNvcHlcIixlLmRyYXdJbWFnZShhLmJhc2VUZXh0dXJlLnNvdXJjZSxmLngsZi55LGYud2lkdGgsZi5oZWlnaHQsMCwwLGYud2lkdGgsZi5oZWlnaHQpO2Zvcih2YXIgZz1iLmhleDJyZ2IoYyksaD1nWzBdLGk9Z1sxXSxqPWdbMl0saz1lLmdldEltYWdlRGF0YSgwLDAsZi53aWR0aCxmLmhlaWdodCksbD1rLmRhdGEsbT0wO208bC5sZW5ndGg7bSs9NClsW20rMF0qPWgsbFttKzFdKj1pLGxbbSsyXSo9ajtlLnB1dEltYWdlRGF0YShrLDAsMCl9LGIuQ2FudmFzVGludGVyLnJvdW5kQ29sb3I9ZnVuY3Rpb24oYSl7dmFyIGM9Yi5DYW52YXNUaW50ZXIuY2FjaGVTdGVwc1BlckNvbG9yQ2hhbm5lbCxkPWIuaGV4MnJnYihhKTtyZXR1cm4gZFswXT1NYXRoLm1pbigyNTUsZFswXS9jKmMpLGRbMV09TWF0aC5taW4oMjU1LGRbMV0vYypjKSxkWzJdPU1hdGgubWluKDI1NSxkWzJdL2MqYyksYi5yZ2IyaGV4KGQpfSxiLkNhbnZhc1RpbnRlci5jYWNoZVN0ZXBzUGVyQ29sb3JDaGFubmVsPTgsYi5DYW52YXNUaW50ZXIuY29udmVydFRpbnRUb0ltYWdlPSExLGIuQ2FudmFzVGludGVyLmNhblVzZU11bHRpcGx5PWIuY2FuVXNlTmV3Q2FudmFzQmxlbmRNb2RlcygpLGIuQ2FudmFzVGludGVyLnRpbnRNZXRob2Q9Yi5DYW52YXNUaW50ZXIuY2FuVXNlTXVsdGlwbHk/Yi5DYW52YXNUaW50ZXIudGludFdpdGhNdWx0aXBseTpiLkNhbnZhc1RpbnRlci50aW50V2l0aFBlclBpeGVsLGIuQ2FudmFzUmVuZGVyZXI9ZnVuY3Rpb24oYSxjLGQsZSl7Yi5kZWZhdWx0UmVuZGVyZXJ8fChiLnNheUhlbGxvKFwiQ2FudmFzXCIpLGIuZGVmYXVsdFJlbmRlcmVyPXRoaXMpLHRoaXMudHlwZT1iLkNBTlZBU19SRU5ERVJFUix0aGlzLmNsZWFyQmVmb3JlUmVuZGVyPSEwLHRoaXMudHJhbnNwYXJlbnQ9ISFlLGIuYmxlbmRNb2Rlc0NhbnZhc3x8KGIuYmxlbmRNb2Rlc0NhbnZhcz1bXSxiLmNhblVzZU5ld0NhbnZhc0JsZW5kTW9kZXMoKT8oYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5OT1JNQUxdPVwic291cmNlLW92ZXJcIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLkFERF09XCJsaWdodGVyXCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5NVUxUSVBMWV09XCJtdWx0aXBseVwiLGIuYmxlbmRNb2Rlc0NhbnZhc1tiLmJsZW5kTW9kZXMuU0NSRUVOXT1cInNjcmVlblwiLGIuYmxlbmRNb2Rlc0NhbnZhc1tiLmJsZW5kTW9kZXMuT1ZFUkxBWV09XCJvdmVybGF5XCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5EQVJLRU5dPVwiZGFya2VuXCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5MSUdIVEVOXT1cImxpZ2h0ZW5cIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLkNPTE9SX0RPREdFXT1cImNvbG9yLWRvZGdlXCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5DT0xPUl9CVVJOXT1cImNvbG9yLWJ1cm5cIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLkhBUkRfTElHSFRdPVwiaGFyZC1saWdodFwiLGIuYmxlbmRNb2Rlc0NhbnZhc1tiLmJsZW5kTW9kZXMuU09GVF9MSUdIVF09XCJzb2Z0LWxpZ2h0XCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5ESUZGRVJFTkNFXT1cImRpZmZlcmVuY2VcIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLkVYQ0xVU0lPTl09XCJleGNsdXNpb25cIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLkhVRV09XCJodWVcIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLlNBVFVSQVRJT05dPVwic2F0dXJhdGlvblwiLGIuYmxlbmRNb2Rlc0NhbnZhc1tiLmJsZW5kTW9kZXMuQ09MT1JdPVwiY29sb3JcIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLkxVTUlOT1NJVFldPVwibHVtaW5vc2l0eVwiKTooYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5OT1JNQUxdPVwic291cmNlLW92ZXJcIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLkFERF09XCJsaWdodGVyXCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5NVUxUSVBMWV09XCJzb3VyY2Utb3ZlclwiLGIuYmxlbmRNb2Rlc0NhbnZhc1tiLmJsZW5kTW9kZXMuU0NSRUVOXT1cInNvdXJjZS1vdmVyXCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5PVkVSTEFZXT1cInNvdXJjZS1vdmVyXCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5EQVJLRU5dPVwic291cmNlLW92ZXJcIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLkxJR0hURU5dPVwic291cmNlLW92ZXJcIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLkNPTE9SX0RPREdFXT1cInNvdXJjZS1vdmVyXCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5DT0xPUl9CVVJOXT1cInNvdXJjZS1vdmVyXCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5IQVJEX0xJR0hUXT1cInNvdXJjZS1vdmVyXCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5TT0ZUX0xJR0hUXT1cInNvdXJjZS1vdmVyXCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5ESUZGRVJFTkNFXT1cInNvdXJjZS1vdmVyXCIsYi5ibGVuZE1vZGVzQ2FudmFzW2IuYmxlbmRNb2Rlcy5FWENMVVNJT05dPVwic291cmNlLW92ZXJcIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLkhVRV09XCJzb3VyY2Utb3ZlclwiLGIuYmxlbmRNb2Rlc0NhbnZhc1tiLmJsZW5kTW9kZXMuU0FUVVJBVElPTl09XCJzb3VyY2Utb3ZlclwiLGIuYmxlbmRNb2Rlc0NhbnZhc1tiLmJsZW5kTW9kZXMuQ09MT1JdPVwic291cmNlLW92ZXJcIixiLmJsZW5kTW9kZXNDYW52YXNbYi5ibGVuZE1vZGVzLkxVTUlOT1NJVFldPVwic291cmNlLW92ZXJcIikpLHRoaXMud2lkdGg9YXx8ODAwLHRoaXMuaGVpZ2h0PWN8fDYwMCx0aGlzLnZpZXc9ZHx8ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKSx0aGlzLmNvbnRleHQ9dGhpcy52aWV3LmdldENvbnRleHQoXCIyZFwiLHthbHBoYTp0aGlzLnRyYW5zcGFyZW50fSksdGhpcy5yZWZyZXNoPSEwLHRoaXMudmlldy53aWR0aD10aGlzLndpZHRoLHRoaXMudmlldy5oZWlnaHQ9dGhpcy5oZWlnaHQsdGhpcy5jb3VudD0wLHRoaXMubWFza01hbmFnZXI9bmV3IGIuQ2FudmFzTWFza01hbmFnZXIsdGhpcy5yZW5kZXJTZXNzaW9uPXtjb250ZXh0OnRoaXMuY29udGV4dCxtYXNrTWFuYWdlcjp0aGlzLm1hc2tNYW5hZ2VyLHNjYWxlTW9kZTpudWxsLHNtb290aFByb3BlcnR5Om51bGwscm91bmRQaXhlbHM6ITF9LFwiaW1hZ2VTbW9vdGhpbmdFbmFibGVkXCJpbiB0aGlzLmNvbnRleHQ/dGhpcy5yZW5kZXJTZXNzaW9uLnNtb290aFByb3BlcnR5PVwiaW1hZ2VTbW9vdGhpbmdFbmFibGVkXCI6XCJ3ZWJraXRJbWFnZVNtb290aGluZ0VuYWJsZWRcImluIHRoaXMuY29udGV4dD90aGlzLnJlbmRlclNlc3Npb24uc21vb3RoUHJvcGVydHk9XCJ3ZWJraXRJbWFnZVNtb290aGluZ0VuYWJsZWRcIjpcIm1vekltYWdlU21vb3RoaW5nRW5hYmxlZFwiaW4gdGhpcy5jb250ZXh0P3RoaXMucmVuZGVyU2Vzc2lvbi5zbW9vdGhQcm9wZXJ0eT1cIm1vekltYWdlU21vb3RoaW5nRW5hYmxlZFwiOlwib0ltYWdlU21vb3RoaW5nRW5hYmxlZFwiaW4gdGhpcy5jb250ZXh0JiYodGhpcy5yZW5kZXJTZXNzaW9uLnNtb290aFByb3BlcnR5PVwib0ltYWdlU21vb3RoaW5nRW5hYmxlZFwiKX0sYi5DYW52YXNSZW5kZXJlci5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5DYW52YXNSZW5kZXJlcixiLkNhbnZhc1JlbmRlcmVyLnByb3RvdHlwZS5yZW5kZXI9ZnVuY3Rpb24oYSl7Yi50ZXh0dXJlc1RvVXBkYXRlLmxlbmd0aD0wLGIudGV4dHVyZXNUb0Rlc3Ryb3kubGVuZ3RoPTAsYS51cGRhdGVUcmFuc2Zvcm0oKSx0aGlzLmNvbnRleHQuc2V0VHJhbnNmb3JtKDEsMCwwLDEsMCwwKSx0aGlzLmNvbnRleHQuZ2xvYmFsQWxwaGE9MSxuYXZpZ2F0b3IuaXNDb2Nvb25KUyYmdGhpcy52aWV3LnNjcmVlbmNhbnZhcyYmKHRoaXMuY29udGV4dC5maWxsU3R5bGU9XCJibGFja1wiLHRoaXMuY29udGV4dC5jbGVhcigpKSwhdGhpcy50cmFuc3BhcmVudCYmdGhpcy5jbGVhckJlZm9yZVJlbmRlcj8odGhpcy5jb250ZXh0LmZpbGxTdHlsZT1hLmJhY2tncm91bmRDb2xvclN0cmluZyx0aGlzLmNvbnRleHQuZmlsbFJlY3QoMCwwLHRoaXMud2lkdGgsdGhpcy5oZWlnaHQpKTp0aGlzLnRyYW5zcGFyZW50JiZ0aGlzLmNsZWFyQmVmb3JlUmVuZGVyJiZ0aGlzLmNvbnRleHQuY2xlYXJSZWN0KDAsMCx0aGlzLndpZHRoLHRoaXMuaGVpZ2h0KSx0aGlzLnJlbmRlckRpc3BsYXlPYmplY3QoYSksYS5pbnRlcmFjdGl2ZSYmKGEuX2ludGVyYWN0aXZlRXZlbnRzQWRkZWR8fChhLl9pbnRlcmFjdGl2ZUV2ZW50c0FkZGVkPSEwLGEuaW50ZXJhY3Rpb25NYW5hZ2VyLnNldFRhcmdldCh0aGlzKSkpLGIuVGV4dHVyZS5mcmFtZVVwZGF0ZXMubGVuZ3RoPjAmJihiLlRleHR1cmUuZnJhbWVVcGRhdGVzLmxlbmd0aD0wKVxufSxiLkNhbnZhc1JlbmRlcmVyLnByb3RvdHlwZS5yZXNpemU9ZnVuY3Rpb24oYSxiKXt0aGlzLndpZHRoPWEsdGhpcy5oZWlnaHQ9Yix0aGlzLnZpZXcud2lkdGg9YSx0aGlzLnZpZXcuaGVpZ2h0PWJ9LGIuQ2FudmFzUmVuZGVyZXIucHJvdG90eXBlLnJlbmRlckRpc3BsYXlPYmplY3Q9ZnVuY3Rpb24oYSxiKXt0aGlzLnJlbmRlclNlc3Npb24uY29udGV4dD1ifHx0aGlzLmNvbnRleHQsYS5fcmVuZGVyQ2FudmFzKHRoaXMucmVuZGVyU2Vzc2lvbil9LGIuQ2FudmFzUmVuZGVyZXIucHJvdG90eXBlLnJlbmRlclN0cmlwRmxhdD1mdW5jdGlvbihhKXt2YXIgYj10aGlzLmNvbnRleHQsYz1hLnZlcnRpY2llcyxkPWMubGVuZ3RoLzI7dGhpcy5jb3VudCsrLGIuYmVnaW5QYXRoKCk7Zm9yKHZhciBlPTE7ZC0yPmU7ZSsrKXt2YXIgZj0yKmUsZz1jW2ZdLGg9Y1tmKzJdLGk9Y1tmKzRdLGo9Y1tmKzFdLGs9Y1tmKzNdLGw9Y1tmKzVdO2IubW92ZVRvKGcsaiksYi5saW5lVG8oaCxrKSxiLmxpbmVUbyhpLGwpfWIuZmlsbFN0eWxlPVwiI0ZGMDAwMFwiLGIuZmlsbCgpLGIuY2xvc2VQYXRoKCl9LGIuQ2FudmFzUmVuZGVyZXIucHJvdG90eXBlLnJlbmRlclN0cmlwPWZ1bmN0aW9uKGEpe3ZhciBiPXRoaXMuY29udGV4dCxjPWEudmVydGljaWVzLGQ9YS51dnMsZT1jLmxlbmd0aC8yO3RoaXMuY291bnQrKztmb3IodmFyIGY9MTtlLTI+ZjtmKyspe3ZhciBnPTIqZixoPWNbZ10saT1jW2crMl0saj1jW2crNF0saz1jW2crMV0sbD1jW2crM10sbT1jW2crNV0sbj1kW2ddKmEudGV4dHVyZS53aWR0aCxvPWRbZysyXSphLnRleHR1cmUud2lkdGgscD1kW2crNF0qYS50ZXh0dXJlLndpZHRoLHE9ZFtnKzFdKmEudGV4dHVyZS5oZWlnaHQscj1kW2crM10qYS50ZXh0dXJlLmhlaWdodCxzPWRbZys1XSphLnRleHR1cmUuaGVpZ2h0O2Iuc2F2ZSgpLGIuYmVnaW5QYXRoKCksYi5tb3ZlVG8oaCxrKSxiLmxpbmVUbyhpLGwpLGIubGluZVRvKGosbSksYi5jbG9zZVBhdGgoKSxiLmNsaXAoKTt2YXIgdD1uKnIrcSpwK28qcy1yKnAtcSpvLW4qcyx1PWgqcitxKmoraSpzLXIqai1xKmktaCpzLHY9bippK2gqcCtvKmotaSpwLWgqby1uKmosdz1uKnIqaitxKmkqcCtoKm8qcy1oKnIqcC1xKm8qai1uKmkqcyx4PWsqcitxKm0rbCpzLXIqbS1xKmwtaypzLHk9bipsK2sqcCtvKm0tbCpwLWsqby1uKm0sej1uKnIqbStxKmwqcCtrKm8qcy1rKnIqcC1xKm8qbS1uKmwqcztiLnRyYW5zZm9ybSh1L3QseC90LHYvdCx5L3Qsdy90LHovdCksYi5kcmF3SW1hZ2UoYS50ZXh0dXJlLmJhc2VUZXh0dXJlLnNvdXJjZSwwLDApLGIucmVzdG9yZSgpfX0sYi5DYW52YXNCdWZmZXI9ZnVuY3Rpb24oYSxiKXt0aGlzLndpZHRoPWEsdGhpcy5oZWlnaHQ9Yix0aGlzLmNhbnZhcz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpLHRoaXMuY29udGV4dD10aGlzLmNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIiksdGhpcy5jYW52YXMud2lkdGg9YSx0aGlzLmNhbnZhcy5oZWlnaHQ9Yn0sYi5DYW52YXNCdWZmZXIucHJvdG90eXBlLmNsZWFyPWZ1bmN0aW9uKCl7dGhpcy5jb250ZXh0LmNsZWFyUmVjdCgwLDAsdGhpcy53aWR0aCx0aGlzLmhlaWdodCl9LGIuQ2FudmFzQnVmZmVyLnByb3RvdHlwZS5yZXNpemU9ZnVuY3Rpb24oYSxiKXt0aGlzLndpZHRoPXRoaXMuY2FudmFzLndpZHRoPWEsdGhpcy5oZWlnaHQ9dGhpcy5jYW52YXMuaGVpZ2h0PWJ9LGIuQ2FudmFzR3JhcGhpY3M9ZnVuY3Rpb24oKXt9LGIuQ2FudmFzR3JhcGhpY3MucmVuZGVyR3JhcGhpY3M9ZnVuY3Rpb24oYSxjKXtmb3IodmFyIGQ9YS53b3JsZEFscGhhLGU9XCJcIixmPTA7ZjxhLmdyYXBoaWNzRGF0YS5sZW5ndGg7ZisrKXt2YXIgZz1hLmdyYXBoaWNzRGF0YVtmXSxoPWcucG9pbnRzO2lmKGMuc3Ryb2tlU3R5bGU9ZT1cIiNcIisoXCIwMDAwMFwiKygwfGcubGluZUNvbG9yKS50b1N0cmluZygxNikpLnN1YnN0cigtNiksYy5saW5lV2lkdGg9Zy5saW5lV2lkdGgsZy50eXBlPT09Yi5HcmFwaGljcy5QT0xZKXtjLmJlZ2luUGF0aCgpLGMubW92ZVRvKGhbMF0saFsxXSk7Zm9yKHZhciBpPTE7aTxoLmxlbmd0aC8yO2krKyljLmxpbmVUbyhoWzIqaV0saFsyKmkrMV0pO2hbMF09PT1oW2gubGVuZ3RoLTJdJiZoWzFdPT09aFtoLmxlbmd0aC0xXSYmYy5jbG9zZVBhdGgoKSxnLmZpbGwmJihjLmdsb2JhbEFscGhhPWcuZmlsbEFscGhhKmQsYy5maWxsU3R5bGU9ZT1cIiNcIisoXCIwMDAwMFwiKygwfGcuZmlsbENvbG9yKS50b1N0cmluZygxNikpLnN1YnN0cigtNiksYy5maWxsKCkpLGcubGluZVdpZHRoJiYoYy5nbG9iYWxBbHBoYT1nLmxpbmVBbHBoYSpkLGMuc3Ryb2tlKCkpfWVsc2UgaWYoZy50eXBlPT09Yi5HcmFwaGljcy5SRUNUKShnLmZpbGxDb2xvcnx8MD09PWcuZmlsbENvbG9yKSYmKGMuZ2xvYmFsQWxwaGE9Zy5maWxsQWxwaGEqZCxjLmZpbGxTdHlsZT1lPVwiI1wiKyhcIjAwMDAwXCIrKDB8Zy5maWxsQ29sb3IpLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC02KSxjLmZpbGxSZWN0KGhbMF0saFsxXSxoWzJdLGhbM10pKSxnLmxpbmVXaWR0aCYmKGMuZ2xvYmFsQWxwaGE9Zy5saW5lQWxwaGEqZCxjLnN0cm9rZVJlY3QoaFswXSxoWzFdLGhbMl0saFszXSkpO2Vsc2UgaWYoZy50eXBlPT09Yi5HcmFwaGljcy5DSVJDKWMuYmVnaW5QYXRoKCksYy5hcmMoaFswXSxoWzFdLGhbMl0sMCwyKk1hdGguUEkpLGMuY2xvc2VQYXRoKCksZy5maWxsJiYoYy5nbG9iYWxBbHBoYT1nLmZpbGxBbHBoYSpkLGMuZmlsbFN0eWxlPWU9XCIjXCIrKFwiMDAwMDBcIisoMHxnLmZpbGxDb2xvcikudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTYpLGMuZmlsbCgpKSxnLmxpbmVXaWR0aCYmKGMuZ2xvYmFsQWxwaGE9Zy5saW5lQWxwaGEqZCxjLnN0cm9rZSgpKTtlbHNlIGlmKGcudHlwZT09PWIuR3JhcGhpY3MuRUxJUCl7dmFyIGo9Zy5wb2ludHMsaz0yKmpbMl0sbD0yKmpbM10sbT1qWzBdLWsvMixuPWpbMV0tbC8yO2MuYmVnaW5QYXRoKCk7dmFyIG89LjU1MjI4NDgscD1rLzIqbyxxPWwvMipvLHI9bStrLHM9bitsLHQ9bStrLzIsdT1uK2wvMjtjLm1vdmVUbyhtLHUpLGMuYmV6aWVyQ3VydmVUbyhtLHUtcSx0LXAsbix0LG4pLGMuYmV6aWVyQ3VydmVUbyh0K3AsbixyLHUtcSxyLHUpLGMuYmV6aWVyQ3VydmVUbyhyLHUrcSx0K3Ascyx0LHMpLGMuYmV6aWVyQ3VydmVUbyh0LXAscyxtLHUrcSxtLHUpLGMuY2xvc2VQYXRoKCksZy5maWxsJiYoYy5nbG9iYWxBbHBoYT1nLmZpbGxBbHBoYSpkLGMuZmlsbFN0eWxlPWU9XCIjXCIrKFwiMDAwMDBcIisoMHxnLmZpbGxDb2xvcikudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTYpLGMuZmlsbCgpKSxnLmxpbmVXaWR0aCYmKGMuZ2xvYmFsQWxwaGE9Zy5saW5lQWxwaGEqZCxjLnN0cm9rZSgpKX1lbHNlIGlmKGcudHlwZT09PWIuR3JhcGhpY3MuUlJFQyl7dmFyIHY9aFswXSx3PWhbMV0seD1oWzJdLHk9aFszXSx6PWhbNF0sQT1NYXRoLm1pbih4LHkpLzJ8MDt6PXo+QT9BOnosYy5iZWdpblBhdGgoKSxjLm1vdmVUbyh2LHcreiksYy5saW5lVG8odix3K3kteiksYy5xdWFkcmF0aWNDdXJ2ZVRvKHYsdyt5LHYreix3K3kpLGMubGluZVRvKHYreC16LHcreSksYy5xdWFkcmF0aWNDdXJ2ZVRvKHYreCx3K3ksdit4LHcreS16KSxjLmxpbmVUbyh2K3gsdyt6KSxjLnF1YWRyYXRpY0N1cnZlVG8odit4LHcsdit4LXosdyksYy5saW5lVG8odit6LHcpLGMucXVhZHJhdGljQ3VydmVUbyh2LHcsdix3K3opLGMuY2xvc2VQYXRoKCksKGcuZmlsbENvbG9yfHwwPT09Zy5maWxsQ29sb3IpJiYoYy5nbG9iYWxBbHBoYT1nLmZpbGxBbHBoYSpkLGMuZmlsbFN0eWxlPWU9XCIjXCIrKFwiMDAwMDBcIisoMHxnLmZpbGxDb2xvcikudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTYpLGMuZmlsbCgpKSxnLmxpbmVXaWR0aCYmKGMuZ2xvYmFsQWxwaGE9Zy5saW5lQWxwaGEqZCxjLnN0cm9rZSgpKX19fSxiLkNhbnZhc0dyYXBoaWNzLnJlbmRlckdyYXBoaWNzTWFzaz1mdW5jdGlvbihhLGMpe3ZhciBkPWEuZ3JhcGhpY3NEYXRhLmxlbmd0aDtpZigwIT09ZCl7ZD4xJiYoZD0xLHdpbmRvdy5jb25zb2xlLmxvZyhcIlBpeGkuanMgd2FybmluZzogbWFza3MgaW4gY2FudmFzIGNhbiBvbmx5IG1hc2sgdXNpbmcgdGhlIGZpcnN0IHBhdGggaW4gdGhlIGdyYXBoaWNzIG9iamVjdFwiKSk7Zm9yKHZhciBlPTA7MT5lO2UrKyl7dmFyIGY9YS5ncmFwaGljc0RhdGFbZV0sZz1mLnBvaW50cztpZihmLnR5cGU9PT1iLkdyYXBoaWNzLlBPTFkpe2MuYmVnaW5QYXRoKCksYy5tb3ZlVG8oZ1swXSxnWzFdKTtmb3IodmFyIGg9MTtoPGcubGVuZ3RoLzI7aCsrKWMubGluZVRvKGdbMipoXSxnWzIqaCsxXSk7Z1swXT09PWdbZy5sZW5ndGgtMl0mJmdbMV09PT1nW2cubGVuZ3RoLTFdJiZjLmNsb3NlUGF0aCgpfWVsc2UgaWYoZi50eXBlPT09Yi5HcmFwaGljcy5SRUNUKWMuYmVnaW5QYXRoKCksYy5yZWN0KGdbMF0sZ1sxXSxnWzJdLGdbM10pLGMuY2xvc2VQYXRoKCk7ZWxzZSBpZihmLnR5cGU9PT1iLkdyYXBoaWNzLkNJUkMpYy5iZWdpblBhdGgoKSxjLmFyYyhnWzBdLGdbMV0sZ1syXSwwLDIqTWF0aC5QSSksYy5jbG9zZVBhdGgoKTtlbHNlIGlmKGYudHlwZT09PWIuR3JhcGhpY3MuRUxJUCl7dmFyIGk9Zi5wb2ludHMsaj0yKmlbMl0saz0yKmlbM10sbD1pWzBdLWovMixtPWlbMV0tay8yO2MuYmVnaW5QYXRoKCk7dmFyIG49LjU1MjI4NDgsbz1qLzIqbixwPWsvMipuLHE9bCtqLHI9bStrLHM9bCtqLzIsdD1tK2svMjtjLm1vdmVUbyhsLHQpLGMuYmV6aWVyQ3VydmVUbyhsLHQtcCxzLW8sbSxzLG0pLGMuYmV6aWVyQ3VydmVUbyhzK28sbSxxLHQtcCxxLHQpLGMuYmV6aWVyQ3VydmVUbyhxLHQrcCxzK28scixzLHIpLGMuYmV6aWVyQ3VydmVUbyhzLW8scixsLHQrcCxsLHQpLGMuY2xvc2VQYXRoKCl9ZWxzZSBpZihmLnR5cGU9PT1iLkdyYXBoaWNzLlJSRUMpe3ZhciB1PWdbMF0sdj1nWzFdLHc9Z1syXSx4PWdbM10seT1nWzRdLHo9TWF0aC5taW4odyx4KS8yfDA7eT15Pno/ejp5LGMuYmVnaW5QYXRoKCksYy5tb3ZlVG8odSx2K3kpLGMubGluZVRvKHUsdit4LXkpLGMucXVhZHJhdGljQ3VydmVUbyh1LHYreCx1K3ksdit4KSxjLmxpbmVUbyh1K3cteSx2K3gpLGMucXVhZHJhdGljQ3VydmVUbyh1K3csdit4LHUrdyx2K3gteSksYy5saW5lVG8odSt3LHYreSksYy5xdWFkcmF0aWNDdXJ2ZVRvKHUrdyx2LHUrdy15LHYpLGMubGluZVRvKHUreSx2KSxjLnF1YWRyYXRpY0N1cnZlVG8odSx2LHUsdit5KSxjLmNsb3NlUGF0aCgpfX19fSxiLkdyYXBoaWNzPWZ1bmN0aW9uKCl7Yi5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLmNhbGwodGhpcyksdGhpcy5yZW5kZXJhYmxlPSEwLHRoaXMuZmlsbEFscGhhPTEsdGhpcy5saW5lV2lkdGg9MCx0aGlzLmxpbmVDb2xvcj1cImJsYWNrXCIsdGhpcy5ncmFwaGljc0RhdGE9W10sdGhpcy50aW50PTE2Nzc3MjE1LHRoaXMuYmxlbmRNb2RlPWIuYmxlbmRNb2Rlcy5OT1JNQUwsdGhpcy5jdXJyZW50UGF0aD17cG9pbnRzOltdfSx0aGlzLl93ZWJHTD1bXSx0aGlzLmlzTWFzaz0hMSx0aGlzLmJvdW5kcz1udWxsLHRoaXMuYm91bmRzUGFkZGluZz0xMCx0aGlzLmRpcnR5PSEwfSxiLkdyYXBoaWNzLnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGIuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUpLGIuR3JhcGhpY3MucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuR3JhcGhpY3MsT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuR3JhcGhpY3MucHJvdG90eXBlLFwiY2FjaGVBc0JpdG1hcFwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fY2FjaGVBc0JpdG1hcH0sc2V0OmZ1bmN0aW9uKGEpe3RoaXMuX2NhY2hlQXNCaXRtYXA9YSx0aGlzLl9jYWNoZUFzQml0bWFwP3RoaXMuX2dlbmVyYXRlQ2FjaGVkU3ByaXRlKCk6KHRoaXMuZGVzdHJveUNhY2hlZFNwcml0ZSgpLHRoaXMuZGlydHk9ITApfX0pLGIuR3JhcGhpY3MucHJvdG90eXBlLmxpbmVTdHlsZT1mdW5jdGlvbihhLGMsZCl7cmV0dXJuIHRoaXMuY3VycmVudFBhdGgucG9pbnRzLmxlbmd0aHx8dGhpcy5ncmFwaGljc0RhdGEucG9wKCksdGhpcy5saW5lV2lkdGg9YXx8MCx0aGlzLmxpbmVDb2xvcj1jfHwwLHRoaXMubGluZUFscGhhPWFyZ3VtZW50cy5sZW5ndGg8Mz8xOmQsdGhpcy5jdXJyZW50UGF0aD17bGluZVdpZHRoOnRoaXMubGluZVdpZHRoLGxpbmVDb2xvcjp0aGlzLmxpbmVDb2xvcixsaW5lQWxwaGE6dGhpcy5saW5lQWxwaGEsZmlsbENvbG9yOnRoaXMuZmlsbENvbG9yLGZpbGxBbHBoYTp0aGlzLmZpbGxBbHBoYSxmaWxsOnRoaXMuZmlsbGluZyxwb2ludHM6W10sdHlwZTpiLkdyYXBoaWNzLlBPTFl9LHRoaXMuZ3JhcGhpY3NEYXRhLnB1c2godGhpcy5jdXJyZW50UGF0aCksdGhpc30sYi5HcmFwaGljcy5wcm90b3R5cGUubW92ZVRvPWZ1bmN0aW9uKGEsYyl7cmV0dXJuIHRoaXMuY3VycmVudFBhdGgucG9pbnRzLmxlbmd0aHx8dGhpcy5ncmFwaGljc0RhdGEucG9wKCksdGhpcy5jdXJyZW50UGF0aD10aGlzLmN1cnJlbnRQYXRoPXtsaW5lV2lkdGg6dGhpcy5saW5lV2lkdGgsbGluZUNvbG9yOnRoaXMubGluZUNvbG9yLGxpbmVBbHBoYTp0aGlzLmxpbmVBbHBoYSxmaWxsQ29sb3I6dGhpcy5maWxsQ29sb3IsZmlsbEFscGhhOnRoaXMuZmlsbEFscGhhLGZpbGw6dGhpcy5maWxsaW5nLHBvaW50czpbXSx0eXBlOmIuR3JhcGhpY3MuUE9MWX0sdGhpcy5jdXJyZW50UGF0aC5wb2ludHMucHVzaChhLGMpLHRoaXMuZ3JhcGhpY3NEYXRhLnB1c2godGhpcy5jdXJyZW50UGF0aCksdGhpc30sYi5HcmFwaGljcy5wcm90b3R5cGUubGluZVRvPWZ1bmN0aW9uKGEsYil7cmV0dXJuIHRoaXMuY3VycmVudFBhdGgucG9pbnRzLnB1c2goYSxiKSx0aGlzLmRpcnR5PSEwLHRoaXN9LGIuR3JhcGhpY3MucHJvdG90eXBlLnF1YWRyYXRpY0N1cnZlVG89ZnVuY3Rpb24oYSxiLGMsZCl7MD09PXRoaXMuY3VycmVudFBhdGgucG9pbnRzLmxlbmd0aCYmdGhpcy5tb3ZlVG8oMCwwKTt2YXIgZSxmLGc9MjAsaD10aGlzLmN1cnJlbnRQYXRoLnBvaW50czswPT09aC5sZW5ndGgmJnRoaXMubW92ZVRvKDAsMCk7Zm9yKHZhciBpPWhbaC5sZW5ndGgtMl0saj1oW2gubGVuZ3RoLTFdLGs9MCxsPTE7Zz49bDtsKyspaz1sL2csZT1pKyhhLWkpKmssZj1qKyhiLWopKmssaC5wdXNoKGUrKGErKGMtYSkqay1lKSprLGYrKGIrKGQtYikqay1mKSprKTtyZXR1cm4gdGhpcy5kaXJ0eT0hMCx0aGlzfSxiLkdyYXBoaWNzLnByb3RvdHlwZS5iZXppZXJDdXJ2ZVRvPWZ1bmN0aW9uKGEsYixjLGQsZSxmKXswPT09dGhpcy5jdXJyZW50UGF0aC5wb2ludHMubGVuZ3RoJiZ0aGlzLm1vdmVUbygwLDApO2Zvcih2YXIgZyxoLGksaixrLGw9MjAsbT10aGlzLmN1cnJlbnRQYXRoLnBvaW50cyxuPW1bbS5sZW5ndGgtMl0sbz1tW20ubGVuZ3RoLTFdLHA9MCxxPTE7bD5xO3ErKylwPXEvbCxnPTEtcCxoPWcqZyxpPWgqZyxqPXAqcCxrPWoqcCxtLnB1c2goaSpuKzMqaCpwKmErMypnKmoqYytrKmUsaSpvKzMqaCpwKmIrMypnKmoqZCtrKmYpO3JldHVybiB0aGlzLmRpcnR5PSEwLHRoaXN9LGIuR3JhcGhpY3MucHJvdG90eXBlLmFyY1RvPWZ1bmN0aW9uKGEsYixjLGQsZSl7MD09PXRoaXMuY3VycmVudFBhdGgucG9pbnRzLmxlbmd0aCYmdGhpcy5tb3ZlVG8oYSxiKTt2YXIgZj10aGlzLmN1cnJlbnRQYXRoLnBvaW50cyxnPWZbZi5sZW5ndGgtMl0saD1mW2YubGVuZ3RoLTFdLGk9aC1iLGo9Zy1hLGs9ZC1iLGw9Yy1hLG09TWF0aC5hYnMoaSpsLWoqayk7aWYoMWUtOD5tfHwwPT09ZSlmLnB1c2goYSxiKTtlbHNle3ZhciBuPWkqaStqKmosbz1rKmsrbCpsLHA9aSprK2oqbCxxPWUqTWF0aC5zcXJ0KG4pL20scj1lKk1hdGguc3FydChvKS9tLHM9cSpwL24sdD1yKnAvbyx1PXEqbCtyKmosdj1xKmsrcippLHc9aioocitzKSx4PWkqKHIrcykseT1sKihxK3QpLHo9ayoocSt0KSxBPU1hdGguYXRhbjIoeC12LHctdSksQj1NYXRoLmF0YW4yKHotdix5LXUpO3RoaXMuYXJjKHUrYSx2K2IsZSxBLEIsaiprPmwqaSl9cmV0dXJuIHRoaXMuZGlydHk9ITAsdGhpc30sYi5HcmFwaGljcy5wcm90b3R5cGUuYXJjPWZ1bmN0aW9uKGEsYixjLGQsZSxmKXt2YXIgZz1hK01hdGguY29zKGQpKmMsaD1iK01hdGguc2luKGQpKmMsaT10aGlzLmN1cnJlbnRQYXRoLnBvaW50cztpZigoMCE9PWkubGVuZ3RoJiZpW2kubGVuZ3RoLTJdIT09Z3x8aVtpLmxlbmd0aC0xXSE9PWgpJiYodGhpcy5tb3ZlVG8oZyxoKSxpPXRoaXMuY3VycmVudFBhdGgucG9pbnRzKSxkPT09ZSlyZXR1cm4gdGhpczshZiYmZD49ZT9lKz0yKk1hdGguUEk6ZiYmZT49ZCYmKGQrPTIqTWF0aC5QSSk7dmFyIGo9Zj8tMSooZC1lKTplLWQsaz1NYXRoLmFicyhqKS8oMipNYXRoLlBJKSo0MDtpZigwPT09ailyZXR1cm4gdGhpcztmb3IodmFyIGw9ai8oMiprKSxtPTIqbCxuPU1hdGguY29zKGwpLG89TWF0aC5zaW4obCkscD1rLTEscT1wJTEvcCxyPTA7cD49cjtyKyspe3ZhciBzPXIrcSpyLHQ9bCtkK20qcyx1PU1hdGguY29zKHQpLHY9LU1hdGguc2luKHQpO2kucHVzaCgobip1K28qdikqYythLChuKi12K28qdSkqYytiKX1yZXR1cm4gdGhpcy5kaXJ0eT0hMCx0aGlzfSxiLkdyYXBoaWNzLnByb3RvdHlwZS5kcmF3UGF0aD1mdW5jdGlvbihhKXtyZXR1cm4gdGhpcy5jdXJyZW50UGF0aC5wb2ludHMubGVuZ3RofHx0aGlzLmdyYXBoaWNzRGF0YS5wb3AoKSx0aGlzLmN1cnJlbnRQYXRoPXRoaXMuY3VycmVudFBhdGg9e2xpbmVXaWR0aDp0aGlzLmxpbmVXaWR0aCxsaW5lQ29sb3I6dGhpcy5saW5lQ29sb3IsbGluZUFscGhhOnRoaXMubGluZUFscGhhLGZpbGxDb2xvcjp0aGlzLmZpbGxDb2xvcixmaWxsQWxwaGE6dGhpcy5maWxsQWxwaGEsZmlsbDp0aGlzLmZpbGxpbmcscG9pbnRzOltdLHR5cGU6Yi5HcmFwaGljcy5QT0xZfSx0aGlzLmdyYXBoaWNzRGF0YS5wdXNoKHRoaXMuY3VycmVudFBhdGgpLHRoaXMuY3VycmVudFBhdGgucG9pbnRzPXRoaXMuY3VycmVudFBhdGgucG9pbnRzLmNvbmNhdChhKSx0aGlzLmRpcnR5PSEwLHRoaXN9LGIuR3JhcGhpY3MucHJvdG90eXBlLmJlZ2luRmlsbD1mdW5jdGlvbihhLGIpe3JldHVybiB0aGlzLmZpbGxpbmc9ITAsdGhpcy5maWxsQ29sb3I9YXx8MCx0aGlzLmZpbGxBbHBoYT1hcmd1bWVudHMubGVuZ3RoPDI/MTpiLHRoaXN9LGIuR3JhcGhpY3MucHJvdG90eXBlLmVuZEZpbGw9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5maWxsaW5nPSExLHRoaXMuZmlsbENvbG9yPW51bGwsdGhpcy5maWxsQWxwaGE9MSx0aGlzfSxiLkdyYXBoaWNzLnByb3RvdHlwZS5kcmF3UmVjdD1mdW5jdGlvbihhLGMsZCxlKXtyZXR1cm4gdGhpcy5jdXJyZW50UGF0aC5wb2ludHMubGVuZ3RofHx0aGlzLmdyYXBoaWNzRGF0YS5wb3AoKSx0aGlzLmN1cnJlbnRQYXRoPXtsaW5lV2lkdGg6dGhpcy5saW5lV2lkdGgsbGluZUNvbG9yOnRoaXMubGluZUNvbG9yLGxpbmVBbHBoYTp0aGlzLmxpbmVBbHBoYSxmaWxsQ29sb3I6dGhpcy5maWxsQ29sb3IsZmlsbEFscGhhOnRoaXMuZmlsbEFscGhhLGZpbGw6dGhpcy5maWxsaW5nLHBvaW50czpbYSxjLGQsZV0sdHlwZTpiLkdyYXBoaWNzLlJFQ1R9LHRoaXMuZ3JhcGhpY3NEYXRhLnB1c2godGhpcy5jdXJyZW50UGF0aCksdGhpcy5kaXJ0eT0hMCx0aGlzfSxiLkdyYXBoaWNzLnByb3RvdHlwZS5kcmF3Um91bmRlZFJlY3Q9ZnVuY3Rpb24oYSxjLGQsZSxmKXtyZXR1cm4gdGhpcy5jdXJyZW50UGF0aC5wb2ludHMubGVuZ3RofHx0aGlzLmdyYXBoaWNzRGF0YS5wb3AoKSx0aGlzLmN1cnJlbnRQYXRoPXtsaW5lV2lkdGg6dGhpcy5saW5lV2lkdGgsbGluZUNvbG9yOnRoaXMubGluZUNvbG9yLGxpbmVBbHBoYTp0aGlzLmxpbmVBbHBoYSxmaWxsQ29sb3I6dGhpcy5maWxsQ29sb3IsZmlsbEFscGhhOnRoaXMuZmlsbEFscGhhLGZpbGw6dGhpcy5maWxsaW5nLHBvaW50czpbYSxjLGQsZSxmXSx0eXBlOmIuR3JhcGhpY3MuUlJFQ30sdGhpcy5ncmFwaGljc0RhdGEucHVzaCh0aGlzLmN1cnJlbnRQYXRoKSx0aGlzLmRpcnR5PSEwLHRoaXN9LGIuR3JhcGhpY3MucHJvdG90eXBlLmRyYXdDaXJjbGU9ZnVuY3Rpb24oYSxjLGQpe3JldHVybiB0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5sZW5ndGh8fHRoaXMuZ3JhcGhpY3NEYXRhLnBvcCgpLHRoaXMuY3VycmVudFBhdGg9e2xpbmVXaWR0aDp0aGlzLmxpbmVXaWR0aCxsaW5lQ29sb3I6dGhpcy5saW5lQ29sb3IsbGluZUFscGhhOnRoaXMubGluZUFscGhhLGZpbGxDb2xvcjp0aGlzLmZpbGxDb2xvcixmaWxsQWxwaGE6dGhpcy5maWxsQWxwaGEsZmlsbDp0aGlzLmZpbGxpbmcscG9pbnRzOlthLGMsZCxkXSx0eXBlOmIuR3JhcGhpY3MuQ0lSQ30sdGhpcy5ncmFwaGljc0RhdGEucHVzaCh0aGlzLmN1cnJlbnRQYXRoKSx0aGlzLmRpcnR5PSEwLHRoaXN9LGIuR3JhcGhpY3MucHJvdG90eXBlLmRyYXdFbGxpcHNlPWZ1bmN0aW9uKGEsYyxkLGUpe3JldHVybiB0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5sZW5ndGh8fHRoaXMuZ3JhcGhpY3NEYXRhLnBvcCgpLHRoaXMuY3VycmVudFBhdGg9e2xpbmVXaWR0aDp0aGlzLmxpbmVXaWR0aCxsaW5lQ29sb3I6dGhpcy5saW5lQ29sb3IsbGluZUFscGhhOnRoaXMubGluZUFscGhhLGZpbGxDb2xvcjp0aGlzLmZpbGxDb2xvcixmaWxsQWxwaGE6dGhpcy5maWxsQWxwaGEsZmlsbDp0aGlzLmZpbGxpbmcscG9pbnRzOlthLGMsZCxlXSx0eXBlOmIuR3JhcGhpY3MuRUxJUH0sdGhpcy5ncmFwaGljc0RhdGEucHVzaCh0aGlzLmN1cnJlbnRQYXRoKSx0aGlzLmRpcnR5PSEwLHRoaXN9LGIuR3JhcGhpY3MucHJvdG90eXBlLmNsZWFyPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubGluZVdpZHRoPTAsdGhpcy5maWxsaW5nPSExLHRoaXMuZGlydHk9ITAsdGhpcy5jbGVhckRpcnR5PSEwLHRoaXMuZ3JhcGhpY3NEYXRhPVtdLHRoaXMuYm91bmRzPW51bGwsdGhpc30sYi5HcmFwaGljcy5wcm90b3R5cGUuZ2VuZXJhdGVUZXh0dXJlPWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5nZXRCb3VuZHMoKSxjPW5ldyBiLkNhbnZhc0J1ZmZlcihhLndpZHRoLGEuaGVpZ2h0KSxkPWIuVGV4dHVyZS5mcm9tQ2FudmFzKGMuY2FudmFzKTtyZXR1cm4gYy5jb250ZXh0LnRyYW5zbGF0ZSgtYS54LC1hLnkpLGIuQ2FudmFzR3JhcGhpY3MucmVuZGVyR3JhcGhpY3ModGhpcyxjLmNvbnRleHQpLGR9LGIuR3JhcGhpY3MucHJvdG90eXBlLl9yZW5kZXJXZWJHTD1mdW5jdGlvbihhKXtpZih0aGlzLnZpc2libGUhPT0hMSYmMCE9PXRoaXMuYWxwaGEmJnRoaXMuaXNNYXNrIT09ITApe2lmKHRoaXMuX2NhY2hlQXNCaXRtYXApcmV0dXJuIHRoaXMuZGlydHkmJih0aGlzLl9nZW5lcmF0ZUNhY2hlZFNwcml0ZSgpLGIudXBkYXRlV2ViR0xUZXh0dXJlKHRoaXMuX2NhY2hlZFNwcml0ZS50ZXh0dXJlLmJhc2VUZXh0dXJlLGEuZ2wpLHRoaXMuZGlydHk9ITEpLHRoaXMuX2NhY2hlZFNwcml0ZS5hbHBoYT10aGlzLmFscGhhLGIuU3ByaXRlLnByb3RvdHlwZS5fcmVuZGVyV2ViR0wuY2FsbCh0aGlzLl9jYWNoZWRTcHJpdGUsYSksdm9pZCAwO2lmKGEuc3ByaXRlQmF0Y2guc3RvcCgpLGEuYmxlbmRNb2RlTWFuYWdlci5zZXRCbGVuZE1vZGUodGhpcy5ibGVuZE1vZGUpLHRoaXMuX21hc2smJmEubWFza01hbmFnZXIucHVzaE1hc2sodGhpcy5fbWFzayxhKSx0aGlzLl9maWx0ZXJzJiZhLmZpbHRlck1hbmFnZXIucHVzaEZpbHRlcih0aGlzLl9maWx0ZXJCbG9jayksdGhpcy5ibGVuZE1vZGUhPT1hLnNwcml0ZUJhdGNoLmN1cnJlbnRCbGVuZE1vZGUpe2Euc3ByaXRlQmF0Y2guY3VycmVudEJsZW5kTW9kZT10aGlzLmJsZW5kTW9kZTt2YXIgYz1iLmJsZW5kTW9kZXNXZWJHTFthLnNwcml0ZUJhdGNoLmN1cnJlbnRCbGVuZE1vZGVdO2Euc3ByaXRlQmF0Y2guZ2wuYmxlbmRGdW5jKGNbMF0sY1sxXSl9aWYoYi5XZWJHTEdyYXBoaWNzLnJlbmRlckdyYXBoaWNzKHRoaXMsYSksdGhpcy5jaGlsZHJlbi5sZW5ndGgpe2Euc3ByaXRlQmF0Y2guc3RhcnQoKTtmb3IodmFyIGQ9MCxlPXRoaXMuY2hpbGRyZW4ubGVuZ3RoO2U+ZDtkKyspdGhpcy5jaGlsZHJlbltkXS5fcmVuZGVyV2ViR0woYSk7YS5zcHJpdGVCYXRjaC5zdG9wKCl9dGhpcy5fZmlsdGVycyYmYS5maWx0ZXJNYW5hZ2VyLnBvcEZpbHRlcigpLHRoaXMuX21hc2smJmEubWFza01hbmFnZXIucG9wTWFzayh0aGlzLm1hc2ssYSksYS5kcmF3Q291bnQrKyxhLnNwcml0ZUJhdGNoLnN0YXJ0KCl9fSxiLkdyYXBoaWNzLnByb3RvdHlwZS5fcmVuZGVyQ2FudmFzPWZ1bmN0aW9uKGEpe2lmKHRoaXMudmlzaWJsZSE9PSExJiYwIT09dGhpcy5hbHBoYSYmdGhpcy5pc01hc2shPT0hMCl7dmFyIGM9YS5jb250ZXh0LGQ9dGhpcy53b3JsZFRyYW5zZm9ybTt0aGlzLmJsZW5kTW9kZSE9PWEuY3VycmVudEJsZW5kTW9kZSYmKGEuY3VycmVudEJsZW5kTW9kZT10aGlzLmJsZW5kTW9kZSxjLmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbj1iLmJsZW5kTW9kZXNDYW52YXNbYS5jdXJyZW50QmxlbmRNb2RlXSksdGhpcy5fbWFzayYmYS5tYXNrTWFuYWdlci5wdXNoTWFzayh0aGlzLl9tYXNrLGEuY29udGV4dCksYy5zZXRUcmFuc2Zvcm0oZC5hLGQuYyxkLmIsZC5kLGQudHgsZC50eSksYi5DYW52YXNHcmFwaGljcy5yZW5kZXJHcmFwaGljcyh0aGlzLGMpO2Zvcih2YXIgZT0wLGY9dGhpcy5jaGlsZHJlbi5sZW5ndGg7Zj5lO2UrKyl0aGlzLmNoaWxkcmVuW2VdLl9yZW5kZXJDYW52YXMoYSk7dGhpcy5fbWFzayYmYS5tYXNrTWFuYWdlci5wb3BNYXNrKGEuY29udGV4dCl9fSxiLkdyYXBoaWNzLnByb3RvdHlwZS5nZXRCb3VuZHM9ZnVuY3Rpb24oYSl7dGhpcy5ib3VuZHN8fHRoaXMudXBkYXRlQm91bmRzKCk7dmFyIGI9dGhpcy5ib3VuZHMueCxjPXRoaXMuYm91bmRzLndpZHRoK3RoaXMuYm91bmRzLngsZD10aGlzLmJvdW5kcy55LGU9dGhpcy5ib3VuZHMuaGVpZ2h0K3RoaXMuYm91bmRzLnksZj1hfHx0aGlzLndvcmxkVHJhbnNmb3JtLGc9Zi5hLGg9Zi5jLGk9Zi5iLGo9Zi5kLGs9Zi50eCxsPWYudHksbT1nKmMraSplK2ssbj1qKmUraCpjK2wsbz1nKmIraSplK2sscD1qKmUraCpiK2wscT1nKmIraSpkK2sscj1qKmQraCpiK2wscz1nKmMraSpkK2ssdD1qKmQraCpjK2wsdT1tLHY9bix3PW0seD1uO3c9dz5vP286dyx3PXc+cT9xOncsdz13PnM/czp3LHg9eD5wP3A6eCx4PXg+cj9yOngseD14PnQ/dDp4LHU9bz51P286dSx1PXE+dT9xOnUsdT1zPnU/czp1LHY9cD52P3A6dix2PXI+dj9yOnYsdj10PnY/dDp2O3ZhciB5PXRoaXMuX2JvdW5kcztyZXR1cm4geS54PXcseS53aWR0aD11LXcseS55PXgseS5oZWlnaHQ9di14LHl9LGIuR3JhcGhpY3MucHJvdG90eXBlLnVwZGF0ZUJvdW5kcz1mdW5jdGlvbigpe2Zvcih2YXIgYSxjLGQsZSxmLGc9MS8wLGg9LTEvMCxpPTEvMCxqPS0xLzAsaz0wO2s8dGhpcy5ncmFwaGljc0RhdGEubGVuZ3RoO2srKyl7dmFyIGw9dGhpcy5ncmFwaGljc0RhdGFba10sbT1sLnR5cGUsbj1sLmxpbmVXaWR0aDtpZihhPWwucG9pbnRzLG09PT1iLkdyYXBoaWNzLlJFQ1QpYz1hWzBdLW4vMixkPWFbMV0tbi8yLGU9YVsyXStuLGY9YVszXStuLGc9Zz5jP2M6ZyxoPWMrZT5oP2MrZTpoLGk9aT5kP2M6aSxqPWQrZj5qP2QrZjpqO2Vsc2UgaWYobT09PWIuR3JhcGhpY3MuQ0lSQ3x8bT09PWIuR3JhcGhpY3MuRUxJUCljPWFbMF0sZD1hWzFdLGU9YVsyXStuLzIsZj1hWzNdK24vMixnPWc+Yy1lP2MtZTpnLGg9YytlPmg/YytlOmgsaT1pPmQtZj9kLWY6aSxqPWQrZj5qP2QrZjpqO2Vsc2UgZm9yKHZhciBvPTA7bzxhLmxlbmd0aDtvKz0yKWM9YVtvXSxkPWFbbysxXSxnPWc+Yy1uP2MtbjpnLGg9YytuPmg/YytuOmgsaT1pPmQtbj9kLW46aSxqPWQrbj5qP2QrbjpqfXZhciBwPXRoaXMuYm91bmRzUGFkZGluZzt0aGlzLmJvdW5kcz1uZXcgYi5SZWN0YW5nbGUoZy1wLGktcCxoLWcrMipwLGotaSsyKnApfSxiLkdyYXBoaWNzLnByb3RvdHlwZS5fZ2VuZXJhdGVDYWNoZWRTcHJpdGU9ZnVuY3Rpb24oKXt2YXIgYT10aGlzLmdldExvY2FsQm91bmRzKCk7aWYodGhpcy5fY2FjaGVkU3ByaXRlKXRoaXMuX2NhY2hlZFNwcml0ZS5idWZmZXIucmVzaXplKGEud2lkdGgsYS5oZWlnaHQpO2Vsc2V7dmFyIGM9bmV3IGIuQ2FudmFzQnVmZmVyKGEud2lkdGgsYS5oZWlnaHQpLGQ9Yi5UZXh0dXJlLmZyb21DYW52YXMoYy5jYW52YXMpO3RoaXMuX2NhY2hlZFNwcml0ZT1uZXcgYi5TcHJpdGUoZCksdGhpcy5fY2FjaGVkU3ByaXRlLmJ1ZmZlcj1jLHRoaXMuX2NhY2hlZFNwcml0ZS53b3JsZFRyYW5zZm9ybT10aGlzLndvcmxkVHJhbnNmb3JtfXRoaXMuX2NhY2hlZFNwcml0ZS5hbmNob3IueD0tKGEueC9hLndpZHRoKSx0aGlzLl9jYWNoZWRTcHJpdGUuYW5jaG9yLnk9LShhLnkvYS5oZWlnaHQpLHRoaXMuX2NhY2hlZFNwcml0ZS5idWZmZXIuY29udGV4dC50cmFuc2xhdGUoLWEueCwtYS55KSxiLkNhbnZhc0dyYXBoaWNzLnJlbmRlckdyYXBoaWNzKHRoaXMsdGhpcy5fY2FjaGVkU3ByaXRlLmJ1ZmZlci5jb250ZXh0KSx0aGlzLl9jYWNoZWRTcHJpdGUuYWxwaGE9dGhpcy5hbHBoYX0sYi5HcmFwaGljcy5wcm90b3R5cGUuZGVzdHJveUNhY2hlZFNwcml0ZT1mdW5jdGlvbigpe3RoaXMuX2NhY2hlZFNwcml0ZS50ZXh0dXJlLmRlc3Ryb3koITApLHRoaXMuX2NhY2hlZFNwcml0ZT1udWxsfSxiLkdyYXBoaWNzLlBPTFk9MCxiLkdyYXBoaWNzLlJFQ1Q9MSxiLkdyYXBoaWNzLkNJUkM9MixiLkdyYXBoaWNzLkVMSVA9MyxiLkdyYXBoaWNzLlJSRUM9NCxiLlN0cmlwPWZ1bmN0aW9uKGEpe2IuRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKHRoaXMpLHRoaXMudGV4dHVyZT1hLHRoaXMudXZzPW5ldyBiLkZsb2F0MzJBcnJheShbMCwxLDEsMSwxLDAsMCwxXSksdGhpcy52ZXJ0aWNpZXM9bmV3IGIuRmxvYXQzMkFycmF5KFswLDAsMTAwLDAsMTAwLDEwMCwwLDEwMF0pLHRoaXMuY29sb3JzPW5ldyBiLkZsb2F0MzJBcnJheShbMSwxLDEsMV0pLHRoaXMuaW5kaWNlcz1uZXcgYi5VaW50MTZBcnJheShbMCwxLDIsM10pLHRoaXMuZGlydHk9ITB9LGIuU3RyaXAucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoYi5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSksYi5TdHJpcC5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5TdHJpcCxiLlN0cmlwLnByb3RvdHlwZS5fcmVuZGVyV2ViR0w9ZnVuY3Rpb24oYSl7IXRoaXMudmlzaWJsZXx8dGhpcy5hbHBoYTw9MHx8KGEuc3ByaXRlQmF0Y2guc3RvcCgpLHRoaXMuX3ZlcnRleEJ1ZmZlcnx8dGhpcy5faW5pdFdlYkdMKGEpLGEuc2hhZGVyTWFuYWdlci5zZXRTaGFkZXIoYS5zaGFkZXJNYW5hZ2VyLnN0cmlwU2hhZGVyKSx0aGlzLl9yZW5kZXJTdHJpcChhKSxhLnNwcml0ZUJhdGNoLnN0YXJ0KCkpfSxiLlN0cmlwLnByb3RvdHlwZS5faW5pdFdlYkdMPWZ1bmN0aW9uKGEpe3ZhciBiPWEuZ2w7dGhpcy5fdmVydGV4QnVmZmVyPWIuY3JlYXRlQnVmZmVyKCksdGhpcy5faW5kZXhCdWZmZXI9Yi5jcmVhdGVCdWZmZXIoKSx0aGlzLl91dkJ1ZmZlcj1iLmNyZWF0ZUJ1ZmZlcigpLHRoaXMuX2NvbG9yQnVmZmVyPWIuY3JlYXRlQnVmZmVyKCksYi5iaW5kQnVmZmVyKGIuQVJSQVlfQlVGRkVSLHRoaXMuX3ZlcnRleEJ1ZmZlciksYi5idWZmZXJEYXRhKGIuQVJSQVlfQlVGRkVSLHRoaXMudmVydGljaWVzLGIuRFlOQU1JQ19EUkFXKSxiLmJpbmRCdWZmZXIoYi5BUlJBWV9CVUZGRVIsdGhpcy5fdXZCdWZmZXIpLGIuYnVmZmVyRGF0YShiLkFSUkFZX0JVRkZFUix0aGlzLnV2cyxiLlNUQVRJQ19EUkFXKSxiLmJpbmRCdWZmZXIoYi5BUlJBWV9CVUZGRVIsdGhpcy5fY29sb3JCdWZmZXIpLGIuYnVmZmVyRGF0YShiLkFSUkFZX0JVRkZFUix0aGlzLmNvbG9ycyxiLlNUQVRJQ19EUkFXKSxiLmJpbmRCdWZmZXIoYi5FTEVNRU5UX0FSUkFZX0JVRkZFUix0aGlzLl9pbmRleEJ1ZmZlciksYi5idWZmZXJEYXRhKGIuRUxFTUVOVF9BUlJBWV9CVUZGRVIsdGhpcy5pbmRpY2VzLGIuU1RBVElDX0RSQVcpfSxiLlN0cmlwLnByb3RvdHlwZS5fcmVuZGVyU3RyaXA9ZnVuY3Rpb24oYSl7dmFyIGM9YS5nbCxkPWEucHJvamVjdGlvbixlPWEub2Zmc2V0LGY9YS5zaGFkZXJNYW5hZ2VyLnN0cmlwU2hhZGVyO2MuYmxlbmRGdW5jKGMuT05FLGMuT05FX01JTlVTX1NSQ19BTFBIQSksYy51bmlmb3JtTWF0cml4M2Z2KGYudHJhbnNsYXRpb25NYXRyaXgsITEsdGhpcy53b3JsZFRyYW5zZm9ybS50b0FycmF5KCEwKSksYy51bmlmb3JtMmYoZi5wcm9qZWN0aW9uVmVjdG9yLGQueCwtZC55KSxjLnVuaWZvcm0yZihmLm9mZnNldFZlY3RvciwtZS54LC1lLnkpLGMudW5pZm9ybTFmKGYuYWxwaGEsMSksdGhpcy5kaXJ0eT8odGhpcy5kaXJ0eT0hMSxjLmJpbmRCdWZmZXIoYy5BUlJBWV9CVUZGRVIsdGhpcy5fdmVydGV4QnVmZmVyKSxjLmJ1ZmZlckRhdGEoYy5BUlJBWV9CVUZGRVIsdGhpcy52ZXJ0aWNpZXMsYy5TVEFUSUNfRFJBVyksYy52ZXJ0ZXhBdHRyaWJQb2ludGVyKGYuYVZlcnRleFBvc2l0aW9uLDIsYy5GTE9BVCwhMSwwLDApLGMuYmluZEJ1ZmZlcihjLkFSUkFZX0JVRkZFUix0aGlzLl91dkJ1ZmZlciksYy5idWZmZXJEYXRhKGMuQVJSQVlfQlVGRkVSLHRoaXMudXZzLGMuU1RBVElDX0RSQVcpLGMudmVydGV4QXR0cmliUG9pbnRlcihmLmFUZXh0dXJlQ29vcmQsMixjLkZMT0FULCExLDAsMCksYy5hY3RpdmVUZXh0dXJlKGMuVEVYVFVSRTApLGMuYmluZFRleHR1cmUoYy5URVhUVVJFXzJELHRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZS5fZ2xUZXh0dXJlc1tjLmlkXXx8Yi5jcmVhdGVXZWJHTFRleHR1cmUodGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLGMpKSxjLmJpbmRCdWZmZXIoYy5FTEVNRU5UX0FSUkFZX0JVRkZFUix0aGlzLl9pbmRleEJ1ZmZlciksYy5idWZmZXJEYXRhKGMuRUxFTUVOVF9BUlJBWV9CVUZGRVIsdGhpcy5pbmRpY2VzLGMuU1RBVElDX0RSQVcpKTooYy5iaW5kQnVmZmVyKGMuQVJSQVlfQlVGRkVSLHRoaXMuX3ZlcnRleEJ1ZmZlciksYy5idWZmZXJTdWJEYXRhKGMuQVJSQVlfQlVGRkVSLDAsdGhpcy52ZXJ0aWNpZXMpLGMudmVydGV4QXR0cmliUG9pbnRlcihmLmFWZXJ0ZXhQb3NpdGlvbiwyLGMuRkxPQVQsITEsMCwwKSxjLmJpbmRCdWZmZXIoYy5BUlJBWV9CVUZGRVIsdGhpcy5fdXZCdWZmZXIpLGMudmVydGV4QXR0cmliUG9pbnRlcihmLmFUZXh0dXJlQ29vcmQsMixjLkZMT0FULCExLDAsMCksYy5hY3RpdmVUZXh0dXJlKGMuVEVYVFVSRTApLGMuYmluZFRleHR1cmUoYy5URVhUVVJFXzJELHRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZS5fZ2xUZXh0dXJlc1tjLmlkXXx8Yi5jcmVhdGVXZWJHTFRleHR1cmUodGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLGMpKSxjLmJpbmRCdWZmZXIoYy5FTEVNRU5UX0FSUkFZX0JVRkZFUix0aGlzLl9pbmRleEJ1ZmZlcikpLGMuZHJhd0VsZW1lbnRzKGMuVFJJQU5HTEVfU1RSSVAsdGhpcy5pbmRpY2VzLmxlbmd0aCxjLlVOU0lHTkVEX1NIT1JULDApfSxiLlN0cmlwLnByb3RvdHlwZS5fcmVuZGVyQ2FudmFzPWZ1bmN0aW9uKGEpe3ZhciBiPWEuY29udGV4dCxjPXRoaXMud29ybGRUcmFuc2Zvcm07YS5yb3VuZFBpeGVscz9iLnNldFRyYW5zZm9ybShjLmEsYy5jLGMuYixjLmQsMHxjLnR4LDB8Yy50eSk6Yi5zZXRUcmFuc2Zvcm0oYy5hLGMuYyxjLmIsYy5kLGMudHgsYy50eSk7dmFyIGQ9dGhpcyxlPWQudmVydGljaWVzLGY9ZC51dnMsZz1lLmxlbmd0aC8yO3RoaXMuY291bnQrKztmb3IodmFyIGg9MDtnLTI+aDtoKyspe3ZhciBpPTIqaCxqPWVbaV0saz1lW2krMl0sbD1lW2krNF0sbT1lW2krMV0sbj1lW2krM10sbz1lW2krNV0scD0oaitrK2wpLzMscT0obStuK28pLzMscj1qLXAscz1tLXEsdD1NYXRoLnNxcnQocipyK3Mqcyk7aj1wK3IvdCoodCszKSxtPXErcy90Kih0KzMpLHI9ay1wLHM9bi1xLHQ9TWF0aC5zcXJ0KHIqcitzKnMpLGs9cCtyL3QqKHQrMyksbj1xK3MvdCoodCszKSxyPWwtcCxzPW8tcSx0PU1hdGguc3FydChyKnIrcypzKSxsPXArci90Kih0KzMpLG89cStzL3QqKHQrMyk7dmFyIHU9ZltpXSpkLnRleHR1cmUud2lkdGgsdj1mW2krMl0qZC50ZXh0dXJlLndpZHRoLHc9ZltpKzRdKmQudGV4dHVyZS53aWR0aCx4PWZbaSsxXSpkLnRleHR1cmUuaGVpZ2h0LHk9ZltpKzNdKmQudGV4dHVyZS5oZWlnaHQsej1mW2krNV0qZC50ZXh0dXJlLmhlaWdodDtiLnNhdmUoKSxiLmJlZ2luUGF0aCgpLGIubW92ZVRvKGosbSksYi5saW5lVG8oayxuKSxiLmxpbmVUbyhsLG8pLGIuY2xvc2VQYXRoKCksYi5jbGlwKCk7dmFyIEE9dSp5K3gqdyt2KnoteSp3LXgqdi11KnosQj1qKnkreCpsK2sqei15KmwteCprLWoqeixDPXUqaytqKncrdipsLWsqdy1qKnYtdSpsLEQ9dSp5KmwreCprKncraip2Knotaip5KncteCp2KmwtdSprKnosRT1tKnkreCpvK24qei15Km8teCpuLW0qeixGPXUqbittKncrdipvLW4qdy1tKnYtdSpvLEc9dSp5Km8reCpuKncrbSp2KnotbSp5KncteCp2Km8tdSpuKno7Yi50cmFuc2Zvcm0oQi9BLEUvQSxDL0EsRi9BLEQvQSxHL0EpLGIuZHJhd0ltYWdlKGQudGV4dHVyZS5iYXNlVGV4dHVyZS5zb3VyY2UsMCwwKSxiLnJlc3RvcmUoKX19LGIuU3RyaXAucHJvdG90eXBlLm9uVGV4dHVyZVVwZGF0ZT1mdW5jdGlvbigpe3RoaXMudXBkYXRlRnJhbWU9ITB9LGIuUm9wZT1mdW5jdGlvbihhLGMpe2IuU3RyaXAuY2FsbCh0aGlzLGEpLHRoaXMucG9pbnRzPWMsdGhpcy52ZXJ0aWNpZXM9bmV3IGIuRmxvYXQzMkFycmF5KDQqYy5sZW5ndGgpLHRoaXMudXZzPW5ldyBiLkZsb2F0MzJBcnJheSg0KmMubGVuZ3RoKSx0aGlzLmNvbG9ycz1uZXcgYi5GbG9hdDMyQXJyYXkoMipjLmxlbmd0aCksdGhpcy5pbmRpY2VzPW5ldyBiLlVpbnQxNkFycmF5KDIqYy5sZW5ndGgpLHRoaXMucmVmcmVzaCgpfSxiLlJvcGUucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoYi5TdHJpcC5wcm90b3R5cGUpLGIuUm9wZS5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5Sb3BlLGIuUm9wZS5wcm90b3R5cGUucmVmcmVzaD1mdW5jdGlvbigpe3ZhciBhPXRoaXMucG9pbnRzO2lmKCEoYS5sZW5ndGg8MSkpe3ZhciBiPXRoaXMudXZzLGM9YVswXSxkPXRoaXMuaW5kaWNlcyxlPXRoaXMuY29sb3JzO3RoaXMuY291bnQtPS4yLGJbMF09MCxiWzFdPTAsYlsyXT0wLGJbM109MSxlWzBdPTEsZVsxXT0xLGRbMF09MCxkWzFdPTE7Zm9yKHZhciBmLGcsaCxpPWEubGVuZ3RoLGo9MTtpPmo7aisrKWY9YVtqXSxnPTQqaixoPWovKGktMSksaiUyPyhiW2ddPWgsYltnKzFdPTAsYltnKzJdPWgsYltnKzNdPTEpOihiW2ddPWgsYltnKzFdPTAsYltnKzJdPWgsYltnKzNdPTEpLGc9MipqLGVbZ109MSxlW2crMV09MSxnPTIqaixkW2ddPWcsZFtnKzFdPWcrMSxjPWZ9fSxiLlJvcGUucHJvdG90eXBlLnVwZGF0ZVRyYW5zZm9ybT1mdW5jdGlvbigpe3ZhciBhPXRoaXMucG9pbnRzO2lmKCEoYS5sZW5ndGg8MSkpe3ZhciBjLGQ9YVswXSxlPXt4OjAseTowfTt0aGlzLmNvdW50LT0uMjtmb3IodmFyIGYsZyxoLGksaixrPXRoaXMudmVydGljaWVzLGw9YS5sZW5ndGgsbT0wO2w+bTttKyspZj1hW21dLGc9NCptLGM9bTxhLmxlbmd0aC0xP2FbbSsxXTpmLGUueT0tKGMueC1kLngpLGUueD1jLnktZC55LGg9MTAqKDEtbS8obC0xKSksaD4xJiYoaD0xKSxpPU1hdGguc3FydChlLngqZS54K2UueSplLnkpLGo9dGhpcy50ZXh0dXJlLmhlaWdodC8yLGUueC89aSxlLnkvPWksZS54Kj1qLGUueSo9aixrW2ddPWYueCtlLngsa1tnKzFdPWYueStlLnksa1tnKzJdPWYueC1lLngsa1tnKzNdPWYueS1lLnksZD1mO2IuRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwodGhpcyl9fSxiLlJvcGUucHJvdG90eXBlLnNldFRleHR1cmU9ZnVuY3Rpb24oYSl7dGhpcy50ZXh0dXJlPWF9LGIuVGlsaW5nU3ByaXRlPWZ1bmN0aW9uKGEsYyxkKXtiLlNwcml0ZS5jYWxsKHRoaXMsYSksdGhpcy5fd2lkdGg9Y3x8MTAwLHRoaXMuX2hlaWdodD1kfHwxMDAsdGhpcy50aWxlU2NhbGU9bmV3IGIuUG9pbnQoMSwxKSx0aGlzLnRpbGVTY2FsZU9mZnNldD1uZXcgYi5Qb2ludCgxLDEpLHRoaXMudGlsZVBvc2l0aW9uPW5ldyBiLlBvaW50KDAsMCksdGhpcy5yZW5kZXJhYmxlPSEwLHRoaXMudGludD0xNjc3NzIxNSx0aGlzLmJsZW5kTW9kZT1iLmJsZW5kTW9kZXMuTk9STUFMfSxiLlRpbGluZ1Nwcml0ZS5wcm90b3R5cGU9T2JqZWN0LmNyZWF0ZShiLlNwcml0ZS5wcm90b3R5cGUpLGIuVGlsaW5nU3ByaXRlLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLlRpbGluZ1Nwcml0ZSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5UaWxpbmdTcHJpdGUucHJvdG90eXBlLFwid2lkdGhcIix7Z2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX3dpZHRofSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy5fd2lkdGg9YX19KSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5UaWxpbmdTcHJpdGUucHJvdG90eXBlLFwiaGVpZ2h0XCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9oZWlnaHR9LHNldDpmdW5jdGlvbihhKXt0aGlzLl9oZWlnaHQ9YX19KSxiLlRpbGluZ1Nwcml0ZS5wcm90b3R5cGUuc2V0VGV4dHVyZT1mdW5jdGlvbihhKXt0aGlzLnRleHR1cmUhPT1hJiYodGhpcy50ZXh0dXJlPWEsdGhpcy5yZWZyZXNoVGV4dHVyZT0hMCx0aGlzLmNhY2hlZFRpbnQ9MTY3NzcyMTUpfSxiLlRpbGluZ1Nwcml0ZS5wcm90b3R5cGUuX3JlbmRlcldlYkdMPWZ1bmN0aW9uKGEpe2lmKHRoaXMudmlzaWJsZSE9PSExJiYwIT09dGhpcy5hbHBoYSl7dmFyIGMsZDtmb3IodGhpcy5fbWFzayYmKGEuc3ByaXRlQmF0Y2guc3RvcCgpLGEubWFza01hbmFnZXIucHVzaE1hc2sodGhpcy5tYXNrLGEpLGEuc3ByaXRlQmF0Y2guc3RhcnQoKSksdGhpcy5fZmlsdGVycyYmKGEuc3ByaXRlQmF0Y2guZmx1c2goKSxhLmZpbHRlck1hbmFnZXIucHVzaEZpbHRlcih0aGlzLl9maWx0ZXJCbG9jaykpLCF0aGlzLnRpbGluZ1RleHR1cmV8fHRoaXMucmVmcmVzaFRleHR1cmU/KHRoaXMuZ2VuZXJhdGVUaWxpbmdUZXh0dXJlKCEwKSx0aGlzLnRpbGluZ1RleHR1cmUmJnRoaXMudGlsaW5nVGV4dHVyZS5uZWVkc1VwZGF0ZSYmKGIudXBkYXRlV2ViR0xUZXh0dXJlKHRoaXMudGlsaW5nVGV4dHVyZS5iYXNlVGV4dHVyZSxhLmdsKSx0aGlzLnRpbGluZ1RleHR1cmUubmVlZHNVcGRhdGU9ITEpKTphLnNwcml0ZUJhdGNoLnJlbmRlclRpbGluZ1Nwcml0ZSh0aGlzKSxjPTAsZD10aGlzLmNoaWxkcmVuLmxlbmd0aDtkPmM7YysrKXRoaXMuY2hpbGRyZW5bY10uX3JlbmRlcldlYkdMKGEpO2Euc3ByaXRlQmF0Y2guc3RvcCgpLHRoaXMuX2ZpbHRlcnMmJmEuZmlsdGVyTWFuYWdlci5wb3BGaWx0ZXIoKSx0aGlzLl9tYXNrJiZhLm1hc2tNYW5hZ2VyLnBvcE1hc2soYSksYS5zcHJpdGVCYXRjaC5zdGFydCgpfX0sYi5UaWxpbmdTcHJpdGUucHJvdG90eXBlLl9yZW5kZXJDYW52YXM9ZnVuY3Rpb24oYSl7aWYodGhpcy52aXNpYmxlIT09ITEmJjAhPT10aGlzLmFscGhhKXt2YXIgYz1hLmNvbnRleHQ7dGhpcy5fbWFzayYmYS5tYXNrTWFuYWdlci5wdXNoTWFzayh0aGlzLl9tYXNrLGMpLGMuZ2xvYmFsQWxwaGE9dGhpcy53b3JsZEFscGhhO3ZhciBkLGUsZj10aGlzLndvcmxkVHJhbnNmb3JtO2lmKGMuc2V0VHJhbnNmb3JtKGYuYSxmLmMsZi5iLGYuZCxmLnR4LGYudHkpLCF0aGlzLl9fdGlsZVBhdHRlcm58fHRoaXMucmVmcmVzaFRleHR1cmUpe2lmKHRoaXMuZ2VuZXJhdGVUaWxpbmdUZXh0dXJlKCExKSwhdGhpcy50aWxpbmdUZXh0dXJlKXJldHVybjt0aGlzLl9fdGlsZVBhdHRlcm49Yy5jcmVhdGVQYXR0ZXJuKHRoaXMudGlsaW5nVGV4dHVyZS5iYXNlVGV4dHVyZS5zb3VyY2UsXCJyZXBlYXRcIil9dGhpcy5ibGVuZE1vZGUhPT1hLmN1cnJlbnRCbGVuZE1vZGUmJihhLmN1cnJlbnRCbGVuZE1vZGU9dGhpcy5ibGVuZE1vZGUsYy5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb249Yi5ibGVuZE1vZGVzQ2FudmFzW2EuY3VycmVudEJsZW5kTW9kZV0pO3ZhciBnPXRoaXMudGlsZVBvc2l0aW9uLGg9dGhpcy50aWxlU2NhbGU7Zm9yKGcueCU9dGhpcy50aWxpbmdUZXh0dXJlLmJhc2VUZXh0dXJlLndpZHRoLGcueSU9dGhpcy50aWxpbmdUZXh0dXJlLmJhc2VUZXh0dXJlLmhlaWdodCxjLnNjYWxlKGgueCxoLnkpLGMudHJhbnNsYXRlKGcueCxnLnkpLGMuZmlsbFN0eWxlPXRoaXMuX190aWxlUGF0dGVybixjLmZpbGxSZWN0KC1nLngrdGhpcy5hbmNob3IueCotdGhpcy5fd2lkdGgsLWcueSt0aGlzLmFuY2hvci55Ki10aGlzLl9oZWlnaHQsdGhpcy5fd2lkdGgvaC54LHRoaXMuX2hlaWdodC9oLnkpLGMuc2NhbGUoMS9oLngsMS9oLnkpLGMudHJhbnNsYXRlKC1nLngsLWcueSksdGhpcy5fbWFzayYmYS5tYXNrTWFuYWdlci5wb3BNYXNrKGEuY29udGV4dCksZD0wLGU9dGhpcy5jaGlsZHJlbi5sZW5ndGg7ZT5kO2QrKyl0aGlzLmNoaWxkcmVuW2RdLl9yZW5kZXJDYW52YXMoYSl9fSxiLlRpbGluZ1Nwcml0ZS5wcm90b3R5cGUuZ2V0Qm91bmRzPWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5fd2lkdGgsYj10aGlzLl9oZWlnaHQsYz1hKigxLXRoaXMuYW5jaG9yLngpLGQ9YSotdGhpcy5hbmNob3IueCxlPWIqKDEtdGhpcy5hbmNob3IueSksZj1iKi10aGlzLmFuY2hvci55LGc9dGhpcy53b3JsZFRyYW5zZm9ybSxoPWcuYSxpPWcuYyxqPWcuYixrPWcuZCxsPWcudHgsbT1nLnR5LG49aCpkK2oqZitsLG89aypmK2kqZCttLHA9aCpjK2oqZitsLHE9aypmK2kqYyttLHI9aCpjK2oqZStsLHM9ayplK2kqYyttLHQ9aCpkK2oqZStsLHU9ayplK2kqZCttLHY9LTEvMCx3PS0xLzAseD0xLzAseT0xLzA7eD14Pm4/bjp4LHg9eD5wP3A6eCx4PXg+cj9yOngseD14PnQ/dDp4LHk9eT5vP286eSx5PXk+cT9xOnkseT15PnM/czp5LHk9eT51P3U6eSx2PW4+dj9uOnYsdj1wPnY/cDp2LHY9cj52P3I6dix2PXQ+dj90OnYsdz1vPnc/bzp3LHc9cT53P3E6dyx3PXM+dz9zOncsdz11Pnc/dTp3O3ZhciB6PXRoaXMuX2JvdW5kcztyZXR1cm4gei54PXgsei53aWR0aD12LXgsei55PXksei5oZWlnaHQ9dy15LHRoaXMuX2N1cnJlbnRCb3VuZHM9eix6fSxiLlRpbGluZ1Nwcml0ZS5wcm90b3R5cGUub25UZXh0dXJlVXBkYXRlPWZ1bmN0aW9uKCl7fSxiLlRpbGluZ1Nwcml0ZS5wcm90b3R5cGUuZ2VuZXJhdGVUaWxpbmdUZXh0dXJlPWZ1bmN0aW9uKGEpe2lmKHRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZS5oYXNMb2FkZWQpe3ZhciBjLGQsZT10aGlzLnRleHR1cmUsZj1lLmZyYW1lLGc9Zi53aWR0aCE9PWUuYmFzZVRleHR1cmUud2lkdGh8fGYuaGVpZ2h0IT09ZS5iYXNlVGV4dHVyZS5oZWlnaHQsaD0hMTtpZihhPyhjPWIuZ2V0TmV4dFBvd2VyT2ZUd28oZi53aWR0aCksZD1iLmdldE5leHRQb3dlck9mVHdvKGYuaGVpZ2h0KSwoZi53aWR0aCE9PWN8fGYuaGVpZ2h0IT09ZCkmJihoPSEwKSk6ZyYmKGM9Zi53aWR0aCxkPWYuaGVpZ2h0LGg9ITApLGgpe3ZhciBpO3RoaXMudGlsaW5nVGV4dHVyZSYmdGhpcy50aWxpbmdUZXh0dXJlLmlzVGlsaW5nPyhpPXRoaXMudGlsaW5nVGV4dHVyZS5jYW52YXNCdWZmZXIsaS5yZXNpemUoYyxkKSx0aGlzLnRpbGluZ1RleHR1cmUuYmFzZVRleHR1cmUud2lkdGg9Yyx0aGlzLnRpbGluZ1RleHR1cmUuYmFzZVRleHR1cmUuaGVpZ2h0PWQsdGhpcy50aWxpbmdUZXh0dXJlLm5lZWRzVXBkYXRlPSEwKTooaT1uZXcgYi5DYW52YXNCdWZmZXIoYyxkKSx0aGlzLnRpbGluZ1RleHR1cmU9Yi5UZXh0dXJlLmZyb21DYW52YXMoaS5jYW52YXMpLHRoaXMudGlsaW5nVGV4dHVyZS5jYW52YXNCdWZmZXI9aSx0aGlzLnRpbGluZ1RleHR1cmUuaXNUaWxpbmc9ITApLGkuY29udGV4dC5kcmF3SW1hZ2UoZS5iYXNlVGV4dHVyZS5zb3VyY2UsZS5jcm9wLngsZS5jcm9wLnksZS5jcm9wLndpZHRoLGUuY3JvcC5oZWlnaHQsMCwwLGMsZCksdGhpcy50aWxlU2NhbGVPZmZzZXQueD1mLndpZHRoL2MsdGhpcy50aWxlU2NhbGVPZmZzZXQueT1mLmhlaWdodC9kfWVsc2UgdGhpcy50aWxpbmdUZXh0dXJlJiZ0aGlzLnRpbGluZ1RleHR1cmUuaXNUaWxpbmcmJnRoaXMudGlsaW5nVGV4dHVyZS5kZXN0cm95KCEwKSx0aGlzLnRpbGVTY2FsZU9mZnNldC54PTEsdGhpcy50aWxlU2NhbGVPZmZzZXQueT0xLHRoaXMudGlsaW5nVGV4dHVyZT1lO3RoaXMucmVmcmVzaFRleHR1cmU9ITEsdGhpcy50aWxpbmdUZXh0dXJlLmJhc2VUZXh0dXJlLl9wb3dlck9mMj0hMH19O3ZhciBmPXt9O2YuQm9uZURhdGE9ZnVuY3Rpb24oYSxiKXt0aGlzLm5hbWU9YSx0aGlzLnBhcmVudD1ifSxmLkJvbmVEYXRhLnByb3RvdHlwZT17bGVuZ3RoOjAseDowLHk6MCxyb3RhdGlvbjowLHNjYWxlWDoxLHNjYWxlWToxfSxmLlNsb3REYXRhPWZ1bmN0aW9uKGEsYil7dGhpcy5uYW1lPWEsdGhpcy5ib25lRGF0YT1ifSxmLlNsb3REYXRhLnByb3RvdHlwZT17cjoxLGc6MSxiOjEsYToxLGF0dGFjaG1lbnROYW1lOm51bGx9LGYuQm9uZT1mdW5jdGlvbihhLGIpe3RoaXMuZGF0YT1hLHRoaXMucGFyZW50PWIsdGhpcy5zZXRUb1NldHVwUG9zZSgpfSxmLkJvbmUueURvd249ITEsZi5Cb25lLnByb3RvdHlwZT17eDowLHk6MCxyb3RhdGlvbjowLHNjYWxlWDoxLHNjYWxlWToxLG0wMDowLG0wMTowLHdvcmxkWDowLG0xMDowLG0xMTowLHdvcmxkWTowLHdvcmxkUm90YXRpb246MCx3b3JsZFNjYWxlWDoxLHdvcmxkU2NhbGVZOjEsdXBkYXRlV29ybGRUcmFuc2Zvcm06ZnVuY3Rpb24oYSxiKXt2YXIgYz10aGlzLnBhcmVudDtudWxsIT1jPyh0aGlzLndvcmxkWD10aGlzLngqYy5tMDArdGhpcy55KmMubTAxK2Mud29ybGRYLHRoaXMud29ybGRZPXRoaXMueCpjLm0xMCt0aGlzLnkqYy5tMTErYy53b3JsZFksdGhpcy53b3JsZFNjYWxlWD1jLndvcmxkU2NhbGVYKnRoaXMuc2NhbGVYLHRoaXMud29ybGRTY2FsZVk9Yy53b3JsZFNjYWxlWSp0aGlzLnNjYWxlWSx0aGlzLndvcmxkUm90YXRpb249Yy53b3JsZFJvdGF0aW9uK3RoaXMucm90YXRpb24pOih0aGlzLndvcmxkWD10aGlzLngsdGhpcy53b3JsZFk9dGhpcy55LHRoaXMud29ybGRTY2FsZVg9dGhpcy5zY2FsZVgsdGhpcy53b3JsZFNjYWxlWT10aGlzLnNjYWxlWSx0aGlzLndvcmxkUm90YXRpb249dGhpcy5yb3RhdGlvbik7dmFyIGQ9dGhpcy53b3JsZFJvdGF0aW9uKk1hdGguUEkvMTgwLGU9TWF0aC5jb3MoZCksZz1NYXRoLnNpbihkKTt0aGlzLm0wMD1lKnRoaXMud29ybGRTY2FsZVgsdGhpcy5tMTA9Zyp0aGlzLndvcmxkU2NhbGVYLHRoaXMubTAxPS1nKnRoaXMud29ybGRTY2FsZVksdGhpcy5tMTE9ZSp0aGlzLndvcmxkU2NhbGVZLGEmJih0aGlzLm0wMD0tdGhpcy5tMDAsdGhpcy5tMDE9LXRoaXMubTAxKSxiJiYodGhpcy5tMTA9LXRoaXMubTEwLHRoaXMubTExPS10aGlzLm0xMSksZi5Cb25lLnlEb3duJiYodGhpcy5tMTA9LXRoaXMubTEwLHRoaXMubTExPS10aGlzLm0xMSl9LHNldFRvU2V0dXBQb3NlOmZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5kYXRhO3RoaXMueD1hLngsdGhpcy55PWEueSx0aGlzLnJvdGF0aW9uPWEucm90YXRpb24sdGhpcy5zY2FsZVg9YS5zY2FsZVgsdGhpcy5zY2FsZVk9YS5zY2FsZVl9fSxmLlNsb3Q9ZnVuY3Rpb24oYSxiLGMpe3RoaXMuZGF0YT1hLHRoaXMuc2tlbGV0b249Yix0aGlzLmJvbmU9Yyx0aGlzLnNldFRvU2V0dXBQb3NlKCl9LGYuU2xvdC5wcm90b3R5cGU9e3I6MSxnOjEsYjoxLGE6MSxfYXR0YWNobWVudFRpbWU6MCxhdHRhY2htZW50Om51bGwsc2V0QXR0YWNobWVudDpmdW5jdGlvbihhKXt0aGlzLmF0dGFjaG1lbnQ9YSx0aGlzLl9hdHRhY2htZW50VGltZT10aGlzLnNrZWxldG9uLnRpbWV9LHNldEF0dGFjaG1lbnRUaW1lOmZ1bmN0aW9uKGEpe3RoaXMuX2F0dGFjaG1lbnRUaW1lPXRoaXMuc2tlbGV0b24udGltZS1hfSxnZXRBdHRhY2htZW50VGltZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLnNrZWxldG9uLnRpbWUtdGhpcy5fYXR0YWNobWVudFRpbWV9LHNldFRvU2V0dXBQb3NlOmZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5kYXRhO3RoaXMucj1hLnIsdGhpcy5nPWEuZyx0aGlzLmI9YS5iLHRoaXMuYT1hLmE7Zm9yKHZhciBiPXRoaXMuc2tlbGV0b24uZGF0YS5zbG90cyxjPTAsZD1iLmxlbmd0aDtkPmM7YysrKWlmKGJbY109PWEpe3RoaXMuc2V0QXR0YWNobWVudChhLmF0dGFjaG1lbnROYW1lP3RoaXMuc2tlbGV0b24uZ2V0QXR0YWNobWVudEJ5U2xvdEluZGV4KGMsYS5hdHRhY2htZW50TmFtZSk6bnVsbCk7YnJlYWt9fX0sZi5Ta2luPWZ1bmN0aW9uKGEpe3RoaXMubmFtZT1hLHRoaXMuYXR0YWNobWVudHM9e319LGYuU2tpbi5wcm90b3R5cGU9e2FkZEF0dGFjaG1lbnQ6ZnVuY3Rpb24oYSxiLGMpe3RoaXMuYXR0YWNobWVudHNbYStcIjpcIitiXT1jfSxnZXRBdHRhY2htZW50OmZ1bmN0aW9uKGEsYil7cmV0dXJuIHRoaXMuYXR0YWNobWVudHNbYStcIjpcIitiXX0sX2F0dGFjaEFsbDpmdW5jdGlvbihhLGIpe2Zvcih2YXIgYyBpbiBiLmF0dGFjaG1lbnRzKXt2YXIgZD1jLmluZGV4T2YoXCI6XCIpLGU9cGFyc2VJbnQoYy5zdWJzdHJpbmcoMCxkKSwxMCksZj1jLnN1YnN0cmluZyhkKzEpLGc9YS5zbG90c1tlXTtpZihnLmF0dGFjaG1lbnQmJmcuYXR0YWNobWVudC5uYW1lPT1mKXt2YXIgaD10aGlzLmdldEF0dGFjaG1lbnQoZSxmKTtoJiZnLnNldEF0dGFjaG1lbnQoaCl9fX19LGYuQW5pbWF0aW9uPWZ1bmN0aW9uKGEsYixjKXt0aGlzLm5hbWU9YSx0aGlzLnRpbWVsaW5lcz1iLHRoaXMuZHVyYXRpb249Y30sZi5BbmltYXRpb24ucHJvdG90eXBlPXthcHBseTpmdW5jdGlvbihhLGIsYyl7YyYmdGhpcy5kdXJhdGlvbiYmKGIlPXRoaXMuZHVyYXRpb24pO2Zvcih2YXIgZD10aGlzLnRpbWVsaW5lcyxlPTAsZj1kLmxlbmd0aDtmPmU7ZSsrKWRbZV0uYXBwbHkoYSxiLDEpfSxtaXg6ZnVuY3Rpb24oYSxiLGMsZCl7YyYmdGhpcy5kdXJhdGlvbiYmKGIlPXRoaXMuZHVyYXRpb24pO2Zvcih2YXIgZT10aGlzLnRpbWVsaW5lcyxmPTAsZz1lLmxlbmd0aDtnPmY7ZisrKWVbZl0uYXBwbHkoYSxiLGQpfX0sZi5iaW5hcnlTZWFyY2g9ZnVuY3Rpb24oYSxiLGMpe3ZhciBkPTAsZT1NYXRoLmZsb29yKGEubGVuZ3RoL2MpLTI7aWYoIWUpcmV0dXJuIGM7Zm9yKHZhciBmPWU+Pj4xOzspe2lmKGFbKGYrMSkqY108PWI/ZD1mKzE6ZT1mLGQ9PWUpcmV0dXJuKGQrMSkqYztmPWQrZT4+PjF9fSxmLmxpbmVhclNlYXJjaD1mdW5jdGlvbihhLGIsYyl7Zm9yKHZhciBkPTAsZT1hLmxlbmd0aC1jO2U+PWQ7ZCs9YylpZihhW2RdPmIpcmV0dXJuIGQ7cmV0dXJuLTF9LGYuQ3VydmVzPWZ1bmN0aW9uKGEpe3RoaXMuY3VydmVzPVtdLHRoaXMuY3VydmVzLmxlbmd0aD02KihhLTEpfSxmLkN1cnZlcy5wcm90b3R5cGU9e3NldExpbmVhcjpmdW5jdGlvbihhKXt0aGlzLmN1cnZlc1s2KmFdPTB9LHNldFN0ZXBwZWQ6ZnVuY3Rpb24oYSl7dGhpcy5jdXJ2ZXNbNiphXT0tMX0sc2V0Q3VydmU6ZnVuY3Rpb24oYSxiLGMsZCxlKXt2YXIgZj0uMSxnPWYqZixoPWcqZixpPTMqZixqPTMqZyxrPTYqZyxsPTYqaCxtPTIqLWIrZCxuPTIqLWMrZSxvPTMqKGItZCkrMSxwPTMqKGMtZSkrMSxxPTYqYSxyPXRoaXMuY3VydmVzO3JbcV09YippK20qaitvKmgscltxKzFdPWMqaStuKmorcCpoLHJbcSsyXT1tKmsrbypsLHJbcSszXT1uKmsrcCpsLHJbcSs0XT1vKmwscltxKzVdPXAqbH0sZ2V0Q3VydmVQZXJjZW50OmZ1bmN0aW9uKGEsYil7Yj0wPmI/MDpiPjE/MTpiO3ZhciBjPTYqYSxkPXRoaXMuY3VydmVzLGU9ZFtjXTtpZighZSlyZXR1cm4gYjtpZigtMT09ZSlyZXR1cm4gMDtmb3IodmFyIGY9ZFtjKzFdLGc9ZFtjKzJdLGg9ZFtjKzNdLGk9ZFtjKzRdLGo9ZFtjKzVdLGs9ZSxsPWYsbT04Ozspe2lmKGs+PWIpe3ZhciBuPWstZSxvPWwtZjtyZXR1cm4gbysobC1vKSooYi1uKS8oay1uKX1pZighbSlicmVhazttLS0sZSs9ZyxmKz1oLGcrPWksaCs9aixrKz1lLGwrPWZ9cmV0dXJuIGwrKDEtbCkqKGItaykvKDEtayl9fSxmLlJvdGF0ZVRpbWVsaW5lPWZ1bmN0aW9uKGEpe3RoaXMuY3VydmVzPW5ldyBmLkN1cnZlcyhhKSx0aGlzLmZyYW1lcz1bXSx0aGlzLmZyYW1lcy5sZW5ndGg9MiphfSxmLlJvdGF0ZVRpbWVsaW5lLnByb3RvdHlwZT17Ym9uZUluZGV4OjAsZ2V0RnJhbWVDb3VudDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmZyYW1lcy5sZW5ndGgvMn0sc2V0RnJhbWU6ZnVuY3Rpb24oYSxiLGMpe2EqPTIsdGhpcy5mcmFtZXNbYV09Yix0aGlzLmZyYW1lc1thKzFdPWN9LGFwcGx5OmZ1bmN0aW9uKGEsYixjKXt2YXIgZCxlPXRoaXMuZnJhbWVzO2lmKCEoYjxlWzBdKSl7dmFyIGc9YS5ib25lc1t0aGlzLmJvbmVJbmRleF07aWYoYj49ZVtlLmxlbmd0aC0yXSl7Zm9yKGQ9Zy5kYXRhLnJvdGF0aW9uK2VbZS5sZW5ndGgtMV0tZy5yb3RhdGlvbjtkPjE4MDspZC09MzYwO2Zvcig7LTE4MD5kOylkKz0zNjA7cmV0dXJuIGcucm90YXRpb24rPWQqYyx2b2lkIDB9dmFyIGg9Zi5iaW5hcnlTZWFyY2goZSxiLDIpLGk9ZVtoLTFdLGo9ZVtoXSxrPTEtKGItaikvKGVbaC0yXS1qKTtmb3Ioaz10aGlzLmN1cnZlcy5nZXRDdXJ2ZVBlcmNlbnQoaC8yLTEsayksZD1lW2grMV0taTtkPjE4MDspZC09MzYwO2Zvcig7LTE4MD5kOylkKz0zNjA7Zm9yKGQ9Zy5kYXRhLnJvdGF0aW9uKyhpK2QqayktZy5yb3RhdGlvbjtkPjE4MDspZC09MzYwO2Zvcig7LTE4MD5kOylkKz0zNjA7Zy5yb3RhdGlvbis9ZCpjfX19LGYuVHJhbnNsYXRlVGltZWxpbmU9ZnVuY3Rpb24oYSl7dGhpcy5jdXJ2ZXM9bmV3IGYuQ3VydmVzKGEpLHRoaXMuZnJhbWVzPVtdLHRoaXMuZnJhbWVzLmxlbmd0aD0zKmF9LGYuVHJhbnNsYXRlVGltZWxpbmUucHJvdG90eXBlPXtib25lSW5kZXg6MCxnZXRGcmFtZUNvdW50OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZnJhbWVzLmxlbmd0aC8zfSxzZXRGcmFtZTpmdW5jdGlvbihhLGIsYyxkKXthKj0zLHRoaXMuZnJhbWVzW2FdPWIsdGhpcy5mcmFtZXNbYSsxXT1jLHRoaXMuZnJhbWVzW2ErMl09ZH0sYXBwbHk6ZnVuY3Rpb24oYSxiLGMpe3ZhciBkPXRoaXMuZnJhbWVzO2lmKCEoYjxkWzBdKSl7dmFyIGU9YS5ib25lc1t0aGlzLmJvbmVJbmRleF07aWYoYj49ZFtkLmxlbmd0aC0zXSlyZXR1cm4gZS54Kz0oZS5kYXRhLngrZFtkLmxlbmd0aC0yXS1lLngpKmMsZS55Kz0oZS5kYXRhLnkrZFtkLmxlbmd0aC0xXS1lLnkpKmMsdm9pZCAwO3ZhciBnPWYuYmluYXJ5U2VhcmNoKGQsYiwzKSxoPWRbZy0yXSxpPWRbZy0xXSxqPWRbZ10saz0xLShiLWopLyhkW2crLTNdLWopO2s9dGhpcy5jdXJ2ZXMuZ2V0Q3VydmVQZXJjZW50KGcvMy0xLGspLGUueCs9KGUuZGF0YS54K2grKGRbZysxXS1oKSprLWUueCkqYyxlLnkrPShlLmRhdGEueStpKyhkW2crMl0taSkqay1lLnkpKmN9fX0sZi5TY2FsZVRpbWVsaW5lPWZ1bmN0aW9uKGEpe3RoaXMuY3VydmVzPW5ldyBmLkN1cnZlcyhhKSx0aGlzLmZyYW1lcz1bXSx0aGlzLmZyYW1lcy5sZW5ndGg9MyphfSxmLlNjYWxlVGltZWxpbmUucHJvdG90eXBlPXtib25lSW5kZXg6MCxnZXRGcmFtZUNvdW50OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZnJhbWVzLmxlbmd0aC8zfSxzZXRGcmFtZTpmdW5jdGlvbihhLGIsYyxkKXthKj0zLHRoaXMuZnJhbWVzW2FdPWIsdGhpcy5mcmFtZXNbYSsxXT1jLHRoaXMuZnJhbWVzW2ErMl09ZH0sYXBwbHk6ZnVuY3Rpb24oYSxiLGMpe3ZhciBkPXRoaXMuZnJhbWVzO2lmKCEoYjxkWzBdKSl7dmFyIGU9YS5ib25lc1t0aGlzLmJvbmVJbmRleF07aWYoYj49ZFtkLmxlbmd0aC0zXSlyZXR1cm4gZS5zY2FsZVgrPShlLmRhdGEuc2NhbGVYLTErZFtkLmxlbmd0aC0yXS1lLnNjYWxlWCkqYyxlLnNjYWxlWSs9KGUuZGF0YS5zY2FsZVktMStkW2QubGVuZ3RoLTFdLWUuc2NhbGVZKSpjLHZvaWQgMDt2YXIgZz1mLmJpbmFyeVNlYXJjaChkLGIsMyksaD1kW2ctMl0saT1kW2ctMV0saj1kW2ddLGs9MS0oYi1qKS8oZFtnKy0zXS1qKTtrPXRoaXMuY3VydmVzLmdldEN1cnZlUGVyY2VudChnLzMtMSxrKSxlLnNjYWxlWCs9KGUuZGF0YS5zY2FsZVgtMStoKyhkW2crMV0taCkqay1lLnNjYWxlWCkqYyxlLnNjYWxlWSs9KGUuZGF0YS5zY2FsZVktMStpKyhkW2crMl0taSkqay1lLnNjYWxlWSkqY319fSxmLkNvbG9yVGltZWxpbmU9ZnVuY3Rpb24oYSl7dGhpcy5jdXJ2ZXM9bmV3IGYuQ3VydmVzKGEpLHRoaXMuZnJhbWVzPVtdLHRoaXMuZnJhbWVzLmxlbmd0aD01KmF9LGYuQ29sb3JUaW1lbGluZS5wcm90b3R5cGU9e3Nsb3RJbmRleDowLGdldEZyYW1lQ291bnQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5mcmFtZXMubGVuZ3RoLzV9LHNldEZyYW1lOmZ1bmN0aW9uKGEsYixjLGQsZSxmKXthKj01LHRoaXMuZnJhbWVzW2FdPWIsdGhpcy5mcmFtZXNbYSsxXT1jLHRoaXMuZnJhbWVzW2ErMl09ZCx0aGlzLmZyYW1lc1thKzNdPWUsdGhpcy5mcmFtZXNbYSs0XT1mfSxhcHBseTpmdW5jdGlvbihhLGIsYyl7dmFyIGQ9dGhpcy5mcmFtZXM7aWYoIShiPGRbMF0pKXt2YXIgZT1hLnNsb3RzW3RoaXMuc2xvdEluZGV4XTtpZihiPj1kW2QubGVuZ3RoLTVdKXt2YXIgZz1kLmxlbmd0aC0xO3JldHVybiBlLnI9ZFtnLTNdLGUuZz1kW2ctMl0sZS5iPWRbZy0xXSxlLmE9ZFtnXSx2b2lkIDB9dmFyIGg9Zi5iaW5hcnlTZWFyY2goZCxiLDUpLGk9ZFtoLTRdLGo9ZFtoLTNdLGs9ZFtoLTJdLGw9ZFtoLTFdLG09ZFtoXSxuPTEtKGItbSkvKGRbaC01XS1tKTtuPXRoaXMuY3VydmVzLmdldEN1cnZlUGVyY2VudChoLzUtMSxuKTt2YXIgbz1pKyhkW2grMV0taSkqbixwPWorKGRbaCsyXS1qKSpuLHE9aysoZFtoKzNdLWspKm4scj1sKyhkW2grNF0tbCkqbjsxPmM/KGUucis9KG8tZS5yKSpjLGUuZys9KHAtZS5nKSpjLGUuYis9KHEtZS5iKSpjLGUuYSs9KHItZS5hKSpjKTooZS5yPW8sZS5nPXAsZS5iPXEsZS5hPXIpfX19LGYuQXR0YWNobWVudFRpbWVsaW5lPWZ1bmN0aW9uKGEpe3RoaXMuY3VydmVzPW5ldyBmLkN1cnZlcyhhKSx0aGlzLmZyYW1lcz1bXSx0aGlzLmZyYW1lcy5sZW5ndGg9YSx0aGlzLmF0dGFjaG1lbnROYW1lcz1bXSx0aGlzLmF0dGFjaG1lbnROYW1lcy5sZW5ndGg9YX0sZi5BdHRhY2htZW50VGltZWxpbmUucHJvdG90eXBlPXtzbG90SW5kZXg6MCxnZXRGcmFtZUNvdW50OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZnJhbWVzLmxlbmd0aH0sc2V0RnJhbWU6ZnVuY3Rpb24oYSxiLGMpe3RoaXMuZnJhbWVzW2FdPWIsdGhpcy5hdHRhY2htZW50TmFtZXNbYV09Y30sYXBwbHk6ZnVuY3Rpb24oYSxiKXt2YXIgYz10aGlzLmZyYW1lcztpZighKGI8Y1swXSkpe3ZhciBkO2Q9Yj49Y1tjLmxlbmd0aC0xXT9jLmxlbmd0aC0xOmYuYmluYXJ5U2VhcmNoKGMsYiwxKS0xO3ZhciBlPXRoaXMuYXR0YWNobWVudE5hbWVzW2RdO2Euc2xvdHNbdGhpcy5zbG90SW5kZXhdLnNldEF0dGFjaG1lbnQoZT9hLmdldEF0dGFjaG1lbnRCeVNsb3RJbmRleCh0aGlzLnNsb3RJbmRleCxlKTpudWxsKX19fSxmLlNrZWxldG9uRGF0YT1mdW5jdGlvbigpe3RoaXMuYm9uZXM9W10sdGhpcy5zbG90cz1bXSx0aGlzLnNraW5zPVtdLHRoaXMuYW5pbWF0aW9ucz1bXX0sZi5Ta2VsZXRvbkRhdGEucHJvdG90eXBlPXtkZWZhdWx0U2tpbjpudWxsLGZpbmRCb25lOmZ1bmN0aW9uKGEpe2Zvcih2YXIgYj10aGlzLmJvbmVzLGM9MCxkPWIubGVuZ3RoO2Q+YztjKyspaWYoYltjXS5uYW1lPT1hKXJldHVybiBiW2NdO3JldHVybiBudWxsfSxmaW5kQm9uZUluZGV4OmZ1bmN0aW9uKGEpe2Zvcih2YXIgYj10aGlzLmJvbmVzLGM9MCxkPWIubGVuZ3RoO2Q+YztjKyspaWYoYltjXS5uYW1lPT1hKXJldHVybiBjO3JldHVybi0xfSxmaW5kU2xvdDpmdW5jdGlvbihhKXtmb3IodmFyIGI9dGhpcy5zbG90cyxjPTAsZD1iLmxlbmd0aDtkPmM7YysrKWlmKGJbY10ubmFtZT09YSlyZXR1cm4gc2xvdFtjXTtyZXR1cm4gbnVsbH0sZmluZFNsb3RJbmRleDpmdW5jdGlvbihhKXtmb3IodmFyIGI9dGhpcy5zbG90cyxjPTAsZD1iLmxlbmd0aDtkPmM7YysrKWlmKGJbY10ubmFtZT09YSlyZXR1cm4gYztyZXR1cm4tMX0sZmluZFNraW46ZnVuY3Rpb24oYSl7Zm9yKHZhciBiPXRoaXMuc2tpbnMsYz0wLGQ9Yi5sZW5ndGg7ZD5jO2MrKylpZihiW2NdLm5hbWU9PWEpcmV0dXJuIGJbY107cmV0dXJuIG51bGx9LGZpbmRBbmltYXRpb246ZnVuY3Rpb24oYSl7Zm9yKHZhciBiPXRoaXMuYW5pbWF0aW9ucyxjPTAsZD1iLmxlbmd0aDtkPmM7YysrKWlmKGJbY10ubmFtZT09YSlyZXR1cm4gYltjXTtyZXR1cm4gbnVsbH19LGYuU2tlbGV0b249ZnVuY3Rpb24oYSl7dGhpcy5kYXRhPWEsdGhpcy5ib25lcz1bXTtcbmZvcih2YXIgYj0wLGM9YS5ib25lcy5sZW5ndGg7Yz5iO2IrKyl7dmFyIGQ9YS5ib25lc1tiXSxlPWQucGFyZW50P3RoaXMuYm9uZXNbYS5ib25lcy5pbmRleE9mKGQucGFyZW50KV06bnVsbDt0aGlzLmJvbmVzLnB1c2gobmV3IGYuQm9uZShkLGUpKX1mb3IodGhpcy5zbG90cz1bXSx0aGlzLmRyYXdPcmRlcj1bXSxiPTAsYz1hLnNsb3RzLmxlbmd0aDtjPmI7YisrKXt2YXIgZz1hLnNsb3RzW2JdLGg9dGhpcy5ib25lc1thLmJvbmVzLmluZGV4T2YoZy5ib25lRGF0YSldLGk9bmV3IGYuU2xvdChnLHRoaXMsaCk7dGhpcy5zbG90cy5wdXNoKGkpLHRoaXMuZHJhd09yZGVyLnB1c2goaSl9fSxmLlNrZWxldG9uLnByb3RvdHlwZT17eDowLHk6MCxza2luOm51bGwscjoxLGc6MSxiOjEsYToxLHRpbWU6MCxmbGlwWDohMSxmbGlwWTohMSx1cGRhdGVXb3JsZFRyYW5zZm9ybTpmdW5jdGlvbigpe2Zvcih2YXIgYT10aGlzLmZsaXBYLGI9dGhpcy5mbGlwWSxjPXRoaXMuYm9uZXMsZD0wLGU9Yy5sZW5ndGg7ZT5kO2QrKyljW2RdLnVwZGF0ZVdvcmxkVHJhbnNmb3JtKGEsYil9LHNldFRvU2V0dXBQb3NlOmZ1bmN0aW9uKCl7dGhpcy5zZXRCb25lc1RvU2V0dXBQb3NlKCksdGhpcy5zZXRTbG90c1RvU2V0dXBQb3NlKCl9LHNldEJvbmVzVG9TZXR1cFBvc2U6ZnVuY3Rpb24oKXtmb3IodmFyIGE9dGhpcy5ib25lcyxiPTAsYz1hLmxlbmd0aDtjPmI7YisrKWFbYl0uc2V0VG9TZXR1cFBvc2UoKX0sc2V0U2xvdHNUb1NldHVwUG9zZTpmdW5jdGlvbigpe2Zvcih2YXIgYT10aGlzLnNsb3RzLGI9MCxjPWEubGVuZ3RoO2M+YjtiKyspYVtiXS5zZXRUb1NldHVwUG9zZShiKX0sZ2V0Um9vdEJvbmU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5ib25lcy5sZW5ndGg/dGhpcy5ib25lc1swXTpudWxsfSxmaW5kQm9uZTpmdW5jdGlvbihhKXtmb3IodmFyIGI9dGhpcy5ib25lcyxjPTAsZD1iLmxlbmd0aDtkPmM7YysrKWlmKGJbY10uZGF0YS5uYW1lPT1hKXJldHVybiBiW2NdO3JldHVybiBudWxsfSxmaW5kQm9uZUluZGV4OmZ1bmN0aW9uKGEpe2Zvcih2YXIgYj10aGlzLmJvbmVzLGM9MCxkPWIubGVuZ3RoO2Q+YztjKyspaWYoYltjXS5kYXRhLm5hbWU9PWEpcmV0dXJuIGM7cmV0dXJuLTF9LGZpbmRTbG90OmZ1bmN0aW9uKGEpe2Zvcih2YXIgYj10aGlzLnNsb3RzLGM9MCxkPWIubGVuZ3RoO2Q+YztjKyspaWYoYltjXS5kYXRhLm5hbWU9PWEpcmV0dXJuIGJbY107cmV0dXJuIG51bGx9LGZpbmRTbG90SW5kZXg6ZnVuY3Rpb24oYSl7Zm9yKHZhciBiPXRoaXMuc2xvdHMsYz0wLGQ9Yi5sZW5ndGg7ZD5jO2MrKylpZihiW2NdLmRhdGEubmFtZT09YSlyZXR1cm4gYztyZXR1cm4tMX0sc2V0U2tpbkJ5TmFtZTpmdW5jdGlvbihhKXt2YXIgYj10aGlzLmRhdGEuZmluZFNraW4oYSk7aWYoIWIpdGhyb3dcIlNraW4gbm90IGZvdW5kOiBcIithO3RoaXMuc2V0U2tpbihiKX0sc2V0U2tpbjpmdW5jdGlvbihhKXt0aGlzLnNraW4mJmEmJmEuX2F0dGFjaEFsbCh0aGlzLHRoaXMuc2tpbiksdGhpcy5za2luPWF9LGdldEF0dGFjaG1lbnRCeVNsb3ROYW1lOmZ1bmN0aW9uKGEsYil7cmV0dXJuIHRoaXMuZ2V0QXR0YWNobWVudEJ5U2xvdEluZGV4KHRoaXMuZGF0YS5maW5kU2xvdEluZGV4KGEpLGIpfSxnZXRBdHRhY2htZW50QnlTbG90SW5kZXg6ZnVuY3Rpb24oYSxiKXtpZih0aGlzLnNraW4pe3ZhciBjPXRoaXMuc2tpbi5nZXRBdHRhY2htZW50KGEsYik7aWYoYylyZXR1cm4gY31yZXR1cm4gdGhpcy5kYXRhLmRlZmF1bHRTa2luP3RoaXMuZGF0YS5kZWZhdWx0U2tpbi5nZXRBdHRhY2htZW50KGEsYik6bnVsbH0sc2V0QXR0YWNobWVudDpmdW5jdGlvbihhLGIpe2Zvcih2YXIgYz10aGlzLnNsb3RzLGQ9MCxlPWMuc2l6ZTtlPmQ7ZCsrKXt2YXIgZj1jW2RdO2lmKGYuZGF0YS5uYW1lPT1hKXt2YXIgZz1udWxsO2lmKGImJihnPXRoaXMuZ2V0QXR0YWNobWVudChkLGIpLG51bGw9PWcpKXRocm93XCJBdHRhY2htZW50IG5vdCBmb3VuZDogXCIrYitcIiwgZm9yIHNsb3Q6IFwiK2E7cmV0dXJuIGYuc2V0QXR0YWNobWVudChnKSx2b2lkIDB9fXRocm93XCJTbG90IG5vdCBmb3VuZDogXCIrYX0sdXBkYXRlOmZ1bmN0aW9uKGEpe3RpbWUrPWF9fSxmLkF0dGFjaG1lbnRUeXBlPXtyZWdpb246MH0sZi5SZWdpb25BdHRhY2htZW50PWZ1bmN0aW9uKCl7dGhpcy5vZmZzZXQ9W10sdGhpcy5vZmZzZXQubGVuZ3RoPTgsdGhpcy51dnM9W10sdGhpcy51dnMubGVuZ3RoPTh9LGYuUmVnaW9uQXR0YWNobWVudC5wcm90b3R5cGU9e3g6MCx5OjAscm90YXRpb246MCxzY2FsZVg6MSxzY2FsZVk6MSx3aWR0aDowLGhlaWdodDowLHJlbmRlcmVyT2JqZWN0Om51bGwscmVnaW9uT2Zmc2V0WDowLHJlZ2lvbk9mZnNldFk6MCxyZWdpb25XaWR0aDowLHJlZ2lvbkhlaWdodDowLHJlZ2lvbk9yaWdpbmFsV2lkdGg6MCxyZWdpb25PcmlnaW5hbEhlaWdodDowLHNldFVWczpmdW5jdGlvbihhLGIsYyxkLGUpe3ZhciBmPXRoaXMudXZzO2U/KGZbMl09YSxmWzNdPWQsZls0XT1hLGZbNV09YixmWzZdPWMsZls3XT1iLGZbMF09YyxmWzFdPWQpOihmWzBdPWEsZlsxXT1kLGZbMl09YSxmWzNdPWIsZls0XT1jLGZbNV09YixmWzZdPWMsZls3XT1kKX0sdXBkYXRlT2Zmc2V0OmZ1bmN0aW9uKCl7dmFyIGE9dGhpcy53aWR0aC90aGlzLnJlZ2lvbk9yaWdpbmFsV2lkdGgqdGhpcy5zY2FsZVgsYj10aGlzLmhlaWdodC90aGlzLnJlZ2lvbk9yaWdpbmFsSGVpZ2h0KnRoaXMuc2NhbGVZLGM9LXRoaXMud2lkdGgvMip0aGlzLnNjYWxlWCt0aGlzLnJlZ2lvbk9mZnNldFgqYSxkPS10aGlzLmhlaWdodC8yKnRoaXMuc2NhbGVZK3RoaXMucmVnaW9uT2Zmc2V0WSpiLGU9Yyt0aGlzLnJlZ2lvbldpZHRoKmEsZj1kK3RoaXMucmVnaW9uSGVpZ2h0KmIsZz10aGlzLnJvdGF0aW9uKk1hdGguUEkvMTgwLGg9TWF0aC5jb3MoZyksaT1NYXRoLnNpbihnKSxqPWMqaCt0aGlzLngsaz1jKmksbD1kKmgrdGhpcy55LG09ZCppLG49ZSpoK3RoaXMueCxvPWUqaSxwPWYqaCt0aGlzLnkscT1mKmkscj10aGlzLm9mZnNldDtyWzBdPWotbSxyWzFdPWwrayxyWzJdPWotcSxyWzNdPXArayxyWzRdPW4tcSxyWzVdPXArbyxyWzZdPW4tbSxyWzddPWwrb30sY29tcHV0ZVZlcnRpY2VzOmZ1bmN0aW9uKGEsYixjLGQpe2ErPWMud29ybGRYLGIrPWMud29ybGRZO3ZhciBlPWMubTAwLGY9Yy5tMDEsZz1jLm0xMCxoPWMubTExLGk9dGhpcy5vZmZzZXQ7ZFswXT1pWzBdKmUraVsxXSpmK2EsZFsxXT1pWzBdKmcraVsxXSpoK2IsZFsyXT1pWzJdKmUraVszXSpmK2EsZFszXT1pWzJdKmcraVszXSpoK2IsZFs0XT1pWzRdKmUraVs1XSpmK2EsZFs1XT1pWzRdKmcraVs1XSpoK2IsZFs2XT1pWzZdKmUraVs3XSpmK2EsZFs3XT1pWzZdKmcraVs3XSpoK2J9fSxmLkFuaW1hdGlvblN0YXRlRGF0YT1mdW5jdGlvbihhKXt0aGlzLnNrZWxldG9uRGF0YT1hLHRoaXMuYW5pbWF0aW9uVG9NaXhUaW1lPXt9fSxmLkFuaW1hdGlvblN0YXRlRGF0YS5wcm90b3R5cGU9e2RlZmF1bHRNaXg6MCxzZXRNaXhCeU5hbWU6ZnVuY3Rpb24oYSxiLGMpe3ZhciBkPXRoaXMuc2tlbGV0b25EYXRhLmZpbmRBbmltYXRpb24oYSk7aWYoIWQpdGhyb3dcIkFuaW1hdGlvbiBub3QgZm91bmQ6IFwiK2E7dmFyIGU9dGhpcy5za2VsZXRvbkRhdGEuZmluZEFuaW1hdGlvbihiKTtpZighZSl0aHJvd1wiQW5pbWF0aW9uIG5vdCBmb3VuZDogXCIrYjt0aGlzLnNldE1peChkLGUsYyl9LHNldE1peDpmdW5jdGlvbihhLGIsYyl7dGhpcy5hbmltYXRpb25Ub01peFRpbWVbYS5uYW1lK1wiOlwiK2IubmFtZV09Y30sZ2V0TWl4OmZ1bmN0aW9uKGEsYil7dmFyIGM9dGhpcy5hbmltYXRpb25Ub01peFRpbWVbYS5uYW1lK1wiOlwiK2IubmFtZV07cmV0dXJuIGM/Yzp0aGlzLmRlZmF1bHRNaXh9fSxmLkFuaW1hdGlvblN0YXRlPWZ1bmN0aW9uKGEpe3RoaXMuZGF0YT1hLHRoaXMucXVldWU9W119LGYuQW5pbWF0aW9uU3RhdGUucHJvdG90eXBlPXthbmltYXRpb25TcGVlZDoxLGN1cnJlbnQ6bnVsbCxwcmV2aW91czpudWxsLGN1cnJlbnRUaW1lOjAscHJldmlvdXNUaW1lOjAsY3VycmVudExvb3A6ITEscHJldmlvdXNMb29wOiExLG1peFRpbWU6MCxtaXhEdXJhdGlvbjowLHVwZGF0ZTpmdW5jdGlvbihhKXtpZih0aGlzLmN1cnJlbnRUaW1lKz1hKnRoaXMuYW5pbWF0aW9uU3BlZWQsdGhpcy5wcmV2aW91c1RpbWUrPWEsdGhpcy5taXhUaW1lKz1hLHRoaXMucXVldWUubGVuZ3RoPjApe3ZhciBiPXRoaXMucXVldWVbMF07dGhpcy5jdXJyZW50VGltZT49Yi5kZWxheSYmKHRoaXMuX3NldEFuaW1hdGlvbihiLmFuaW1hdGlvbixiLmxvb3ApLHRoaXMucXVldWUuc2hpZnQoKSl9fSxhcHBseTpmdW5jdGlvbihhKXtpZih0aGlzLmN1cnJlbnQpaWYodGhpcy5wcmV2aW91cyl7dGhpcy5wcmV2aW91cy5hcHBseShhLHRoaXMucHJldmlvdXNUaW1lLHRoaXMucHJldmlvdXNMb29wKTt2YXIgYj10aGlzLm1peFRpbWUvdGhpcy5taXhEdXJhdGlvbjtiPj0xJiYoYj0xLHRoaXMucHJldmlvdXM9bnVsbCksdGhpcy5jdXJyZW50Lm1peChhLHRoaXMuY3VycmVudFRpbWUsdGhpcy5jdXJyZW50TG9vcCxiKX1lbHNlIHRoaXMuY3VycmVudC5hcHBseShhLHRoaXMuY3VycmVudFRpbWUsdGhpcy5jdXJyZW50TG9vcCl9LGNsZWFyQW5pbWF0aW9uOmZ1bmN0aW9uKCl7dGhpcy5wcmV2aW91cz1udWxsLHRoaXMuY3VycmVudD1udWxsLHRoaXMucXVldWUubGVuZ3RoPTB9LF9zZXRBbmltYXRpb246ZnVuY3Rpb24oYSxiKXt0aGlzLnByZXZpb3VzPW51bGwsYSYmdGhpcy5jdXJyZW50JiYodGhpcy5taXhEdXJhdGlvbj10aGlzLmRhdGEuZ2V0TWl4KHRoaXMuY3VycmVudCxhKSx0aGlzLm1peER1cmF0aW9uPjAmJih0aGlzLm1peFRpbWU9MCx0aGlzLnByZXZpb3VzPXRoaXMuY3VycmVudCx0aGlzLnByZXZpb3VzVGltZT10aGlzLmN1cnJlbnRUaW1lLHRoaXMucHJldmlvdXNMb29wPXRoaXMuY3VycmVudExvb3ApKSx0aGlzLmN1cnJlbnQ9YSx0aGlzLmN1cnJlbnRMb29wPWIsdGhpcy5jdXJyZW50VGltZT0wfSxzZXRBbmltYXRpb25CeU5hbWU6ZnVuY3Rpb24oYSxiKXt2YXIgYz10aGlzLmRhdGEuc2tlbGV0b25EYXRhLmZpbmRBbmltYXRpb24oYSk7aWYoIWMpdGhyb3dcIkFuaW1hdGlvbiBub3QgZm91bmQ6IFwiK2E7dGhpcy5zZXRBbmltYXRpb24oYyxiKX0sc2V0QW5pbWF0aW9uOmZ1bmN0aW9uKGEsYil7dGhpcy5xdWV1ZS5sZW5ndGg9MCx0aGlzLl9zZXRBbmltYXRpb24oYSxiKX0sYWRkQW5pbWF0aW9uQnlOYW1lOmZ1bmN0aW9uKGEsYixjKXt2YXIgZD10aGlzLmRhdGEuc2tlbGV0b25EYXRhLmZpbmRBbmltYXRpb24oYSk7aWYoIWQpdGhyb3dcIkFuaW1hdGlvbiBub3QgZm91bmQ6IFwiK2E7dGhpcy5hZGRBbmltYXRpb24oZCxiLGMpfSxhZGRBbmltYXRpb246ZnVuY3Rpb24oYSxiLGMpe3ZhciBkPXt9O2lmKGQuYW5pbWF0aW9uPWEsZC5sb29wPWIsIWN8fDA+PWMpe3ZhciBlPXRoaXMucXVldWUubGVuZ3RoP3RoaXMucXVldWVbdGhpcy5xdWV1ZS5sZW5ndGgtMV0uYW5pbWF0aW9uOnRoaXMuY3VycmVudDtjPW51bGwhPWU/ZS5kdXJhdGlvbi10aGlzLmRhdGEuZ2V0TWl4KGUsYSkrKGN8fDApOjB9ZC5kZWxheT1jLHRoaXMucXVldWUucHVzaChkKX0saXNDb21wbGV0ZTpmdW5jdGlvbigpe3JldHVybiF0aGlzLmN1cnJlbnR8fHRoaXMuY3VycmVudFRpbWU+PXRoaXMuY3VycmVudC5kdXJhdGlvbn19LGYuU2tlbGV0b25Kc29uPWZ1bmN0aW9uKGEpe3RoaXMuYXR0YWNobWVudExvYWRlcj1hfSxmLlNrZWxldG9uSnNvbi5wcm90b3R5cGU9e3NjYWxlOjEscmVhZFNrZWxldG9uRGF0YTpmdW5jdGlvbihhKXtmb3IodmFyIGIsYz1uZXcgZi5Ta2VsZXRvbkRhdGEsZD1hLmJvbmVzLGU9MCxnPWQubGVuZ3RoO2c+ZTtlKyspe3ZhciBoPWRbZV0saT1udWxsO2lmKGgucGFyZW50JiYoaT1jLmZpbmRCb25lKGgucGFyZW50KSwhaSkpdGhyb3dcIlBhcmVudCBib25lIG5vdCBmb3VuZDogXCIraC5wYXJlbnQ7Yj1uZXcgZi5Cb25lRGF0YShoLm5hbWUsaSksYi5sZW5ndGg9KGgubGVuZ3RofHwwKSp0aGlzLnNjYWxlLGIueD0oaC54fHwwKSp0aGlzLnNjYWxlLGIueT0oaC55fHwwKSp0aGlzLnNjYWxlLGIucm90YXRpb249aC5yb3RhdGlvbnx8MCxiLnNjYWxlWD1oLnNjYWxlWHx8MSxiLnNjYWxlWT1oLnNjYWxlWXx8MSxjLmJvbmVzLnB1c2goYil9dmFyIGo9YS5zbG90cztmb3IoZT0wLGc9ai5sZW5ndGg7Zz5lO2UrKyl7dmFyIGs9altlXTtpZihiPWMuZmluZEJvbmUoay5ib25lKSwhYil0aHJvd1wiU2xvdCBib25lIG5vdCBmb3VuZDogXCIray5ib25lO3ZhciBsPW5ldyBmLlNsb3REYXRhKGsubmFtZSxiKSxtPWsuY29sb3I7bSYmKGwucj1mLlNrZWxldG9uSnNvbi50b0NvbG9yKG0sMCksbC5nPWYuU2tlbGV0b25Kc29uLnRvQ29sb3IobSwxKSxsLmI9Zi5Ta2VsZXRvbkpzb24udG9Db2xvcihtLDIpLGwuYT1mLlNrZWxldG9uSnNvbi50b0NvbG9yKG0sMykpLGwuYXR0YWNobWVudE5hbWU9ay5hdHRhY2htZW50LGMuc2xvdHMucHVzaChsKX12YXIgbj1hLnNraW5zO2Zvcih2YXIgbyBpbiBuKWlmKG4uaGFzT3duUHJvcGVydHkobykpe3ZhciBwPW5bb10scT1uZXcgZi5Ta2luKG8pO2Zvcih2YXIgciBpbiBwKWlmKHAuaGFzT3duUHJvcGVydHkocikpe3ZhciBzPWMuZmluZFNsb3RJbmRleChyKSx0PXBbcl07Zm9yKHZhciB1IGluIHQpaWYodC5oYXNPd25Qcm9wZXJ0eSh1KSl7dmFyIHY9dGhpcy5yZWFkQXR0YWNobWVudChxLHUsdFt1XSk7bnVsbCE9diYmcS5hZGRBdHRhY2htZW50KHMsdSx2KX19Yy5za2lucy5wdXNoKHEpLFwiZGVmYXVsdFwiPT1xLm5hbWUmJihjLmRlZmF1bHRTa2luPXEpfXZhciB3PWEuYW5pbWF0aW9ucztmb3IodmFyIHggaW4gdyl3Lmhhc093blByb3BlcnR5KHgpJiZ0aGlzLnJlYWRBbmltYXRpb24oeCx3W3hdLGMpO3JldHVybiBjfSxyZWFkQXR0YWNobWVudDpmdW5jdGlvbihhLGIsYyl7Yj1jLm5hbWV8fGI7dmFyIGQ9Zi5BdHRhY2htZW50VHlwZVtjLnR5cGV8fFwicmVnaW9uXCJdO2lmKGQ9PWYuQXR0YWNobWVudFR5cGUucmVnaW9uKXt2YXIgZT1uZXcgZi5SZWdpb25BdHRhY2htZW50O3JldHVybiBlLng9KGMueHx8MCkqdGhpcy5zY2FsZSxlLnk9KGMueXx8MCkqdGhpcy5zY2FsZSxlLnNjYWxlWD1jLnNjYWxlWHx8MSxlLnNjYWxlWT1jLnNjYWxlWXx8MSxlLnJvdGF0aW9uPWMucm90YXRpb258fDAsZS53aWR0aD0oYy53aWR0aHx8MzIpKnRoaXMuc2NhbGUsZS5oZWlnaHQ9KGMuaGVpZ2h0fHwzMikqdGhpcy5zY2FsZSxlLnVwZGF0ZU9mZnNldCgpLGUucmVuZGVyZXJPYmplY3Q9e30sZS5yZW5kZXJlck9iamVjdC5uYW1lPWIsZS5yZW5kZXJlck9iamVjdC5zY2FsZT17fSxlLnJlbmRlcmVyT2JqZWN0LnNjYWxlLng9ZS5zY2FsZVgsZS5yZW5kZXJlck9iamVjdC5zY2FsZS55PWUuc2NhbGVZLGUucmVuZGVyZXJPYmplY3Qucm90YXRpb249LWUucm90YXRpb24qTWF0aC5QSS8xODAsZX10aHJvd1wiVW5rbm93biBhdHRhY2htZW50IHR5cGU6IFwiK2R9LHJlYWRBbmltYXRpb246ZnVuY3Rpb24oYSxiLGMpe3ZhciBkLGUsZyxoLGksaixrLGw9W10sbT0wLG49Yi5ib25lcztmb3IodmFyIG8gaW4gbilpZihuLmhhc093blByb3BlcnR5KG8pKXt2YXIgcD1jLmZpbmRCb25lSW5kZXgobyk7aWYoLTE9PXApdGhyb3dcIkJvbmUgbm90IGZvdW5kOiBcIitvO3ZhciBxPW5bb107Zm9yKGcgaW4gcSlpZihxLmhhc093blByb3BlcnR5KGcpKWlmKGk9cVtnXSxcInJvdGF0ZVwiPT1nKXtmb3IoZT1uZXcgZi5Sb3RhdGVUaW1lbGluZShpLmxlbmd0aCksZS5ib25lSW5kZXg9cCxkPTAsaj0wLGs9aS5sZW5ndGg7az5qO2orKyloPWlbal0sZS5zZXRGcmFtZShkLGgudGltZSxoLmFuZ2xlKSxmLlNrZWxldG9uSnNvbi5yZWFkQ3VydmUoZSxkLGgpLGQrKztsLnB1c2goZSksbT1NYXRoLm1heChtLGUuZnJhbWVzWzIqZS5nZXRGcmFtZUNvdW50KCktMl0pfWVsc2V7aWYoXCJ0cmFuc2xhdGVcIiE9ZyYmXCJzY2FsZVwiIT1nKXRocm93XCJJbnZhbGlkIHRpbWVsaW5lIHR5cGUgZm9yIGEgYm9uZTogXCIrZytcIiAoXCIrbytcIilcIjt2YXIgcj0xO2ZvcihcInNjYWxlXCI9PWc/ZT1uZXcgZi5TY2FsZVRpbWVsaW5lKGkubGVuZ3RoKTooZT1uZXcgZi5UcmFuc2xhdGVUaW1lbGluZShpLmxlbmd0aCkscj10aGlzLnNjYWxlKSxlLmJvbmVJbmRleD1wLGQ9MCxqPTAsaz1pLmxlbmd0aDtrPmo7aisrKXtoPWlbal07dmFyIHM9KGgueHx8MCkqcix0PShoLnl8fDApKnI7ZS5zZXRGcmFtZShkLGgudGltZSxzLHQpLGYuU2tlbGV0b25Kc29uLnJlYWRDdXJ2ZShlLGQsaCksZCsrfWwucHVzaChlKSxtPU1hdGgubWF4KG0sZS5mcmFtZXNbMyplLmdldEZyYW1lQ291bnQoKS0zXSl9fXZhciB1PWIuc2xvdHM7Zm9yKHZhciB2IGluIHUpaWYodS5oYXNPd25Qcm9wZXJ0eSh2KSl7dmFyIHc9dVt2XSx4PWMuZmluZFNsb3RJbmRleCh2KTtmb3IoZyBpbiB3KWlmKHcuaGFzT3duUHJvcGVydHkoZykpaWYoaT13W2ddLFwiY29sb3JcIj09Zyl7Zm9yKGU9bmV3IGYuQ29sb3JUaW1lbGluZShpLmxlbmd0aCksZS5zbG90SW5kZXg9eCxkPTAsaj0wLGs9aS5sZW5ndGg7az5qO2orKyl7aD1pW2pdO3ZhciB5PWguY29sb3Isej1mLlNrZWxldG9uSnNvbi50b0NvbG9yKHksMCksQT1mLlNrZWxldG9uSnNvbi50b0NvbG9yKHksMSksQj1mLlNrZWxldG9uSnNvbi50b0NvbG9yKHksMiksQz1mLlNrZWxldG9uSnNvbi50b0NvbG9yKHksMyk7ZS5zZXRGcmFtZShkLGgudGltZSx6LEEsQixDKSxmLlNrZWxldG9uSnNvbi5yZWFkQ3VydmUoZSxkLGgpLGQrK31sLnB1c2goZSksbT1NYXRoLm1heChtLGUuZnJhbWVzWzUqZS5nZXRGcmFtZUNvdW50KCktNV0pfWVsc2V7aWYoXCJhdHRhY2htZW50XCIhPWcpdGhyb3dcIkludmFsaWQgdGltZWxpbmUgdHlwZSBmb3IgYSBzbG90OiBcIitnK1wiIChcIit2K1wiKVwiO2ZvcihlPW5ldyBmLkF0dGFjaG1lbnRUaW1lbGluZShpLmxlbmd0aCksZS5zbG90SW5kZXg9eCxkPTAsaj0wLGs9aS5sZW5ndGg7az5qO2orKyloPWlbal0sZS5zZXRGcmFtZShkKyssaC50aW1lLGgubmFtZSk7bC5wdXNoKGUpLG09TWF0aC5tYXgobSxlLmZyYW1lc1tlLmdldEZyYW1lQ291bnQoKS0xXSl9fWMuYW5pbWF0aW9ucy5wdXNoKG5ldyBmLkFuaW1hdGlvbihhLGwsbSkpfX0sZi5Ta2VsZXRvbkpzb24ucmVhZEN1cnZlPWZ1bmN0aW9uKGEsYixjKXt2YXIgZD1jLmN1cnZlO2QmJihcInN0ZXBwZWRcIj09ZD9hLmN1cnZlcy5zZXRTdGVwcGVkKGIpOmQgaW5zdGFuY2VvZiBBcnJheSYmYS5jdXJ2ZXMuc2V0Q3VydmUoYixkWzBdLGRbMV0sZFsyXSxkWzNdKSl9LGYuU2tlbGV0b25Kc29uLnRvQ29sb3I9ZnVuY3Rpb24oYSxiKXtpZig4IT1hLmxlbmd0aCl0aHJvd1wiQ29sb3IgaGV4aWRlY2ltYWwgbGVuZ3RoIG11c3QgYmUgOCwgcmVjaWV2ZWQ6IFwiK2E7cmV0dXJuIHBhcnNlSW50KGEuc3Vic3RyKDIqYiwyKSwxNikvMjU1fSxmLkF0bGFzPWZ1bmN0aW9uKGEsYil7dGhpcy50ZXh0dXJlTG9hZGVyPWIsdGhpcy5wYWdlcz1bXSx0aGlzLnJlZ2lvbnM9W107dmFyIGM9bmV3IGYuQXRsYXNSZWFkZXIoYSksZD1bXTtkLmxlbmd0aD00O2Zvcih2YXIgZT1udWxsOzspe3ZhciBnPWMucmVhZExpbmUoKTtpZihudWxsPT1nKWJyZWFrO2lmKGc9Yy50cmltKGcpLGcubGVuZ3RoKWlmKGUpe3ZhciBoPW5ldyBmLkF0bGFzUmVnaW9uO2gubmFtZT1nLGgucGFnZT1lLGgucm90YXRlPVwidHJ1ZVwiPT1jLnJlYWRWYWx1ZSgpLGMucmVhZFR1cGxlKGQpO3ZhciBpPXBhcnNlSW50KGRbMF0sMTApLGo9cGFyc2VJbnQoZFsxXSwxMCk7Yy5yZWFkVHVwbGUoZCk7dmFyIGs9cGFyc2VJbnQoZFswXSwxMCksbD1wYXJzZUludChkWzFdLDEwKTtoLnU9aS9lLndpZHRoLGgudj1qL2UuaGVpZ2h0LGgucm90YXRlPyhoLnUyPShpK2wpL2Uud2lkdGgsaC52Mj0oaitrKS9lLmhlaWdodCk6KGgudTI9KGkraykvZS53aWR0aCxoLnYyPShqK2wpL2UuaGVpZ2h0KSxoLng9aSxoLnk9aixoLndpZHRoPU1hdGguYWJzKGspLGguaGVpZ2h0PU1hdGguYWJzKGwpLDQ9PWMucmVhZFR1cGxlKGQpJiYoaC5zcGxpdHM9W3BhcnNlSW50KGRbMF0sMTApLHBhcnNlSW50KGRbMV0sMTApLHBhcnNlSW50KGRbMl0sMTApLHBhcnNlSW50KGRbM10sMTApXSw0PT1jLnJlYWRUdXBsZShkKSYmKGgucGFkcz1bcGFyc2VJbnQoZFswXSwxMCkscGFyc2VJbnQoZFsxXSwxMCkscGFyc2VJbnQoZFsyXSwxMCkscGFyc2VJbnQoZFszXSwxMCldLGMucmVhZFR1cGxlKGQpKSksaC5vcmlnaW5hbFdpZHRoPXBhcnNlSW50KGRbMF0sMTApLGgub3JpZ2luYWxIZWlnaHQ9cGFyc2VJbnQoZFsxXSwxMCksYy5yZWFkVHVwbGUoZCksaC5vZmZzZXRYPXBhcnNlSW50KGRbMF0sMTApLGgub2Zmc2V0WT1wYXJzZUludChkWzFdLDEwKSxoLmluZGV4PXBhcnNlSW50KGMucmVhZFZhbHVlKCksMTApLHRoaXMucmVnaW9ucy5wdXNoKGgpfWVsc2V7ZT1uZXcgZi5BdGxhc1BhZ2UsZS5uYW1lPWcsZS5mb3JtYXQ9Zi5BdGxhcy5Gb3JtYXRbYy5yZWFkVmFsdWUoKV0sYy5yZWFkVHVwbGUoZCksZS5taW5GaWx0ZXI9Zi5BdGxhcy5UZXh0dXJlRmlsdGVyW2RbMF1dLGUubWFnRmlsdGVyPWYuQXRsYXMuVGV4dHVyZUZpbHRlcltkWzFdXTt2YXIgbT1jLnJlYWRWYWx1ZSgpO2UudVdyYXA9Zi5BdGxhcy5UZXh0dXJlV3JhcC5jbGFtcFRvRWRnZSxlLnZXcmFwPWYuQXRsYXMuVGV4dHVyZVdyYXAuY2xhbXBUb0VkZ2UsXCJ4XCI9PW0/ZS51V3JhcD1mLkF0bGFzLlRleHR1cmVXcmFwLnJlcGVhdDpcInlcIj09bT9lLnZXcmFwPWYuQXRsYXMuVGV4dHVyZVdyYXAucmVwZWF0OlwieHlcIj09bSYmKGUudVdyYXA9ZS52V3JhcD1mLkF0bGFzLlRleHR1cmVXcmFwLnJlcGVhdCksYi5sb2FkKGUsZyksdGhpcy5wYWdlcy5wdXNoKGUpfWVsc2UgZT1udWxsfX0sZi5BdGxhcy5wcm90b3R5cGU9e2ZpbmRSZWdpb246ZnVuY3Rpb24oYSl7Zm9yKHZhciBiPXRoaXMucmVnaW9ucyxjPTAsZD1iLmxlbmd0aDtkPmM7YysrKWlmKGJbY10ubmFtZT09YSlyZXR1cm4gYltjXTtyZXR1cm4gbnVsbH0sZGlzcG9zZTpmdW5jdGlvbigpe2Zvcih2YXIgYT10aGlzLnBhZ2VzLGI9MCxjPWEubGVuZ3RoO2M+YjtiKyspdGhpcy50ZXh0dXJlTG9hZGVyLnVubG9hZChhW2JdLnJlbmRlcmVyT2JqZWN0KX0sdXBkYXRlVVZzOmZ1bmN0aW9uKGEpe2Zvcih2YXIgYj10aGlzLnJlZ2lvbnMsYz0wLGQ9Yi5sZW5ndGg7ZD5jO2MrKyl7dmFyIGU9YltjXTtlLnBhZ2U9PWEmJihlLnU9ZS54L2Eud2lkdGgsZS52PWUueS9hLmhlaWdodCxlLnJvdGF0ZT8oZS51Mj0oZS54K2UuaGVpZ2h0KS9hLndpZHRoLGUudjI9KGUueStlLndpZHRoKS9hLmhlaWdodCk6KGUudTI9KGUueCtlLndpZHRoKS9hLndpZHRoLGUudjI9KGUueStlLmhlaWdodCkvYS5oZWlnaHQpKX19fSxmLkF0bGFzLkZvcm1hdD17YWxwaGE6MCxpbnRlbnNpdHk6MSxsdW1pbmFuY2VBbHBoYToyLHJnYjU2NTozLHJnYmE0NDQ0OjQscmdiODg4OjUscmdiYTg4ODg6Nn0sZi5BdGxhcy5UZXh0dXJlRmlsdGVyPXtuZWFyZXN0OjAsbGluZWFyOjEsbWlwTWFwOjIsbWlwTWFwTmVhcmVzdE5lYXJlc3Q6MyxtaXBNYXBMaW5lYXJOZWFyZXN0OjQsbWlwTWFwTmVhcmVzdExpbmVhcjo1LG1pcE1hcExpbmVhckxpbmVhcjo2fSxmLkF0bGFzLlRleHR1cmVXcmFwPXttaXJyb3JlZFJlcGVhdDowLGNsYW1wVG9FZGdlOjEscmVwZWF0OjJ9LGYuQXRsYXNQYWdlPWZ1bmN0aW9uKCl7fSxmLkF0bGFzUGFnZS5wcm90b3R5cGU9e25hbWU6bnVsbCxmb3JtYXQ6bnVsbCxtaW5GaWx0ZXI6bnVsbCxtYWdGaWx0ZXI6bnVsbCx1V3JhcDpudWxsLHZXcmFwOm51bGwscmVuZGVyZXJPYmplY3Q6bnVsbCx3aWR0aDowLGhlaWdodDowfSxmLkF0bGFzUmVnaW9uPWZ1bmN0aW9uKCl7fSxmLkF0bGFzUmVnaW9uLnByb3RvdHlwZT17cGFnZTpudWxsLG5hbWU6bnVsbCx4OjAseTowLHdpZHRoOjAsaGVpZ2h0OjAsdTowLHY6MCx1MjowLHYyOjAsb2Zmc2V0WDowLG9mZnNldFk6MCxvcmlnaW5hbFdpZHRoOjAsb3JpZ2luYWxIZWlnaHQ6MCxpbmRleDowLHJvdGF0ZTohMSxzcGxpdHM6bnVsbCxwYWRzOm51bGx9LGYuQXRsYXNSZWFkZXI9ZnVuY3Rpb24oYSl7dGhpcy5saW5lcz1hLnNwbGl0KC9cXHJcXG58XFxyfFxcbi8pfSxmLkF0bGFzUmVhZGVyLnByb3RvdHlwZT17aW5kZXg6MCx0cmltOmZ1bmN0aW9uKGEpe3JldHVybiBhLnJlcGxhY2UoL15cXHMrfFxccyskL2csXCJcIil9LHJlYWRMaW5lOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuaW5kZXg+PXRoaXMubGluZXMubGVuZ3RoP251bGw6dGhpcy5saW5lc1t0aGlzLmluZGV4KytdfSxyZWFkVmFsdWU6ZnVuY3Rpb24oKXt2YXIgYT10aGlzLnJlYWRMaW5lKCksYj1hLmluZGV4T2YoXCI6XCIpO2lmKC0xPT1iKXRocm93XCJJbnZhbGlkIGxpbmU6IFwiK2E7cmV0dXJuIHRoaXMudHJpbShhLnN1YnN0cmluZyhiKzEpKX0scmVhZFR1cGxlOmZ1bmN0aW9uKGEpe3ZhciBiPXRoaXMucmVhZExpbmUoKSxjPWIuaW5kZXhPZihcIjpcIik7aWYoLTE9PWMpdGhyb3dcIkludmFsaWQgbGluZTogXCIrYjtmb3IodmFyIGQ9MCxlPWMrMTszPmQ7ZCsrKXt2YXIgZj1iLmluZGV4T2YoXCIsXCIsZSk7aWYoLTE9PWYpe2lmKCFkKXRocm93XCJJbnZhbGlkIGxpbmU6IFwiK2I7YnJlYWt9YVtkXT10aGlzLnRyaW0oYi5zdWJzdHIoZSxmLWUpKSxlPWYrMX1yZXR1cm4gYVtkXT10aGlzLnRyaW0oYi5zdWJzdHJpbmcoZSkpLGQrMX19LGYuQXRsYXNBdHRhY2htZW50TG9hZGVyPWZ1bmN0aW9uKGEpe3RoaXMuYXRsYXM9YX0sZi5BdGxhc0F0dGFjaG1lbnRMb2FkZXIucHJvdG90eXBlPXtuZXdBdHRhY2htZW50OmZ1bmN0aW9uKGEsYixjKXtzd2l0Y2goYil7Y2FzZSBmLkF0dGFjaG1lbnRUeXBlLnJlZ2lvbjp2YXIgZD10aGlzLmF0bGFzLmZpbmRSZWdpb24oYyk7aWYoIWQpdGhyb3dcIlJlZ2lvbiBub3QgZm91bmQgaW4gYXRsYXM6IFwiK2MrXCIgKFwiK2IrXCIpXCI7dmFyIGU9bmV3IGYuUmVnaW9uQXR0YWNobWVudChjKTtyZXR1cm4gZS5yZW5kZXJlck9iamVjdD1kLGUuc2V0VVZzKGQudSxkLnYsZC51MixkLnYyLGQucm90YXRlKSxlLnJlZ2lvbk9mZnNldFg9ZC5vZmZzZXRYLGUucmVnaW9uT2Zmc2V0WT1kLm9mZnNldFksZS5yZWdpb25XaWR0aD1kLndpZHRoLGUucmVnaW9uSGVpZ2h0PWQuaGVpZ2h0LGUucmVnaW9uT3JpZ2luYWxXaWR0aD1kLm9yaWdpbmFsV2lkdGgsZS5yZWdpb25PcmlnaW5hbEhlaWdodD1kLm9yaWdpbmFsSGVpZ2h0LGV9dGhyb3dcIlVua25vd24gYXR0YWNobWVudCB0eXBlOiBcIitifX0sZi5Cb25lLnlEb3duPSEwLGIuQW5pbUNhY2hlPXt9LGIuU3BpbmU9ZnVuY3Rpb24oYSl7aWYoYi5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLmNhbGwodGhpcyksdGhpcy5zcGluZURhdGE9Yi5BbmltQ2FjaGVbYV0sIXRoaXMuc3BpbmVEYXRhKXRocm93IG5ldyBFcnJvcihcIlNwaW5lIGRhdGEgbXVzdCBiZSBwcmVsb2FkZWQgdXNpbmcgUElYSS5TcGluZUxvYWRlciBvciBQSVhJLkFzc2V0TG9hZGVyOiBcIithKTt0aGlzLnNrZWxldG9uPW5ldyBmLlNrZWxldG9uKHRoaXMuc3BpbmVEYXRhKSx0aGlzLnNrZWxldG9uLnVwZGF0ZVdvcmxkVHJhbnNmb3JtKCksdGhpcy5zdGF0ZURhdGE9bmV3IGYuQW5pbWF0aW9uU3RhdGVEYXRhKHRoaXMuc3BpbmVEYXRhKSx0aGlzLnN0YXRlPW5ldyBmLkFuaW1hdGlvblN0YXRlKHRoaXMuc3RhdGVEYXRhKSx0aGlzLnNsb3RDb250YWluZXJzPVtdO2Zvcih2YXIgYz0wLGQ9dGhpcy5za2VsZXRvbi5kcmF3T3JkZXIubGVuZ3RoO2Q+YztjKyspe3ZhciBlPXRoaXMuc2tlbGV0b24uZHJhd09yZGVyW2NdLGc9ZS5hdHRhY2htZW50LGg9bmV3IGIuRGlzcGxheU9iamVjdENvbnRhaW5lcjtpZih0aGlzLnNsb3RDb250YWluZXJzLnB1c2goaCksdGhpcy5hZGRDaGlsZChoKSxnIGluc3RhbmNlb2YgZi5SZWdpb25BdHRhY2htZW50KXt2YXIgaT1nLnJlbmRlcmVyT2JqZWN0Lm5hbWUsaj10aGlzLmNyZWF0ZVNwcml0ZShlLGcucmVuZGVyZXJPYmplY3QpO2UuY3VycmVudFNwcml0ZT1qLGUuY3VycmVudFNwcml0ZU5hbWU9aSxoLmFkZENoaWxkKGopfX19LGIuU3BpbmUucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoYi5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSksYi5TcGluZS5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5TcGluZSxiLlNwaW5lLnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm09ZnVuY3Rpb24oKXt0aGlzLmxhc3RUaW1lPXRoaXMubGFzdFRpbWV8fERhdGUubm93KCk7dmFyIGE9LjAwMSooRGF0ZS5ub3coKS10aGlzLmxhc3RUaW1lKTt0aGlzLmxhc3RUaW1lPURhdGUubm93KCksdGhpcy5zdGF0ZS51cGRhdGUoYSksdGhpcy5zdGF0ZS5hcHBseSh0aGlzLnNrZWxldG9uKSx0aGlzLnNrZWxldG9uLnVwZGF0ZVdvcmxkVHJhbnNmb3JtKCk7Zm9yKHZhciBjPXRoaXMuc2tlbGV0b24uZHJhd09yZGVyLGQ9MCxlPWMubGVuZ3RoO2U+ZDtkKyspe3ZhciBnPWNbZF0saD1nLmF0dGFjaG1lbnQsaT10aGlzLnNsb3RDb250YWluZXJzW2RdO2lmKGggaW5zdGFuY2VvZiBmLlJlZ2lvbkF0dGFjaG1lbnQpe2lmKGgucmVuZGVyZXJPYmplY3QmJighZy5jdXJyZW50U3ByaXRlTmFtZXx8Zy5jdXJyZW50U3ByaXRlTmFtZSE9aC5uYW1lKSl7dmFyIGo9aC5yZW5kZXJlck9iamVjdC5uYW1lO2lmKHZvaWQgMCE9PWcuY3VycmVudFNwcml0ZSYmKGcuY3VycmVudFNwcml0ZS52aXNpYmxlPSExKSxnLnNwcml0ZXM9Zy5zcHJpdGVzfHx7fSx2b2lkIDAhPT1nLnNwcml0ZXNbal0pZy5zcHJpdGVzW2pdLnZpc2libGU9ITA7ZWxzZXt2YXIgaz10aGlzLmNyZWF0ZVNwcml0ZShnLGgucmVuZGVyZXJPYmplY3QpO2kuYWRkQ2hpbGQoayl9Zy5jdXJyZW50U3ByaXRlPWcuc3ByaXRlc1tqXSxnLmN1cnJlbnRTcHJpdGVOYW1lPWp9aS52aXNpYmxlPSEwO3ZhciBsPWcuYm9uZTtpLnBvc2l0aW9uLng9bC53b3JsZFgraC54KmwubTAwK2gueSpsLm0wMSxpLnBvc2l0aW9uLnk9bC53b3JsZFkraC54KmwubTEwK2gueSpsLm0xMSxpLnNjYWxlLng9bC53b3JsZFNjYWxlWCxpLnNjYWxlLnk9bC53b3JsZFNjYWxlWSxpLnJvdGF0aW9uPS0oZy5ib25lLndvcmxkUm90YXRpb24qTWF0aC5QSS8xODApLGkuYWxwaGE9Zy5hLGcuY3VycmVudFNwcml0ZS50aW50PWIucmdiMmhleChbZy5yLGcuZyxnLmJdKX1lbHNlIGkudmlzaWJsZT0hMX1iLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLnVwZGF0ZVRyYW5zZm9ybS5jYWxsKHRoaXMpfSxiLlNwaW5lLnByb3RvdHlwZS5jcmVhdGVTcHJpdGU9ZnVuY3Rpb24oYSxjKXt2YXIgZD1iLlRleHR1cmVDYWNoZVtjLm5hbWVdP2MubmFtZTpjLm5hbWUrXCIucG5nXCIsZT1uZXcgYi5TcHJpdGUoYi5UZXh0dXJlLmZyb21GcmFtZShkKSk7cmV0dXJuIGUuc2NhbGU9Yy5zY2FsZSxlLnJvdGF0aW9uPWMucm90YXRpb24sZS5hbmNob3IueD1lLmFuY2hvci55PS41LGEuc3ByaXRlcz1hLnNwcml0ZXN8fHt9LGEuc3ByaXRlc1tjLm5hbWVdPWUsZX0sYi5CYXNlVGV4dHVyZUNhY2hlPXt9LGIudGV4dHVyZXNUb1VwZGF0ZT1bXSxiLnRleHR1cmVzVG9EZXN0cm95PVtdLGIuQmFzZVRleHR1cmVDYWNoZUlkR2VuZXJhdG9yPTAsYi5CYXNlVGV4dHVyZT1mdW5jdGlvbihhLGMpe2lmKGIuRXZlbnRUYXJnZXQuY2FsbCh0aGlzKSx0aGlzLndpZHRoPTEwMCx0aGlzLmhlaWdodD0xMDAsdGhpcy5zY2FsZU1vZGU9Y3x8Yi5zY2FsZU1vZGVzLkRFRkFVTFQsdGhpcy5oYXNMb2FkZWQ9ITEsdGhpcy5zb3VyY2U9YSx0aGlzLmlkPWIuQmFzZVRleHR1cmVDYWNoZUlkR2VuZXJhdG9yKyssdGhpcy5wcmVtdWx0aXBsaWVkQWxwaGE9ITAsdGhpcy5fZ2xUZXh0dXJlcz1bXSx0aGlzLl9kaXJ0eT1bXSxhKXtpZigodGhpcy5zb3VyY2UuY29tcGxldGV8fHRoaXMuc291cmNlLmdldENvbnRleHQpJiZ0aGlzLnNvdXJjZS53aWR0aCYmdGhpcy5zb3VyY2UuaGVpZ2h0KXRoaXMuaGFzTG9hZGVkPSEwLHRoaXMud2lkdGg9dGhpcy5zb3VyY2Uud2lkdGgsdGhpcy5oZWlnaHQ9dGhpcy5zb3VyY2UuaGVpZ2h0LGIudGV4dHVyZXNUb1VwZGF0ZS5wdXNoKHRoaXMpO2Vsc2V7dmFyIGQ9dGhpczt0aGlzLnNvdXJjZS5vbmxvYWQ9ZnVuY3Rpb24oKXtkLmhhc0xvYWRlZD0hMCxkLndpZHRoPWQuc291cmNlLndpZHRoLGQuaGVpZ2h0PWQuc291cmNlLmhlaWdodDtmb3IodmFyIGE9MDthPGQuX2dsVGV4dHVyZXMubGVuZ3RoO2ErKylkLl9kaXJ0eVthXT0hMDtkLmRpc3BhdGNoRXZlbnQoe3R5cGU6XCJsb2FkZWRcIixjb250ZW50OmR9KX0sdGhpcy5zb3VyY2Uub25lcnJvcj1mdW5jdGlvbigpe2QuZGlzcGF0Y2hFdmVudCh7dHlwZTpcImVycm9yXCIsY29udGVudDpkfSl9fXRoaXMuaW1hZ2VVcmw9bnVsbCx0aGlzLl9wb3dlck9mMj0hMX19LGIuQmFzZVRleHR1cmUucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuQmFzZVRleHR1cmUsYi5CYXNlVGV4dHVyZS5wcm90b3R5cGUuZGVzdHJveT1mdW5jdGlvbigpe3RoaXMuaW1hZ2VVcmw/KGRlbGV0ZSBiLkJhc2VUZXh0dXJlQ2FjaGVbdGhpcy5pbWFnZVVybF0sZGVsZXRlIGIuVGV4dHVyZUNhY2hlW3RoaXMuaW1hZ2VVcmxdLHRoaXMuaW1hZ2VVcmw9bnVsbCx0aGlzLnNvdXJjZS5zcmM9bnVsbCk6dGhpcy5zb3VyY2UmJnRoaXMuc291cmNlLl9waXhpSWQmJmRlbGV0ZSBiLkJhc2VUZXh0dXJlQ2FjaGVbdGhpcy5zb3VyY2UuX3BpeGlJZF0sdGhpcy5zb3VyY2U9bnVsbCxiLnRleHR1cmVzVG9EZXN0cm95LnB1c2godGhpcyl9LGIuQmFzZVRleHR1cmUucHJvdG90eXBlLnVwZGF0ZVNvdXJjZUltYWdlPWZ1bmN0aW9uKGEpe3RoaXMuaGFzTG9hZGVkPSExLHRoaXMuc291cmNlLnNyYz1udWxsLHRoaXMuc291cmNlLnNyYz1hfSxiLkJhc2VUZXh0dXJlLmZyb21JbWFnZT1mdW5jdGlvbihhLGMsZCl7dmFyIGU9Yi5CYXNlVGV4dHVyZUNhY2hlW2FdO2lmKHZvaWQgMD09PWMmJi0xPT09YS5pbmRleE9mKFwiZGF0YTpcIikmJihjPSEwKSwhZSl7dmFyIGY9bmV3IEltYWdlO2MmJihmLmNyb3NzT3JpZ2luPVwiXCIpLGYuc3JjPWEsZT1uZXcgYi5CYXNlVGV4dHVyZShmLGQpLGUuaW1hZ2VVcmw9YSxiLkJhc2VUZXh0dXJlQ2FjaGVbYV09ZX1yZXR1cm4gZX0sYi5CYXNlVGV4dHVyZS5mcm9tQ2FudmFzPWZ1bmN0aW9uKGEsYyl7YS5fcGl4aUlkfHwoYS5fcGl4aUlkPVwiY2FudmFzX1wiK2IuVGV4dHVyZUNhY2hlSWRHZW5lcmF0b3IrKyk7dmFyIGQ9Yi5CYXNlVGV4dHVyZUNhY2hlW2EuX3BpeGlJZF07cmV0dXJuIGR8fChkPW5ldyBiLkJhc2VUZXh0dXJlKGEsYyksYi5CYXNlVGV4dHVyZUNhY2hlW2EuX3BpeGlJZF09ZCksZH0sYi5UZXh0dXJlQ2FjaGU9e30sYi5GcmFtZUNhY2hlPXt9LGIuVGV4dHVyZUNhY2hlSWRHZW5lcmF0b3I9MCxiLlRleHR1cmU9ZnVuY3Rpb24oYSxjKXtpZihiLkV2ZW50VGFyZ2V0LmNhbGwodGhpcyksdGhpcy5ub0ZyYW1lPSExLGN8fCh0aGlzLm5vRnJhbWU9ITAsYz1uZXcgYi5SZWN0YW5nbGUoMCwwLDEsMSkpLGEgaW5zdGFuY2VvZiBiLlRleHR1cmUmJihhPWEuYmFzZVRleHR1cmUpLHRoaXMuYmFzZVRleHR1cmU9YSx0aGlzLmZyYW1lPWMsdGhpcy50cmltPW51bGwsdGhpcy52YWxpZD0hMSx0aGlzLnNjb3BlPXRoaXMsdGhpcy5fdXZzPW51bGwsdGhpcy53aWR0aD0wLHRoaXMuaGVpZ2h0PTAsdGhpcy5jcm9wPW5ldyBiLlJlY3RhbmdsZSgwLDAsMSwxKSxhLmhhc0xvYWRlZCl0aGlzLm5vRnJhbWUmJihjPW5ldyBiLlJlY3RhbmdsZSgwLDAsYS53aWR0aCxhLmhlaWdodCkpLHRoaXMuc2V0RnJhbWUoYyk7ZWxzZXt2YXIgZD10aGlzO2EuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRlZFwiLGZ1bmN0aW9uKCl7ZC5vbkJhc2VUZXh0dXJlTG9hZGVkKCl9KX19LGIuVGV4dHVyZS5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5UZXh0dXJlLGIuVGV4dHVyZS5wcm90b3R5cGUub25CYXNlVGV4dHVyZUxvYWRlZD1mdW5jdGlvbigpe3ZhciBhPXRoaXMuYmFzZVRleHR1cmU7YS5yZW1vdmVFdmVudExpc3RlbmVyKFwibG9hZGVkXCIsdGhpcy5vbkxvYWRlZCksdGhpcy5ub0ZyYW1lJiYodGhpcy5mcmFtZT1uZXcgYi5SZWN0YW5nbGUoMCwwLGEud2lkdGgsYS5oZWlnaHQpKSx0aGlzLnNldEZyYW1lKHRoaXMuZnJhbWUpLHRoaXMuc2NvcGUuZGlzcGF0Y2hFdmVudCh7dHlwZTpcInVwZGF0ZVwiLGNvbnRlbnQ6dGhpc30pfSxiLlRleHR1cmUucHJvdG90eXBlLmRlc3Ryb3k9ZnVuY3Rpb24oYSl7YSYmdGhpcy5iYXNlVGV4dHVyZS5kZXN0cm95KCksdGhpcy52YWxpZD0hMX0sYi5UZXh0dXJlLnByb3RvdHlwZS5zZXRGcmFtZT1mdW5jdGlvbihhKXtpZih0aGlzLm5vRnJhbWU9ITEsdGhpcy5mcmFtZT1hLHRoaXMud2lkdGg9YS53aWR0aCx0aGlzLmhlaWdodD1hLmhlaWdodCx0aGlzLmNyb3AueD1hLngsdGhpcy5jcm9wLnk9YS55LHRoaXMuY3JvcC53aWR0aD1hLndpZHRoLHRoaXMuY3JvcC5oZWlnaHQ9YS5oZWlnaHQsIXRoaXMudHJpbSYmKGEueCthLndpZHRoPnRoaXMuYmFzZVRleHR1cmUud2lkdGh8fGEueSthLmhlaWdodD50aGlzLmJhc2VUZXh0dXJlLmhlaWdodCkpdGhyb3cgbmV3IEVycm9yKFwiVGV4dHVyZSBFcnJvcjogZnJhbWUgZG9lcyBub3QgZml0IGluc2lkZSB0aGUgYmFzZSBUZXh0dXJlIGRpbWVuc2lvbnMgXCIrdGhpcyk7dGhpcy52YWxpZD1hJiZhLndpZHRoJiZhLmhlaWdodCYmdGhpcy5iYXNlVGV4dHVyZS5zb3VyY2UmJnRoaXMuYmFzZVRleHR1cmUuaGFzTG9hZGVkLHRoaXMudHJpbSYmKHRoaXMud2lkdGg9dGhpcy50cmltLndpZHRoLHRoaXMuaGVpZ2h0PXRoaXMudHJpbS5oZWlnaHQsdGhpcy5mcmFtZS53aWR0aD10aGlzLnRyaW0ud2lkdGgsdGhpcy5mcmFtZS5oZWlnaHQ9dGhpcy50cmltLmhlaWdodCksdGhpcy52YWxpZCYmYi5UZXh0dXJlLmZyYW1lVXBkYXRlcy5wdXNoKHRoaXMpfSxiLlRleHR1cmUucHJvdG90eXBlLl91cGRhdGVXZWJHTHV2cz1mdW5jdGlvbigpe3RoaXMuX3V2c3x8KHRoaXMuX3V2cz1uZXcgYi5UZXh0dXJlVXZzKTt2YXIgYT10aGlzLmNyb3AsYz10aGlzLmJhc2VUZXh0dXJlLndpZHRoLGQ9dGhpcy5iYXNlVGV4dHVyZS5oZWlnaHQ7dGhpcy5fdXZzLngwPWEueC9jLHRoaXMuX3V2cy55MD1hLnkvZCx0aGlzLl91dnMueDE9KGEueCthLndpZHRoKS9jLHRoaXMuX3V2cy55MT1hLnkvZCx0aGlzLl91dnMueDI9KGEueCthLndpZHRoKS9jLHRoaXMuX3V2cy55Mj0oYS55K2EuaGVpZ2h0KS9kLHRoaXMuX3V2cy54Mz1hLngvYyx0aGlzLl91dnMueTM9KGEueSthLmhlaWdodCkvZH0sYi5UZXh0dXJlLmZyb21JbWFnZT1mdW5jdGlvbihhLGMsZCl7dmFyIGU9Yi5UZXh0dXJlQ2FjaGVbYV07cmV0dXJuIGV8fChlPW5ldyBiLlRleHR1cmUoYi5CYXNlVGV4dHVyZS5mcm9tSW1hZ2UoYSxjLGQpKSxiLlRleHR1cmVDYWNoZVthXT1lKSxlfSxiLlRleHR1cmUuZnJvbUZyYW1lPWZ1bmN0aW9uKGEpe3ZhciBjPWIuVGV4dHVyZUNhY2hlW2FdO2lmKCFjKXRocm93IG5ldyBFcnJvcignVGhlIGZyYW1lSWQgXCInK2ErJ1wiIGRvZXMgbm90IGV4aXN0IGluIHRoZSB0ZXh0dXJlIGNhY2hlICcpO3JldHVybiBjfSxiLlRleHR1cmUuZnJvbUNhbnZhcz1mdW5jdGlvbihhLGMpe3ZhciBkPWIuQmFzZVRleHR1cmUuZnJvbUNhbnZhcyhhLGMpO3JldHVybiBuZXcgYi5UZXh0dXJlKGQpfSxiLlRleHR1cmUuYWRkVGV4dHVyZVRvQ2FjaGU9ZnVuY3Rpb24oYSxjKXtiLlRleHR1cmVDYWNoZVtjXT1hfSxiLlRleHR1cmUucmVtb3ZlVGV4dHVyZUZyb21DYWNoZT1mdW5jdGlvbihhKXt2YXIgYz1iLlRleHR1cmVDYWNoZVthXTtyZXR1cm4gZGVsZXRlIGIuVGV4dHVyZUNhY2hlW2FdLGRlbGV0ZSBiLkJhc2VUZXh0dXJlQ2FjaGVbYV0sY30sYi5UZXh0dXJlLmZyYW1lVXBkYXRlcz1bXSxiLlRleHR1cmVVdnM9ZnVuY3Rpb24oKXt0aGlzLngwPTAsdGhpcy55MD0wLHRoaXMueDE9MCx0aGlzLnkxPTAsdGhpcy54Mj0wLHRoaXMueTI9MCx0aGlzLngzPTAsdGhpcy55Mz0wfSxiLlJlbmRlclRleHR1cmU9ZnVuY3Rpb24oYSxjLGQsZSl7aWYoYi5FdmVudFRhcmdldC5jYWxsKHRoaXMpLHRoaXMud2lkdGg9YXx8MTAwLHRoaXMuaGVpZ2h0PWN8fDEwMCx0aGlzLmZyYW1lPW5ldyBiLlJlY3RhbmdsZSgwLDAsdGhpcy53aWR0aCx0aGlzLmhlaWdodCksdGhpcy5jcm9wPW5ldyBiLlJlY3RhbmdsZSgwLDAsdGhpcy53aWR0aCx0aGlzLmhlaWdodCksdGhpcy5iYXNlVGV4dHVyZT1uZXcgYi5CYXNlVGV4dHVyZSx0aGlzLmJhc2VUZXh0dXJlLndpZHRoPXRoaXMud2lkdGgsdGhpcy5iYXNlVGV4dHVyZS5oZWlnaHQ9dGhpcy5oZWlnaHQsdGhpcy5iYXNlVGV4dHVyZS5fZ2xUZXh0dXJlcz1bXSx0aGlzLmJhc2VUZXh0dXJlLnNjYWxlTW9kZT1lfHxiLnNjYWxlTW9kZXMuREVGQVVMVCx0aGlzLmJhc2VUZXh0dXJlLmhhc0xvYWRlZD0hMCx0aGlzLnJlbmRlcmVyPWR8fGIuZGVmYXVsdFJlbmRlcmVyLHRoaXMucmVuZGVyZXIudHlwZT09PWIuV0VCR0xfUkVOREVSRVIpe3ZhciBmPXRoaXMucmVuZGVyZXIuZ2w7dGhpcy50ZXh0dXJlQnVmZmVyPW5ldyBiLkZpbHRlclRleHR1cmUoZix0aGlzLndpZHRoLHRoaXMuaGVpZ2h0LHRoaXMuYmFzZVRleHR1cmUuc2NhbGVNb2RlKSx0aGlzLmJhc2VUZXh0dXJlLl9nbFRleHR1cmVzW2YuaWRdPXRoaXMudGV4dHVyZUJ1ZmZlci50ZXh0dXJlLHRoaXMucmVuZGVyPXRoaXMucmVuZGVyV2ViR0wsdGhpcy5wcm9qZWN0aW9uPW5ldyBiLlBvaW50KHRoaXMud2lkdGgvMiwtdGhpcy5oZWlnaHQvMil9ZWxzZSB0aGlzLnJlbmRlcj10aGlzLnJlbmRlckNhbnZhcyx0aGlzLnRleHR1cmVCdWZmZXI9bmV3IGIuQ2FudmFzQnVmZmVyKHRoaXMud2lkdGgsdGhpcy5oZWlnaHQpLHRoaXMuYmFzZVRleHR1cmUuc291cmNlPXRoaXMudGV4dHVyZUJ1ZmZlci5jYW52YXM7dGhpcy52YWxpZD0hMCxiLlRleHR1cmUuZnJhbWVVcGRhdGVzLnB1c2godGhpcyl9LGIuUmVuZGVyVGV4dHVyZS5wcm90b3R5cGU9T2JqZWN0LmNyZWF0ZShiLlRleHR1cmUucHJvdG90eXBlKSxiLlJlbmRlclRleHR1cmUucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuUmVuZGVyVGV4dHVyZSxiLlJlbmRlclRleHR1cmUucHJvdG90eXBlLnJlc2l6ZT1mdW5jdGlvbihhLGMsZCl7KGEhPT10aGlzLndpZHRofHxjIT09dGhpcy5oZWlnaHQpJiYodGhpcy53aWR0aD10aGlzLmZyYW1lLndpZHRoPXRoaXMuY3JvcC53aWR0aD1hLHRoaXMuaGVpZ2h0PXRoaXMuZnJhbWUuaGVpZ2h0PXRoaXMuY3JvcC5oZWlnaHQ9YyxkJiYodGhpcy5iYXNlVGV4dHVyZS53aWR0aD10aGlzLndpZHRoLHRoaXMuYmFzZVRleHR1cmUuaGVpZ2h0PXRoaXMuaGVpZ2h0KSx0aGlzLnJlbmRlcmVyLnR5cGU9PT1iLldFQkdMX1JFTkRFUkVSJiYodGhpcy5wcm9qZWN0aW9uLng9dGhpcy53aWR0aC8yLHRoaXMucHJvamVjdGlvbi55PS10aGlzLmhlaWdodC8yKSx0aGlzLnRleHR1cmVCdWZmZXIucmVzaXplKHRoaXMud2lkdGgsdGhpcy5oZWlnaHQpKX0sYi5SZW5kZXJUZXh0dXJlLnByb3RvdHlwZS5jbGVhcj1mdW5jdGlvbigpe3RoaXMucmVuZGVyZXIudHlwZT09PWIuV0VCR0xfUkVOREVSRVImJnRoaXMucmVuZGVyZXIuZ2wuYmluZEZyYW1lYnVmZmVyKHRoaXMucmVuZGVyZXIuZ2wuRlJBTUVCVUZGRVIsdGhpcy50ZXh0dXJlQnVmZmVyLmZyYW1lQnVmZmVyKSx0aGlzLnRleHR1cmVCdWZmZXIuY2xlYXIoKX0sYi5SZW5kZXJUZXh0dXJlLnByb3RvdHlwZS5yZW5kZXJXZWJHTD1mdW5jdGlvbihhLGMsZCl7dmFyIGU9dGhpcy5yZW5kZXJlci5nbDtlLmNvbG9yTWFzayghMCwhMCwhMCwhMCksZS52aWV3cG9ydCgwLDAsdGhpcy53aWR0aCx0aGlzLmhlaWdodCksZS5iaW5kRnJhbWVidWZmZXIoZS5GUkFNRUJVRkZFUix0aGlzLnRleHR1cmVCdWZmZXIuZnJhbWVCdWZmZXIpLGQmJnRoaXMudGV4dHVyZUJ1ZmZlci5jbGVhcigpO3ZhciBmPWEuY2hpbGRyZW4sZz1hLndvcmxkVHJhbnNmb3JtO2Eud29ybGRUcmFuc2Zvcm09Yi5SZW5kZXJUZXh0dXJlLnRlbXBNYXRyaXgsYS53b3JsZFRyYW5zZm9ybS5kPS0xLGEud29ybGRUcmFuc2Zvcm0udHk9LTIqdGhpcy5wcm9qZWN0aW9uLnksYyYmKGEud29ybGRUcmFuc2Zvcm0udHg9Yy54LGEud29ybGRUcmFuc2Zvcm0udHktPWMueSk7Zm9yKHZhciBoPTAsaT1mLmxlbmd0aDtpPmg7aCsrKWZbaF0udXBkYXRlVHJhbnNmb3JtKCk7Yi5XZWJHTFJlbmRlcmVyLnVwZGF0ZVRleHR1cmVzKCksdGhpcy5yZW5kZXJlci5zcHJpdGVCYXRjaC5kaXJ0eT0hMCx0aGlzLnJlbmRlcmVyLnJlbmRlckRpc3BsYXlPYmplY3QoYSx0aGlzLnByb2plY3Rpb24sdGhpcy50ZXh0dXJlQnVmZmVyLmZyYW1lQnVmZmVyKSxhLndvcmxkVHJhbnNmb3JtPWcsdGhpcy5yZW5kZXJlci5zcHJpdGVCYXRjaC5kaXJ0eT0hMH0sYi5SZW5kZXJUZXh0dXJlLnByb3RvdHlwZS5yZW5kZXJDYW52YXM9ZnVuY3Rpb24oYSxjLGQpe3ZhciBlPWEuY2hpbGRyZW4sZj1hLndvcmxkVHJhbnNmb3JtO2Eud29ybGRUcmFuc2Zvcm09Yi5SZW5kZXJUZXh0dXJlLnRlbXBNYXRyaXgsYz8oYS53b3JsZFRyYW5zZm9ybS50eD1jLngsYS53b3JsZFRyYW5zZm9ybS50eT1jLnkpOihhLndvcmxkVHJhbnNmb3JtLnR4PTAsYS53b3JsZFRyYW5zZm9ybS50eT0wKTtmb3IodmFyIGc9MCxoPWUubGVuZ3RoO2g+ZztnKyspZVtnXS51cGRhdGVUcmFuc2Zvcm0oKTtkJiZ0aGlzLnRleHR1cmVCdWZmZXIuY2xlYXIoKTt2YXIgaT10aGlzLnRleHR1cmVCdWZmZXIuY29udGV4dDt0aGlzLnJlbmRlcmVyLnJlbmRlckRpc3BsYXlPYmplY3QoYSxpKSxpLnNldFRyYW5zZm9ybSgxLDAsMCwxLDAsMCksYS53b3JsZFRyYW5zZm9ybT1mfSxiLlJlbmRlclRleHR1cmUudGVtcE1hdHJpeD1uZXcgYi5NYXRyaXgsYi5Bc3NldExvYWRlcj1mdW5jdGlvbihhLGMpe2IuRXZlbnRUYXJnZXQuY2FsbCh0aGlzKSx0aGlzLmFzc2V0VVJMcz1hLHRoaXMuY3Jvc3NvcmlnaW49Yyx0aGlzLmxvYWRlcnNCeVR5cGU9e2pwZzpiLkltYWdlTG9hZGVyLGpwZWc6Yi5JbWFnZUxvYWRlcixwbmc6Yi5JbWFnZUxvYWRlcixnaWY6Yi5JbWFnZUxvYWRlcix3ZWJwOmIuSW1hZ2VMb2FkZXIsanNvbjpiLkpzb25Mb2FkZXIsYXRsYXM6Yi5BdGxhc0xvYWRlcixhbmltOmIuU3BpbmVMb2FkZXIseG1sOmIuQml0bWFwRm9udExvYWRlcixmbnQ6Yi5CaXRtYXBGb250TG9hZGVyfX0sYi5Bc3NldExvYWRlci5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5Bc3NldExvYWRlcixiLkFzc2V0TG9hZGVyLnByb3RvdHlwZS5fZ2V0RGF0YVR5cGU9ZnVuY3Rpb24oYSl7dmFyIGI9XCJkYXRhOlwiLGM9YS5zbGljZSgwLGIubGVuZ3RoKS50b0xvd2VyQ2FzZSgpO2lmKGM9PT1iKXt2YXIgZD1hLnNsaWNlKGIubGVuZ3RoKSxlPWQuaW5kZXhPZihcIixcIik7aWYoLTE9PT1lKXJldHVybiBudWxsO3ZhciBmPWQuc2xpY2UoMCxlKS5zcGxpdChcIjtcIilbMF07cmV0dXJuIGYmJlwidGV4dC9wbGFpblwiIT09Zi50b0xvd2VyQ2FzZSgpP2Yuc3BsaXQoXCIvXCIpLnBvcCgpLnRvTG93ZXJDYXNlKCk6XCJ0eHRcIn1yZXR1cm4gbnVsbH0sYi5Bc3NldExvYWRlci5wcm90b3R5cGUubG9hZD1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoYSl7Yi5vbkFzc2V0TG9hZGVkKGEuY29udGVudCl9dmFyIGI9dGhpczt0aGlzLmxvYWRDb3VudD10aGlzLmFzc2V0VVJMcy5sZW5ndGg7Zm9yKHZhciBjPTA7Yzx0aGlzLmFzc2V0VVJMcy5sZW5ndGg7YysrKXt2YXIgZD10aGlzLmFzc2V0VVJMc1tjXSxlPXRoaXMuX2dldERhdGFUeXBlKGQpO2V8fChlPWQuc3BsaXQoXCI/XCIpLnNoaWZ0KCkuc3BsaXQoXCIuXCIpLnBvcCgpLnRvTG93ZXJDYXNlKCkpO3ZhciBmPXRoaXMubG9hZGVyc0J5VHlwZVtlXTtpZighZil0aHJvdyBuZXcgRXJyb3IoZStcIiBpcyBhbiB1bnN1cHBvcnRlZCBmaWxlIHR5cGVcIik7dmFyIGc9bmV3IGYoZCx0aGlzLmNyb3Nzb3JpZ2luKTtnLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkZWRcIixhKSxnLmxvYWQoKX19LGIuQXNzZXRMb2FkZXIucHJvdG90eXBlLm9uQXNzZXRMb2FkZWQ9ZnVuY3Rpb24oYSl7dGhpcy5sb2FkQ291bnQtLSx0aGlzLmRpc3BhdGNoRXZlbnQoe3R5cGU6XCJvblByb2dyZXNzXCIsY29udGVudDp0aGlzLGxvYWRlcjphfSksdGhpcy5vblByb2dyZXNzJiZ0aGlzLm9uUHJvZ3Jlc3MoYSksdGhpcy5sb2FkQ291bnR8fCh0aGlzLmRpc3BhdGNoRXZlbnQoe3R5cGU6XCJvbkNvbXBsZXRlXCIsY29udGVudDp0aGlzfSksdGhpcy5vbkNvbXBsZXRlJiZ0aGlzLm9uQ29tcGxldGUoKSl9LGIuSnNvbkxvYWRlcj1mdW5jdGlvbihhLGMpe2IuRXZlbnRUYXJnZXQuY2FsbCh0aGlzKSx0aGlzLnVybD1hLHRoaXMuY3Jvc3NvcmlnaW49Yyx0aGlzLmJhc2VVcmw9YS5yZXBsYWNlKC9bXlxcL10qJC8sXCJcIiksdGhpcy5sb2FkZWQ9ITF9LGIuSnNvbkxvYWRlci5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5Kc29uTG9hZGVyLGIuSnNvbkxvYWRlci5wcm90b3R5cGUubG9hZD1mdW5jdGlvbigpe3ZhciBhPXRoaXM7d2luZG93LlhEb21haW5SZXF1ZXN0JiZhLmNyb3Nzb3JpZ2luPyh0aGlzLmFqYXhSZXF1ZXN0PW5ldyB3aW5kb3cuWERvbWFpblJlcXVlc3QsdGhpcy5hamF4UmVxdWVzdC50aW1lb3V0PTNlMyx0aGlzLmFqYXhSZXF1ZXN0Lm9uZXJyb3I9ZnVuY3Rpb24oKXthLm9uRXJyb3IoKX0sdGhpcy5hamF4UmVxdWVzdC5vbnRpbWVvdXQ9ZnVuY3Rpb24oKXthLm9uRXJyb3IoKX0sdGhpcy5hamF4UmVxdWVzdC5vbnByb2dyZXNzPWZ1bmN0aW9uKCl7fSk6dGhpcy5hamF4UmVxdWVzdD13aW5kb3cuWE1MSHR0cFJlcXVlc3Q/bmV3IHdpbmRvdy5YTUxIdHRwUmVxdWVzdDpuZXcgd2luZG93LkFjdGl2ZVhPYmplY3QoXCJNaWNyb3NvZnQuWE1MSFRUUFwiKSx0aGlzLmFqYXhSZXF1ZXN0Lm9ubG9hZD1mdW5jdGlvbigpe2Eub25KU09OTG9hZGVkKCl9LHRoaXMuYWpheFJlcXVlc3Qub3BlbihcIkdFVFwiLHRoaXMudXJsLCEwKSx0aGlzLmFqYXhSZXF1ZXN0LnNlbmQoKX0sYi5Kc29uTG9hZGVyLnByb3RvdHlwZS5vbkpTT05Mb2FkZWQ9ZnVuY3Rpb24oKXtpZighdGhpcy5hamF4UmVxdWVzdC5yZXNwb25zZVRleHQpcmV0dXJuIHRoaXMub25FcnJvcigpLHZvaWQgMDtpZih0aGlzLmpzb249SlNPTi5wYXJzZSh0aGlzLmFqYXhSZXF1ZXN0LnJlc3BvbnNlVGV4dCksdGhpcy5qc29uLmZyYW1lcyl7dmFyIGE9dGhpcyxjPXRoaXMuYmFzZVVybCt0aGlzLmpzb24ubWV0YS5pbWFnZSxkPW5ldyBiLkltYWdlTG9hZGVyKGMsdGhpcy5jcm9zc29yaWdpbiksZT10aGlzLmpzb24uZnJhbWVzO3RoaXMudGV4dHVyZT1kLnRleHR1cmUuYmFzZVRleHR1cmUsZC5hZGRFdmVudExpc3RlbmVyKFwibG9hZGVkXCIsZnVuY3Rpb24oKXthLm9uTG9hZGVkKCl9KTtmb3IodmFyIGcgaW4gZSl7dmFyIGg9ZVtnXS5mcmFtZTtpZihoJiYoYi5UZXh0dXJlQ2FjaGVbZ109bmV3IGIuVGV4dHVyZSh0aGlzLnRleHR1cmUse3g6aC54LHk6aC55LHdpZHRoOmgudyxoZWlnaHQ6aC5ofSksYi5UZXh0dXJlQ2FjaGVbZ10uY3JvcD1uZXcgYi5SZWN0YW5nbGUoaC54LGgueSxoLncsaC5oKSxlW2ddLnRyaW1tZWQpKXt2YXIgaT1lW2ddLnNvdXJjZVNpemUsaj1lW2ddLnNwcml0ZVNvdXJjZVNpemU7Yi5UZXh0dXJlQ2FjaGVbZ10udHJpbT1uZXcgYi5SZWN0YW5nbGUoai54LGoueSxpLncsaS5oKX19ZC5sb2FkKCl9ZWxzZSBpZih0aGlzLmpzb24uYm9uZXMpe3ZhciBrPW5ldyBmLlNrZWxldG9uSnNvbixsPWsucmVhZFNrZWxldG9uRGF0YSh0aGlzLmpzb24pO2IuQW5pbUNhY2hlW3RoaXMudXJsXT1sLHRoaXMub25Mb2FkZWQoKX1lbHNlIHRoaXMub25Mb2FkZWQoKX0sYi5Kc29uTG9hZGVyLnByb3RvdHlwZS5vbkxvYWRlZD1mdW5jdGlvbigpe3RoaXMubG9hZGVkPSEwLHRoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTpcImxvYWRlZFwiLGNvbnRlbnQ6dGhpc30pfSxiLkpzb25Mb2FkZXIucHJvdG90eXBlLm9uRXJyb3I9ZnVuY3Rpb24oKXt0aGlzLmRpc3BhdGNoRXZlbnQoe3R5cGU6XCJlcnJvclwiLGNvbnRlbnQ6dGhpc30pfSxiLkF0bGFzTG9hZGVyPWZ1bmN0aW9uKGEsYyl7Yi5FdmVudFRhcmdldC5jYWxsKHRoaXMpLHRoaXMudXJsPWEsdGhpcy5iYXNlVXJsPWEucmVwbGFjZSgvW15cXC9dKiQvLFwiXCIpLHRoaXMuY3Jvc3NvcmlnaW49Yyx0aGlzLmxvYWRlZD0hMX0sYi5BdGxhc0xvYWRlci5jb25zdHJ1Y3Rvcj1iLkF0bGFzTG9hZGVyLGIuQXRsYXNMb2FkZXIucHJvdG90eXBlLmxvYWQ9ZnVuY3Rpb24oKXt0aGlzLmFqYXhSZXF1ZXN0PW5ldyBiLkFqYXhSZXF1ZXN0LHRoaXMuYWpheFJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlPXRoaXMub25BdGxhc0xvYWRlZC5iaW5kKHRoaXMpLHRoaXMuYWpheFJlcXVlc3Qub3BlbihcIkdFVFwiLHRoaXMudXJsLCEwKSx0aGlzLmFqYXhSZXF1ZXN0Lm92ZXJyaWRlTWltZVR5cGUmJnRoaXMuYWpheFJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZShcImFwcGxpY2F0aW9uL2pzb25cIiksdGhpcy5hamF4UmVxdWVzdC5zZW5kKG51bGwpfSxiLkF0bGFzTG9hZGVyLnByb3RvdHlwZS5vbkF0bGFzTG9hZGVkPWZ1bmN0aW9uKCl7aWYoND09PXRoaXMuYWpheFJlcXVlc3QucmVhZHlTdGF0ZSlpZigyMDA9PT10aGlzLmFqYXhSZXF1ZXN0LnN0YXR1c3x8LTE9PT13aW5kb3cubG9jYXRpb24uaHJlZi5pbmRleE9mKFwiaHR0cFwiKSl7dGhpcy5hdGxhcz17bWV0YTp7aW1hZ2U6W119LGZyYW1lczpbXX07dmFyIGE9dGhpcy5hamF4UmVxdWVzdC5yZXNwb25zZVRleHQuc3BsaXQoL1xccj9cXG4vKSxjPS0zLGQ9MCxlPW51bGwsZj0hMSxnPTAsaD0wLGk9dGhpcy5vbkxvYWRlZC5iaW5kKHRoaXMpO2ZvcihnPTA7ZzxhLmxlbmd0aDtnKyspaWYoYVtnXT1hW2ddLnJlcGxhY2UoL15cXHMrfFxccyskL2csXCJcIiksXCJcIj09PWFbZ10mJihmPWcrMSksYVtnXS5sZW5ndGg+MCl7aWYoZj09PWcpdGhpcy5hdGxhcy5tZXRhLmltYWdlLnB1c2goYVtnXSksZD10aGlzLmF0bGFzLm1ldGEuaW1hZ2UubGVuZ3RoLTEsdGhpcy5hdGxhcy5mcmFtZXMucHVzaCh7fSksYz0tMztlbHNlIGlmKGM+MClpZihjJTc9PT0xKW51bGwhPWUmJih0aGlzLmF0bGFzLmZyYW1lc1tkXVtlLm5hbWVdPWUpLGU9e25hbWU6YVtnXSxmcmFtZTp7fX07ZWxzZXt2YXIgaj1hW2ddLnNwbGl0KFwiIFwiKTtpZihjJTc9PT0zKWUuZnJhbWUueD1OdW1iZXIoalsxXS5yZXBsYWNlKFwiLFwiLFwiXCIpKSxlLmZyYW1lLnk9TnVtYmVyKGpbMl0pO2Vsc2UgaWYoYyU3PT09NCllLmZyYW1lLnc9TnVtYmVyKGpbMV0ucmVwbGFjZShcIixcIixcIlwiKSksZS5mcmFtZS5oPU51bWJlcihqWzJdKTtlbHNlIGlmKGMlNz09PTUpe3ZhciBrPXt4OjAseTowLHc6TnVtYmVyKGpbMV0ucmVwbGFjZShcIixcIixcIlwiKSksaDpOdW1iZXIoalsyXSl9O2sudz5lLmZyYW1lLnd8fGsuaD5lLmZyYW1lLmg/KGUudHJpbW1lZD0hMCxlLnJlYWxTaXplPWspOmUudHJpbW1lZD0hMX19YysrfWlmKG51bGwhPWUmJih0aGlzLmF0bGFzLmZyYW1lc1tkXVtlLm5hbWVdPWUpLHRoaXMuYXRsYXMubWV0YS5pbWFnZS5sZW5ndGg+MCl7Zm9yKHRoaXMuaW1hZ2VzPVtdLGg9MDtoPHRoaXMuYXRsYXMubWV0YS5pbWFnZS5sZW5ndGg7aCsrKXt2YXIgbD10aGlzLmJhc2VVcmwrdGhpcy5hdGxhcy5tZXRhLmltYWdlW2hdLG09dGhpcy5hdGxhcy5mcmFtZXNbaF07dGhpcy5pbWFnZXMucHVzaChuZXcgYi5JbWFnZUxvYWRlcihsLHRoaXMuY3Jvc3NvcmlnaW4pKTtmb3IoZyBpbiBtKXt2YXIgbj1tW2ddLmZyYW1lO24mJihiLlRleHR1cmVDYWNoZVtnXT1uZXcgYi5UZXh0dXJlKHRoaXMuaW1hZ2VzW2hdLnRleHR1cmUuYmFzZVRleHR1cmUse3g6bi54LHk6bi55LHdpZHRoOm4udyxoZWlnaHQ6bi5ofSksbVtnXS50cmltbWVkJiYoYi5UZXh0dXJlQ2FjaGVbZ10ucmVhbFNpemU9bVtnXS5yZWFsU2l6ZSxiLlRleHR1cmVDYWNoZVtnXS50cmltLng9MCxiLlRleHR1cmVDYWNoZVtnXS50cmltLnk9MCkpfX1mb3IodGhpcy5jdXJyZW50SW1hZ2VJZD0wLGg9MDtoPHRoaXMuaW1hZ2VzLmxlbmd0aDtoKyspdGhpcy5pbWFnZXNbaF0uYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRlZFwiLGkpO3RoaXMuaW1hZ2VzW3RoaXMuY3VycmVudEltYWdlSWRdLmxvYWQoKX1lbHNlIHRoaXMub25Mb2FkZWQoKX1lbHNlIHRoaXMub25FcnJvcigpfSxiLkF0bGFzTG9hZGVyLnByb3RvdHlwZS5vbkxvYWRlZD1mdW5jdGlvbigpe3RoaXMuaW1hZ2VzLmxlbmd0aC0xPnRoaXMuY3VycmVudEltYWdlSWQ/KHRoaXMuY3VycmVudEltYWdlSWQrKyx0aGlzLmltYWdlc1t0aGlzLmN1cnJlbnRJbWFnZUlkXS5sb2FkKCkpOih0aGlzLmxvYWRlZD0hMCx0aGlzLmRpc3BhdGNoRXZlbnQoe3R5cGU6XCJsb2FkZWRcIixjb250ZW50OnRoaXN9KSl9LGIuQXRsYXNMb2FkZXIucHJvdG90eXBlLm9uRXJyb3I9ZnVuY3Rpb24oKXt0aGlzLmRpc3BhdGNoRXZlbnQoe3R5cGU6XCJlcnJvclwiLGNvbnRlbnQ6dGhpc30pfSxiLlNwcml0ZVNoZWV0TG9hZGVyPWZ1bmN0aW9uKGEsYyl7Yi5FdmVudFRhcmdldC5jYWxsKHRoaXMpLHRoaXMudXJsPWEsdGhpcy5jcm9zc29yaWdpbj1jLHRoaXMuYmFzZVVybD1hLnJlcGxhY2UoL1teXFwvXSokLyxcIlwiKSx0aGlzLnRleHR1cmU9bnVsbCx0aGlzLmZyYW1lcz17fX0sYi5TcHJpdGVTaGVldExvYWRlci5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5TcHJpdGVTaGVldExvYWRlcixiLlNwcml0ZVNoZWV0TG9hZGVyLnByb3RvdHlwZS5sb2FkPWZ1bmN0aW9uKCl7dmFyIGE9dGhpcyxjPW5ldyBiLkpzb25Mb2FkZXIodGhpcy51cmwsdGhpcy5jcm9zc29yaWdpbik7Yy5hZGRFdmVudExpc3RlbmVyKFwibG9hZGVkXCIsZnVuY3Rpb24oYil7YS5qc29uPWIuY29udGVudC5qc29uLGEub25Mb2FkZWQoKX0pLGMubG9hZCgpfSxiLlNwcml0ZVNoZWV0TG9hZGVyLnByb3RvdHlwZS5vbkxvYWRlZD1mdW5jdGlvbigpe3RoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTpcImxvYWRlZFwiLGNvbnRlbnQ6dGhpc30pfSxiLkltYWdlTG9hZGVyPWZ1bmN0aW9uKGEsYyl7Yi5FdmVudFRhcmdldC5jYWxsKHRoaXMpLHRoaXMudGV4dHVyZT1iLlRleHR1cmUuZnJvbUltYWdlKGEsYyksdGhpcy5mcmFtZXM9W119LGIuSW1hZ2VMb2FkZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuSW1hZ2VMb2FkZXIsYi5JbWFnZUxvYWRlci5wcm90b3R5cGUubG9hZD1mdW5jdGlvbigpe2lmKHRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZS5oYXNMb2FkZWQpdGhpcy5vbkxvYWRlZCgpO2Vsc2V7dmFyIGE9dGhpczt0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRlZFwiLGZ1bmN0aW9uKCl7YS5vbkxvYWRlZCgpfSl9fSxiLkltYWdlTG9hZGVyLnByb3RvdHlwZS5vbkxvYWRlZD1mdW5jdGlvbigpe3RoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTpcImxvYWRlZFwiLGNvbnRlbnQ6dGhpc30pfSxiLkltYWdlTG9hZGVyLnByb3RvdHlwZS5sb2FkRnJhbWVkU3ByaXRlU2hlZXQ9ZnVuY3Rpb24oYSxjLGQpe3RoaXMuZnJhbWVzPVtdO2Zvcih2YXIgZT1NYXRoLmZsb29yKHRoaXMudGV4dHVyZS53aWR0aC9hKSxmPU1hdGguZmxvb3IodGhpcy50ZXh0dXJlLmhlaWdodC9jKSxnPTAsaD0wO2Y+aDtoKyspZm9yKHZhciBpPTA7ZT5pO2krKyxnKyspe3ZhciBqPW5ldyBiLlRleHR1cmUodGhpcy50ZXh0dXJlLHt4OmkqYSx5OmgqYyx3aWR0aDphLGhlaWdodDpjfSk7dGhpcy5mcmFtZXMucHVzaChqKSxkJiYoYi5UZXh0dXJlQ2FjaGVbZCtcIi1cIitnXT1qKX1pZih0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUuaGFzTG9hZGVkKXRoaXMub25Mb2FkZWQoKTtlbHNle3ZhciBrPXRoaXM7dGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkZWRcIixmdW5jdGlvbigpe2sub25Mb2FkZWQoKX0pfX0sYi5CaXRtYXBGb250TG9hZGVyPWZ1bmN0aW9uKGEsYyl7Yi5FdmVudFRhcmdldC5jYWxsKHRoaXMpLHRoaXMudXJsPWEsdGhpcy5jcm9zc29yaWdpbj1jLHRoaXMuYmFzZVVybD1hLnJlcGxhY2UoL1teXFwvXSokLyxcIlwiKSx0aGlzLnRleHR1cmU9bnVsbH0sYi5CaXRtYXBGb250TG9hZGVyLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLkJpdG1hcEZvbnRMb2FkZXIsYi5CaXRtYXBGb250TG9hZGVyLnByb3RvdHlwZS5sb2FkPWZ1bmN0aW9uKCl7dGhpcy5hamF4UmVxdWVzdD1uZXcgYi5BamF4UmVxdWVzdDt2YXIgYT10aGlzO3RoaXMuYWpheFJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlPWZ1bmN0aW9uKCl7YS5vblhNTExvYWRlZCgpfSx0aGlzLmFqYXhSZXF1ZXN0Lm9wZW4oXCJHRVRcIix0aGlzLnVybCwhMCksdGhpcy5hamF4UmVxdWVzdC5vdmVycmlkZU1pbWVUeXBlJiZ0aGlzLmFqYXhSZXF1ZXN0Lm92ZXJyaWRlTWltZVR5cGUoXCJhcHBsaWNhdGlvbi94bWxcIiksdGhpcy5hamF4UmVxdWVzdC5zZW5kKG51bGwpfSxiLkJpdG1hcEZvbnRMb2FkZXIucHJvdG90eXBlLm9uWE1MTG9hZGVkPWZ1bmN0aW9uKCl7aWYoND09PXRoaXMuYWpheFJlcXVlc3QucmVhZHlTdGF0ZSYmKDIwMD09PXRoaXMuYWpheFJlcXVlc3Quc3RhdHVzfHwtMT09PXdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbC5pbmRleE9mKFwiaHR0cFwiKSkpe3ZhciBhPXRoaXMuYWpheFJlcXVlc3QucmVzcG9uc2VYTUw7aWYoIWF8fC9NU0lFIDkvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpfHxuYXZpZ2F0b3IuaXNDb2Nvb25KUylpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiB3aW5kb3cuRE9NUGFyc2VyKXt2YXIgYz1uZXcgRE9NUGFyc2VyO2E9Yy5wYXJzZUZyb21TdHJpbmcodGhpcy5hamF4UmVxdWVzdC5yZXNwb25zZVRleHQsXCJ0ZXh0L3htbFwiKX1lbHNle3ZhciBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7ZC5pbm5lckhUTUw9dGhpcy5hamF4UmVxdWVzdC5yZXNwb25zZVRleHQsYT1kfXZhciBlPXRoaXMuYmFzZVVybCthLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwicGFnZVwiKVswXS5nZXRBdHRyaWJ1dGUoXCJmaWxlXCIpLGY9bmV3IGIuSW1hZ2VMb2FkZXIoZSx0aGlzLmNyb3Nzb3JpZ2luKTt0aGlzLnRleHR1cmU9Zi50ZXh0dXJlLmJhc2VUZXh0dXJlO3ZhciBnPXt9LGg9YS5nZXRFbGVtZW50c0J5VGFnTmFtZShcImluZm9cIilbMF0saT1hLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiY29tbW9uXCIpWzBdO2cuZm9udD1oLmdldEF0dHJpYnV0ZShcImZhY2VcIiksZy5zaXplPXBhcnNlSW50KGguZ2V0QXR0cmlidXRlKFwic2l6ZVwiKSwxMCksZy5saW5lSGVpZ2h0PXBhcnNlSW50KGkuZ2V0QXR0cmlidXRlKFwibGluZUhlaWdodFwiKSwxMCksZy5jaGFycz17fTtmb3IodmFyIGo9YS5nZXRFbGVtZW50c0J5VGFnTmFtZShcImNoYXJcIiksaz0wO2s8ai5sZW5ndGg7aysrKXt2YXIgbD1wYXJzZUludChqW2tdLmdldEF0dHJpYnV0ZShcImlkXCIpLDEwKSxtPW5ldyBiLlJlY3RhbmdsZShwYXJzZUludChqW2tdLmdldEF0dHJpYnV0ZShcInhcIiksMTApLHBhcnNlSW50KGpba10uZ2V0QXR0cmlidXRlKFwieVwiKSwxMCkscGFyc2VJbnQoaltrXS5nZXRBdHRyaWJ1dGUoXCJ3aWR0aFwiKSwxMCkscGFyc2VJbnQoaltrXS5nZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIiksMTApKTtnLmNoYXJzW2xdPXt4T2Zmc2V0OnBhcnNlSW50KGpba10uZ2V0QXR0cmlidXRlKFwieG9mZnNldFwiKSwxMCkseU9mZnNldDpwYXJzZUludChqW2tdLmdldEF0dHJpYnV0ZShcInlvZmZzZXRcIiksMTApLHhBZHZhbmNlOnBhcnNlSW50KGpba10uZ2V0QXR0cmlidXRlKFwieGFkdmFuY2VcIiksMTApLGtlcm5pbmc6e30sdGV4dHVyZTpiLlRleHR1cmVDYWNoZVtsXT1uZXcgYi5UZXh0dXJlKHRoaXMudGV4dHVyZSxtKX19dmFyIG49YS5nZXRFbGVtZW50c0J5VGFnTmFtZShcImtlcm5pbmdcIik7Zm9yKGs9MDtrPG4ubGVuZ3RoO2srKyl7dmFyIG89cGFyc2VJbnQobltrXS5nZXRBdHRyaWJ1dGUoXCJmaXJzdFwiKSwxMCkscD1wYXJzZUludChuW2tdLmdldEF0dHJpYnV0ZShcInNlY29uZFwiKSwxMCkscT1wYXJzZUludChuW2tdLmdldEF0dHJpYnV0ZShcImFtb3VudFwiKSwxMCk7Zy5jaGFyc1twXS5rZXJuaW5nW29dPXF9Yi5CaXRtYXBUZXh0LmZvbnRzW2cuZm9udF09Zzt2YXIgcj10aGlzO2YuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRlZFwiLGZ1bmN0aW9uKCl7ci5vbkxvYWRlZCgpfSksZi5sb2FkKCl9fSxiLkJpdG1hcEZvbnRMb2FkZXIucHJvdG90eXBlLm9uTG9hZGVkPWZ1bmN0aW9uKCl7dGhpcy5kaXNwYXRjaEV2ZW50KHt0eXBlOlwibG9hZGVkXCIsY29udGVudDp0aGlzfSl9LGIuU3BpbmVMb2FkZXI9ZnVuY3Rpb24oYSxjKXtiLkV2ZW50VGFyZ2V0LmNhbGwodGhpcyksdGhpcy51cmw9YSx0aGlzLmNyb3Nzb3JpZ2luPWMsdGhpcy5sb2FkZWQ9ITF9LGIuU3BpbmVMb2FkZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuU3BpbmVMb2FkZXIsYi5TcGluZUxvYWRlci5wcm90b3R5cGUubG9hZD1mdW5jdGlvbigpe3ZhciBhPXRoaXMsYz1uZXcgYi5Kc29uTG9hZGVyKHRoaXMudXJsLHRoaXMuY3Jvc3NvcmlnaW4pO1xuYy5hZGRFdmVudExpc3RlbmVyKFwibG9hZGVkXCIsZnVuY3Rpb24oYil7YS5qc29uPWIuY29udGVudC5qc29uLGEub25Mb2FkZWQoKX0pLGMubG9hZCgpfSxiLlNwaW5lTG9hZGVyLnByb3RvdHlwZS5vbkxvYWRlZD1mdW5jdGlvbigpe3RoaXMubG9hZGVkPSEwLHRoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTpcImxvYWRlZFwiLGNvbnRlbnQ6dGhpc30pfSxiLkFic3RyYWN0RmlsdGVyPWZ1bmN0aW9uKGEsYil7dGhpcy5wYXNzZXM9W3RoaXNdLHRoaXMuc2hhZGVycz1bXSx0aGlzLmRpcnR5PSEwLHRoaXMucGFkZGluZz0wLHRoaXMudW5pZm9ybXM9Ynx8e30sdGhpcy5mcmFnbWVudFNyYz1hfHxbXX0sYi5BbHBoYU1hc2tGaWx0ZXI9ZnVuY3Rpb24oYSl7Yi5BYnN0cmFjdEZpbHRlci5jYWxsKHRoaXMpLHRoaXMucGFzc2VzPVt0aGlzXSxhLmJhc2VUZXh0dXJlLl9wb3dlck9mMj0hMCx0aGlzLnVuaWZvcm1zPXttYXNrOnt0eXBlOlwic2FtcGxlcjJEXCIsdmFsdWU6YX0sbWFwRGltZW5zaW9uczp7dHlwZTpcIjJmXCIsdmFsdWU6e3g6MSx5OjUxMTJ9fSxkaW1lbnNpb25zOnt0eXBlOlwiNGZ2XCIsdmFsdWU6WzAsMCwwLDBdfX0sYS5iYXNlVGV4dHVyZS5oYXNMb2FkZWQ/KHRoaXMudW5pZm9ybXMubWFzay52YWx1ZS54PWEud2lkdGgsdGhpcy51bmlmb3Jtcy5tYXNrLnZhbHVlLnk9YS5oZWlnaHQpOih0aGlzLmJvdW5kTG9hZGVkRnVuY3Rpb249dGhpcy5vblRleHR1cmVMb2FkZWQuYmluZCh0aGlzKSxhLmJhc2VUZXh0dXJlLm9uKFwibG9hZGVkXCIsdGhpcy5ib3VuZExvYWRlZEZ1bmN0aW9uKSksdGhpcy5mcmFnbWVudFNyYz1bXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcIixcInZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkO1wiLFwidmFyeWluZyB2ZWM0IHZDb2xvcjtcIixcInVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XCIsXCJ1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjtcIixcInVuaWZvcm0gdmVjMiBvZmZzZXQ7XCIsXCJ1bmlmb3JtIHZlYzQgZGltZW5zaW9ucztcIixcInVuaWZvcm0gdmVjMiBtYXBEaW1lbnNpb25zO1wiLFwidm9pZCBtYWluKHZvaWQpIHtcIixcIiAgIHZlYzIgbWFwQ29yZHMgPSB2VGV4dHVyZUNvb3JkLnh5O1wiLFwiICAgbWFwQ29yZHMgKz0gKGRpbWVuc2lvbnMuencgKyBvZmZzZXQpLyBkaW1lbnNpb25zLnh5IDtcIixcIiAgIG1hcENvcmRzLnkgKj0gLTEuMDtcIixcIiAgIG1hcENvcmRzLnkgKz0gMS4wO1wiLFwiICAgbWFwQ29yZHMgKj0gZGltZW5zaW9ucy54eSAvIG1hcERpbWVuc2lvbnM7XCIsXCIgICB2ZWM0IG9yaWdpbmFsID0gIHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCk7XCIsXCIgICBmbG9hdCBtYXNrQWxwaGEgPSAgdGV4dHVyZTJEKG1hc2ssIG1hcENvcmRzKS5yO1wiLFwiICAgb3JpZ2luYWwgKj0gbWFza0FscGhhO1wiLFwiICAgZ2xfRnJhZ0NvbG9yID0gIG9yaWdpbmFsO1wiLFwifVwiXX0sYi5BbHBoYU1hc2tGaWx0ZXIucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoYi5BYnN0cmFjdEZpbHRlci5wcm90b3R5cGUpLGIuQWxwaGFNYXNrRmlsdGVyLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLkFscGhhTWFza0ZpbHRlcixiLkFscGhhTWFza0ZpbHRlci5wcm90b3R5cGUub25UZXh0dXJlTG9hZGVkPWZ1bmN0aW9uKCl7dGhpcy51bmlmb3Jtcy5tYXBEaW1lbnNpb25zLnZhbHVlLng9dGhpcy51bmlmb3Jtcy5tYXNrLnZhbHVlLndpZHRoLHRoaXMudW5pZm9ybXMubWFwRGltZW5zaW9ucy52YWx1ZS55PXRoaXMudW5pZm9ybXMubWFzay52YWx1ZS5oZWlnaHQsdGhpcy51bmlmb3Jtcy5tYXNrLnZhbHVlLmJhc2VUZXh0dXJlLm9mZihcImxvYWRlZFwiLHRoaXMuYm91bmRMb2FkZWRGdW5jdGlvbil9LE9iamVjdC5kZWZpbmVQcm9wZXJ0eShiLkFscGhhTWFza0ZpbHRlci5wcm90b3R5cGUsXCJtYXBcIix7Z2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMudW5pZm9ybXMubWFzay52YWx1ZX0sc2V0OmZ1bmN0aW9uKGEpe3RoaXMudW5pZm9ybXMubWFzay52YWx1ZT1hfX0pLGIuQ29sb3JNYXRyaXhGaWx0ZXI9ZnVuY3Rpb24oKXtiLkFic3RyYWN0RmlsdGVyLmNhbGwodGhpcyksdGhpcy5wYXNzZXM9W3RoaXNdLHRoaXMudW5pZm9ybXM9e21hdHJpeDp7dHlwZTpcIm1hdDRcIix2YWx1ZTpbMSwwLDAsMCwwLDEsMCwwLDAsMCwxLDAsMCwwLDAsMV19fSx0aGlzLmZyYWdtZW50U3JjPVtcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1wiLFwidmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7XCIsXCJ2YXJ5aW5nIHZlYzQgdkNvbG9yO1wiLFwidW5pZm9ybSBmbG9hdCBpbnZlcnQ7XCIsXCJ1bmlmb3JtIG1hdDQgbWF0cml4O1wiLFwidW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7XCIsXCJ2b2lkIG1haW4odm9pZCkge1wiLFwiICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkKSAqIG1hdHJpeDtcIixcIn1cIl19LGIuQ29sb3JNYXRyaXhGaWx0ZXIucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoYi5BYnN0cmFjdEZpbHRlci5wcm90b3R5cGUpLGIuQ29sb3JNYXRyaXhGaWx0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuQ29sb3JNYXRyaXhGaWx0ZXIsT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuQ29sb3JNYXRyaXhGaWx0ZXIucHJvdG90eXBlLFwibWF0cml4XCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVuaWZvcm1zLm1hdHJpeC52YWx1ZX0sc2V0OmZ1bmN0aW9uKGEpe3RoaXMudW5pZm9ybXMubWF0cml4LnZhbHVlPWF9fSksYi5HcmF5RmlsdGVyPWZ1bmN0aW9uKCl7Yi5BYnN0cmFjdEZpbHRlci5jYWxsKHRoaXMpLHRoaXMucGFzc2VzPVt0aGlzXSx0aGlzLnVuaWZvcm1zPXtncmF5Ont0eXBlOlwiMWZcIix2YWx1ZToxfX0sdGhpcy5mcmFnbWVudFNyYz1bXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcIixcInZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkO1wiLFwidmFyeWluZyB2ZWM0IHZDb2xvcjtcIixcInVuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyO1wiLFwidW5pZm9ybSBmbG9hdCBncmF5O1wiLFwidm9pZCBtYWluKHZvaWQpIHtcIixcIiAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCk7XCIsXCIgICBnbF9GcmFnQ29sb3IucmdiID0gbWl4KGdsX0ZyYWdDb2xvci5yZ2IsIHZlYzMoMC4yMTI2KmdsX0ZyYWdDb2xvci5yICsgMC43MTUyKmdsX0ZyYWdDb2xvci5nICsgMC4wNzIyKmdsX0ZyYWdDb2xvci5iKSwgZ3JheSk7XCIsXCJ9XCJdfSxiLkdyYXlGaWx0ZXIucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoYi5BYnN0cmFjdEZpbHRlci5wcm90b3R5cGUpLGIuR3JheUZpbHRlci5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5HcmF5RmlsdGVyLE9iamVjdC5kZWZpbmVQcm9wZXJ0eShiLkdyYXlGaWx0ZXIucHJvdG90eXBlLFwiZ3JheVwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51bmlmb3Jtcy5ncmF5LnZhbHVlfSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy51bmlmb3Jtcy5ncmF5LnZhbHVlPWF9fSksYi5EaXNwbGFjZW1lbnRGaWx0ZXI9ZnVuY3Rpb24oYSl7Yi5BYnN0cmFjdEZpbHRlci5jYWxsKHRoaXMpLHRoaXMucGFzc2VzPVt0aGlzXSxhLmJhc2VUZXh0dXJlLl9wb3dlck9mMj0hMCx0aGlzLnVuaWZvcm1zPXtkaXNwbGFjZW1lbnRNYXA6e3R5cGU6XCJzYW1wbGVyMkRcIix2YWx1ZTphfSxzY2FsZTp7dHlwZTpcIjJmXCIsdmFsdWU6e3g6MzAseTozMH19LG9mZnNldDp7dHlwZTpcIjJmXCIsdmFsdWU6e3g6MCx5OjB9fSxtYXBEaW1lbnNpb25zOnt0eXBlOlwiMmZcIix2YWx1ZTp7eDoxLHk6NTExMn19LGRpbWVuc2lvbnM6e3R5cGU6XCI0ZnZcIix2YWx1ZTpbMCwwLDAsMF19fSxhLmJhc2VUZXh0dXJlLmhhc0xvYWRlZD8odGhpcy51bmlmb3Jtcy5tYXBEaW1lbnNpb25zLnZhbHVlLng9YS53aWR0aCx0aGlzLnVuaWZvcm1zLm1hcERpbWVuc2lvbnMudmFsdWUueT1hLmhlaWdodCk6KHRoaXMuYm91bmRMb2FkZWRGdW5jdGlvbj10aGlzLm9uVGV4dHVyZUxvYWRlZC5iaW5kKHRoaXMpLGEuYmFzZVRleHR1cmUub24oXCJsb2FkZWRcIix0aGlzLmJvdW5kTG9hZGVkRnVuY3Rpb24pKSx0aGlzLmZyYWdtZW50U3JjPVtcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1wiLFwidmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7XCIsXCJ2YXJ5aW5nIHZlYzQgdkNvbG9yO1wiLFwidW5pZm9ybSBzYW1wbGVyMkQgZGlzcGxhY2VtZW50TWFwO1wiLFwidW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7XCIsXCJ1bmlmb3JtIHZlYzIgc2NhbGU7XCIsXCJ1bmlmb3JtIHZlYzIgb2Zmc2V0O1wiLFwidW5pZm9ybSB2ZWM0IGRpbWVuc2lvbnM7XCIsXCJ1bmlmb3JtIHZlYzIgbWFwRGltZW5zaW9ucztcIixcInZvaWQgbWFpbih2b2lkKSB7XCIsXCIgICB2ZWMyIG1hcENvcmRzID0gdlRleHR1cmVDb29yZC54eTtcIixcIiAgIG1hcENvcmRzICs9IChkaW1lbnNpb25zLnp3ICsgb2Zmc2V0KS8gZGltZW5zaW9ucy54eSA7XCIsXCIgICBtYXBDb3Jkcy55ICo9IC0xLjA7XCIsXCIgICBtYXBDb3Jkcy55ICs9IDEuMDtcIixcIiAgIHZlYzIgbWF0U2FtcGxlID0gdGV4dHVyZTJEKGRpc3BsYWNlbWVudE1hcCwgbWFwQ29yZHMpLnh5O1wiLFwiICAgbWF0U2FtcGxlIC09IDAuNTtcIixcIiAgIG1hdFNhbXBsZSAqPSBzY2FsZTtcIixcIiAgIG1hdFNhbXBsZSAvPSBtYXBEaW1lbnNpb25zO1wiLFwiICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCArIG1hdFNhbXBsZS54LCB2VGV4dHVyZUNvb3JkLnkgKyBtYXRTYW1wbGUueSkpO1wiLFwiICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IG1peCggZ2xfRnJhZ0NvbG9yLnJnYiwgZ2xfRnJhZ0NvbG9yLnJnYiwgMS4wKTtcIixcIiAgIHZlYzIgY29yZCA9IHZUZXh0dXJlQ29vcmQ7XCIsXCJ9XCJdfSxiLkRpc3BsYWNlbWVudEZpbHRlci5wcm90b3R5cGU9T2JqZWN0LmNyZWF0ZShiLkFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSksYi5EaXNwbGFjZW1lbnRGaWx0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuRGlzcGxhY2VtZW50RmlsdGVyLGIuRGlzcGxhY2VtZW50RmlsdGVyLnByb3RvdHlwZS5vblRleHR1cmVMb2FkZWQ9ZnVuY3Rpb24oKXt0aGlzLnVuaWZvcm1zLm1hcERpbWVuc2lvbnMudmFsdWUueD10aGlzLnVuaWZvcm1zLmRpc3BsYWNlbWVudE1hcC52YWx1ZS53aWR0aCx0aGlzLnVuaWZvcm1zLm1hcERpbWVuc2lvbnMudmFsdWUueT10aGlzLnVuaWZvcm1zLmRpc3BsYWNlbWVudE1hcC52YWx1ZS5oZWlnaHQsdGhpcy51bmlmb3Jtcy5kaXNwbGFjZW1lbnRNYXAudmFsdWUuYmFzZVRleHR1cmUub2ZmKFwibG9hZGVkXCIsdGhpcy5ib3VuZExvYWRlZEZ1bmN0aW9uKX0sT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuRGlzcGxhY2VtZW50RmlsdGVyLnByb3RvdHlwZSxcIm1hcFwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51bmlmb3Jtcy5kaXNwbGFjZW1lbnRNYXAudmFsdWV9LHNldDpmdW5jdGlvbihhKXt0aGlzLnVuaWZvcm1zLmRpc3BsYWNlbWVudE1hcC52YWx1ZT1hfX0pLE9iamVjdC5kZWZpbmVQcm9wZXJ0eShiLkRpc3BsYWNlbWVudEZpbHRlci5wcm90b3R5cGUsXCJzY2FsZVwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51bmlmb3Jtcy5zY2FsZS52YWx1ZX0sc2V0OmZ1bmN0aW9uKGEpe3RoaXMudW5pZm9ybXMuc2NhbGUudmFsdWU9YX19KSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5EaXNwbGFjZW1lbnRGaWx0ZXIucHJvdG90eXBlLFwib2Zmc2V0XCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVuaWZvcm1zLm9mZnNldC52YWx1ZX0sc2V0OmZ1bmN0aW9uKGEpe3RoaXMudW5pZm9ybXMub2Zmc2V0LnZhbHVlPWF9fSksYi5QaXhlbGF0ZUZpbHRlcj1mdW5jdGlvbigpe2IuQWJzdHJhY3RGaWx0ZXIuY2FsbCh0aGlzKSx0aGlzLnBhc3Nlcz1bdGhpc10sdGhpcy51bmlmb3Jtcz17aW52ZXJ0Ont0eXBlOlwiMWZcIix2YWx1ZTowfSxkaW1lbnNpb25zOnt0eXBlOlwiNGZ2XCIsdmFsdWU6bmV3IEZsb2F0MzJBcnJheShbMWU0LDEwMCwxMCwxMF0pfSxwaXhlbFNpemU6e3R5cGU6XCIyZlwiLHZhbHVlOnt4OjEwLHk6MTB9fX0sdGhpcy5mcmFnbWVudFNyYz1bXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcIixcInZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkO1wiLFwidmFyeWluZyB2ZWM0IHZDb2xvcjtcIixcInVuaWZvcm0gdmVjMiB0ZXN0RGltO1wiLFwidW5pZm9ybSB2ZWM0IGRpbWVuc2lvbnM7XCIsXCJ1bmlmb3JtIHZlYzIgcGl4ZWxTaXplO1wiLFwidW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7XCIsXCJ2b2lkIG1haW4odm9pZCkge1wiLFwiICAgdmVjMiBjb29yZCA9IHZUZXh0dXJlQ29vcmQ7XCIsXCIgICB2ZWMyIHNpemUgPSBkaW1lbnNpb25zLnh5L3BpeGVsU2l6ZTtcIixcIiAgIHZlYzIgY29sb3IgPSBmbG9vciggKCB2VGV4dHVyZUNvb3JkICogc2l6ZSApICkgLyBzaXplICsgcGl4ZWxTaXplL2RpbWVuc2lvbnMueHkgKiAwLjU7XCIsXCIgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIGNvbG9yKTtcIixcIn1cIl19LGIuUGl4ZWxhdGVGaWx0ZXIucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoYi5BYnN0cmFjdEZpbHRlci5wcm90b3R5cGUpLGIuUGl4ZWxhdGVGaWx0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuUGl4ZWxhdGVGaWx0ZXIsT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuUGl4ZWxhdGVGaWx0ZXIucHJvdG90eXBlLFwic2l6ZVwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51bmlmb3Jtcy5waXhlbFNpemUudmFsdWV9LHNldDpmdW5jdGlvbihhKXt0aGlzLmRpcnR5PSEwLHRoaXMudW5pZm9ybXMucGl4ZWxTaXplLnZhbHVlPWF9fSksYi5CbHVyWEZpbHRlcj1mdW5jdGlvbigpe2IuQWJzdHJhY3RGaWx0ZXIuY2FsbCh0aGlzKSx0aGlzLnBhc3Nlcz1bdGhpc10sdGhpcy51bmlmb3Jtcz17Ymx1cjp7dHlwZTpcIjFmXCIsdmFsdWU6MS81MTJ9fSx0aGlzLmZyYWdtZW50U3JjPVtcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1wiLFwidmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7XCIsXCJ2YXJ5aW5nIHZlYzQgdkNvbG9yO1wiLFwidW5pZm9ybSBmbG9hdCBibHVyO1wiLFwidW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7XCIsXCJ2b2lkIG1haW4odm9pZCkge1wiLFwiICAgdmVjNCBzdW0gPSB2ZWM0KDAuMCk7XCIsXCIgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCAtIDQuMCpibHVyLCB2VGV4dHVyZUNvb3JkLnkpKSAqIDAuMDU7XCIsXCIgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCAtIDMuMCpibHVyLCB2VGV4dHVyZUNvb3JkLnkpKSAqIDAuMDk7XCIsXCIgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCAtIDIuMCpibHVyLCB2VGV4dHVyZUNvb3JkLnkpKSAqIDAuMTI7XCIsXCIgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCAtIGJsdXIsIHZUZXh0dXJlQ29vcmQueSkpICogMC4xNTtcIixcIiAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkpKSAqIDAuMTY7XCIsXCIgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCArIGJsdXIsIHZUZXh0dXJlQ29vcmQueSkpICogMC4xNTtcIixcIiAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54ICsgMi4wKmJsdXIsIHZUZXh0dXJlQ29vcmQueSkpICogMC4xMjtcIixcIiAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54ICsgMy4wKmJsdXIsIHZUZXh0dXJlQ29vcmQueSkpICogMC4wOTtcIixcIiAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54ICsgNC4wKmJsdXIsIHZUZXh0dXJlQ29vcmQueSkpICogMC4wNTtcIixcIiAgIGdsX0ZyYWdDb2xvciA9IHN1bTtcIixcIn1cIl19LGIuQmx1clhGaWx0ZXIucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoYi5BYnN0cmFjdEZpbHRlci5wcm90b3R5cGUpLGIuQmx1clhGaWx0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuQmx1clhGaWx0ZXIsT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuQmx1clhGaWx0ZXIucHJvdG90eXBlLFwiYmx1clwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51bmlmb3Jtcy5ibHVyLnZhbHVlLygxLzdlMyl9LHNldDpmdW5jdGlvbihhKXt0aGlzLmRpcnR5PSEwLHRoaXMudW5pZm9ybXMuYmx1ci52YWx1ZT0xLzdlMyphfX0pLGIuQmx1cllGaWx0ZXI9ZnVuY3Rpb24oKXtiLkFic3RyYWN0RmlsdGVyLmNhbGwodGhpcyksdGhpcy5wYXNzZXM9W3RoaXNdLHRoaXMudW5pZm9ybXM9e2JsdXI6e3R5cGU6XCIxZlwiLHZhbHVlOjEvNTEyfX0sdGhpcy5mcmFnbWVudFNyYz1bXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcIixcInZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkO1wiLFwidmFyeWluZyB2ZWM0IHZDb2xvcjtcIixcInVuaWZvcm0gZmxvYXQgYmx1cjtcIixcInVuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyO1wiLFwidm9pZCBtYWluKHZvaWQpIHtcIixcIiAgIHZlYzQgc3VtID0gdmVjNCgwLjApO1wiLFwiICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLngsIHZUZXh0dXJlQ29vcmQueSAtIDQuMCpibHVyKSkgKiAwLjA1O1wiLFwiICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLngsIHZUZXh0dXJlQ29vcmQueSAtIDMuMCpibHVyKSkgKiAwLjA5O1wiLFwiICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLngsIHZUZXh0dXJlQ29vcmQueSAtIDIuMCpibHVyKSkgKiAwLjEyO1wiLFwiICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLngsIHZUZXh0dXJlQ29vcmQueSAtIGJsdXIpKSAqIDAuMTU7XCIsXCIgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCwgdlRleHR1cmVDb29yZC55KSkgKiAwLjE2O1wiLFwiICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLngsIHZUZXh0dXJlQ29vcmQueSArIGJsdXIpKSAqIDAuMTU7XCIsXCIgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCwgdlRleHR1cmVDb29yZC55ICsgMi4wKmJsdXIpKSAqIDAuMTI7XCIsXCIgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCwgdlRleHR1cmVDb29yZC55ICsgMy4wKmJsdXIpKSAqIDAuMDk7XCIsXCIgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCwgdlRleHR1cmVDb29yZC55ICsgNC4wKmJsdXIpKSAqIDAuMDU7XCIsXCIgICBnbF9GcmFnQ29sb3IgPSBzdW07XCIsXCJ9XCJdfSxiLkJsdXJZRmlsdGVyLnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGIuQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlKSxiLkJsdXJZRmlsdGVyLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLkJsdXJZRmlsdGVyLE9iamVjdC5kZWZpbmVQcm9wZXJ0eShiLkJsdXJZRmlsdGVyLnByb3RvdHlwZSxcImJsdXJcIix7Z2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMudW5pZm9ybXMuYmx1ci52YWx1ZS8oMS83ZTMpfSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy51bmlmb3Jtcy5ibHVyLnZhbHVlPTEvN2UzKmF9fSksYi5CbHVyRmlsdGVyPWZ1bmN0aW9uKCl7dGhpcy5ibHVyWEZpbHRlcj1uZXcgYi5CbHVyWEZpbHRlcix0aGlzLmJsdXJZRmlsdGVyPW5ldyBiLkJsdXJZRmlsdGVyLHRoaXMucGFzc2VzPVt0aGlzLmJsdXJYRmlsdGVyLHRoaXMuYmx1cllGaWx0ZXJdfSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5CbHVyRmlsdGVyLnByb3RvdHlwZSxcImJsdXJcIix7Z2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuYmx1clhGaWx0ZXIuYmx1cn0sc2V0OmZ1bmN0aW9uKGEpe3RoaXMuYmx1clhGaWx0ZXIuYmx1cj10aGlzLmJsdXJZRmlsdGVyLmJsdXI9YX19KSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5CbHVyRmlsdGVyLnByb3RvdHlwZSxcImJsdXJYXCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmJsdXJYRmlsdGVyLmJsdXJ9LHNldDpmdW5jdGlvbihhKXt0aGlzLmJsdXJYRmlsdGVyLmJsdXI9YX19KSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5CbHVyRmlsdGVyLnByb3RvdHlwZSxcImJsdXJZXCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmJsdXJZRmlsdGVyLmJsdXJ9LHNldDpmdW5jdGlvbihhKXt0aGlzLmJsdXJZRmlsdGVyLmJsdXI9YX19KSxiLkludmVydEZpbHRlcj1mdW5jdGlvbigpe2IuQWJzdHJhY3RGaWx0ZXIuY2FsbCh0aGlzKSx0aGlzLnBhc3Nlcz1bdGhpc10sdGhpcy51bmlmb3Jtcz17aW52ZXJ0Ont0eXBlOlwiMWZcIix2YWx1ZToxfX0sdGhpcy5mcmFnbWVudFNyYz1bXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcIixcInZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkO1wiLFwidmFyeWluZyB2ZWM0IHZDb2xvcjtcIixcInVuaWZvcm0gZmxvYXQgaW52ZXJ0O1wiLFwidW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7XCIsXCJ2b2lkIG1haW4odm9pZCkge1wiLFwiICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkKTtcIixcIiAgIGdsX0ZyYWdDb2xvci5yZ2IgPSBtaXgoICh2ZWMzKDEpLWdsX0ZyYWdDb2xvci5yZ2IpICogZ2xfRnJhZ0NvbG9yLmEsIGdsX0ZyYWdDb2xvci5yZ2IsIDEuMCAtIGludmVydCk7XCIsXCJ9XCJdfSxiLkludmVydEZpbHRlci5wcm90b3R5cGU9T2JqZWN0LmNyZWF0ZShiLkFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSksYi5JbnZlcnRGaWx0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuSW52ZXJ0RmlsdGVyLE9iamVjdC5kZWZpbmVQcm9wZXJ0eShiLkludmVydEZpbHRlci5wcm90b3R5cGUsXCJpbnZlcnRcIix7Z2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMudW5pZm9ybXMuaW52ZXJ0LnZhbHVlfSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy51bmlmb3Jtcy5pbnZlcnQudmFsdWU9YX19KSxiLlNlcGlhRmlsdGVyPWZ1bmN0aW9uKCl7Yi5BYnN0cmFjdEZpbHRlci5jYWxsKHRoaXMpLHRoaXMucGFzc2VzPVt0aGlzXSx0aGlzLnVuaWZvcm1zPXtzZXBpYTp7dHlwZTpcIjFmXCIsdmFsdWU6MX19LHRoaXMuZnJhZ21lbnRTcmM9W1wicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XCIsXCJ2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDtcIixcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXCJ1bmlmb3JtIGZsb2F0IHNlcGlhO1wiLFwidW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7XCIsXCJjb25zdCBtYXQzIHNlcGlhTWF0cml4ID0gbWF0MygwLjM1ODgsIDAuNzA0NCwgMC4xMzY4LCAwLjI5OTAsIDAuNTg3MCwgMC4xMTQwLCAwLjIzOTIsIDAuNDY5NiwgMC4wOTEyKTtcIixcInZvaWQgbWFpbih2b2lkKSB7XCIsXCIgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZUZXh0dXJlQ29vcmQpO1wiLFwiICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IG1peCggZ2xfRnJhZ0NvbG9yLnJnYiwgZ2xfRnJhZ0NvbG9yLnJnYiAqIHNlcGlhTWF0cml4LCBzZXBpYSk7XCIsXCJ9XCJdfSxiLlNlcGlhRmlsdGVyLnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGIuQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlKSxiLlNlcGlhRmlsdGVyLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1iLlNlcGlhRmlsdGVyLE9iamVjdC5kZWZpbmVQcm9wZXJ0eShiLlNlcGlhRmlsdGVyLnByb3RvdHlwZSxcInNlcGlhXCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVuaWZvcm1zLnNlcGlhLnZhbHVlfSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy51bmlmb3Jtcy5zZXBpYS52YWx1ZT1hfX0pLGIuVHdpc3RGaWx0ZXI9ZnVuY3Rpb24oKXtiLkFic3RyYWN0RmlsdGVyLmNhbGwodGhpcyksdGhpcy5wYXNzZXM9W3RoaXNdLHRoaXMudW5pZm9ybXM9e3JhZGl1czp7dHlwZTpcIjFmXCIsdmFsdWU6LjV9LGFuZ2xlOnt0eXBlOlwiMWZcIix2YWx1ZTo1fSxvZmZzZXQ6e3R5cGU6XCIyZlwiLHZhbHVlOnt4Oi41LHk6LjV9fX0sdGhpcy5mcmFnbWVudFNyYz1bXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcIixcInZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkO1wiLFwidmFyeWluZyB2ZWM0IHZDb2xvcjtcIixcInVuaWZvcm0gdmVjNCBkaW1lbnNpb25zO1wiLFwidW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7XCIsXCJ1bmlmb3JtIGZsb2F0IHJhZGl1cztcIixcInVuaWZvcm0gZmxvYXQgYW5nbGU7XCIsXCJ1bmlmb3JtIHZlYzIgb2Zmc2V0O1wiLFwidm9pZCBtYWluKHZvaWQpIHtcIixcIiAgIHZlYzIgY29vcmQgPSB2VGV4dHVyZUNvb3JkIC0gb2Zmc2V0O1wiLFwiICAgZmxvYXQgZGlzdGFuY2UgPSBsZW5ndGgoY29vcmQpO1wiLFwiICAgaWYgKGRpc3RhbmNlIDwgcmFkaXVzKSB7XCIsXCIgICAgICAgZmxvYXQgcmF0aW8gPSAocmFkaXVzIC0gZGlzdGFuY2UpIC8gcmFkaXVzO1wiLFwiICAgICAgIGZsb2F0IGFuZ2xlTW9kID0gcmF0aW8gKiByYXRpbyAqIGFuZ2xlO1wiLFwiICAgICAgIGZsb2F0IHMgPSBzaW4oYW5nbGVNb2QpO1wiLFwiICAgICAgIGZsb2F0IGMgPSBjb3MoYW5nbGVNb2QpO1wiLFwiICAgICAgIGNvb3JkID0gdmVjMihjb29yZC54ICogYyAtIGNvb3JkLnkgKiBzLCBjb29yZC54ICogcyArIGNvb3JkLnkgKiBjKTtcIixcIiAgIH1cIixcIiAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgY29vcmQrb2Zmc2V0KTtcIixcIn1cIl19LGIuVHdpc3RGaWx0ZXIucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoYi5BYnN0cmFjdEZpbHRlci5wcm90b3R5cGUpLGIuVHdpc3RGaWx0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuVHdpc3RGaWx0ZXIsT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuVHdpc3RGaWx0ZXIucHJvdG90eXBlLFwib2Zmc2V0XCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVuaWZvcm1zLm9mZnNldC52YWx1ZX0sc2V0OmZ1bmN0aW9uKGEpe3RoaXMuZGlydHk9ITAsdGhpcy51bmlmb3Jtcy5vZmZzZXQudmFsdWU9YX19KSxPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5Ud2lzdEZpbHRlci5wcm90b3R5cGUsXCJyYWRpdXNcIix7Z2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMudW5pZm9ybXMucmFkaXVzLnZhbHVlfSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy5kaXJ0eT0hMCx0aGlzLnVuaWZvcm1zLnJhZGl1cy52YWx1ZT1hfX0pLE9iamVjdC5kZWZpbmVQcm9wZXJ0eShiLlR3aXN0RmlsdGVyLnByb3RvdHlwZSxcImFuZ2xlXCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVuaWZvcm1zLmFuZ2xlLnZhbHVlfSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy5kaXJ0eT0hMCx0aGlzLnVuaWZvcm1zLmFuZ2xlLnZhbHVlPWF9fSksYi5Db2xvclN0ZXBGaWx0ZXI9ZnVuY3Rpb24oKXtiLkFic3RyYWN0RmlsdGVyLmNhbGwodGhpcyksdGhpcy5wYXNzZXM9W3RoaXNdLHRoaXMudW5pZm9ybXM9e3N0ZXA6e3R5cGU6XCIxZlwiLHZhbHVlOjV9fSx0aGlzLmZyYWdtZW50U3JjPVtcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1wiLFwidmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7XCIsXCJ2YXJ5aW5nIHZlYzQgdkNvbG9yO1wiLFwidW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7XCIsXCJ1bmlmb3JtIGZsb2F0IHN0ZXA7XCIsXCJ2b2lkIG1haW4odm9pZCkge1wiLFwiICAgdmVjNCBjb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCk7XCIsXCIgICBjb2xvciA9IGZsb29yKGNvbG9yICogc3RlcCkgLyBzdGVwO1wiLFwiICAgZ2xfRnJhZ0NvbG9yID0gY29sb3I7XCIsXCJ9XCJdfSxiLkNvbG9yU3RlcEZpbHRlci5wcm90b3R5cGU9T2JqZWN0LmNyZWF0ZShiLkFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSksYi5Db2xvclN0ZXBGaWx0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuQ29sb3JTdGVwRmlsdGVyLE9iamVjdC5kZWZpbmVQcm9wZXJ0eShiLkNvbG9yU3RlcEZpbHRlci5wcm90b3R5cGUsXCJzdGVwXCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVuaWZvcm1zLnN0ZXAudmFsdWV9LHNldDpmdW5jdGlvbihhKXt0aGlzLnVuaWZvcm1zLnN0ZXAudmFsdWU9YX19KSxiLkRvdFNjcmVlbkZpbHRlcj1mdW5jdGlvbigpe2IuQWJzdHJhY3RGaWx0ZXIuY2FsbCh0aGlzKSx0aGlzLnBhc3Nlcz1bdGhpc10sdGhpcy51bmlmb3Jtcz17c2NhbGU6e3R5cGU6XCIxZlwiLHZhbHVlOjF9LGFuZ2xlOnt0eXBlOlwiMWZcIix2YWx1ZTo1fSxkaW1lbnNpb25zOnt0eXBlOlwiNGZ2XCIsdmFsdWU6WzAsMCwwLDBdfX0sdGhpcy5mcmFnbWVudFNyYz1bXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcIixcInZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkO1wiLFwidmFyeWluZyB2ZWM0IHZDb2xvcjtcIixcInVuaWZvcm0gdmVjNCBkaW1lbnNpb25zO1wiLFwidW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7XCIsXCJ1bmlmb3JtIGZsb2F0IGFuZ2xlO1wiLFwidW5pZm9ybSBmbG9hdCBzY2FsZTtcIixcImZsb2F0IHBhdHRlcm4oKSB7XCIsXCIgICBmbG9hdCBzID0gc2luKGFuZ2xlKSwgYyA9IGNvcyhhbmdsZSk7XCIsXCIgICB2ZWMyIHRleCA9IHZUZXh0dXJlQ29vcmQgKiBkaW1lbnNpb25zLnh5O1wiLFwiICAgdmVjMiBwb2ludCA9IHZlYzIoXCIsXCIgICAgICAgYyAqIHRleC54IC0gcyAqIHRleC55LFwiLFwiICAgICAgIHMgKiB0ZXgueCArIGMgKiB0ZXgueVwiLFwiICAgKSAqIHNjYWxlO1wiLFwiICAgcmV0dXJuIChzaW4ocG9pbnQueCkgKiBzaW4ocG9pbnQueSkpICogNC4wO1wiLFwifVwiLFwidm9pZCBtYWluKCkge1wiLFwiICAgdmVjNCBjb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCk7XCIsXCIgICBmbG9hdCBhdmVyYWdlID0gKGNvbG9yLnIgKyBjb2xvci5nICsgY29sb3IuYikgLyAzLjA7XCIsXCIgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KHZlYzMoYXZlcmFnZSAqIDEwLjAgLSA1LjAgKyBwYXR0ZXJuKCkpLCBjb2xvci5hKTtcIixcIn1cIl19LGIuRG90U2NyZWVuRmlsdGVyLnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGIuQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlKSxiLkRvdFNjcmVlbkZpbHRlci5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5Eb3RTY3JlZW5GaWx0ZXIsT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuRG90U2NyZWVuRmlsdGVyLnByb3RvdHlwZSxcInNjYWxlXCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVuaWZvcm1zLnNjYWxlLnZhbHVlfSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy5kaXJ0eT0hMCx0aGlzLnVuaWZvcm1zLnNjYWxlLnZhbHVlPWF9fSksT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuRG90U2NyZWVuRmlsdGVyLnByb3RvdHlwZSxcImFuZ2xlXCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVuaWZvcm1zLmFuZ2xlLnZhbHVlfSxzZXQ6ZnVuY3Rpb24oYSl7dGhpcy5kaXJ0eT0hMCx0aGlzLnVuaWZvcm1zLmFuZ2xlLnZhbHVlPWF9fSksYi5Dcm9zc0hhdGNoRmlsdGVyPWZ1bmN0aW9uKCl7Yi5BYnN0cmFjdEZpbHRlci5jYWxsKHRoaXMpLHRoaXMucGFzc2VzPVt0aGlzXSx0aGlzLnVuaWZvcm1zPXtibHVyOnt0eXBlOlwiMWZcIix2YWx1ZToxLzUxMn19LHRoaXMuZnJhZ21lbnRTcmM9W1wicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XCIsXCJ2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDtcIixcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXCJ1bmlmb3JtIGZsb2F0IGJsdXI7XCIsXCJ1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjtcIixcInZvaWQgbWFpbih2b2lkKSB7XCIsXCIgICAgZmxvYXQgbHVtID0gbGVuZ3RoKHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZC54eSkucmdiKTtcIixcIiAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KDEuMCwgMS4wLCAxLjAsIDEuMCk7XCIsXCIgICAgaWYgKGx1bSA8IDEuMDApIHtcIixcIiAgICAgICAgaWYgKG1vZChnbF9GcmFnQ29vcmQueCArIGdsX0ZyYWdDb29yZC55LCAxMC4wKSA9PSAwLjApIHtcIixcIiAgICAgICAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMS4wKTtcIixcIiAgICAgICAgfVwiLFwiICAgIH1cIixcIiAgICBpZiAobHVtIDwgMC43NSkge1wiLFwiICAgICAgICBpZiAobW9kKGdsX0ZyYWdDb29yZC54IC0gZ2xfRnJhZ0Nvb3JkLnksIDEwLjApID09IDAuMCkge1wiLFwiICAgICAgICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAxLjApO1wiLFwiICAgICAgICB9XCIsXCIgICAgfVwiLFwiICAgIGlmIChsdW0gPCAwLjUwKSB7XCIsXCIgICAgICAgIGlmIChtb2QoZ2xfRnJhZ0Nvb3JkLnggKyBnbF9GcmFnQ29vcmQueSAtIDUuMCwgMTAuMCkgPT0gMC4wKSB7XCIsXCIgICAgICAgICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDEuMCk7XCIsXCIgICAgICAgIH1cIixcIiAgICB9XCIsXCIgICAgaWYgKGx1bSA8IDAuMykge1wiLFwiICAgICAgICBpZiAobW9kKGdsX0ZyYWdDb29yZC54IC0gZ2xfRnJhZ0Nvb3JkLnkgLSA1LjAsIDEwLjApID09IDAuMCkge1wiLFwiICAgICAgICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAxLjApO1wiLFwiICAgICAgICB9XCIsXCIgICAgfVwiLFwifVwiXX0sYi5Dcm9zc0hhdGNoRmlsdGVyLnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGIuQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlKSxiLkNyb3NzSGF0Y2hGaWx0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yPWIuQmx1cllGaWx0ZXIsT2JqZWN0LmRlZmluZVByb3BlcnR5KGIuQ3Jvc3NIYXRjaEZpbHRlci5wcm90b3R5cGUsXCJibHVyXCIse2dldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVuaWZvcm1zLmJsdXIudmFsdWUvKDEvN2UzKX0sc2V0OmZ1bmN0aW9uKGEpe3RoaXMudW5pZm9ybXMuYmx1ci52YWx1ZT0xLzdlMyphfX0pLGIuUkdCU3BsaXRGaWx0ZXI9ZnVuY3Rpb24oKXtiLkFic3RyYWN0RmlsdGVyLmNhbGwodGhpcyksdGhpcy5wYXNzZXM9W3RoaXNdLHRoaXMudW5pZm9ybXM9e3JlZDp7dHlwZTpcIjJmXCIsdmFsdWU6e3g6MjAseToyMH19LGdyZWVuOnt0eXBlOlwiMmZcIix2YWx1ZTp7eDotMjAseToyMH19LGJsdWU6e3R5cGU6XCIyZlwiLHZhbHVlOnt4OjIwLHk6LTIwfX0sZGltZW5zaW9uczp7dHlwZTpcIjRmdlwiLHZhbHVlOlswLDAsMCwwXX19LHRoaXMuZnJhZ21lbnRTcmM9W1wicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XCIsXCJ2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDtcIixcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXCJ1bmlmb3JtIHZlYzIgcmVkO1wiLFwidW5pZm9ybSB2ZWMyIGdyZWVuO1wiLFwidW5pZm9ybSB2ZWMyIGJsdWU7XCIsXCJ1bmlmb3JtIHZlYzQgZGltZW5zaW9ucztcIixcInVuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyO1wiLFwidm9pZCBtYWluKHZvaWQpIHtcIixcIiAgIGdsX0ZyYWdDb2xvci5yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkICsgcmVkL2RpbWVuc2lvbnMueHkpLnI7XCIsXCIgICBnbF9GcmFnQ29sb3IuZyA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCArIGdyZWVuL2RpbWVuc2lvbnMueHkpLmc7XCIsXCIgICBnbF9GcmFnQ29sb3IuYiA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCArIGJsdWUvZGltZW5zaW9ucy54eSkuYjtcIixcIiAgIGdsX0ZyYWdDb2xvci5hID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkKS5hO1wiLFwifVwiXX0sYi5SR0JTcGxpdEZpbHRlci5wcm90b3R5cGU9T2JqZWN0LmNyZWF0ZShiLkFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSksYi5SR0JTcGxpdEZpbHRlci5wcm90b3R5cGUuY29uc3RydWN0b3I9Yi5SR0JTcGxpdEZpbHRlcixPYmplY3QuZGVmaW5lUHJvcGVydHkoYi5SR0JTcGxpdEZpbHRlci5wcm90b3R5cGUsXCJhbmdsZVwiLHtnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51bmlmb3Jtcy5ibHVyLnZhbHVlLygxLzdlMyl9LHNldDpmdW5jdGlvbihhKXt0aGlzLnVuaWZvcm1zLmJsdXIudmFsdWU9MS83ZTMqYX19KSxcInVuZGVmaW5lZFwiIT10eXBlb2YgZXhwb3J0cz8oXCJ1bmRlZmluZWRcIiE9dHlwZW9mIG1vZHVsZSYmbW9kdWxlLmV4cG9ydHMmJihleHBvcnRzPW1vZHVsZS5leHBvcnRzPWIpLGV4cG9ydHMuUElYST1iKTpcInVuZGVmaW5lZFwiIT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kP2RlZmluZShiKTphLlBJWEk9Yn0pLmNhbGwodGhpcyk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIjFZaVo1U1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uL2Jvd2VyX2NvbXBvbmVudHMvcGl4aS9iaW4vcGl4aS5qc1wiLFwiLy4uL2Jvd2VyX2NvbXBvbmVudHMvcGl4aS9iaW5cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vLyAgICAgVW5kZXJzY29yZS5qcyAxLjYuMFxuLy8gICAgIGh0dHA6Ly91bmRlcnNjb3JlanMub3JnXG4vLyAgICAgKGMpIDIwMDktMjAxNCBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuLy8gICAgIFVuZGVyc2NvcmUgbWF5IGJlIGZyZWVseSBkaXN0cmlidXRlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG5cbihmdW5jdGlvbigpIHtcblxuICAvLyBCYXNlbGluZSBzZXR1cFxuICAvLyAtLS0tLS0tLS0tLS0tLVxuXG4gIC8vIEVzdGFibGlzaCB0aGUgcm9vdCBvYmplY3QsIGB3aW5kb3dgIGluIHRoZSBicm93c2VyLCBvciBgZXhwb3J0c2Agb24gdGhlIHNlcnZlci5cbiAgdmFyIHJvb3QgPSB0aGlzO1xuXG4gIC8vIFNhdmUgdGhlIHByZXZpb3VzIHZhbHVlIG9mIHRoZSBgX2AgdmFyaWFibGUuXG4gIHZhciBwcmV2aW91c1VuZGVyc2NvcmUgPSByb290Ll87XG5cbiAgLy8gRXN0YWJsaXNoIHRoZSBvYmplY3QgdGhhdCBnZXRzIHJldHVybmVkIHRvIGJyZWFrIG91dCBvZiBhIGxvb3AgaXRlcmF0aW9uLlxuICB2YXIgYnJlYWtlciA9IHt9O1xuXG4gIC8vIFNhdmUgYnl0ZXMgaW4gdGhlIG1pbmlmaWVkIChidXQgbm90IGd6aXBwZWQpIHZlcnNpb246XG4gIHZhciBBcnJheVByb3RvID0gQXJyYXkucHJvdG90eXBlLCBPYmpQcm90byA9IE9iamVjdC5wcm90b3R5cGUsIEZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZTtcblxuICAvLyBDcmVhdGUgcXVpY2sgcmVmZXJlbmNlIHZhcmlhYmxlcyBmb3Igc3BlZWQgYWNjZXNzIHRvIGNvcmUgcHJvdG90eXBlcy5cbiAgdmFyXG4gICAgcHVzaCAgICAgICAgICAgICA9IEFycmF5UHJvdG8ucHVzaCxcbiAgICBzbGljZSAgICAgICAgICAgID0gQXJyYXlQcm90by5zbGljZSxcbiAgICBjb25jYXQgICAgICAgICAgID0gQXJyYXlQcm90by5jb25jYXQsXG4gICAgdG9TdHJpbmcgICAgICAgICA9IE9ialByb3RvLnRvU3RyaW5nLFxuICAgIGhhc093blByb3BlcnR5ICAgPSBPYmpQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuICAvLyBBbGwgKipFQ01BU2NyaXB0IDUqKiBuYXRpdmUgZnVuY3Rpb24gaW1wbGVtZW50YXRpb25zIHRoYXQgd2UgaG9wZSB0byB1c2VcbiAgLy8gYXJlIGRlY2xhcmVkIGhlcmUuXG4gIHZhclxuICAgIG5hdGl2ZUZvckVhY2ggICAgICA9IEFycmF5UHJvdG8uZm9yRWFjaCxcbiAgICBuYXRpdmVNYXAgICAgICAgICAgPSBBcnJheVByb3RvLm1hcCxcbiAgICBuYXRpdmVSZWR1Y2UgICAgICAgPSBBcnJheVByb3RvLnJlZHVjZSxcbiAgICBuYXRpdmVSZWR1Y2VSaWdodCAgPSBBcnJheVByb3RvLnJlZHVjZVJpZ2h0LFxuICAgIG5hdGl2ZUZpbHRlciAgICAgICA9IEFycmF5UHJvdG8uZmlsdGVyLFxuICAgIG5hdGl2ZUV2ZXJ5ICAgICAgICA9IEFycmF5UHJvdG8uZXZlcnksXG4gICAgbmF0aXZlU29tZSAgICAgICAgID0gQXJyYXlQcm90by5zb21lLFxuICAgIG5hdGl2ZUluZGV4T2YgICAgICA9IEFycmF5UHJvdG8uaW5kZXhPZixcbiAgICBuYXRpdmVMYXN0SW5kZXhPZiAgPSBBcnJheVByb3RvLmxhc3RJbmRleE9mLFxuICAgIG5hdGl2ZUlzQXJyYXkgICAgICA9IEFycmF5LmlzQXJyYXksXG4gICAgbmF0aXZlS2V5cyAgICAgICAgID0gT2JqZWN0LmtleXMsXG4gICAgbmF0aXZlQmluZCAgICAgICAgID0gRnVuY1Byb3RvLmJpbmQ7XG5cbiAgLy8gQ3JlYXRlIGEgc2FmZSByZWZlcmVuY2UgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0IGZvciB1c2UgYmVsb3cuXG4gIHZhciBfID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iaiBpbnN0YW5jZW9mIF8pIHJldHVybiBvYmo7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIF8pKSByZXR1cm4gbmV3IF8ob2JqKTtcbiAgICB0aGlzLl93cmFwcGVkID0gb2JqO1xuICB9O1xuXG4gIC8vIEV4cG9ydCB0aGUgVW5kZXJzY29yZSBvYmplY3QgZm9yICoqTm9kZS5qcyoqLCB3aXRoXG4gIC8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5IGZvciB0aGUgb2xkIGByZXF1aXJlKClgIEFQSS4gSWYgd2UncmUgaW5cbiAgLy8gdGhlIGJyb3dzZXIsIGFkZCBgX2AgYXMgYSBnbG9iYWwgb2JqZWN0IHZpYSBhIHN0cmluZyBpZGVudGlmaWVyLFxuICAvLyBmb3IgQ2xvc3VyZSBDb21waWxlciBcImFkdmFuY2VkXCIgbW9kZS5cbiAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gXztcbiAgICB9XG4gICAgZXhwb3J0cy5fID0gXztcbiAgfSBlbHNlIHtcbiAgICByb290Ll8gPSBfO1xuICB9XG5cbiAgLy8gQ3VycmVudCB2ZXJzaW9uLlxuICBfLlZFUlNJT04gPSAnMS42LjAnO1xuXG4gIC8vIENvbGxlY3Rpb24gRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gVGhlIGNvcm5lcnN0b25lLCBhbiBgZWFjaGAgaW1wbGVtZW50YXRpb24sIGFrYSBgZm9yRWFjaGAuXG4gIC8vIEhhbmRsZXMgb2JqZWN0cyB3aXRoIHRoZSBidWlsdC1pbiBgZm9yRWFjaGAsIGFycmF5cywgYW5kIHJhdyBvYmplY3RzLlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgZm9yRWFjaGAgaWYgYXZhaWxhYmxlLlxuICB2YXIgZWFjaCA9IF8uZWFjaCA9IF8uZm9yRWFjaCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBvYmo7XG4gICAgaWYgKG5hdGl2ZUZvckVhY2ggJiYgb2JqLmZvckVhY2ggPT09IG5hdGl2ZUZvckVhY2gpIHtcbiAgICAgIG9iai5mb3JFYWNoKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoKSB7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtpXSwgaSwgb2JqKSA9PT0gYnJlYWtlcikgcmV0dXJuO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2tleXNbaV1dLCBrZXlzW2ldLCBvYmopID09PSBicmVha2VyKSByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSByZXN1bHRzIG9mIGFwcGx5aW5nIHRoZSBpdGVyYXRvciB0byBlYWNoIGVsZW1lbnQuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBtYXBgIGlmIGF2YWlsYWJsZS5cbiAgXy5tYXAgPSBfLmNvbGxlY3QgPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHRzO1xuICAgIGlmIChuYXRpdmVNYXAgJiYgb2JqLm1hcCA9PT0gbmF0aXZlTWFwKSByZXR1cm4gb2JqLm1hcChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgcmVzdWx0cy5wdXNoKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgdmFyIHJlZHVjZUVycm9yID0gJ1JlZHVjZSBvZiBlbXB0eSBhcnJheSB3aXRoIG5vIGluaXRpYWwgdmFsdWUnO1xuXG4gIC8vICoqUmVkdWNlKiogYnVpbGRzIHVwIGEgc2luZ2xlIHJlc3VsdCBmcm9tIGEgbGlzdCBvZiB2YWx1ZXMsIGFrYSBgaW5qZWN0YCxcbiAgLy8gb3IgYGZvbGRsYC4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYHJlZHVjZWAgaWYgYXZhaWxhYmxlLlxuICBfLnJlZHVjZSA9IF8uZm9sZGwgPSBfLmluamVjdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIG1lbW8sIGNvbnRleHQpIHtcbiAgICB2YXIgaW5pdGlhbCA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xuICAgIGlmIChvYmogPT0gbnVsbCkgb2JqID0gW107XG4gICAgaWYgKG5hdGl2ZVJlZHVjZSAmJiBvYmoucmVkdWNlID09PSBuYXRpdmVSZWR1Y2UpIHtcbiAgICAgIGlmIChjb250ZXh0KSBpdGVyYXRvciA9IF8uYmluZChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICByZXR1cm4gaW5pdGlhbCA/IG9iai5yZWR1Y2UoaXRlcmF0b3IsIG1lbW8pIDogb2JqLnJlZHVjZShpdGVyYXRvcik7XG4gICAgfVxuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmICghaW5pdGlhbCkge1xuICAgICAgICBtZW1vID0gdmFsdWU7XG4gICAgICAgIGluaXRpYWwgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWVtbyA9IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgbWVtbywgdmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIWluaXRpYWwpIHRocm93IG5ldyBUeXBlRXJyb3IocmVkdWNlRXJyb3IpO1xuICAgIHJldHVybiBtZW1vO1xuICB9O1xuXG4gIC8vIFRoZSByaWdodC1hc3NvY2lhdGl2ZSB2ZXJzaW9uIG9mIHJlZHVjZSwgYWxzbyBrbm93biBhcyBgZm9sZHJgLlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgcmVkdWNlUmlnaHRgIGlmIGF2YWlsYWJsZS5cbiAgXy5yZWR1Y2VSaWdodCA9IF8uZm9sZHIgPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgdmFyIGluaXRpYWwgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcbiAgICBpZiAob2JqID09IG51bGwpIG9iaiA9IFtdO1xuICAgIGlmIChuYXRpdmVSZWR1Y2VSaWdodCAmJiBvYmoucmVkdWNlUmlnaHQgPT09IG5hdGl2ZVJlZHVjZVJpZ2h0KSB7XG4gICAgICBpZiAoY29udGV4dCkgaXRlcmF0b3IgPSBfLmJpbmQoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgICAgcmV0dXJuIGluaXRpYWwgPyBvYmoucmVkdWNlUmlnaHQoaXRlcmF0b3IsIG1lbW8pIDogb2JqLnJlZHVjZVJpZ2h0KGl0ZXJhdG9yKTtcbiAgICB9XG4gICAgdmFyIGxlbmd0aCA9IG9iai5sZW5ndGg7XG4gICAgaWYgKGxlbmd0aCAhPT0gK2xlbmd0aCkge1xuICAgICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICAgIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIH1cbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpbmRleCA9IGtleXMgPyBrZXlzWy0tbGVuZ3RoXSA6IC0tbGVuZ3RoO1xuICAgICAgaWYgKCFpbml0aWFsKSB7XG4gICAgICAgIG1lbW8gPSBvYmpbaW5kZXhdO1xuICAgICAgICBpbml0aWFsID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1lbW8gPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG1lbW8sIG9ialtpbmRleF0sIGluZGV4LCBsaXN0KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIWluaXRpYWwpIHRocm93IG5ldyBUeXBlRXJyb3IocmVkdWNlRXJyb3IpO1xuICAgIHJldHVybiBtZW1vO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgZmlyc3QgdmFsdWUgd2hpY2ggcGFzc2VzIGEgdHJ1dGggdGVzdC4gQWxpYXNlZCBhcyBgZGV0ZWN0YC5cbiAgXy5maW5kID0gXy5kZXRlY3QgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHQ7XG4gICAgYW55KG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAocHJlZGljYXRlLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSkge1xuICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBSZXR1cm4gYWxsIHRoZSBlbGVtZW50cyB0aGF0IHBhc3MgYSB0cnV0aCB0ZXN0LlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgZmlsdGVyYCBpZiBhdmFpbGFibGUuXG4gIC8vIEFsaWFzZWQgYXMgYHNlbGVjdGAuXG4gIF8uZmlsdGVyID0gXy5zZWxlY3QgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0cztcbiAgICBpZiAobmF0aXZlRmlsdGVyICYmIG9iai5maWx0ZXIgPT09IG5hdGl2ZUZpbHRlcikgcmV0dXJuIG9iai5maWx0ZXIocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAocHJlZGljYXRlLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSkgcmVzdWx0cy5wdXNoKHZhbHVlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfTtcblxuICAvLyBSZXR1cm4gYWxsIHRoZSBlbGVtZW50cyBmb3Igd2hpY2ggYSB0cnV0aCB0ZXN0IGZhaWxzLlxuICBfLnJlamVjdCA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgcmV0dXJuIF8uZmlsdGVyKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICByZXR1cm4gIXByZWRpY2F0ZS5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgfSwgY29udGV4dCk7XG4gIH07XG5cbiAgLy8gRGV0ZXJtaW5lIHdoZXRoZXIgYWxsIG9mIHRoZSBlbGVtZW50cyBtYXRjaCBhIHRydXRoIHRlc3QuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBldmVyeWAgaWYgYXZhaWxhYmxlLlxuICAvLyBBbGlhc2VkIGFzIGBhbGxgLlxuICBfLmV2ZXJ5ID0gXy5hbGwgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHByZWRpY2F0ZSB8fCAocHJlZGljYXRlID0gXy5pZGVudGl0eSk7XG4gICAgdmFyIHJlc3VsdCA9IHRydWU7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0O1xuICAgIGlmIChuYXRpdmVFdmVyeSAmJiBvYmouZXZlcnkgPT09IG5hdGl2ZUV2ZXJ5KSByZXR1cm4gb2JqLmV2ZXJ5KHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaWYgKCEocmVzdWx0ID0gcmVzdWx0ICYmIHByZWRpY2F0ZS5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpKSByZXR1cm4gYnJlYWtlcjtcbiAgICB9KTtcbiAgICByZXR1cm4gISFyZXN1bHQ7XG4gIH07XG5cbiAgLy8gRGV0ZXJtaW5lIGlmIGF0IGxlYXN0IG9uZSBlbGVtZW50IGluIHRoZSBvYmplY3QgbWF0Y2hlcyBhIHRydXRoIHRlc3QuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBzb21lYCBpZiBhdmFpbGFibGUuXG4gIC8vIEFsaWFzZWQgYXMgYGFueWAuXG4gIHZhciBhbnkgPSBfLnNvbWUgPSBfLmFueSA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgcHJlZGljYXRlIHx8IChwcmVkaWNhdGUgPSBfLmlkZW50aXR5KTtcbiAgICB2YXIgcmVzdWx0ID0gZmFsc2U7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0O1xuICAgIGlmIChuYXRpdmVTb21lICYmIG9iai5zb21lID09PSBuYXRpdmVTb21lKSByZXR1cm4gb2JqLnNvbWUocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAocmVzdWx0IHx8IChyZXN1bHQgPSBwcmVkaWNhdGUuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKSkgcmV0dXJuIGJyZWFrZXI7XG4gICAgfSk7XG4gICAgcmV0dXJuICEhcmVzdWx0O1xuICB9O1xuXG4gIC8vIERldGVybWluZSBpZiB0aGUgYXJyYXkgb3Igb2JqZWN0IGNvbnRhaW5zIGEgZ2l2ZW4gdmFsdWUgKHVzaW5nIGA9PT1gKS5cbiAgLy8gQWxpYXNlZCBhcyBgaW5jbHVkZWAuXG4gIF8uY29udGFpbnMgPSBfLmluY2x1ZGUgPSBmdW5jdGlvbihvYmosIHRhcmdldCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChuYXRpdmVJbmRleE9mICYmIG9iai5pbmRleE9mID09PSBuYXRpdmVJbmRleE9mKSByZXR1cm4gb2JqLmluZGV4T2YodGFyZ2V0KSAhPSAtMTtcbiAgICByZXR1cm4gYW55KG9iaiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZSA9PT0gdGFyZ2V0O1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIEludm9rZSBhIG1ldGhvZCAod2l0aCBhcmd1bWVudHMpIG9uIGV2ZXJ5IGl0ZW0gaW4gYSBjb2xsZWN0aW9uLlxuICBfLmludm9rZSA9IGZ1bmN0aW9uKG9iaiwgbWV0aG9kKSB7XG4gICAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIGlzRnVuYyA9IF8uaXNGdW5jdGlvbihtZXRob2QpO1xuICAgIHJldHVybiBfLm1hcChvYmosIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gKGlzRnVuYyA/IG1ldGhvZCA6IHZhbHVlW21ldGhvZF0pLmFwcGx5KHZhbHVlLCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBDb252ZW5pZW5jZSB2ZXJzaW9uIG9mIGEgY29tbW9uIHVzZSBjYXNlIG9mIGBtYXBgOiBmZXRjaGluZyBhIHByb3BlcnR5LlxuICBfLnBsdWNrID0gZnVuY3Rpb24ob2JqLCBrZXkpIHtcbiAgICByZXR1cm4gXy5tYXAob2JqLCBfLnByb3BlcnR5KGtleSkpO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYGZpbHRlcmA6IHNlbGVjdGluZyBvbmx5IG9iamVjdHNcbiAgLy8gY29udGFpbmluZyBzcGVjaWZpYyBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy53aGVyZSA9IGZ1bmN0aW9uKG9iaiwgYXR0cnMpIHtcbiAgICByZXR1cm4gXy5maWx0ZXIob2JqLCBfLm1hdGNoZXMoYXR0cnMpKTtcbiAgfTtcblxuICAvLyBDb252ZW5pZW5jZSB2ZXJzaW9uIG9mIGEgY29tbW9uIHVzZSBjYXNlIG9mIGBmaW5kYDogZ2V0dGluZyB0aGUgZmlyc3Qgb2JqZWN0XG4gIC8vIGNvbnRhaW5pbmcgc3BlY2lmaWMgYGtleTp2YWx1ZWAgcGFpcnMuXG4gIF8uZmluZFdoZXJlID0gZnVuY3Rpb24ob2JqLCBhdHRycykge1xuICAgIHJldHVybiBfLmZpbmQob2JqLCBfLm1hdGNoZXMoYXR0cnMpKTtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIG1heGltdW0gZWxlbWVudCBvciAoZWxlbWVudC1iYXNlZCBjb21wdXRhdGlvbikuXG4gIC8vIENhbid0IG9wdGltaXplIGFycmF5cyBvZiBpbnRlZ2VycyBsb25nZXIgdGhhbiA2NSw1MzUgZWxlbWVudHMuXG4gIC8vIFNlZSBbV2ViS2l0IEJ1ZyA4MDc5N10oaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTgwNzk3KVxuICBfLm1heCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpZiAoIWl0ZXJhdG9yICYmIF8uaXNBcnJheShvYmopICYmIG9ialswXSA9PT0gK29ialswXSAmJiBvYmoubGVuZ3RoIDwgNjU1MzUpIHtcbiAgICAgIHJldHVybiBNYXRoLm1heC5hcHBseShNYXRoLCBvYmopO1xuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gLUluZmluaXR5LCBsYXN0Q29tcHV0ZWQgPSAtSW5maW5pdHk7XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgdmFyIGNvbXB1dGVkID0gaXRlcmF0b3IgPyBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkgOiB2YWx1ZTtcbiAgICAgIGlmIChjb21wdXRlZCA+IGxhc3RDb21wdXRlZCkge1xuICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgbGFzdENvbXB1dGVkID0gY29tcHV0ZWQ7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIG1pbmltdW0gZWxlbWVudCAob3IgZWxlbWVudC1iYXNlZCBjb21wdXRhdGlvbikuXG4gIF8ubWluID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmICghaXRlcmF0b3IgJiYgXy5pc0FycmF5KG9iaikgJiYgb2JqWzBdID09PSArb2JqWzBdICYmIG9iai5sZW5ndGggPCA2NTUzNSkge1xuICAgICAgcmV0dXJuIE1hdGgubWluLmFwcGx5KE1hdGgsIG9iaik7XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSBJbmZpbml0eSwgbGFzdENvbXB1dGVkID0gSW5maW5pdHk7XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgdmFyIGNvbXB1dGVkID0gaXRlcmF0b3IgPyBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkgOiB2YWx1ZTtcbiAgICAgIGlmIChjb21wdXRlZCA8IGxhc3RDb21wdXRlZCkge1xuICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgbGFzdENvbXB1dGVkID0gY29tcHV0ZWQ7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBTaHVmZmxlIGFuIGFycmF5LCB1c2luZyB0aGUgbW9kZXJuIHZlcnNpb24gb2YgdGhlXG4gIC8vIFtGaXNoZXItWWF0ZXMgc2h1ZmZsZV0oaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9GaXNoZXLigJNZYXRlc19zaHVmZmxlKS5cbiAgXy5zaHVmZmxlID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIHJhbmQ7XG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICB2YXIgc2h1ZmZsZWQgPSBbXTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJhbmQgPSBfLnJhbmRvbShpbmRleCsrKTtcbiAgICAgIHNodWZmbGVkW2luZGV4IC0gMV0gPSBzaHVmZmxlZFtyYW5kXTtcbiAgICAgIHNodWZmbGVkW3JhbmRdID0gdmFsdWU7XG4gICAgfSk7XG4gICAgcmV0dXJuIHNodWZmbGVkO1xuICB9O1xuXG4gIC8vIFNhbXBsZSAqKm4qKiByYW5kb20gdmFsdWVzIGZyb20gYSBjb2xsZWN0aW9uLlxuICAvLyBJZiAqKm4qKiBpcyBub3Qgc3BlY2lmaWVkLCByZXR1cm5zIGEgc2luZ2xlIHJhbmRvbSBlbGVtZW50LlxuICAvLyBUaGUgaW50ZXJuYWwgYGd1YXJkYCBhcmd1bWVudCBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBtYXBgLlxuICBfLnNhbXBsZSA9IGZ1bmN0aW9uKG9iaiwgbiwgZ3VhcmQpIHtcbiAgICBpZiAobiA9PSBudWxsIHx8IGd1YXJkKSB7XG4gICAgICBpZiAob2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGgpIG9iaiA9IF8udmFsdWVzKG9iaik7XG4gICAgICByZXR1cm4gb2JqW18ucmFuZG9tKG9iai5sZW5ndGggLSAxKV07XG4gICAgfVxuICAgIHJldHVybiBfLnNodWZmbGUob2JqKS5zbGljZSgwLCBNYXRoLm1heCgwLCBuKSk7XG4gIH07XG5cbiAgLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgbG9va3VwIGl0ZXJhdG9ycy5cbiAgdmFyIGxvb2t1cEl0ZXJhdG9yID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgaWYgKF8uaXNGdW5jdGlvbih2YWx1ZSkpIHJldHVybiB2YWx1ZTtcbiAgICByZXR1cm4gXy5wcm9wZXJ0eSh2YWx1ZSk7XG4gIH07XG5cbiAgLy8gU29ydCB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uIHByb2R1Y2VkIGJ5IGFuIGl0ZXJhdG9yLlxuICBfLnNvcnRCeSA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRvciA9IGxvb2t1cEl0ZXJhdG9yKGl0ZXJhdG9yKTtcbiAgICByZXR1cm4gXy5wbHVjayhfLm1hcChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgIGNyaXRlcmlhOiBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdClcbiAgICAgIH07XG4gICAgfSkuc29ydChmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgdmFyIGEgPSBsZWZ0LmNyaXRlcmlhO1xuICAgICAgdmFyIGIgPSByaWdodC5jcml0ZXJpYTtcbiAgICAgIGlmIChhICE9PSBiKSB7XG4gICAgICAgIGlmIChhID4gYiB8fCBhID09PSB2b2lkIDApIHJldHVybiAxO1xuICAgICAgICBpZiAoYSA8IGIgfHwgYiA9PT0gdm9pZCAwKSByZXR1cm4gLTE7XG4gICAgICB9XG4gICAgICByZXR1cm4gbGVmdC5pbmRleCAtIHJpZ2h0LmluZGV4O1xuICAgIH0pLCAndmFsdWUnKTtcbiAgfTtcblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB1c2VkIGZvciBhZ2dyZWdhdGUgXCJncm91cCBieVwiIG9wZXJhdGlvbnMuXG4gIHZhciBncm91cCA9IGZ1bmN0aW9uKGJlaGF2aW9yKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICAgIGl0ZXJhdG9yID0gbG9va3VwSXRlcmF0b3IoaXRlcmF0b3IpO1xuICAgICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICB2YXIga2V5ID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIG9iaik7XG4gICAgICAgIGJlaGF2aW9yKHJlc3VsdCwga2V5LCB2YWx1ZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBHcm91cHMgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbi4gUGFzcyBlaXRoZXIgYSBzdHJpbmcgYXR0cmlidXRlXG4gIC8vIHRvIGdyb3VwIGJ5LCBvciBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgY3JpdGVyaW9uLlxuICBfLmdyb3VwQnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIGtleSwgdmFsdWUpIHtcbiAgICBfLmhhcyhyZXN1bHQsIGtleSkgPyByZXN1bHRba2V5XS5wdXNoKHZhbHVlKSA6IHJlc3VsdFtrZXldID0gW3ZhbHVlXTtcbiAgfSk7XG5cbiAgLy8gSW5kZXhlcyB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uLCBzaW1pbGFyIHRvIGBncm91cEJ5YCwgYnV0IGZvclxuICAvLyB3aGVuIHlvdSBrbm93IHRoYXQgeW91ciBpbmRleCB2YWx1ZXMgd2lsbCBiZSB1bmlxdWUuXG4gIF8uaW5kZXhCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwga2V5LCB2YWx1ZSkge1xuICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gIH0pO1xuXG4gIC8vIENvdW50cyBpbnN0YW5jZXMgb2YgYW4gb2JqZWN0IHRoYXQgZ3JvdXAgYnkgYSBjZXJ0YWluIGNyaXRlcmlvbi4gUGFzc1xuICAvLyBlaXRoZXIgYSBzdHJpbmcgYXR0cmlidXRlIHRvIGNvdW50IGJ5LCBvciBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGVcbiAgLy8gY3JpdGVyaW9uLlxuICBfLmNvdW50QnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIGtleSkge1xuICAgIF8uaGFzKHJlc3VsdCwga2V5KSA/IHJlc3VsdFtrZXldKysgOiByZXN1bHRba2V5XSA9IDE7XG4gIH0pO1xuXG4gIC8vIFVzZSBhIGNvbXBhcmF0b3IgZnVuY3Rpb24gdG8gZmlndXJlIG91dCB0aGUgc21hbGxlc3QgaW5kZXggYXQgd2hpY2hcbiAgLy8gYW4gb2JqZWN0IHNob3VsZCBiZSBpbnNlcnRlZCBzbyBhcyB0byBtYWludGFpbiBvcmRlci4gVXNlcyBiaW5hcnkgc2VhcmNoLlxuICBfLnNvcnRlZEluZGV4ID0gZnVuY3Rpb24oYXJyYXksIG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRvciA9IGxvb2t1cEl0ZXJhdG9yKGl0ZXJhdG9yKTtcbiAgICB2YXIgdmFsdWUgPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9iaik7XG4gICAgdmFyIGxvdyA9IDAsIGhpZ2ggPSBhcnJheS5sZW5ndGg7XG4gICAgd2hpbGUgKGxvdyA8IGhpZ2gpIHtcbiAgICAgIHZhciBtaWQgPSAobG93ICsgaGlnaCkgPj4+IDE7XG4gICAgICBpdGVyYXRvci5jYWxsKGNvbnRleHQsIGFycmF5W21pZF0pIDwgdmFsdWUgPyBsb3cgPSBtaWQgKyAxIDogaGlnaCA9IG1pZDtcbiAgICB9XG4gICAgcmV0dXJuIGxvdztcbiAgfTtcblxuICAvLyBTYWZlbHkgY3JlYXRlIGEgcmVhbCwgbGl2ZSBhcnJheSBmcm9tIGFueXRoaW5nIGl0ZXJhYmxlLlxuICBfLnRvQXJyYXkgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIW9iaikgcmV0dXJuIFtdO1xuICAgIGlmIChfLmlzQXJyYXkob2JqKSkgcmV0dXJuIHNsaWNlLmNhbGwob2JqKTtcbiAgICBpZiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpIHJldHVybiBfLm1hcChvYmosIF8uaWRlbnRpdHkpO1xuICAgIHJldHVybiBfLnZhbHVlcyhvYmopO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIGluIGFuIG9iamVjdC5cbiAgXy5zaXplID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gMDtcbiAgICByZXR1cm4gKG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoKSA/IG9iai5sZW5ndGggOiBfLmtleXMob2JqKS5sZW5ndGg7XG4gIH07XG5cbiAgLy8gQXJyYXkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIEdldCB0aGUgZmlyc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgZmlyc3QgTlxuICAvLyB2YWx1ZXMgaW4gdGhlIGFycmF5LiBBbGlhc2VkIGFzIGBoZWFkYCBhbmQgYHRha2VgLiBUaGUgKipndWFyZCoqIGNoZWNrXG4gIC8vIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5maXJzdCA9IF8uaGVhZCA9IF8udGFrZSA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIGlmICgobiA9PSBudWxsKSB8fCBndWFyZCkgcmV0dXJuIGFycmF5WzBdO1xuICAgIGlmIChuIDwgMCkgcmV0dXJuIFtdO1xuICAgIHJldHVybiBzbGljZS5jYWxsKGFycmF5LCAwLCBuKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGV2ZXJ5dGhpbmcgYnV0IHRoZSBsYXN0IGVudHJ5IG9mIHRoZSBhcnJheS4gRXNwZWNpYWxseSB1c2VmdWwgb25cbiAgLy8gdGhlIGFyZ3VtZW50cyBvYmplY3QuIFBhc3NpbmcgKipuKiogd2lsbCByZXR1cm4gYWxsIHRoZSB2YWx1ZXMgaW5cbiAgLy8gdGhlIGFycmF5LCBleGNsdWRpbmcgdGhlIGxhc3QgTi4gVGhlICoqZ3VhcmQqKiBjaGVjayBhbGxvd3MgaXQgdG8gd29yayB3aXRoXG4gIC8vIGBfLm1hcGAuXG4gIF8uaW5pdGlhbCA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIHJldHVybiBzbGljZS5jYWxsKGFycmF5LCAwLCBhcnJheS5sZW5ndGggLSAoKG4gPT0gbnVsbCkgfHwgZ3VhcmQgPyAxIDogbikpO1xuICB9O1xuXG4gIC8vIEdldCB0aGUgbGFzdCBlbGVtZW50IG9mIGFuIGFycmF5LiBQYXNzaW5nICoqbioqIHdpbGwgcmV0dXJuIHRoZSBsYXN0IE5cbiAgLy8gdmFsdWVzIGluIHRoZSBhcnJheS4gVGhlICoqZ3VhcmQqKiBjaGVjayBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIF8ubGFzdCA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIGlmICgobiA9PSBudWxsKSB8fCBndWFyZCkgcmV0dXJuIGFycmF5W2FycmF5Lmxlbmd0aCAtIDFdO1xuICAgIHJldHVybiBzbGljZS5jYWxsKGFycmF5LCBNYXRoLm1heChhcnJheS5sZW5ndGggLSBuLCAwKSk7XG4gIH07XG5cbiAgLy8gUmV0dXJucyBldmVyeXRoaW5nIGJ1dCB0aGUgZmlyc3QgZW50cnkgb2YgdGhlIGFycmF5LiBBbGlhc2VkIGFzIGB0YWlsYCBhbmQgYGRyb3BgLlxuICAvLyBFc3BlY2lhbGx5IHVzZWZ1bCBvbiB0aGUgYXJndW1lbnRzIG9iamVjdC4gUGFzc2luZyBhbiAqKm4qKiB3aWxsIHJldHVyblxuICAvLyB0aGUgcmVzdCBOIHZhbHVlcyBpbiB0aGUgYXJyYXkuIFRoZSAqKmd1YXJkKipcbiAgLy8gY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgXy5tYXBgLlxuICBfLnJlc3QgPSBfLnRhaWwgPSBfLmRyb3AgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgKG4gPT0gbnVsbCkgfHwgZ3VhcmQgPyAxIDogbik7XG4gIH07XG5cbiAgLy8gVHJpbSBvdXQgYWxsIGZhbHN5IHZhbHVlcyBmcm9tIGFuIGFycmF5LlxuICBfLmNvbXBhY3QgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHJldHVybiBfLmZpbHRlcihhcnJheSwgXy5pZGVudGl0eSk7XG4gIH07XG5cbiAgLy8gSW50ZXJuYWwgaW1wbGVtZW50YXRpb24gb2YgYSByZWN1cnNpdmUgYGZsYXR0ZW5gIGZ1bmN0aW9uLlxuICB2YXIgZmxhdHRlbiA9IGZ1bmN0aW9uKGlucHV0LCBzaGFsbG93LCBvdXRwdXQpIHtcbiAgICBpZiAoc2hhbGxvdyAmJiBfLmV2ZXJ5KGlucHV0LCBfLmlzQXJyYXkpKSB7XG4gICAgICByZXR1cm4gY29uY2F0LmFwcGx5KG91dHB1dCwgaW5wdXQpO1xuICAgIH1cbiAgICBlYWNoKGlucHV0LCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgaWYgKF8uaXNBcnJheSh2YWx1ZSkgfHwgXy5pc0FyZ3VtZW50cyh2YWx1ZSkpIHtcbiAgICAgICAgc2hhbGxvdyA/IHB1c2guYXBwbHkob3V0cHV0LCB2YWx1ZSkgOiBmbGF0dGVuKHZhbHVlLCBzaGFsbG93LCBvdXRwdXQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBvdXRwdXQ7XG4gIH07XG5cbiAgLy8gRmxhdHRlbiBvdXQgYW4gYXJyYXksIGVpdGhlciByZWN1cnNpdmVseSAoYnkgZGVmYXVsdCksIG9yIGp1c3Qgb25lIGxldmVsLlxuICBfLmZsYXR0ZW4gPSBmdW5jdGlvbihhcnJheSwgc2hhbGxvdykge1xuICAgIHJldHVybiBmbGF0dGVuKGFycmF5LCBzaGFsbG93LCBbXSk7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgdmVyc2lvbiBvZiB0aGUgYXJyYXkgdGhhdCBkb2VzIG5vdCBjb250YWluIHRoZSBzcGVjaWZpZWQgdmFsdWUocykuXG4gIF8ud2l0aG91dCA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgcmV0dXJuIF8uZGlmZmVyZW5jZShhcnJheSwgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgfTtcblxuICAvLyBTcGxpdCBhbiBhcnJheSBpbnRvIHR3byBhcnJheXM6IG9uZSB3aG9zZSBlbGVtZW50cyBhbGwgc2F0aXNmeSB0aGUgZ2l2ZW5cbiAgLy8gcHJlZGljYXRlLCBhbmQgb25lIHdob3NlIGVsZW1lbnRzIGFsbCBkbyBub3Qgc2F0aXNmeSB0aGUgcHJlZGljYXRlLlxuICBfLnBhcnRpdGlvbiA9IGZ1bmN0aW9uKGFycmF5LCBwcmVkaWNhdGUpIHtcbiAgICB2YXIgcGFzcyA9IFtdLCBmYWlsID0gW107XG4gICAgZWFjaChhcnJheSwgZnVuY3Rpb24oZWxlbSkge1xuICAgICAgKHByZWRpY2F0ZShlbGVtKSA/IHBhc3MgOiBmYWlsKS5wdXNoKGVsZW0pO1xuICAgIH0pO1xuICAgIHJldHVybiBbcGFzcywgZmFpbF07XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhIGR1cGxpY2F0ZS1mcmVlIHZlcnNpb24gb2YgdGhlIGFycmF5LiBJZiB0aGUgYXJyYXkgaGFzIGFscmVhZHlcbiAgLy8gYmVlbiBzb3J0ZWQsIHlvdSBoYXZlIHRoZSBvcHRpb24gb2YgdXNpbmcgYSBmYXN0ZXIgYWxnb3JpdGhtLlxuICAvLyBBbGlhc2VkIGFzIGB1bmlxdWVgLlxuICBfLnVuaXEgPSBfLnVuaXF1ZSA9IGZ1bmN0aW9uKGFycmF5LCBpc1NvcnRlZCwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpZiAoXy5pc0Z1bmN0aW9uKGlzU29ydGVkKSkge1xuICAgICAgY29udGV4dCA9IGl0ZXJhdG9yO1xuICAgICAgaXRlcmF0b3IgPSBpc1NvcnRlZDtcbiAgICAgIGlzU29ydGVkID0gZmFsc2U7XG4gICAgfVxuICAgIHZhciBpbml0aWFsID0gaXRlcmF0b3IgPyBfLm1hcChhcnJheSwgaXRlcmF0b3IsIGNvbnRleHQpIDogYXJyYXk7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICB2YXIgc2VlbiA9IFtdO1xuICAgIGVhY2goaW5pdGlhbCwgZnVuY3Rpb24odmFsdWUsIGluZGV4KSB7XG4gICAgICBpZiAoaXNTb3J0ZWQgPyAoIWluZGV4IHx8IHNlZW5bc2Vlbi5sZW5ndGggLSAxXSAhPT0gdmFsdWUpIDogIV8uY29udGFpbnMoc2VlbiwgdmFsdWUpKSB7XG4gICAgICAgIHNlZW4ucHVzaCh2YWx1ZSk7XG4gICAgICAgIHJlc3VsdHMucHVzaChhcnJheVtpbmRleF0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIFByb2R1Y2UgYW4gYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdW5pb246IGVhY2ggZGlzdGluY3QgZWxlbWVudCBmcm9tIGFsbCBvZlxuICAvLyB0aGUgcGFzc2VkLWluIGFycmF5cy5cbiAgXy51bmlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfLnVuaXEoXy5mbGF0dGVuKGFyZ3VtZW50cywgdHJ1ZSkpO1xuICB9O1xuXG4gIC8vIFByb2R1Y2UgYW4gYXJyYXkgdGhhdCBjb250YWlucyBldmVyeSBpdGVtIHNoYXJlZCBiZXR3ZWVuIGFsbCB0aGVcbiAgLy8gcGFzc2VkLWluIGFycmF5cy5cbiAgXy5pbnRlcnNlY3Rpb24gPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHZhciByZXN0ID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLmZpbHRlcihfLnVuaXEoYXJyYXkpLCBmdW5jdGlvbihpdGVtKSB7XG4gICAgICByZXR1cm4gXy5ldmVyeShyZXN0LCBmdW5jdGlvbihvdGhlcikge1xuICAgICAgICByZXR1cm4gXy5jb250YWlucyhvdGhlciwgaXRlbSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBUYWtlIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gb25lIGFycmF5IGFuZCBhIG51bWJlciBvZiBvdGhlciBhcnJheXMuXG4gIC8vIE9ubHkgdGhlIGVsZW1lbnRzIHByZXNlbnQgaW4ganVzdCB0aGUgZmlyc3QgYXJyYXkgd2lsbCByZW1haW4uXG4gIF8uZGlmZmVyZW5jZSA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgdmFyIHJlc3QgPSBjb25jYXQuYXBwbHkoQXJyYXlQcm90bywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICByZXR1cm4gXy5maWx0ZXIoYXJyYXksIGZ1bmN0aW9uKHZhbHVlKXsgcmV0dXJuICFfLmNvbnRhaW5zKHJlc3QsIHZhbHVlKTsgfSk7XG4gIH07XG5cbiAgLy8gWmlwIHRvZ2V0aGVyIG11bHRpcGxlIGxpc3RzIGludG8gYSBzaW5nbGUgYXJyYXkgLS0gZWxlbWVudHMgdGhhdCBzaGFyZVxuICAvLyBhbiBpbmRleCBnbyB0b2dldGhlci5cbiAgXy56aXAgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGVuZ3RoID0gXy5tYXgoXy5wbHVjayhhcmd1bWVudHMsICdsZW5ndGgnKS5jb25jYXQoMCkpO1xuICAgIHZhciByZXN1bHRzID0gbmV3IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0c1tpXSA9IF8ucGx1Y2soYXJndW1lbnRzLCAnJyArIGkpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfTtcblxuICAvLyBDb252ZXJ0cyBsaXN0cyBpbnRvIG9iamVjdHMuIFBhc3MgZWl0aGVyIGEgc2luZ2xlIGFycmF5IG9mIGBba2V5LCB2YWx1ZV1gXG4gIC8vIHBhaXJzLCBvciB0d28gcGFyYWxsZWwgYXJyYXlzIG9mIHRoZSBzYW1lIGxlbmd0aCAtLSBvbmUgb2Yga2V5cywgYW5kIG9uZSBvZlxuICAvLyB0aGUgY29ycmVzcG9uZGluZyB2YWx1ZXMuXG4gIF8ub2JqZWN0ID0gZnVuY3Rpb24obGlzdCwgdmFsdWVzKSB7XG4gICAgaWYgKGxpc3QgPT0gbnVsbCkgcmV0dXJuIHt9O1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gbGlzdC5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHZhbHVlcykge1xuICAgICAgICByZXN1bHRbbGlzdFtpXV0gPSB2YWx1ZXNbaV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHRbbGlzdFtpXVswXV0gPSBsaXN0W2ldWzFdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIElmIHRoZSBicm93c2VyIGRvZXNuJ3Qgc3VwcGx5IHVzIHdpdGggaW5kZXhPZiAoSSdtIGxvb2tpbmcgYXQgeW91LCAqKk1TSUUqKiksXG4gIC8vIHdlIG5lZWQgdGhpcyBmdW5jdGlvbi4gUmV0dXJuIHRoZSBwb3NpdGlvbiBvZiB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZiBhblxuICAvLyBpdGVtIGluIGFuIGFycmF5LCBvciAtMSBpZiB0aGUgaXRlbSBpcyBub3QgaW5jbHVkZWQgaW4gdGhlIGFycmF5LlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgaW5kZXhPZmAgaWYgYXZhaWxhYmxlLlxuICAvLyBJZiB0aGUgYXJyYXkgaXMgbGFyZ2UgYW5kIGFscmVhZHkgaW4gc29ydCBvcmRlciwgcGFzcyBgdHJ1ZWBcbiAgLy8gZm9yICoqaXNTb3J0ZWQqKiB0byB1c2UgYmluYXJ5IHNlYXJjaC5cbiAgXy5pbmRleE9mID0gZnVuY3Rpb24oYXJyYXksIGl0ZW0sIGlzU29ydGVkKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiAtMTtcbiAgICB2YXIgaSA9IDAsIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcbiAgICBpZiAoaXNTb3J0ZWQpIHtcbiAgICAgIGlmICh0eXBlb2YgaXNTb3J0ZWQgPT0gJ251bWJlcicpIHtcbiAgICAgICAgaSA9IChpc1NvcnRlZCA8IDAgPyBNYXRoLm1heCgwLCBsZW5ndGggKyBpc1NvcnRlZCkgOiBpc1NvcnRlZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpID0gXy5zb3J0ZWRJbmRleChhcnJheSwgaXRlbSk7XG4gICAgICAgIHJldHVybiBhcnJheVtpXSA9PT0gaXRlbSA/IGkgOiAtMTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG5hdGl2ZUluZGV4T2YgJiYgYXJyYXkuaW5kZXhPZiA9PT0gbmF0aXZlSW5kZXhPZikgcmV0dXJuIGFycmF5LmluZGV4T2YoaXRlbSwgaXNTb3J0ZWQpO1xuICAgIGZvciAoOyBpIDwgbGVuZ3RoOyBpKyspIGlmIChhcnJheVtpXSA9PT0gaXRlbSkgcmV0dXJuIGk7XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBsYXN0SW5kZXhPZmAgaWYgYXZhaWxhYmxlLlxuICBfLmxhc3RJbmRleE9mID0gZnVuY3Rpb24oYXJyYXksIGl0ZW0sIGZyb20pIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIC0xO1xuICAgIHZhciBoYXNJbmRleCA9IGZyb20gIT0gbnVsbDtcbiAgICBpZiAobmF0aXZlTGFzdEluZGV4T2YgJiYgYXJyYXkubGFzdEluZGV4T2YgPT09IG5hdGl2ZUxhc3RJbmRleE9mKSB7XG4gICAgICByZXR1cm4gaGFzSW5kZXggPyBhcnJheS5sYXN0SW5kZXhPZihpdGVtLCBmcm9tKSA6IGFycmF5Lmxhc3RJbmRleE9mKGl0ZW0pO1xuICAgIH1cbiAgICB2YXIgaSA9IChoYXNJbmRleCA/IGZyb20gOiBhcnJheS5sZW5ndGgpO1xuICAgIHdoaWxlIChpLS0pIGlmIChhcnJheVtpXSA9PT0gaXRlbSkgcmV0dXJuIGk7XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIC8vIEdlbmVyYXRlIGFuIGludGVnZXIgQXJyYXkgY29udGFpbmluZyBhbiBhcml0aG1ldGljIHByb2dyZXNzaW9uLiBBIHBvcnQgb2ZcbiAgLy8gdGhlIG5hdGl2ZSBQeXRob24gYHJhbmdlKClgIGZ1bmN0aW9uLiBTZWVcbiAgLy8gW3RoZSBQeXRob24gZG9jdW1lbnRhdGlvbl0oaHR0cDovL2RvY3MucHl0aG9uLm9yZy9saWJyYXJ5L2Z1bmN0aW9ucy5odG1sI3JhbmdlKS5cbiAgXy5yYW5nZSA9IGZ1bmN0aW9uKHN0YXJ0LCBzdG9wLCBzdGVwKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPD0gMSkge1xuICAgICAgc3RvcCA9IHN0YXJ0IHx8IDA7XG4gICAgICBzdGFydCA9IDA7XG4gICAgfVxuICAgIHN0ZXAgPSBhcmd1bWVudHNbMl0gfHwgMTtcblxuICAgIHZhciBsZW5ndGggPSBNYXRoLm1heChNYXRoLmNlaWwoKHN0b3AgLSBzdGFydCkgLyBzdGVwKSwgMCk7XG4gICAgdmFyIGlkeCA9IDA7XG4gICAgdmFyIHJhbmdlID0gbmV3IEFycmF5KGxlbmd0aCk7XG5cbiAgICB3aGlsZShpZHggPCBsZW5ndGgpIHtcbiAgICAgIHJhbmdlW2lkeCsrXSA9IHN0YXJ0O1xuICAgICAgc3RhcnQgKz0gc3RlcDtcbiAgICB9XG5cbiAgICByZXR1cm4gcmFuZ2U7XG4gIH07XG5cbiAgLy8gRnVuY3Rpb24gKGFoZW0pIEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBSZXVzYWJsZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBmb3IgcHJvdG90eXBlIHNldHRpbmcuXG4gIHZhciBjdG9yID0gZnVuY3Rpb24oKXt9O1xuXG4gIC8vIENyZWF0ZSBhIGZ1bmN0aW9uIGJvdW5kIHRvIGEgZ2l2ZW4gb2JqZWN0IChhc3NpZ25pbmcgYHRoaXNgLCBhbmQgYXJndW1lbnRzLFxuICAvLyBvcHRpb25hbGx5KS4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYEZ1bmN0aW9uLmJpbmRgIGlmXG4gIC8vIGF2YWlsYWJsZS5cbiAgXy5iaW5kID0gZnVuY3Rpb24oZnVuYywgY29udGV4dCkge1xuICAgIHZhciBhcmdzLCBib3VuZDtcbiAgICBpZiAobmF0aXZlQmluZCAmJiBmdW5jLmJpbmQgPT09IG5hdGl2ZUJpbmQpIHJldHVybiBuYXRpdmVCaW5kLmFwcGx5KGZ1bmMsIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgaWYgKCFfLmlzRnVuY3Rpb24oZnVuYykpIHRocm93IG5ldyBUeXBlRXJyb3I7XG4gICAgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICByZXR1cm4gYm91bmQgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkpIHJldHVybiBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgY3Rvci5wcm90b3R5cGUgPSBmdW5jLnByb3RvdHlwZTtcbiAgICAgIHZhciBzZWxmID0gbmV3IGN0b3I7XG4gICAgICBjdG9yLnByb3RvdHlwZSA9IG51bGw7XG4gICAgICB2YXIgcmVzdWx0ID0gZnVuYy5hcHBseShzZWxmLCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgIGlmIChPYmplY3QocmVzdWx0KSA9PT0gcmVzdWx0KSByZXR1cm4gcmVzdWx0O1xuICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfTtcbiAgfTtcblxuICAvLyBQYXJ0aWFsbHkgYXBwbHkgYSBmdW5jdGlvbiBieSBjcmVhdGluZyBhIHZlcnNpb24gdGhhdCBoYXMgaGFkIHNvbWUgb2YgaXRzXG4gIC8vIGFyZ3VtZW50cyBwcmUtZmlsbGVkLCB3aXRob3V0IGNoYW5naW5nIGl0cyBkeW5hbWljIGB0aGlzYCBjb250ZXh0LiBfIGFjdHNcbiAgLy8gYXMgYSBwbGFjZWhvbGRlciwgYWxsb3dpbmcgYW55IGNvbWJpbmF0aW9uIG9mIGFyZ3VtZW50cyB0byBiZSBwcmUtZmlsbGVkLlxuICBfLnBhcnRpYWwgPSBmdW5jdGlvbihmdW5jKSB7XG4gICAgdmFyIGJvdW5kQXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcG9zaXRpb24gPSAwO1xuICAgICAgdmFyIGFyZ3MgPSBib3VuZEFyZ3Muc2xpY2UoKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBhcmdzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChhcmdzW2ldID09PSBfKSBhcmdzW2ldID0gYXJndW1lbnRzW3Bvc2l0aW9uKytdO1xuICAgICAgfVxuICAgICAgd2hpbGUgKHBvc2l0aW9uIDwgYXJndW1lbnRzLmxlbmd0aCkgYXJncy5wdXNoKGFyZ3VtZW50c1twb3NpdGlvbisrXSk7XG4gICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIEJpbmQgYSBudW1iZXIgb2YgYW4gb2JqZWN0J3MgbWV0aG9kcyB0byB0aGF0IG9iamVjdC4gUmVtYWluaW5nIGFyZ3VtZW50c1xuICAvLyBhcmUgdGhlIG1ldGhvZCBuYW1lcyB0byBiZSBib3VuZC4gVXNlZnVsIGZvciBlbnN1cmluZyB0aGF0IGFsbCBjYWxsYmFja3NcbiAgLy8gZGVmaW5lZCBvbiBhbiBvYmplY3QgYmVsb25nIHRvIGl0LlxuICBfLmJpbmRBbGwgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgZnVuY3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgaWYgKGZ1bmNzLmxlbmd0aCA9PT0gMCkgdGhyb3cgbmV3IEVycm9yKCdiaW5kQWxsIG11c3QgYmUgcGFzc2VkIGZ1bmN0aW9uIG5hbWVzJyk7XG4gICAgZWFjaChmdW5jcywgZnVuY3Rpb24oZikgeyBvYmpbZl0gPSBfLmJpbmQob2JqW2ZdLCBvYmopOyB9KTtcbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIE1lbW9pemUgYW4gZXhwZW5zaXZlIGZ1bmN0aW9uIGJ5IHN0b3JpbmcgaXRzIHJlc3VsdHMuXG4gIF8ubWVtb2l6ZSA9IGZ1bmN0aW9uKGZ1bmMsIGhhc2hlcikge1xuICAgIHZhciBtZW1vID0ge307XG4gICAgaGFzaGVyIHx8IChoYXNoZXIgPSBfLmlkZW50aXR5KTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIga2V5ID0gaGFzaGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICByZXR1cm4gXy5oYXMobWVtbywga2V5KSA/IG1lbW9ba2V5XSA6IChtZW1vW2tleV0gPSBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykpO1xuICAgIH07XG4gIH07XG5cbiAgLy8gRGVsYXlzIGEgZnVuY3Rpb24gZm9yIHRoZSBnaXZlbiBudW1iZXIgb2YgbWlsbGlzZWNvbmRzLCBhbmQgdGhlbiBjYWxsc1xuICAvLyBpdCB3aXRoIHRoZSBhcmd1bWVudHMgc3VwcGxpZWQuXG4gIF8uZGVsYXkgPSBmdW5jdGlvbihmdW5jLCB3YWl0KSB7XG4gICAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKXsgcmV0dXJuIGZ1bmMuYXBwbHkobnVsbCwgYXJncyk7IH0sIHdhaXQpO1xuICB9O1xuXG4gIC8vIERlZmVycyBhIGZ1bmN0aW9uLCBzY2hlZHVsaW5nIGl0IHRvIHJ1biBhZnRlciB0aGUgY3VycmVudCBjYWxsIHN0YWNrIGhhc1xuICAvLyBjbGVhcmVkLlxuICBfLmRlZmVyID0gZnVuY3Rpb24oZnVuYykge1xuICAgIHJldHVybiBfLmRlbGF5LmFwcGx5KF8sIFtmdW5jLCAxXS5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKSk7XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uLCB0aGF0LCB3aGVuIGludm9rZWQsIHdpbGwgb25seSBiZSB0cmlnZ2VyZWQgYXQgbW9zdCBvbmNlXG4gIC8vIGR1cmluZyBhIGdpdmVuIHdpbmRvdyBvZiB0aW1lLiBOb3JtYWxseSwgdGhlIHRocm90dGxlZCBmdW5jdGlvbiB3aWxsIHJ1blxuICAvLyBhcyBtdWNoIGFzIGl0IGNhbiwgd2l0aG91dCBldmVyIGdvaW5nIG1vcmUgdGhhbiBvbmNlIHBlciBgd2FpdGAgZHVyYXRpb247XG4gIC8vIGJ1dCBpZiB5b3UnZCBsaWtlIHRvIGRpc2FibGUgdGhlIGV4ZWN1dGlvbiBvbiB0aGUgbGVhZGluZyBlZGdlLCBwYXNzXG4gIC8vIGB7bGVhZGluZzogZmFsc2V9YC4gVG8gZGlzYWJsZSBleGVjdXRpb24gb24gdGhlIHRyYWlsaW5nIGVkZ2UsIGRpdHRvLlxuICBfLnRocm90dGxlID0gZnVuY3Rpb24oZnVuYywgd2FpdCwgb3B0aW9ucykge1xuICAgIHZhciBjb250ZXh0LCBhcmdzLCByZXN1bHQ7XG4gICAgdmFyIHRpbWVvdXQgPSBudWxsO1xuICAgIHZhciBwcmV2aW91cyA9IDA7XG4gICAgb3B0aW9ucyB8fCAob3B0aW9ucyA9IHt9KTtcbiAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHByZXZpb3VzID0gb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSA/IDAgOiBfLm5vdygpO1xuICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgIH07XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG5vdyA9IF8ubm93KCk7XG4gICAgICBpZiAoIXByZXZpb3VzICYmIG9wdGlvbnMubGVhZGluZyA9PT0gZmFsc2UpIHByZXZpb3VzID0gbm93O1xuICAgICAgdmFyIHJlbWFpbmluZyA9IHdhaXQgLSAobm93IC0gcHJldmlvdXMpO1xuICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgaWYgKHJlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIHByZXZpb3VzID0gbm93O1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKCF0aW1lb3V0ICYmIG9wdGlvbnMudHJhaWxpbmcgIT09IGZhbHNlKSB7XG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCByZW1haW5pbmcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiwgdGhhdCwgYXMgbG9uZyBhcyBpdCBjb250aW51ZXMgdG8gYmUgaW52b2tlZCwgd2lsbCBub3RcbiAgLy8gYmUgdHJpZ2dlcmVkLiBUaGUgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgaXQgc3RvcHMgYmVpbmcgY2FsbGVkIGZvclxuICAvLyBOIG1pbGxpc2Vjb25kcy4gSWYgYGltbWVkaWF0ZWAgaXMgcGFzc2VkLCB0cmlnZ2VyIHRoZSBmdW5jdGlvbiBvbiB0aGVcbiAgLy8gbGVhZGluZyBlZGdlLCBpbnN0ZWFkIG9mIHRoZSB0cmFpbGluZy5cbiAgXy5kZWJvdW5jZSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIGltbWVkaWF0ZSkge1xuICAgIHZhciB0aW1lb3V0LCBhcmdzLCBjb250ZXh0LCB0aW1lc3RhbXAsIHJlc3VsdDtcblxuICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGxhc3QgPSBfLm5vdygpIC0gdGltZXN0YW1wO1xuICAgICAgaWYgKGxhc3QgPCB3YWl0KSB7XG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0IC0gbGFzdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgaWYgKCFpbW1lZGlhdGUpIHtcbiAgICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICB0aW1lc3RhbXAgPSBfLm5vdygpO1xuICAgICAgdmFyIGNhbGxOb3cgPSBpbW1lZGlhdGUgJiYgIXRpbWVvdXQ7XG4gICAgICBpZiAoIXRpbWVvdXQpIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQpO1xuICAgICAgfVxuICAgICAgaWYgKGNhbGxOb3cpIHtcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBleGVjdXRlZCBhdCBtb3N0IG9uZSB0aW1lLCBubyBtYXR0ZXIgaG93XG4gIC8vIG9mdGVuIHlvdSBjYWxsIGl0LiBVc2VmdWwgZm9yIGxhenkgaW5pdGlhbGl6YXRpb24uXG4gIF8ub25jZSA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICB2YXIgcmFuID0gZmFsc2UsIG1lbW87XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHJhbikgcmV0dXJuIG1lbW87XG4gICAgICByYW4gPSB0cnVlO1xuICAgICAgbWVtbyA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIGZ1bmMgPSBudWxsO1xuICAgICAgcmV0dXJuIG1lbW87XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIHRoZSBmaXJzdCBmdW5jdGlvbiBwYXNzZWQgYXMgYW4gYXJndW1lbnQgdG8gdGhlIHNlY29uZCxcbiAgLy8gYWxsb3dpbmcgeW91IHRvIGFkanVzdCBhcmd1bWVudHMsIHJ1biBjb2RlIGJlZm9yZSBhbmQgYWZ0ZXIsIGFuZFxuICAvLyBjb25kaXRpb25hbGx5IGV4ZWN1dGUgdGhlIG9yaWdpbmFsIGZ1bmN0aW9uLlxuICBfLndyYXAgPSBmdW5jdGlvbihmdW5jLCB3cmFwcGVyKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbCh3cmFwcGVyLCBmdW5jKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBpcyB0aGUgY29tcG9zaXRpb24gb2YgYSBsaXN0IG9mIGZ1bmN0aW9ucywgZWFjaFxuICAvLyBjb25zdW1pbmcgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZnVuY3Rpb24gdGhhdCBmb2xsb3dzLlxuICBfLmNvbXBvc2UgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZnVuY3MgPSBhcmd1bWVudHM7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICBmb3IgKHZhciBpID0gZnVuY3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgYXJncyA9IFtmdW5jc1tpXS5hcHBseSh0aGlzLCBhcmdzKV07XG4gICAgICB9XG4gICAgICByZXR1cm4gYXJnc1swXTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgb25seSBiZSBleGVjdXRlZCBhZnRlciBiZWluZyBjYWxsZWQgTiB0aW1lcy5cbiAgXy5hZnRlciA9IGZ1bmN0aW9uKHRpbWVzLCBmdW5jKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKC0tdGltZXMgPCAxKSB7XG4gICAgICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICB9XG4gICAgfTtcbiAgfTtcblxuICAvLyBPYmplY3QgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBSZXRyaWV2ZSB0aGUgbmFtZXMgb2YgYW4gb2JqZWN0J3MgcHJvcGVydGllcy5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYE9iamVjdC5rZXlzYFxuICBfLmtleXMgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIV8uaXNPYmplY3Qob2JqKSkgcmV0dXJuIFtdO1xuICAgIGlmIChuYXRpdmVLZXlzKSByZXR1cm4gbmF0aXZlS2V5cyhvYmopO1xuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikgaWYgKF8uaGFzKG9iaiwga2V5KSkga2V5cy5wdXNoKGtleSk7XG4gICAgcmV0dXJuIGtleXM7XG4gIH07XG5cbiAgLy8gUmV0cmlldmUgdGhlIHZhbHVlcyBvZiBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICBfLnZhbHVlcyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIHZhciB2YWx1ZXMgPSBuZXcgQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB2YWx1ZXNbaV0gPSBvYmpba2V5c1tpXV07XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXM7XG4gIH07XG5cbiAgLy8gQ29udmVydCBhbiBvYmplY3QgaW50byBhIGxpc3Qgb2YgYFtrZXksIHZhbHVlXWAgcGFpcnMuXG4gIF8ucGFpcnMgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBrZXlzLmxlbmd0aDtcbiAgICB2YXIgcGFpcnMgPSBuZXcgQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBwYWlyc1tpXSA9IFtrZXlzW2ldLCBvYmpba2V5c1tpXV1dO1xuICAgIH1cbiAgICByZXR1cm4gcGFpcnM7XG4gIH07XG5cbiAgLy8gSW52ZXJ0IHRoZSBrZXlzIGFuZCB2YWx1ZXMgb2YgYW4gb2JqZWN0LiBUaGUgdmFsdWVzIG11c3QgYmUgc2VyaWFsaXphYmxlLlxuICBfLmludmVydCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBrZXlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHRbb2JqW2tleXNbaV1dXSA9IGtleXNbaV07XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgc29ydGVkIGxpc3Qgb2YgdGhlIGZ1bmN0aW9uIG5hbWVzIGF2YWlsYWJsZSBvbiB0aGUgb2JqZWN0LlxuICAvLyBBbGlhc2VkIGFzIGBtZXRob2RzYFxuICBfLmZ1bmN0aW9ucyA9IF8ubWV0aG9kcyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBuYW1lcyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChfLmlzRnVuY3Rpb24ob2JqW2tleV0pKSBuYW1lcy5wdXNoKGtleSk7XG4gICAgfVxuICAgIHJldHVybiBuYW1lcy5zb3J0KCk7XG4gIH07XG5cbiAgLy8gRXh0ZW5kIGEgZ2l2ZW4gb2JqZWN0IHdpdGggYWxsIHRoZSBwcm9wZXJ0aWVzIGluIHBhc3NlZC1pbiBvYmplY3QocykuXG4gIF8uZXh0ZW5kID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgZWFjaChzbGljZS5jYWxsKGFyZ3VtZW50cywgMSksIGZ1bmN0aW9uKHNvdXJjZSkge1xuICAgICAgaWYgKHNvdXJjZSkge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICAgIG9ialtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgY29weSBvZiB0aGUgb2JqZWN0IG9ubHkgY29udGFpbmluZyB0aGUgd2hpdGVsaXN0ZWQgcHJvcGVydGllcy5cbiAgXy5waWNrID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGNvcHkgPSB7fTtcbiAgICB2YXIga2V5cyA9IGNvbmNhdC5hcHBseShBcnJheVByb3RvLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIGVhY2goa2V5cywgZnVuY3Rpb24oa2V5KSB7XG4gICAgICBpZiAoa2V5IGluIG9iaikgY29weVtrZXldID0gb2JqW2tleV07XG4gICAgfSk7XG4gICAgcmV0dXJuIGNvcHk7XG4gIH07XG5cbiAgIC8vIFJldHVybiBhIGNvcHkgb2YgdGhlIG9iamVjdCB3aXRob3V0IHRoZSBibGFja2xpc3RlZCBwcm9wZXJ0aWVzLlxuICBfLm9taXQgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgY29weSA9IHt9O1xuICAgIHZhciBrZXlzID0gY29uY2F0LmFwcGx5KEFycmF5UHJvdG8sIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgaWYgKCFfLmNvbnRhaW5zKGtleXMsIGtleSkpIGNvcHlba2V5XSA9IG9ialtrZXldO1xuICAgIH1cbiAgICByZXR1cm4gY29weTtcbiAgfTtcblxuICAvLyBGaWxsIGluIGEgZ2l2ZW4gb2JqZWN0IHdpdGggZGVmYXVsdCBwcm9wZXJ0aWVzLlxuICBfLmRlZmF1bHRzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgZWFjaChzbGljZS5jYWxsKGFyZ3VtZW50cywgMSksIGZ1bmN0aW9uKHNvdXJjZSkge1xuICAgICAgaWYgKHNvdXJjZSkge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICAgIGlmIChvYmpbcHJvcF0gPT09IHZvaWQgMCkgb2JqW3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBDcmVhdGUgYSAoc2hhbGxvdy1jbG9uZWQpIGR1cGxpY2F0ZSBvZiBhbiBvYmplY3QuXG4gIF8uY2xvbmUgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIV8uaXNPYmplY3Qob2JqKSkgcmV0dXJuIG9iajtcbiAgICByZXR1cm4gXy5pc0FycmF5KG9iaikgPyBvYmouc2xpY2UoKSA6IF8uZXh0ZW5kKHt9LCBvYmopO1xuICB9O1xuXG4gIC8vIEludm9rZXMgaW50ZXJjZXB0b3Igd2l0aCB0aGUgb2JqLCBhbmQgdGhlbiByZXR1cm5zIG9iai5cbiAgLy8gVGhlIHByaW1hcnkgcHVycG9zZSBvZiB0aGlzIG1ldGhvZCBpcyB0byBcInRhcCBpbnRvXCIgYSBtZXRob2QgY2hhaW4sIGluXG4gIC8vIG9yZGVyIHRvIHBlcmZvcm0gb3BlcmF0aW9ucyBvbiBpbnRlcm1lZGlhdGUgcmVzdWx0cyB3aXRoaW4gdGhlIGNoYWluLlxuICBfLnRhcCA9IGZ1bmN0aW9uKG9iaiwgaW50ZXJjZXB0b3IpIHtcbiAgICBpbnRlcmNlcHRvcihvYmopO1xuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gSW50ZXJuYWwgcmVjdXJzaXZlIGNvbXBhcmlzb24gZnVuY3Rpb24gZm9yIGBpc0VxdWFsYC5cbiAgdmFyIGVxID0gZnVuY3Rpb24oYSwgYiwgYVN0YWNrLCBiU3RhY2spIHtcbiAgICAvLyBJZGVudGljYWwgb2JqZWN0cyBhcmUgZXF1YWwuIGAwID09PSAtMGAsIGJ1dCB0aGV5IGFyZW4ndCBpZGVudGljYWwuXG4gICAgLy8gU2VlIHRoZSBbSGFybW9ueSBgZWdhbGAgcHJvcG9zYWxdKGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6ZWdhbCkuXG4gICAgaWYgKGEgPT09IGIpIHJldHVybiBhICE9PSAwIHx8IDEgLyBhID09IDEgLyBiO1xuICAgIC8vIEEgc3RyaWN0IGNvbXBhcmlzb24gaXMgbmVjZXNzYXJ5IGJlY2F1c2UgYG51bGwgPT0gdW5kZWZpbmVkYC5cbiAgICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGEgPT09IGI7XG4gICAgLy8gVW53cmFwIGFueSB3cmFwcGVkIG9iamVjdHMuXG4gICAgaWYgKGEgaW5zdGFuY2VvZiBfKSBhID0gYS5fd3JhcHBlZDtcbiAgICBpZiAoYiBpbnN0YW5jZW9mIF8pIGIgPSBiLl93cmFwcGVkO1xuICAgIC8vIENvbXBhcmUgYFtbQ2xhc3NdXWAgbmFtZXMuXG4gICAgdmFyIGNsYXNzTmFtZSA9IHRvU3RyaW5nLmNhbGwoYSk7XG4gICAgaWYgKGNsYXNzTmFtZSAhPSB0b1N0cmluZy5jYWxsKGIpKSByZXR1cm4gZmFsc2U7XG4gICAgc3dpdGNoIChjbGFzc05hbWUpIHtcbiAgICAgIC8vIFN0cmluZ3MsIG51bWJlcnMsIGRhdGVzLCBhbmQgYm9vbGVhbnMgYXJlIGNvbXBhcmVkIGJ5IHZhbHVlLlxuICAgICAgY2FzZSAnW29iamVjdCBTdHJpbmddJzpcbiAgICAgICAgLy8gUHJpbWl0aXZlcyBhbmQgdGhlaXIgY29ycmVzcG9uZGluZyBvYmplY3Qgd3JhcHBlcnMgYXJlIGVxdWl2YWxlbnQ7IHRodXMsIGBcIjVcImAgaXNcbiAgICAgICAgLy8gZXF1aXZhbGVudCB0byBgbmV3IFN0cmluZyhcIjVcIilgLlxuICAgICAgICByZXR1cm4gYSA9PSBTdHJpbmcoYik7XG4gICAgICBjYXNlICdbb2JqZWN0IE51bWJlcl0nOlxuICAgICAgICAvLyBgTmFOYHMgYXJlIGVxdWl2YWxlbnQsIGJ1dCBub24tcmVmbGV4aXZlLiBBbiBgZWdhbGAgY29tcGFyaXNvbiBpcyBwZXJmb3JtZWQgZm9yXG4gICAgICAgIC8vIG90aGVyIG51bWVyaWMgdmFsdWVzLlxuICAgICAgICByZXR1cm4gYSAhPSArYSA/IGIgIT0gK2IgOiAoYSA9PSAwID8gMSAvIGEgPT0gMSAvIGIgOiBhID09ICtiKTtcbiAgICAgIGNhc2UgJ1tvYmplY3QgRGF0ZV0nOlxuICAgICAgY2FzZSAnW29iamVjdCBCb29sZWFuXSc6XG4gICAgICAgIC8vIENvZXJjZSBkYXRlcyBhbmQgYm9vbGVhbnMgdG8gbnVtZXJpYyBwcmltaXRpdmUgdmFsdWVzLiBEYXRlcyBhcmUgY29tcGFyZWQgYnkgdGhlaXJcbiAgICAgICAgLy8gbWlsbGlzZWNvbmQgcmVwcmVzZW50YXRpb25zLiBOb3RlIHRoYXQgaW52YWxpZCBkYXRlcyB3aXRoIG1pbGxpc2Vjb25kIHJlcHJlc2VudGF0aW9uc1xuICAgICAgICAvLyBvZiBgTmFOYCBhcmUgbm90IGVxdWl2YWxlbnQuXG4gICAgICAgIHJldHVybiArYSA9PSArYjtcbiAgICAgIC8vIFJlZ0V4cHMgYXJlIGNvbXBhcmVkIGJ5IHRoZWlyIHNvdXJjZSBwYXR0ZXJucyBhbmQgZmxhZ3MuXG4gICAgICBjYXNlICdbb2JqZWN0IFJlZ0V4cF0nOlxuICAgICAgICByZXR1cm4gYS5zb3VyY2UgPT0gYi5zb3VyY2UgJiZcbiAgICAgICAgICAgICAgIGEuZ2xvYmFsID09IGIuZ2xvYmFsICYmXG4gICAgICAgICAgICAgICBhLm11bHRpbGluZSA9PSBiLm11bHRpbGluZSAmJlxuICAgICAgICAgICAgICAgYS5pZ25vcmVDYXNlID09IGIuaWdub3JlQ2FzZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBhICE9ICdvYmplY3QnIHx8IHR5cGVvZiBiICE9ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gQXNzdW1lIGVxdWFsaXR5IGZvciBjeWNsaWMgc3RydWN0dXJlcy4gVGhlIGFsZ29yaXRobSBmb3IgZGV0ZWN0aW5nIGN5Y2xpY1xuICAgIC8vIHN0cnVjdHVyZXMgaXMgYWRhcHRlZCBmcm9tIEVTIDUuMSBzZWN0aW9uIDE1LjEyLjMsIGFic3RyYWN0IG9wZXJhdGlvbiBgSk9gLlxuICAgIHZhciBsZW5ndGggPSBhU3RhY2subGVuZ3RoO1xuICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgLy8gTGluZWFyIHNlYXJjaC4gUGVyZm9ybWFuY2UgaXMgaW52ZXJzZWx5IHByb3BvcnRpb25hbCB0byB0aGUgbnVtYmVyIG9mXG4gICAgICAvLyB1bmlxdWUgbmVzdGVkIHN0cnVjdHVyZXMuXG4gICAgICBpZiAoYVN0YWNrW2xlbmd0aF0gPT0gYSkgcmV0dXJuIGJTdGFja1tsZW5ndGhdID09IGI7XG4gICAgfVxuICAgIC8vIE9iamVjdHMgd2l0aCBkaWZmZXJlbnQgY29uc3RydWN0b3JzIGFyZSBub3QgZXF1aXZhbGVudCwgYnV0IGBPYmplY3Rgc1xuICAgIC8vIGZyb20gZGlmZmVyZW50IGZyYW1lcyBhcmUuXG4gICAgdmFyIGFDdG9yID0gYS5jb25zdHJ1Y3RvciwgYkN0b3IgPSBiLmNvbnN0cnVjdG9yO1xuICAgIGlmIChhQ3RvciAhPT0gYkN0b3IgJiYgIShfLmlzRnVuY3Rpb24oYUN0b3IpICYmIChhQ3RvciBpbnN0YW5jZW9mIGFDdG9yKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLmlzRnVuY3Rpb24oYkN0b3IpICYmIChiQ3RvciBpbnN0YW5jZW9mIGJDdG9yKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICYmICgnY29uc3RydWN0b3InIGluIGEgJiYgJ2NvbnN0cnVjdG9yJyBpbiBiKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBBZGQgdGhlIGZpcnN0IG9iamVjdCB0byB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gICAgYVN0YWNrLnB1c2goYSk7XG4gICAgYlN0YWNrLnB1c2goYik7XG4gICAgdmFyIHNpemUgPSAwLCByZXN1bHQgPSB0cnVlO1xuICAgIC8vIFJlY3Vyc2l2ZWx5IGNvbXBhcmUgb2JqZWN0cyBhbmQgYXJyYXlzLlxuICAgIGlmIChjbGFzc05hbWUgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgLy8gQ29tcGFyZSBhcnJheSBsZW5ndGhzIHRvIGRldGVybWluZSBpZiBhIGRlZXAgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnkuXG4gICAgICBzaXplID0gYS5sZW5ndGg7XG4gICAgICByZXN1bHQgPSBzaXplID09IGIubGVuZ3RoO1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAvLyBEZWVwIGNvbXBhcmUgdGhlIGNvbnRlbnRzLCBpZ25vcmluZyBub24tbnVtZXJpYyBwcm9wZXJ0aWVzLlxuICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgaWYgKCEocmVzdWx0ID0gZXEoYVtzaXplXSwgYltzaXplXSwgYVN0YWNrLCBiU3RhY2spKSkgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGVlcCBjb21wYXJlIG9iamVjdHMuXG4gICAgICBmb3IgKHZhciBrZXkgaW4gYSkge1xuICAgICAgICBpZiAoXy5oYXMoYSwga2V5KSkge1xuICAgICAgICAgIC8vIENvdW50IHRoZSBleHBlY3RlZCBudW1iZXIgb2YgcHJvcGVydGllcy5cbiAgICAgICAgICBzaXplKys7XG4gICAgICAgICAgLy8gRGVlcCBjb21wYXJlIGVhY2ggbWVtYmVyLlxuICAgICAgICAgIGlmICghKHJlc3VsdCA9IF8uaGFzKGIsIGtleSkgJiYgZXEoYVtrZXldLCBiW2tleV0sIGFTdGFjaywgYlN0YWNrKSkpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBFbnN1cmUgdGhhdCBib3RoIG9iamVjdHMgY29udGFpbiB0aGUgc2FtZSBudW1iZXIgb2YgcHJvcGVydGllcy5cbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgZm9yIChrZXkgaW4gYikge1xuICAgICAgICAgIGlmIChfLmhhcyhiLCBrZXkpICYmICEoc2l6ZS0tKSkgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0ID0gIXNpemU7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFJlbW92ZSB0aGUgZmlyc3Qgb2JqZWN0IGZyb20gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzLlxuICAgIGFTdGFjay5wb3AoKTtcbiAgICBiU3RhY2sucG9wKCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBQZXJmb3JtIGEgZGVlcCBjb21wYXJpc29uIHRvIGNoZWNrIGlmIHR3byBvYmplY3RzIGFyZSBlcXVhbC5cbiAgXy5pc0VxdWFsID0gZnVuY3Rpb24oYSwgYikge1xuICAgIHJldHVybiBlcShhLCBiLCBbXSwgW10pO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gYXJyYXksIHN0cmluZywgb3Igb2JqZWN0IGVtcHR5P1xuICAvLyBBbiBcImVtcHR5XCIgb2JqZWN0IGhhcyBubyBlbnVtZXJhYmxlIG93bi1wcm9wZXJ0aWVzLlxuICBfLmlzRW1wdHkgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIGlmIChfLmlzQXJyYXkob2JqKSB8fCBfLmlzU3RyaW5nKG9iaikpIHJldHVybiBvYmoubGVuZ3RoID09PSAwO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIGlmIChfLmhhcyhvYmosIGtleSkpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGEgRE9NIGVsZW1lbnQ/XG4gIF8uaXNFbGVtZW50ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuICEhKG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDEpO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYW4gYXJyYXk/XG4gIC8vIERlbGVnYXRlcyB0byBFQ01BNSdzIG5hdGl2ZSBBcnJheS5pc0FycmF5XG4gIF8uaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBBcnJheV0nO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFyaWFibGUgYW4gb2JqZWN0P1xuICBfLmlzT2JqZWN0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gT2JqZWN0KG9iaik7XG4gIH07XG5cbiAgLy8gQWRkIHNvbWUgaXNUeXBlIG1ldGhvZHM6IGlzQXJndW1lbnRzLCBpc0Z1bmN0aW9uLCBpc1N0cmluZywgaXNOdW1iZXIsIGlzRGF0ZSwgaXNSZWdFeHAuXG4gIGVhY2goWydBcmd1bWVudHMnLCAnRnVuY3Rpb24nLCAnU3RyaW5nJywgJ051bWJlcicsICdEYXRlJywgJ1JlZ0V4cCddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgX1snaXMnICsgbmFtZV0gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgJyArIG5hbWUgKyAnXSc7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gRGVmaW5lIGEgZmFsbGJhY2sgdmVyc2lvbiBvZiB0aGUgbWV0aG9kIGluIGJyb3dzZXJzIChhaGVtLCBJRSksIHdoZXJlXG4gIC8vIHRoZXJlIGlzbid0IGFueSBpbnNwZWN0YWJsZSBcIkFyZ3VtZW50c1wiIHR5cGUuXG4gIGlmICghXy5pc0FyZ3VtZW50cyhhcmd1bWVudHMpKSB7XG4gICAgXy5pc0FyZ3VtZW50cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuICEhKG9iaiAmJiBfLmhhcyhvYmosICdjYWxsZWUnKSk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIE9wdGltaXplIGBpc0Z1bmN0aW9uYCBpZiBhcHByb3ByaWF0ZS5cbiAgaWYgKHR5cGVvZiAoLy4vKSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIF8uaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbic7XG4gICAgfTtcbiAgfVxuXG4gIC8vIElzIGEgZ2l2ZW4gb2JqZWN0IGEgZmluaXRlIG51bWJlcj9cbiAgXy5pc0Zpbml0ZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBpc0Zpbml0ZShvYmopICYmICFpc05hTihwYXJzZUZsb2F0KG9iaikpO1xuICB9O1xuXG4gIC8vIElzIHRoZSBnaXZlbiB2YWx1ZSBgTmFOYD8gKE5hTiBpcyB0aGUgb25seSBudW1iZXIgd2hpY2ggZG9lcyBub3QgZXF1YWwgaXRzZWxmKS5cbiAgXy5pc05hTiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBfLmlzTnVtYmVyKG9iaikgJiYgb2JqICE9ICtvYmo7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhIGJvb2xlYW4/XG4gIF8uaXNCb29sZWFuID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gdHJ1ZSB8fCBvYmogPT09IGZhbHNlIHx8IHRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBCb29sZWFuXSc7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBlcXVhbCB0byBudWxsP1xuICBfLmlzTnVsbCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IG51bGw7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YXJpYWJsZSB1bmRlZmluZWQ/XG4gIF8uaXNVbmRlZmluZWQgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSB2b2lkIDA7XG4gIH07XG5cbiAgLy8gU2hvcnRjdXQgZnVuY3Rpb24gZm9yIGNoZWNraW5nIGlmIGFuIG9iamVjdCBoYXMgYSBnaXZlbiBwcm9wZXJ0eSBkaXJlY3RseVxuICAvLyBvbiBpdHNlbGYgKGluIG90aGVyIHdvcmRzLCBub3Qgb24gYSBwcm90b3R5cGUpLlxuICBfLmhhcyA9IGZ1bmN0aW9uKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIGhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpO1xuICB9O1xuXG4gIC8vIFV0aWxpdHkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gUnVuIFVuZGVyc2NvcmUuanMgaW4gKm5vQ29uZmxpY3QqIG1vZGUsIHJldHVybmluZyB0aGUgYF9gIHZhcmlhYmxlIHRvIGl0c1xuICAvLyBwcmV2aW91cyBvd25lci4gUmV0dXJucyBhIHJlZmVyZW5jZSB0byB0aGUgVW5kZXJzY29yZSBvYmplY3QuXG4gIF8ubm9Db25mbGljdCA9IGZ1bmN0aW9uKCkge1xuICAgIHJvb3QuXyA9IHByZXZpb3VzVW5kZXJzY29yZTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvLyBLZWVwIHRoZSBpZGVudGl0eSBmdW5jdGlvbiBhcm91bmQgZm9yIGRlZmF1bHQgaXRlcmF0b3JzLlxuICBfLmlkZW50aXR5ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgXy5jb25zdGFudCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuICB9O1xuXG4gIF8ucHJvcGVydHkgPSBmdW5jdGlvbihrZXkpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gb2JqW2tleV07XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgcHJlZGljYXRlIGZvciBjaGVja2luZyB3aGV0aGVyIGFuIG9iamVjdCBoYXMgYSBnaXZlbiBzZXQgb2YgYGtleTp2YWx1ZWAgcGFpcnMuXG4gIF8ubWF0Y2hlcyA9IGZ1bmN0aW9uKGF0dHJzKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuICAgICAgaWYgKG9iaiA9PT0gYXR0cnMpIHJldHVybiB0cnVlOyAvL2F2b2lkIGNvbXBhcmluZyBhbiBvYmplY3QgdG8gaXRzZWxmLlxuICAgICAgZm9yICh2YXIga2V5IGluIGF0dHJzKSB7XG4gICAgICAgIGlmIChhdHRyc1trZXldICE9PSBvYmpba2V5XSlcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH07XG5cbiAgLy8gUnVuIGEgZnVuY3Rpb24gKipuKiogdGltZXMuXG4gIF8udGltZXMgPSBmdW5jdGlvbihuLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIHZhciBhY2N1bSA9IEFycmF5KE1hdGgubWF4KDAsIG4pKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykgYWNjdW1baV0gPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIGkpO1xuICAgIHJldHVybiBhY2N1bTtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSByYW5kb20gaW50ZWdlciBiZXR3ZWVuIG1pbiBhbmQgbWF4IChpbmNsdXNpdmUpLlxuICBfLnJhbmRvbSA9IGZ1bmN0aW9uKG1pbiwgbWF4KSB7XG4gICAgaWYgKG1heCA9PSBudWxsKSB7XG4gICAgICBtYXggPSBtaW47XG4gICAgICBtaW4gPSAwO1xuICAgIH1cbiAgICByZXR1cm4gbWluICsgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbiArIDEpKTtcbiAgfTtcblxuICAvLyBBIChwb3NzaWJseSBmYXN0ZXIpIHdheSB0byBnZXQgdGhlIGN1cnJlbnQgdGltZXN0YW1wIGFzIGFuIGludGVnZXIuXG4gIF8ubm93ID0gRGF0ZS5ub3cgfHwgZnVuY3Rpb24oKSB7IHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTsgfTtcblxuICAvLyBMaXN0IG9mIEhUTUwgZW50aXRpZXMgZm9yIGVzY2FwaW5nLlxuICB2YXIgZW50aXR5TWFwID0ge1xuICAgIGVzY2FwZToge1xuICAgICAgJyYnOiAnJmFtcDsnLFxuICAgICAgJzwnOiAnJmx0OycsXG4gICAgICAnPic6ICcmZ3Q7JyxcbiAgICAgICdcIic6ICcmcXVvdDsnLFxuICAgICAgXCInXCI6ICcmI3gyNzsnXG4gICAgfVxuICB9O1xuICBlbnRpdHlNYXAudW5lc2NhcGUgPSBfLmludmVydChlbnRpdHlNYXAuZXNjYXBlKTtcblxuICAvLyBSZWdleGVzIGNvbnRhaW5pbmcgdGhlIGtleXMgYW5kIHZhbHVlcyBsaXN0ZWQgaW1tZWRpYXRlbHkgYWJvdmUuXG4gIHZhciBlbnRpdHlSZWdleGVzID0ge1xuICAgIGVzY2FwZTogICBuZXcgUmVnRXhwKCdbJyArIF8ua2V5cyhlbnRpdHlNYXAuZXNjYXBlKS5qb2luKCcnKSArICddJywgJ2cnKSxcbiAgICB1bmVzY2FwZTogbmV3IFJlZ0V4cCgnKCcgKyBfLmtleXMoZW50aXR5TWFwLnVuZXNjYXBlKS5qb2luKCd8JykgKyAnKScsICdnJylcbiAgfTtcblxuICAvLyBGdW5jdGlvbnMgZm9yIGVzY2FwaW5nIGFuZCB1bmVzY2FwaW5nIHN0cmluZ3MgdG8vZnJvbSBIVE1MIGludGVycG9sYXRpb24uXG4gIF8uZWFjaChbJ2VzY2FwZScsICd1bmVzY2FwZSddLCBmdW5jdGlvbihtZXRob2QpIHtcbiAgICBfW21ldGhvZF0gPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIGlmIChzdHJpbmcgPT0gbnVsbCkgcmV0dXJuICcnO1xuICAgICAgcmV0dXJuICgnJyArIHN0cmluZykucmVwbGFjZShlbnRpdHlSZWdleGVzW21ldGhvZF0sIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgICAgIHJldHVybiBlbnRpdHlNYXBbbWV0aG9kXVttYXRjaF07XG4gICAgICB9KTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBJZiB0aGUgdmFsdWUgb2YgdGhlIG5hbWVkIGBwcm9wZXJ0eWAgaXMgYSBmdW5jdGlvbiB0aGVuIGludm9rZSBpdCB3aXRoIHRoZVxuICAvLyBgb2JqZWN0YCBhcyBjb250ZXh0OyBvdGhlcndpc2UsIHJldHVybiBpdC5cbiAgXy5yZXN1bHQgPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5KSB7XG4gICAgaWYgKG9iamVjdCA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIHZhciB2YWx1ZSA9IG9iamVjdFtwcm9wZXJ0eV07XG4gICAgcmV0dXJuIF8uaXNGdW5jdGlvbih2YWx1ZSkgPyB2YWx1ZS5jYWxsKG9iamVjdCkgOiB2YWx1ZTtcbiAgfTtcblxuICAvLyBBZGQgeW91ciBvd24gY3VzdG9tIGZ1bmN0aW9ucyB0byB0aGUgVW5kZXJzY29yZSBvYmplY3QuXG4gIF8ubWl4aW4gPSBmdW5jdGlvbihvYmopIHtcbiAgICBlYWNoKF8uZnVuY3Rpb25zKG9iaiksIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHZhciBmdW5jID0gX1tuYW1lXSA9IG9ialtuYW1lXTtcbiAgICAgIF8ucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW3RoaXMuX3dyYXBwZWRdO1xuICAgICAgICBwdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBmdW5jLmFwcGx5KF8sIGFyZ3MpKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gR2VuZXJhdGUgYSB1bmlxdWUgaW50ZWdlciBpZCAodW5pcXVlIHdpdGhpbiB0aGUgZW50aXJlIGNsaWVudCBzZXNzaW9uKS5cbiAgLy8gVXNlZnVsIGZvciB0ZW1wb3JhcnkgRE9NIGlkcy5cbiAgdmFyIGlkQ291bnRlciA9IDA7XG4gIF8udW5pcXVlSWQgPSBmdW5jdGlvbihwcmVmaXgpIHtcbiAgICB2YXIgaWQgPSArK2lkQ291bnRlciArICcnO1xuICAgIHJldHVybiBwcmVmaXggPyBwcmVmaXggKyBpZCA6IGlkO1xuICB9O1xuXG4gIC8vIEJ5IGRlZmF1bHQsIFVuZGVyc2NvcmUgdXNlcyBFUkItc3R5bGUgdGVtcGxhdGUgZGVsaW1pdGVycywgY2hhbmdlIHRoZVxuICAvLyBmb2xsb3dpbmcgdGVtcGxhdGUgc2V0dGluZ3MgdG8gdXNlIGFsdGVybmF0aXZlIGRlbGltaXRlcnMuXG4gIF8udGVtcGxhdGVTZXR0aW5ncyA9IHtcbiAgICBldmFsdWF0ZSAgICA6IC88JShbXFxzXFxTXSs/KSU+L2csXG4gICAgaW50ZXJwb2xhdGUgOiAvPCU9KFtcXHNcXFNdKz8pJT4vZyxcbiAgICBlc2NhcGUgICAgICA6IC88JS0oW1xcc1xcU10rPyklPi9nXG4gIH07XG5cbiAgLy8gV2hlbiBjdXN0b21pemluZyBgdGVtcGxhdGVTZXR0aW5nc2AsIGlmIHlvdSBkb24ndCB3YW50IHRvIGRlZmluZSBhblxuICAvLyBpbnRlcnBvbGF0aW9uLCBldmFsdWF0aW9uIG9yIGVzY2FwaW5nIHJlZ2V4LCB3ZSBuZWVkIG9uZSB0aGF0IGlzXG4gIC8vIGd1YXJhbnRlZWQgbm90IHRvIG1hdGNoLlxuICB2YXIgbm9NYXRjaCA9IC8oLileLztcblxuICAvLyBDZXJ0YWluIGNoYXJhY3RlcnMgbmVlZCB0byBiZSBlc2NhcGVkIHNvIHRoYXQgdGhleSBjYW4gYmUgcHV0IGludG8gYVxuICAvLyBzdHJpbmcgbGl0ZXJhbC5cbiAgdmFyIGVzY2FwZXMgPSB7XG4gICAgXCInXCI6ICAgICAgXCInXCIsXG4gICAgJ1xcXFwnOiAgICAgJ1xcXFwnLFxuICAgICdcXHInOiAgICAgJ3InLFxuICAgICdcXG4nOiAgICAgJ24nLFxuICAgICdcXHQnOiAgICAgJ3QnLFxuICAgICdcXHUyMDI4JzogJ3UyMDI4JyxcbiAgICAnXFx1MjAyOSc6ICd1MjAyOSdcbiAgfTtcblxuICB2YXIgZXNjYXBlciA9IC9cXFxcfCd8XFxyfFxcbnxcXHR8XFx1MjAyOHxcXHUyMDI5L2c7XG5cbiAgLy8gSmF2YVNjcmlwdCBtaWNyby10ZW1wbGF0aW5nLCBzaW1pbGFyIHRvIEpvaG4gUmVzaWcncyBpbXBsZW1lbnRhdGlvbi5cbiAgLy8gVW5kZXJzY29yZSB0ZW1wbGF0aW5nIGhhbmRsZXMgYXJiaXRyYXJ5IGRlbGltaXRlcnMsIHByZXNlcnZlcyB3aGl0ZXNwYWNlLFxuICAvLyBhbmQgY29ycmVjdGx5IGVzY2FwZXMgcXVvdGVzIHdpdGhpbiBpbnRlcnBvbGF0ZWQgY29kZS5cbiAgXy50ZW1wbGF0ZSA9IGZ1bmN0aW9uKHRleHQsIGRhdGEsIHNldHRpbmdzKSB7XG4gICAgdmFyIHJlbmRlcjtcbiAgICBzZXR0aW5ncyA9IF8uZGVmYXVsdHMoe30sIHNldHRpbmdzLCBfLnRlbXBsYXRlU2V0dGluZ3MpO1xuXG4gICAgLy8gQ29tYmluZSBkZWxpbWl0ZXJzIGludG8gb25lIHJlZ3VsYXIgZXhwcmVzc2lvbiB2aWEgYWx0ZXJuYXRpb24uXG4gICAgdmFyIG1hdGNoZXIgPSBuZXcgUmVnRXhwKFtcbiAgICAgIChzZXR0aW5ncy5lc2NhcGUgfHwgbm9NYXRjaCkuc291cmNlLFxuICAgICAgKHNldHRpbmdzLmludGVycG9sYXRlIHx8IG5vTWF0Y2gpLnNvdXJjZSxcbiAgICAgIChzZXR0aW5ncy5ldmFsdWF0ZSB8fCBub01hdGNoKS5zb3VyY2VcbiAgICBdLmpvaW4oJ3wnKSArICd8JCcsICdnJyk7XG5cbiAgICAvLyBDb21waWxlIHRoZSB0ZW1wbGF0ZSBzb3VyY2UsIGVzY2FwaW5nIHN0cmluZyBsaXRlcmFscyBhcHByb3ByaWF0ZWx5LlxuICAgIHZhciBpbmRleCA9IDA7XG4gICAgdmFyIHNvdXJjZSA9IFwiX19wKz0nXCI7XG4gICAgdGV4dC5yZXBsYWNlKG1hdGNoZXIsIGZ1bmN0aW9uKG1hdGNoLCBlc2NhcGUsIGludGVycG9sYXRlLCBldmFsdWF0ZSwgb2Zmc2V0KSB7XG4gICAgICBzb3VyY2UgKz0gdGV4dC5zbGljZShpbmRleCwgb2Zmc2V0KVxuICAgICAgICAucmVwbGFjZShlc2NhcGVyLCBmdW5jdGlvbihtYXRjaCkgeyByZXR1cm4gJ1xcXFwnICsgZXNjYXBlc1ttYXRjaF07IH0pO1xuXG4gICAgICBpZiAoZXNjYXBlKSB7XG4gICAgICAgIHNvdXJjZSArPSBcIicrXFxuKChfX3Q9KFwiICsgZXNjYXBlICsgXCIpKT09bnVsbD8nJzpfLmVzY2FwZShfX3QpKStcXG4nXCI7XG4gICAgICB9XG4gICAgICBpZiAoaW50ZXJwb2xhdGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJytcXG4oKF9fdD0oXCIgKyBpbnRlcnBvbGF0ZSArIFwiKSk9PW51bGw/Jyc6X190KStcXG4nXCI7XG4gICAgICB9XG4gICAgICBpZiAoZXZhbHVhdGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJztcXG5cIiArIGV2YWx1YXRlICsgXCJcXG5fX3ArPSdcIjtcbiAgICAgIH1cbiAgICAgIGluZGV4ID0gb2Zmc2V0ICsgbWF0Y2gubGVuZ3RoO1xuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0pO1xuICAgIHNvdXJjZSArPSBcIic7XFxuXCI7XG5cbiAgICAvLyBJZiBhIHZhcmlhYmxlIGlzIG5vdCBzcGVjaWZpZWQsIHBsYWNlIGRhdGEgdmFsdWVzIGluIGxvY2FsIHNjb3BlLlxuICAgIGlmICghc2V0dGluZ3MudmFyaWFibGUpIHNvdXJjZSA9ICd3aXRoKG9ianx8e30pe1xcbicgKyBzb3VyY2UgKyAnfVxcbic7XG5cbiAgICBzb3VyY2UgPSBcInZhciBfX3QsX19wPScnLF9faj1BcnJheS5wcm90b3R5cGUuam9pbixcIiArXG4gICAgICBcInByaW50PWZ1bmN0aW9uKCl7X19wKz1fX2ouY2FsbChhcmd1bWVudHMsJycpO307XFxuXCIgK1xuICAgICAgc291cmNlICsgXCJyZXR1cm4gX19wO1xcblwiO1xuXG4gICAgdHJ5IHtcbiAgICAgIHJlbmRlciA9IG5ldyBGdW5jdGlvbihzZXR0aW5ncy52YXJpYWJsZSB8fCAnb2JqJywgJ18nLCBzb3VyY2UpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGUuc291cmNlID0gc291cmNlO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YSkgcmV0dXJuIHJlbmRlcihkYXRhLCBfKTtcbiAgICB2YXIgdGVtcGxhdGUgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICByZXR1cm4gcmVuZGVyLmNhbGwodGhpcywgZGF0YSwgXyk7XG4gICAgfTtcblxuICAgIC8vIFByb3ZpZGUgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uIHNvdXJjZSBhcyBhIGNvbnZlbmllbmNlIGZvciBwcmVjb21waWxhdGlvbi5cbiAgICB0ZW1wbGF0ZS5zb3VyY2UgPSAnZnVuY3Rpb24oJyArIChzZXR0aW5ncy52YXJpYWJsZSB8fCAnb2JqJykgKyAnKXtcXG4nICsgc291cmNlICsgJ30nO1xuXG4gICAgcmV0dXJuIHRlbXBsYXRlO1xuICB9O1xuXG4gIC8vIEFkZCBhIFwiY2hhaW5cIiBmdW5jdGlvbiwgd2hpY2ggd2lsbCBkZWxlZ2F0ZSB0byB0aGUgd3JhcHBlci5cbiAgXy5jaGFpbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBfKG9iaikuY2hhaW4oKTtcbiAgfTtcblxuICAvLyBPT1BcbiAgLy8gLS0tLS0tLS0tLS0tLS0tXG4gIC8vIElmIFVuZGVyc2NvcmUgaXMgY2FsbGVkIGFzIGEgZnVuY3Rpb24sIGl0IHJldHVybnMgYSB3cmFwcGVkIG9iamVjdCB0aGF0XG4gIC8vIGNhbiBiZSB1c2VkIE9PLXN0eWxlLiBUaGlzIHdyYXBwZXIgaG9sZHMgYWx0ZXJlZCB2ZXJzaW9ucyBvZiBhbGwgdGhlXG4gIC8vIHVuZGVyc2NvcmUgZnVuY3Rpb25zLiBXcmFwcGVkIG9iamVjdHMgbWF5IGJlIGNoYWluZWQuXG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGNvbnRpbnVlIGNoYWluaW5nIGludGVybWVkaWF0ZSByZXN1bHRzLlxuICB2YXIgcmVzdWx0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NoYWluID8gXyhvYmopLmNoYWluKCkgOiBvYmo7XG4gIH07XG5cbiAgLy8gQWRkIGFsbCBvZiB0aGUgVW5kZXJzY29yZSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIgb2JqZWN0LlxuICBfLm1peGluKF8pO1xuXG4gIC8vIEFkZCBhbGwgbXV0YXRvciBBcnJheSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIuXG4gIGVhY2goWydwb3AnLCAncHVzaCcsICdyZXZlcnNlJywgJ3NoaWZ0JywgJ3NvcnQnLCAnc3BsaWNlJywgJ3Vuc2hpZnQnXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBtZXRob2QgPSBBcnJheVByb3RvW25hbWVdO1xuICAgIF8ucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgb2JqID0gdGhpcy5fd3JhcHBlZDtcbiAgICAgIG1ldGhvZC5hcHBseShvYmosIGFyZ3VtZW50cyk7XG4gICAgICBpZiAoKG5hbWUgPT0gJ3NoaWZ0JyB8fCBuYW1lID09ICdzcGxpY2UnKSAmJiBvYmoubGVuZ3RoID09PSAwKSBkZWxldGUgb2JqWzBdO1xuICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIG9iaik7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gQWRkIGFsbCBhY2Nlc3NvciBBcnJheSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIuXG4gIGVhY2goWydjb25jYXQnLCAnam9pbicsICdzbGljZSddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG1ldGhvZCA9IEFycmF5UHJvdG9bbmFtZV07XG4gICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBtZXRob2QuYXBwbHkodGhpcy5fd3JhcHBlZCwgYXJndW1lbnRzKSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgXy5leHRlbmQoXy5wcm90b3R5cGUsIHtcblxuICAgIC8vIFN0YXJ0IGNoYWluaW5nIGEgd3JhcHBlZCBVbmRlcnNjb3JlIG9iamVjdC5cbiAgICBjaGFpbjogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLl9jaGFpbiA9IHRydWU7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLy8gRXh0cmFjdHMgdGhlIHJlc3VsdCBmcm9tIGEgd3JhcHBlZCBhbmQgY2hhaW5lZCBvYmplY3QuXG4gICAgdmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3dyYXBwZWQ7XG4gICAgfVxuXG4gIH0pO1xuXG4gIC8vIEFNRCByZWdpc3RyYXRpb24gaGFwcGVucyBhdCB0aGUgZW5kIGZvciBjb21wYXRpYmlsaXR5IHdpdGggQU1EIGxvYWRlcnNcbiAgLy8gdGhhdCBtYXkgbm90IGVuZm9yY2UgbmV4dC10dXJuIHNlbWFudGljcyBvbiBtb2R1bGVzLiBFdmVuIHRob3VnaCBnZW5lcmFsXG4gIC8vIHByYWN0aWNlIGZvciBBTUQgcmVnaXN0cmF0aW9uIGlzIHRvIGJlIGFub255bW91cywgdW5kZXJzY29yZSByZWdpc3RlcnNcbiAgLy8gYXMgYSBuYW1lZCBtb2R1bGUgYmVjYXVzZSwgbGlrZSBqUXVlcnksIGl0IGlzIGEgYmFzZSBsaWJyYXJ5IHRoYXQgaXNcbiAgLy8gcG9wdWxhciBlbm91Z2ggdG8gYmUgYnVuZGxlZCBpbiBhIHRoaXJkIHBhcnR5IGxpYiwgYnV0IG5vdCBiZSBwYXJ0IG9mXG4gIC8vIGFuIEFNRCBsb2FkIHJlcXVlc3QuIFRob3NlIGNhc2VzIGNvdWxkIGdlbmVyYXRlIGFuIGVycm9yIHdoZW4gYW5cbiAgLy8gYW5vbnltb3VzIGRlZmluZSgpIGlzIGNhbGxlZCBvdXRzaWRlIG9mIGEgbG9hZGVyIHJlcXVlc3QuXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoJ3VuZGVyc2NvcmUnLCBbXSwgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gXztcbiAgICB9KTtcbiAgfVxufSkuY2FsbCh0aGlzKTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCIxWWlaNVNcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi9ib3dlcl9jb21wb25lbnRzL3VuZGVyc2NvcmUvdW5kZXJzY29yZS5qc1wiLFwiLy4uL2Jvd2VyX2NvbXBvbmVudHMvdW5kZXJzY29yZVwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8qKlxuICogQ3JlYXRlZCBieSBhcmxhbmRvIG9uIDcvMjYvMTQuXG4gKi9cbid1c2Ugc3RyaWN0JztcbnZhciBhc3luYyA9IHJlcXVpcmUoJy4uL2Jvd2VyX2NvbXBvbmVudHMvYXN5bmMvbGliL2FzeW5jJyk7XG52YXIgXyA9IHJlcXVpcmUoJy4uL2Jvd2VyX2NvbXBvbmVudHMvdW5kZXJzY29yZS91bmRlcnNjb3JlJyk7XG5cbmZ1bmN0aW9uIEFkamFjZW5jeUxpc3QoZ3JhcGhpY3MsIGdyaWQpIHtcbiAgICAgICAgaWYgKGdyYXBoaWNzID09PSB2b2lkIDApIHRocm93IG5ldyBFcnJvcignTXVzdCBoYXZlIGEgZ3JhcGhpY3MhJyk7XG4gICAgICAgIGlmIChncmlkID09PSB2b2lkIDApIHRocm93IG5ldyBFcnJvcignTXVzdCBoYXZlIGEgZ3JpZCEnKTtcbiAgICAgICAgdGhpcy5zZXR1cChncmFwaGljcywgZ3JpZCk7XG59XG5cbkFkamFjZW5jeUxpc3QucHJvdG90eXBlID0ge1xuICAgIHNldHVwOiBmdW5jdGlvbiAoZ3JhcGhpY3MsIGdyaWQpIHtcbiAgICAgICAgdGhpcy5saXN0ID0ge307XG4gICAgICAgIHRoaXMubm9kZUxpc3QgPSBbXTtcbiAgICAgICAgdGhpcy5jdXJyTm9kZUlkID0gMDtcbiAgICAgICAgdGhpcy5ncmlkID0gZ3JpZDtcbiAgICAgICAgdGhpcy5ncmFwaGljcyA9IGdyYXBoaWNzO1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIGkgLSBncmlkIG5vZGVcbiAgICAgKiBAcGFyYW0gbm9kZVxuICAgICAqL1xuICAgIGFkZE5vZGU6IGZ1bmN0aW9uIChpLCBub2RlKSB7XG4gICAgICAgIG5vZGUuc2V0SWQodGhpcy5jdXJyTm9kZUlkKTtcbiAgICAgICAgdGhpcy5saXN0W25vZGUuZ2V0SWQoKV0gPSBub2RlO1xuICAgICAgICB0aGlzLm5vZGVMaXN0LnB1c2gobm9kZSk7XG4gICAgICAgIHRoaXMuZ3JpZC5hZGRPYmplY3RUb0FHcmlkTm9kZShpLCBub2RlKTtcbiAgICAgICAgdGhpcy5jdXJyTm9kZUlkKys7XG4gICAgfSxcblxuICAgIGFkZEVkZ2U6IGZ1bmN0aW9uIChub2RlMSwgbm9kZTIpIHtcbiAgICAgICAgbm9kZTEuYWRkQ29ubmVjdGlvbihub2RlMik7XG4gICAgICAgIG5vZGUyLmFkZENvbm5lY3Rpb24obm9kZTEpO1xuICAgIH0sXG5cbiAgICByZW1vdmVFZGdlOiBmdW5jdGlvbiAobm9kZTEsIG5vZGUyKSB7XG4gICAgICAgIG5vZGUxLnJlbW92ZUNvbm5lY3Rpb24obm9kZTIpO1xuICAgICAgICBub2RlMi5yZW1vdmVDb25uZWN0aW9uKG5vZGUxKTtcbiAgICB9LFxuXG4gICAgaXNFbXB0eTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5saXN0KS5sZW5ndGggPT09IDA7XG4gICAgfSxcblxuICAgIGRyYXc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuZ3JhcGhpY3MgPT09IHZvaWQgMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGRyYXcgd2l0aG91dCBncmFwaGljcy5cIik7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBkcmF3TGlzdCA9IF8uY2xvbmUodGhpcy5ub2RlTGlzdCk7IC8vRG8gbm90IHdhbnQgdG8gbXV0YXRlIGFjdHVhbCBsaXN0LlxuICAgICAgICBfLmZvckVhY2goZHJhd0xpc3QsIHRoaXMuX3JlbW92ZU5vZGVGcm9tT3RoZXJMaXN0cywgdGhpcyk7XG4gICAgICAgIGFzeW5jLnNlcmllcyh7XG4vLyAgICAgICAgICAgIHJlbW92ZU5vZGVzRnJvbU90aGVyTGlzdHM6IGZ1bmN0aW9uICgpIHtcbi8vXG4vLyAgICAgICAgICAgICAgICBhc3luYy5lYWNoKHNlbGYuZHJhd0xpc3QsIHNlbGYuX3JlbW92ZU5vZGVGcm9tT3RoZXJMaXN0cywgZnVuY3Rpb24gKGVycikge1xuLy8gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbi8vICAgICAgICAgICAgICAgIH0pO1xuLy8gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZHJhd0VkZ2VzOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBhc3luYy5lYWNoKGRyYXdMaXN0LCBzZWxmLl9kcmF3RWRnZS5iaW5kKHNlbGYpLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZygneicpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZHJhd0xpc3QpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRyYXdOb2RlczogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgYXN5bmMuZWFjaChkcmF3TGlzdCwgc2VsZi5fZHJhd05vZGUuYmluZChzZWxmKSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB0aHJvdyBlcnI7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZHJhd0xpc3QpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgICAgfSk7XG4gICAgICAgIC8vXy5mb3JFYWNoKHRoaXMuZHJhd0xpc3QsIHRoaXMucmVtb3ZlTm9kZUZyb21PdGhlckxpc3RzLCB0aGlzKTtcbiAgICAgICAgLy9fLmZvckVhY2godGhpcy5kcmF3TGlzdCwgdGhpcy5fZHJhd0VkZ2UsIHRoaXMpO1xuICAgICAgICAvL18uZm9yRWFjaCh0aGlzLmRyYXdMaXN0LCB0aGlzLl9kcmF3Tm9kZSwgdGhpcyk7XG4gICAgfSxcblxuICAgIF9yZW1vdmVOb2RlRnJvbU90aGVyTGlzdHM6IGZ1bmN0aW9uIChub2RlLCBjYWxsYmFjaykge1xuICAgICAgICBfLmVhY2gobm9kZS5nZXRDb25uZWN0aW9ucygpLCBmdW5jdGlvbiAoY29ubmVjdGVkTm9kZSkge1xuICAgICAgICAgICAgLy9yZW1vdmUgdGhlIGN1cnJlbnQgbm9kZSBmcm9tIHRoZSBjb25uZWN0IG5vZGUncyBsaXN0IG9mIGNvbm5lY3Rpb25zXG4gICAgICAgICAgICBjb25uZWN0ZWROb2RlLnJlbW92ZUNvbm5lY3Rpb24obm9kZSk7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgICAgICAvL2NhbGxiYWNrKCk7XG4gICAgfSxcblxuICAgIC8vVE9ETyBCRVRURVIgUFJJVkFURSBGVU5DVElPTlNcbiAgICBfZHJhd05vZGU6IGZ1bmN0aW9uIChub2RlLCBjYWxsYmFjaykge1xuICAgICAgICBub2RlLmRyYXcodGhpcy5ncmFwaGljcyk7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgfSxcblxuICAgIC8vVE9ETyBCRVRURVIgUFJJVkFURSBGVU5DVElPTlNcbiAgICBfZHJhd0VkZ2U6IGZ1bmN0aW9uIChub2RlLCBjYWxsYmFjaykge1xuICAgICAgICBfLmVhY2gobm9kZS5nZXRDb25uZWN0aW9ucygpLCBmdW5jdGlvbihjb25uZWN0ZWROb2RlKSB7XG4gICAgICAgICAgICB0aGlzLmRyYXdDb25uZWN0aW9uKG5vZGUsIGNvbm5lY3RlZE5vZGUpO1xuICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBsaW5lIGNvbm5lY3RpbmcgdHdvIG5vZGVzLlxuICAgICAqIEBwYXJhbSBub2RlMVxuICAgICAqIEBwYXJhbSBub2RlMlxuICAgICAqL1xuICAgIGRyYXdDb25uZWN0aW9uOiBmdW5jdGlvbihub2RlMSwgbm9kZTIpIHtcbiAgICAgICAgLy8gc2V0IGEgZmlsbCBhbmQgbGluZSBzdHlsZSBhZ2FpblxuICAgICAgICB0aGlzLmdyYXBoaWNzLmxpbmVTdHlsZSgxMCwgMHhGRjAwMDAsIDAuOCk7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3MuYmVnaW5GaWxsKDB4RkY3MDBCLCAxKTtcblxuICAgICAgICAvLyBkcmF3IGEgc2Vjb25kIHNoYXBlXG4gICAgICAgIHRoaXMuZ3JhcGhpY3MubW92ZVRvKG5vZGUxLmdldExvY2F0aW9uKCkueCwgbm9kZTEuZ2V0TG9jYXRpb24oKS55KTtcbiAgICAgICAgLy90aGlzLmdyYXBoaWNzLmxpbmVUbyhub2RlMS5nZXRMb2NhdGlvbigpLngsIG5vZGUxLmdldExvY2F0aW9uKCkueSk7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3MubGluZVRvKG5vZGUyLmdldExvY2F0aW9uKCkueCwgbm9kZTIuZ2V0TG9jYXRpb24oKS55KTtcbiAgICAgICAgdGhpcy5ncmFwaGljcy5lbmRGaWxsKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIERyYXdzIHRoZSB1bmRlcmx5aW5nIGdyaWQgc3RydWN0dXJlXG4gICAgICovXG4gICAgZHJhd0dyaWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5ncmlkLmRyYXcodGhpcy5ncmFwaGljcyk7XG4gICAgfVxuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFkamFjZW5jeUxpc3Q7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIjFZaVo1U1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0FkamFjZW5jeUxpc3QuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKipcbiAqIENyZWF0ZWQgYnkgYXJsYW5kbyBvbiA3LzI2LzE0LlxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBWZWN0b3IgPSByZXF1aXJlKCcuL1ZlY3RvcicpO1xudmFyIFNFVFRJTkdTID0gcmVxdWlyZSgnLi9TRVRUSU5HUycpLkdSSUQ7XG5cbmZ1bmN0aW9uIEdyaWQoKSB7XG4gICAgdGhpcy5zZXR1cCgpO1xufVxuXG5HcmlkLnByb3RvdHlwZSA9IHtcbiAgICBzZXR1cDogZnVuY3Rpb24odmVjdG9yKSB7XG4gICAgICAgIHRoaXMuX1ZlY3RvciA9IHZlY3RvciB8fCBWZWN0b3I7IC8vZGVwZW5kZW5jeSBpbmplY3Rpb25cbiAgICAgICAgdGhpcy5ub2RlcyA9IHt9O1xuICAgICAgICB0aGlzLmluaXRpYWxpemVOb2RlcygpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVQb3NpdGlvbnMoKTtcbiAgICB9LFxuXG4gICAgZ2V0Tm9kZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ub2RlcztcbiAgICB9LFxuXG4gICAgZ2V0TnVtYmVyb2ZOb2RlczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLm5vZGVzKS5sZW5ndGg7XG4gICAgfSxcblxuICAgIGFkZE9iamVjdFRvQUdyaWROb2RlOiBmdW5jdGlvbihpLCBvYmopIHtcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLm5vZGVzW2ldO1xuICAgICAgICBub2RlLm9iamVjdCA9IG9iajtcbiAgICAgICAgaWYgKG9iai5zZXRMb2NhdGlvbikge1xuICAgICAgICAgICAgb2JqLnNldExvY2F0aW9uKG5vZGUubG9jYXRpb24pO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIGdldEdyaWROb2RlOiBmdW5jdGlvbihpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm5vZGVzW2ldO1xuICAgIH0sXG5cbiAgICBpbml0aWFsaXplTm9kZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbnVtYmVyT2ZOb2RlcyA9IDA7XG4gICAgICAgIHdoaWxlIChudW1iZXJPZk5vZGVzIDwgU0VUVElOR1MuTUFYX05PREVTX1ggKiBTRVRUSU5HUy5NQVhfTk9ERVNfWSkge1xuICAgICAgICAgICAgdGhpcy5ub2Rlc1tudW1iZXJPZk5vZGVzXSA9IHt9O1xuICAgICAgICAgICAgbnVtYmVyT2ZOb2RlcysrO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIGluaXRpYWxpemVQb3NpdGlvbnM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG51bWJlck9mTm9kZXMgPSAwO1xuICAgICAgICB2YXIgeCA9IDA7XG4gICAgICAgIGZvciAoeDsgeCA8IFNFVFRJTkdTLk1BWF9OT0RFU19YOyB4KyspIHtcbiAgICAgICAgICAgIHZhciB5ID0gMDtcbiAgICAgICAgICAgIGZvciAoeTsgeSA8IFNFVFRJTkdTLk1BWF9OT0RFU19ZOyB5KyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLm5vZGVzW251bWJlck9mTm9kZXNdLmxvY2F0aW9uID0gT2JqZWN0LmZyZWV6ZShuZXcgdGhpcy5fVmVjdG9yKHggKiBTRVRUSU5HUy5TVEVQX1gsIHkgKiBTRVRUSU5HUy5TVEVQX1kpKTtcbiAgICAgICAgICAgICAgICBudW1iZXJPZk5vZGVzKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgZHJhdzogZnVuY3Rpb24gKGdyYXBoaWNzKSB7XG4gICAgICAgIGZvcih2YXIgaSBpbiB0aGlzLm5vZGVzKSB7XG4gICAgICAgICAgICBncmFwaGljcy5kcmF3Q2lyY2xlKHRoaXMubm9kZXNbaV0ubG9jYXRpb24ueCwgdGhpcy5ub2Rlc1tpXS5sb2NhdGlvbi55LCA1MCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdyaWQ7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIjFZaVo1U1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0dyaWQuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKipcbiAqIENyZWF0ZWQgYnkgYXJsYW5kbyBvbiA3LzI2LzE0LlxuICovXG4ndXNlIHN0cmljdCc7XG52YXIgVmVjdG9yID0gcmVxdWlyZSgnLi9WZWN0b3InKTtcbnZhciBTRVRUSU5HUyA9IHJlcXVpcmUoJy4vU0VUVElOR1MnKS5OT0RFO1xuXG5mdW5jdGlvbiBOb2RlKCkge1xuICAgIHRoaXMuc2V0dXAoKTtcbn1cblxuTm9kZS5wcm90b3R5cGUgPSB7XG4gICAgc2V0dXA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0aW9ucyA9IHt9O1xuICAgICAgICB0aGlzLnNldElkKDApO1xuICAgIH0sXG5cbiAgICBzZXRJZDogZnVuY3Rpb24oaWQpIHtcbiAgICAgICAgdGhpcy5pZCA9IGlkO1xuICAgIH0sXG5cbiAgICBnZXRJZDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlkO1xuICAgIH0sXG5cbiAgICBnZXRDb25uZWN0aW9uczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbm5lY3Rpb25zO1xuICAgIH0sXG5cbiAgICBzZXRMb2NhdGlvbjogZnVuY3Rpb24gKHZlY3Rvcikge1xuICAgICAgICBpZiAodmVjdG9yIGluc3RhbmNlb2YgVmVjdG9yKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2F0aW9uID0gdmVjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdEbyBub3Qga25vdyB3aGF0IHRvIGRvIHdpdGggYSBub24gVmVjdG9yIGluc3RhbmNlLicpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIGdldExvY2F0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYXRpb247XG4gICAgfSxcblxuICAgIGFkZENvbm5lY3Rpb246IGZ1bmN0aW9uIChub2RlVG9BZGQpIHtcbiAgICAgICAgdmFyIGNhbkFkZCA9IGZhbHNlO1xuICAgICAgICAvL0RvIG5vdCBhZGQgc2VsZlxuICAgICAgICBpZiAodGhpcy5nZXRJZCgpID09PSBub2RlVG9BZGQuZ2V0SWQoKSkge1xuICAgICAgICAgICAgY2FuQWRkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvL0RvIG5vdCBhZGQgbm9kZXMgYWxyZWFkeSBoYXZlIGJlZW4gYWRkZWQuXG4gICAgICAgIGlmICh0aGlzLmNvbm5lY3Rpb25zW25vZGVUb0FkZC5nZXRJZCgpXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjYW5BZGQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNhbkFkZCkge1xuICAgICAgICAgICAgdGhpcy5jb25uZWN0aW9uc1tub2RlVG9BZGQuZ2V0SWQoKV0gPSBub2RlVG9BZGQ7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgcmVtb3ZlQ29ubmVjdGlvbjogZnVuY3Rpb24gKG5vZGVUb1JlbW92ZSkge1xuICAgICAgICBpZiAodGhpcy5jb25uZWN0aW9uc1tub2RlVG9SZW1vdmUuZ2V0SWQoKV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbnNbbm9kZVRvUmVtb3ZlLmdldElkKCldO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIGRyYXc6IGZ1bmN0aW9uIChncmFwaGljcykge1xuICAgICAgICB2YXIgbm9kZUxvY2F0aW9uID0gdGhpcy5nZXRMb2NhdGlvbigpO1xuICAgICAgICBncmFwaGljcy5kcmF3Q2lyY2xlKG5vZGVMb2NhdGlvbi54LCBub2RlTG9jYXRpb24ueSwgU0VUVElOR1MuUkFESVVTKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE5vZGU7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIjFZaVo1U1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL05vZGUuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKipcbiAqIENyZWF0ZWQgYnkgYXJsYW5kbyBvbiA3LzI2LzE0LlxuICovXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzLk5PREUgPSBPYmplY3QuZnJlZXplKHtcbiAgICBSQURJVVM6IDI1XG59KTtcblxubW9kdWxlLmV4cG9ydHMuR1JJRCA9IE9iamVjdC5mcmVlemUoe1xuICAgIFNURVBfWDogMTAwLFxuICAgIFNURVBfWSA6IDEwMCxcbiAgICBNQVhfTk9ERVNfWDogMyxcbiAgICBNQVhfTk9ERVNfWTogM1xufSk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIjFZaVo1U1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL1NFVFRJTkdTLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyoqXG4gKiBDcmVhdGVkIGJ5IGFybGFuZG8gb24gNy8yNi8xNC5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBWZWN0b3IoeCwgeSkge1xuICAgIHRoaXMueCA9IHggfHwgMDtcbiAgICB0aGlzLnkgPSB5IHx8IDA7XG59XG5cblZlY3Rvci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKHgsIHkpIHtcbiAgICB0aGlzLnggKz0geDtcbiAgICB0aGlzLnkgKz0geTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVmVjdG9yO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCIxWWlaNVNcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9WZWN0b3IuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKipcbiAqIENyZWF0ZWQgYnkgYXJsYW5kbyBvbiA3LzI2LzE0LlxuICovXG4ndXNlIHN0cmljdCc7XG52YXIgR3JpZCA9IHJlcXVpcmUoJy4vR3JpZCcpO1xudmFyIE5vZGUgPSByZXF1aXJlKCcuL05vZGUnKTtcbnZhciBBZGphY2VuY3lMaXN0ID0gcmVxdWlyZSgnLi9BZGphY2VuY3lMaXN0Jyk7XG52YXIgUElYSSA9IHJlcXVpcmUoJy4uL2Jvd2VyX2NvbXBvbmVudHMvcGl4aS9iaW4vcGl4aS5qcycpO1xudmFyIGRvbXJlYWR5ID0gcmVxdWlyZSgnZG9tcmVhZHknKTtcblxuZG9tcmVhZHkoZnVuY3Rpb24gKCkge1xuICAgIC8vIGNyZWF0ZSBhbiBuZXcgaW5zdGFuY2Ugb2YgYSBwaXhpIHN0YWdlXG4gICAgdmFyIHN0YWdlID0gbmV3IFBJWEkuU3RhZ2UoMHg2NkZGOTkpO1xuXG4gICAgLy8gY3JlYXRlIGEgcmVuZGVyZXIgaW5zdGFuY2VcbiAgICB2YXIgcmVuZGVyZXIgPSBuZXcgUElYSS5XZWJHTFJlbmRlcmVyKDYwMCwgNjAwKTsvL2F1dG9EZXRlY3RSZW5kZXJlcig0MDAsIDMwMCk7XG5cbiAgICAvLyBhZGQgdGhlIHJlbmRlcmVyIHZpZXcgZWxlbWVudCB0byB0aGUgRE9NXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChyZW5kZXJlci52aWV3KTtcbiAgICByZXF1ZXN0QW5pbUZyYW1lKCBhbmltYXRlICk7XG5cbiAgICAvLyAgICAvLyBjcmVhdGUgYSB0ZXh0dXJlIGZyb20gYW4gaW1hZ2UgcGF0aFxuICAgIC8vICAgIHZhciB0ZXh0dXJlID0gUElYSS5UZXh0dXJlLmZyb21JbWFnZShcImJ1bm55LnBuZ1wiKTtcbiAgICAvLyAgICAvLyBjcmVhdGUgYSBuZXcgU3ByaXRlIHVzaW5nIHRoZSB0ZXh0dXJlXG4gICAgLy8gICAgdmFyIGJ1bm55ID0gbmV3IFBJWEkuU3ByaXRlKHRleHR1cmUpO1xuICAgIC8vXG4gICAgLy8gICAgLy8gY2VudGVyIHRoZSBzcHJpdGVzIGFuY2hvciBwb2ludFxuICAgIC8vICAgIGJ1bm55LmFuY2hvci54ID0gMC41O1xuICAgIC8vICAgIGJ1bm55LmFuY2hvci55ID0gMC41O1xuICAgIC8vXG4gICAgLy8gICAgLy8gbW92ZSB0aGUgc3ByaXRlIHQgdGhlIGNlbnRlciBvZiB0aGUgc2NyZWVuXG4gICAgLy8gICAgYnVubnkucG9zaXRpb24ueCA9IDIwMDtcbiAgICAvLyAgICBidW5ueS5wb3NpdGlvbi55ID0gMTUwO1xuICAgIC8vXG4gICAgLy8gICAgc3RhZ2UuYWRkQ2hpbGQoYnVubnkpO1xuXG4gICAgLy8gZHJhdyBhIGNpcmNsZVxuICAgIHZhciBncmFwaGljcyA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gICAgZ3JhcGhpY3MubGluZVN0eWxlKDApO1xuICAgIGdyYXBoaWNzLmJlZ2luRmlsbCgweEZGRkZGRiwgMC41KTtcblxuICAgIHZhciBncmlkID0gbmV3IEdyaWQoKTtcbiAgICB2YXIgYWRqYWNlbmN5TGlzdCA9IG5ldyBBZGphY2VuY3lMaXN0KGdyYXBoaWNzLCBncmlkKTtcblxuICAgIGZ1bmN0aW9uIG1ha2VOb2RlcygpIHtcbiAgICAgICAgdmFyIG4xID0gbmV3IE5vZGUoKTtcbiAgICAgICAgYWRqYWNlbmN5TGlzdC5hZGROb2RlKDEsIG4xKTtcblxuICAgICAgICB2YXIgbjIgPSBuZXcgTm9kZSgpO1xuICAgICAgICBhZGphY2VuY3lMaXN0LmFkZE5vZGUoMiwgbjIpO1xuXG4gICAgICAgIHZhciBuMyA9IG5ldyBOb2RlKCk7XG4gICAgICAgIGFkamFjZW5jeUxpc3QuYWRkTm9kZSgzLCBuMyk7XG5cbiAgICAgICAgbjEuYWRkQ29ubmVjdGlvbihuMik7XG4gICAgICAgIG4yLmFkZENvbm5lY3Rpb24objMpO1xuXG4gICAgfVxuXG4gICAgbWFrZU5vZGVzKCk7XG4gICAgc3RhZ2UuYWRkQ2hpbGQoZ3JhcGhpY3MpO1xuXG5cbiAgICBmdW5jdGlvbiBhbmltYXRlKCkge1xuICAgICAgICByZXF1ZXN0QW5pbUZyYW1lKCBhbmltYXRlICk7XG5cblxuICAgICAgICAvLyBqdXN0IGZvciBmdW4sIGxldHMgcm90YXRlIG1yIHJhYmJpdCBhIGxpdHRsZVxuICAgICAgICAvL2J1bm55LnJvdGF0aW9uICs9IDAuMTtcblxuXG4gICAgICAgIC8vIHJlbmRlciB0aGUgc3RhZ2VcbiAgICAgICAgZ3JhcGhpY3MuY2xlYXIoKTtcbiAgICAgICAgYWRqYWNlbmN5TGlzdC5kcmF3KCk7XG4gICAgICAgIHJlbmRlcmVyLnJlbmRlcihzdGFnZSk7XG4gICAgfVxufSk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIjFZaVo1U1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2Zha2VfNDQwMjg2ZDQuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKiFcbiAgKiBkb21yZWFkeSAoYykgRHVzdGluIERpYXogMjAxNCAtIExpY2Vuc2UgTUlUXG4gICovXG4hZnVuY3Rpb24gKG5hbWUsIGRlZmluaXRpb24pIHtcblxuICBpZiAodHlwZW9mIG1vZHVsZSAhPSAndW5kZWZpbmVkJykgbW9kdWxlLmV4cG9ydHMgPSBkZWZpbml0aW9uKClcbiAgZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnKSBkZWZpbmUoZGVmaW5pdGlvbilcbiAgZWxzZSB0aGlzW25hbWVdID0gZGVmaW5pdGlvbigpXG5cbn0oJ2RvbXJlYWR5JywgZnVuY3Rpb24gKCkge1xuXG4gIHZhciBmbnMgPSBbXSwgbGlzdGVuZXJcbiAgICAsIGRvYyA9IGRvY3VtZW50XG4gICAgLCBkb21Db250ZW50TG9hZGVkID0gJ0RPTUNvbnRlbnRMb2FkZWQnXG4gICAgLCBsb2FkZWQgPSAvXmxvYWRlZHxeaXxeYy8udGVzdChkb2MucmVhZHlTdGF0ZSlcblxuICBpZiAoIWxvYWRlZClcbiAgZG9jLmFkZEV2ZW50TGlzdGVuZXIoZG9tQ29udGVudExvYWRlZCwgbGlzdGVuZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIoZG9tQ29udGVudExvYWRlZCwgbGlzdGVuZXIpXG4gICAgbG9hZGVkID0gMVxuICAgIHdoaWxlIChsaXN0ZW5lciA9IGZucy5zaGlmdCgpKSBsaXN0ZW5lcigpXG4gIH0pXG5cbiAgcmV0dXJuIGZ1bmN0aW9uIChmbikge1xuICAgIGxvYWRlZCA/IGZuKCkgOiBmbnMucHVzaChmbilcbiAgfVxuXG59KTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCIxWWlaNVNcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi9ub2RlX21vZHVsZXMvZG9tcmVhZHkvcmVhZHkuanNcIixcIi8uLi9ub2RlX21vZHVsZXMvZG9tcmVhZHlcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5fdXNlVHlwZWRBcnJheXNgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAoY29tcGF0aWJsZSBkb3duIHRvIElFNilcbiAqL1xuQnVmZmVyLl91c2VUeXBlZEFycmF5cyA9IChmdW5jdGlvbiAoKSB7XG4gIC8vIERldGVjdCBpZiBicm93c2VyIHN1cHBvcnRzIFR5cGVkIEFycmF5cy4gU3VwcG9ydGVkIGJyb3dzZXJzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssXG4gIC8vIENocm9tZSA3KywgU2FmYXJpIDUuMSssIE9wZXJhIDExLjYrLCBpT1MgNC4yKy4gSWYgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBhZGRpbmdcbiAgLy8gcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLCB0aGVuIHRoYXQncyB0aGUgc2FtZSBhcyBubyBgVWludDhBcnJheWAgc3VwcG9ydFxuICAvLyBiZWNhdXNlIHdlIG5lZWQgdG8gYmUgYWJsZSB0byBhZGQgYWxsIHRoZSBub2RlIEJ1ZmZlciBBUEkgbWV0aG9kcy4gVGhpcyBpcyBhbiBpc3N1ZVxuICAvLyBpbiBGaXJlZm94IDQtMjkuIE5vdyBmaXhlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJlxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nIC8vIENocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBXb3JrYXJvdW5kOiBub2RlJ3MgYmFzZTY0IGltcGxlbWVudGF0aW9uIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBzdHJpbmdzXG4gIC8vIHdoaWxlIGJhc2U2NC1qcyBkb2VzIG5vdC5cbiAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JyAmJiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIHN1YmplY3QgPSBzdHJpbmd0cmltKHN1YmplY3QpXG4gICAgd2hpbGUgKHN1YmplY3QubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgICAgc3ViamVjdCA9IHN1YmplY3QgKyAnPSdcbiAgICB9XG4gIH1cblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdC5sZW5ndGgpIC8vIGFzc3VtZSB0aGF0IG9iamVjdCBpcyBhcnJheS1saWtlXG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG5lZWRzIHRvIGJlIGEgbnVtYmVyLCBhcnJheSBvciBzdHJpbmcuJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSlcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICAgIGVsc2VcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdFtpXVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBTVEFUSUMgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9PSBudWxsICYmIGIgIT09IHVuZGVmaW5lZCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ciArICcnXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggLyAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgYXNzZXJ0KGlzQXJyYXkobGlzdCksICdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0LCBbdG90YWxMZW5ndGhdKVxcbicgK1xuICAgICAgJ2xpc3Qgc2hvdWxkIGJlIGFuIEFycmF5LicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBsaXN0WzBdXG4gIH1cblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHRvdGFsTGVuZ3RoICE9PSAnbnVtYmVyJykge1xuICAgIHRvdGFsTGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHRvdGFsTGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbi8vIEJVRkZFUiBJTlNUQU5DRSBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBfaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBhc3NlcnQoc3RyTGVuICUgMiA9PT0gMCwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGFzc2VydCghaXNOYU4oYnl0ZSksICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9IGkgKiAyXG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIF91dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gX2FzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF91dGYxNmxlV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuICBzdGFydCA9IE51bWJlcihzdGFydCkgfHwgMFxuICBlbmQgPSAoZW5kICE9PSB1bmRlZmluZWQpXG4gICAgPyBOdW1iZXIoZW5kKVxuICAgIDogZW5kID0gc2VsZi5sZW5ndGhcblxuICAvLyBGYXN0cGF0aCBlbXB0eSBzdHJpbmdzXG4gIGlmIChlbmQgPT09IHN0YXJ0KVxuICAgIHJldHVybiAnJ1xuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ3NvdXJjZUVuZCA8IHNvdXJjZVN0YXJ0JylcbiAgYXNzZXJ0KHRhcmdldF9zdGFydCA+PSAwICYmIHRhcmdldF9zdGFydCA8IHRhcmdldC5sZW5ndGgsXG4gICAgICAndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgc291cmNlLmxlbmd0aCwgJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMCB8fCAhQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICB0YXJnZXRbaSArIHRhcmdldF9zdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIF91dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gX2FzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKVxuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBfYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICByZXR1cm4gX2FzY2lpU2xpY2UoYnVmLCBzdGFydCwgZW5kKVxufVxuXG5mdW5jdGlvbiBfaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiBfdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpKzFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IGNsYW1wKHN0YXJ0LCBsZW4sIDApXG4gIGVuZCA9IGNsYW1wKGVuZCwgbGVuLCBsZW4pXG5cbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICByZXR1cm4gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkLCB0cnVlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICAgIHJldHVybiBuZXdCdWZcbiAgfVxufVxuXG4vLyBgZ2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gX3JlYWRVSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gIH0gZWxzZSB7XG4gICAgdmFsID0gYnVmW29mZnNldF0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkVUludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMl0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICAgIHZhbCB8PSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXQgKyAzXSA8PCAyNCA+Pj4gMClcbiAgfSBlbHNlIHtcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAxXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAyXSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDNdXG4gICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXRdIDw8IDI0ID4+PiAwKVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCxcbiAgICAgICAgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHZhciBuZWcgPSB0aGlzW29mZnNldF0gJiAweDgwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiBfcmVhZEludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IF9yZWFkVUludDE2KGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSBfcmVhZFVJbnQzMihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwMDAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRGbG9hdCAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRmxvYXQodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZERvdWJsZSAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmYpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm5cblxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgICAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZiwgLTB4ODApXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHRoaXMud3JpdGVVSW50OCh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHRoaXMud3JpdGVVSW50OCgweGZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmYsIC0weDgwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICBfd3JpdGVVSW50MTYoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgX3dyaXRlVUludDE2KGJ1ZiwgMHhmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgX3dyaXRlVUludDMyKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIF93cml0ZVVJbnQzMihidWYsIDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLFxuICAgICAgICAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmNoYXJDb2RlQXQoMClcbiAgfVxuXG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmICFpc05hTih2YWx1ZSksICd2YWx1ZSBpcyBub3QgYSBudW1iZXInKVxuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCB0aGlzLmxlbmd0aCwgJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHRoaXMubGVuZ3RoLCAnZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgdGhpc1tpXSA9IHZhbHVlXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3V0ID0gW11cbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBvdXRbaV0gPSB0b0hleCh0aGlzW2ldKVxuICAgIGlmIChpID09PSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTKSB7XG4gICAgICBvdXRbaSArIDFdID0gJy4uLidcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgb3V0LmpvaW4oJyAnKSArICc+J1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSlcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG4vLyBzbGljZShzdGFydCwgZW5kKVxuZnVuY3Rpb24gY2xhbXAgKGluZGV4LCBsZW4sIGRlZmF1bHRWYWx1ZSkge1xuICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGRlZmF1bHRWYWx1ZVxuICBpbmRleCA9IH5+aW5kZXg7ICAvLyBDb2VyY2UgdG8gaW50ZWdlci5cbiAgaWYgKGluZGV4ID49IGxlbikgcmV0dXJuIGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIGluZGV4ICs9IGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGNvZXJjZSAobGVuZ3RoKSB7XG4gIC8vIENvZXJjZSBsZW5ndGggdG8gYSBudW1iZXIgKHBvc3NpYmx5IE5hTiksIHJvdW5kIHVwXG4gIC8vIGluIGNhc2UgaXQncyBmcmFjdGlvbmFsIChlLmcuIDEyMy40NTYpIHRoZW4gZG8gYVxuICAvLyBkb3VibGUgbmVnYXRlIHRvIGNvZXJjZSBhIE5hTiB0byAwLiBFYXN5LCByaWdodD9cbiAgbGVuZ3RoID0gfn5NYXRoLmNlaWwoK2xlbmd0aClcbiAgcmV0dXJuIGxlbmd0aCA8IDAgPyAwIDogbGVuZ3RoXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkgKHN1YmplY3QpIHtcbiAgcmV0dXJuIChBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChzdWJqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdWJqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICB9KShzdWJqZWN0KVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKVxuICAgICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkpXG4gICAgZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKVxuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBwb3NcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSlcbiAgICAgIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gZGVjb2RlVXRmOENoYXIgKHN0cikge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgweEZGRkQpIC8vIFVURiA4IGludmFsaWQgY2hhclxuICB9XG59XG5cbi8qXG4gKiBXZSBoYXZlIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSB2YWx1ZSBpcyBhIHZhbGlkIGludGVnZXIuIFRoaXMgbWVhbnMgdGhhdCBpdFxuICogaXMgbm9uLW5lZ2F0aXZlLiBJdCBoYXMgbm8gZnJhY3Rpb25hbCBjb21wb25lbnQgYW5kIHRoYXQgaXQgZG9lcyBub3RcbiAqIGV4Y2VlZCB0aGUgbWF4aW11bSBhbGxvd2VkIHZhbHVlLlxuICovXG5mdW5jdGlvbiB2ZXJpZnVpbnQgKHZhbHVlLCBtYXgpIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlID49IDAsICdzcGVjaWZpZWQgYSBuZWdhdGl2ZSB2YWx1ZSBmb3Igd3JpdGluZyBhbiB1bnNpZ25lZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBpcyBsYXJnZXIgdGhhbiBtYXhpbXVtIHZhbHVlIGZvciB0eXBlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZzaW50ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZJRUVFNzU0ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbn1cblxuZnVuY3Rpb24gYXNzZXJ0ICh0ZXN0LCBtZXNzYWdlKSB7XG4gIGlmICghdGVzdCkgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UgfHwgJ0ZhaWxlZCBhc3NlcnRpb24nKVxufVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIjFZaVo1U1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qc1wiLFwiLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMpXG5cdFx0XHRyZXR1cm4gNjIgLy8gJysnXG5cdFx0aWYgKGNvZGUgPT09IFNMQVNIKVxuXHRcdFx0cmV0dXJuIDYzIC8vICcvJ1xuXHRcdGlmIChjb2RlIDwgTlVNQkVSKVxuXHRcdFx0cmV0dXJuIC0xIC8vbm8gbWF0Y2hcblx0XHRpZiAoY29kZSA8IE5VTUJFUiArIDEwKVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBOVU1CRVIgKyAyNiArIDI2XG5cdFx0aWYgKGNvZGUgPCBVUFBFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBVUFBFUlxuXHRcdGlmIChjb2RlIDwgTE9XRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gTE9XRVIgKyAyNlxuXHR9XG5cblx0ZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuXHRcdHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cblx0XHRpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuXHRcdH1cblxuXHRcdC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuXHRcdC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuXHRcdC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuXHRcdC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2Vcblx0XHR2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXHRcdHBsYWNlSG9sZGVycyA9ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAyKSA/IDIgOiAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMSkgPyAxIDogMFxuXG5cdFx0Ly8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5cdFx0YXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cblx0XHQvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG5cdFx0bCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuXHRcdHZhciBMID0gMFxuXG5cdFx0ZnVuY3Rpb24gcHVzaCAodikge1xuXHRcdFx0YXJyW0wrK10gPSB2XG5cdFx0fVxuXG5cdFx0Zm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG5cdFx0XHRwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdHJldHVybiBhcnJcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGhcblxuXHRcdGZ1bmN0aW9uIGVuY29kZSAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwLmNoYXJBdChudW0pXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBlbmNvZGUobnVtID4+IDE4ICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDEyICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDYgJiAweDNGKSArIGVuY29kZShudW0gJiAweDNGKVxuXHRcdH1cblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApXG5cdFx0fVxuXG5cdFx0Ly8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuXHRcdHN3aXRjaCAoZXh0cmFCeXRlcykge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHR0ZW1wID0gdWludDhbdWludDgubGVuZ3RoIC0gMV1cblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDIpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz09J1xuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHR0ZW1wID0gKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDJdIDw8IDgpICsgKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMTApXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPj4gNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDIpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9J1xuXHRcdFx0XHRicmVha1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXRcblx0fVxuXG5cdGV4cG9ydHMudG9CeXRlQXJyYXkgPSBiNjRUb0J5dGVBcnJheVxuXHRleHBvcnRzLmZyb21CeXRlQXJyYXkgPSB1aW50OFRvQmFzZTY0XG59KHR5cGVvZiBleHBvcnRzID09PSAndW5kZWZpbmVkJyA/ICh0aGlzLmJhc2U2NGpzID0ge30pIDogZXhwb3J0cykpXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiMVlpWjVTXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qc1wiLFwiLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYlwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgbkJpdHMgPSAtNyxcbiAgICAgIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMCxcbiAgICAgIGQgPSBpc0xFID8gLTEgOiAxLFxuICAgICAgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXTtcblxuICBpICs9IGQ7XG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIHMgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBlTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKTtcbiAgZSA+Pj0gKC1uQml0cyk7XG4gIG5CaXRzICs9IG1MZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhcztcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpO1xuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbik7XG4gICAgZSA9IGUgLSBlQmlhcztcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKTtcbn07XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbihidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgYyxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMCksXG4gICAgICBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSksXG4gICAgICBkID0gaXNMRSA/IDEgOiAtMSxcbiAgICAgIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDA7XG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSk7XG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDA7XG4gICAgZSA9IGVNYXg7XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpO1xuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLTtcbiAgICAgIGMgKj0gMjtcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKTtcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKys7XG4gICAgICBjIC89IDI7XG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMDtcbiAgICAgIGUgPSBlTWF4O1xuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSBlICsgZUJpYXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpO1xuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG07XG4gIGVMZW4gKz0gbUxlbjtcbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KTtcblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjg7XG59O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIjFZaVo1U1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qc1wiLFwiLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaWVlZTc1NFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhblBvc3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5wb3N0TWVzc2FnZSAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lclxuICAgIDtcblxuICAgIGlmIChjYW5TZXRJbW1lZGlhdGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmKSB7IHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlKGYpIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgdmFyIHF1ZXVlID0gW107XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc291cmNlID0gZXYuc291cmNlO1xuICAgICAgICAgICAgaWYgKChzb3VyY2UgPT09IHdpbmRvdyB8fCBzb3VyY2UgPT09IG51bGwpICYmIGV2LmRhdGEgPT09ICdwcm9jZXNzLXRpY2snKSB7XG4gICAgICAgICAgICAgICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgZm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoJ3Byb2Nlc3MtdGljaycsICcqJyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZm4sIDApO1xuICAgIH07XG59KSgpO1xuXG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn1cblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIjFZaVo1U1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qc1wiLFwiLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3NcIikiXX0=
