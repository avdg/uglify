var crypto = require("crypto");
var fs = require("fs");
var https = require("https");
var path = require("path");
var url = require("url");

var handlebars = require("handlebars");

var getFromUrl = function(location) {
    var etag;
    var fileCache;

    if (typeof location === "object") {
        etag = location.etag;
        fileCache = location.fileCache;
        location = location.location;
    }

    var request = url.parse(location);
    request.headers = {};

    if (typeof etag === "string") {
        request.headers["If-None-Match"] = etag;
    }

    return new Promise(function(done, err) {
        https.get(request, function(res) {
            var data = "";
            res.on("data", function(chunk) {
                data += chunk;
            });
            res.on("end", function(chunk) {
                if (res.statusCode === 304) {
                    data = fs.readFileSync(fileCache, {encoding: 'utf8'});
                } else if (typeof fileCache === "string") {
                    var dir = path.dirname(fileCache);
                    if (!fs.existsSync(dir)) {
                        fs.mkdir(path.dirname(fileCache));
                    }
                    fs.writeFileSync(fileCache, data);
                }
                res.data = data;
                done(res);
            });
        }).on('error', err);
    });
};

function contentHash(data) {
    var sha384 = crypto.createHash('sha384');
    sha384.update(data);
    return "sha384-" + sha384.digest('base64');
}

function cacheHash(fileName) {
    var sha = crypto.createHash('sha');
    sha.update(fileName);
    return sha.digest('hex');
}

function getIntegrationHash(href, data) {
    data = data || {};
    var promise;

    if (/^[a-z+]*:\/\//i.test(href)) {
        promise = getFromUrl({
            location: href,
            etag: data.etag,
            fileCache: __dirname + "/../build/cache/" + cacheHash(href).substr(0, 16)
        });
    } else {
        if (href[0] === "/") {
            throw "Invalid url " + href;
        }
        promise = new Promise(function(done, err) {
            fs.readFile(__dirname + "/../docs/" + href, {encoding: "utf8"}, function(fsErr, data) {
                if (fsErr) {
                    err(fsErr);
                } else {
                    done({data: data});
                }
            });
        });
    }
    return promise.then(function(res) {
        if (res.headers && typeof res.headers.etag === "string") {
            data.etag = res.headers.etag;
        }
        data.integrity = contentHash(res.data);
        return new Promise(function(done) {
            done(data);
        });
    });
}


var cache = {};
function processDependencies(settings) {
    var dependenciesFile = "build/dependencies.json";
    var promises = [];

    if (cache.integrity === undefined) {
        if (fs.existsSync(dependenciesFile)) {
            cache.integrity = JSON.parse(fs.readFileSync(dependenciesFile, {encoding: 'utf-8'}));
        } else {
            cache.integrity = {};
        }
    }

    var updateData = function(url) {
        return function(data) {
            cache.integrity[url] = data;
        };
    };

    for (var type in settings) {
        for (var i = 0; i < settings[type].length; i++) {
            var url;

            if (typeof settings[type][i] === "string") {
                url = settings[type][i];
            } else {
                url = settings[type][i].href;
            }

            promises.push(
                getIntegrationHash(url, cache.integrity[url])
                    .then(updateData(url))
            );
        }
    }

    return Promise.all(promises).then(function() {
        fs.writeFileSync(dependenciesFile, JSON.stringify(cache.integrity));
        for (var type in settings) {
            for (var i = 0; i < settings[type].length; i++) {
                var data = {};
                if (typeof settings[type][i] === "string") {
                    data.href = settings[type][i];
                } else {
                    data = settings[type][i];
                }
                data.integrity = cache.integrity[data.href].integrity;
                settings[type][i] = data;
            }
        }

        return new Promise(function(done) {
            done(settings);
        });
    });
}

module.exports = function(grunt) {
    grunt.registerMultiTask('assembler', function(){
        var done = this.async();
        var options = this.options({
            css: "build/css/style.css",
            dependencies: "snippets/data/dependencies.json",
            editor: "snippets/html/editor.html",
            js: "build/script.js",
            skeleton: "snippets/html/skeleton.hbs",
            output: "docs/index.html"
        });
        var templateData = {
            css: grunt.file.read(options.css),
            editor: grunt.file.read(options.editor),
            js: grunt.file.read(options.js),
        };
        processDependencies(
            JSON.parse(grunt.file.read(options.dependencies))
        ).then(function(result) {
            templateData.dependencies = result;
            var template = handlebars.compile(grunt.file.read(options.skeleton), {noEscape: true});
            var output = template(templateData);
            grunt.file.write(options.output, output);
            done();
        });
    });
};
