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

    return getFromUrl({
        location: href,
        etag: data.etag,
        fileCache: __dirname + "/../build/cache/" + cacheHash(href).substr(0, 16)
    }).then(function(res) {
        if (typeof res.headers.etag === "string") {
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
    var dependenciesFile = "build/data/dependencies.json";
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

    var stylesheets = settings.stylesheets;
    var scripts = settings.scripts;

    for (var i = 0; i < stylesheets.length; i++) {
        promises.push(getIntegrationHash(
            stylesheets[i],
            cache.integrity[stylesheets[i]]
        ).then(updateData(stylesheets[i])));
    }
    for (var j = 0; j < scripts.length; j++) {
        promises.push(getIntegrationHash(
            scripts[j],
            cache.integrity[scripts[j]]
        ).then(updateData(scripts[j])));
    }
    return Promise.all(promises).then(function() {
        fs.writeFileSync(dependenciesFile, JSON.stringify(cache.integrity));
        settings.stylesheets = [];
        settings.scripts = [];
        for (var i = 0; i < stylesheets.length; i++) {
            cache.integrity[stylesheets[i]].href = stylesheets[i];
            settings.stylesheets.push(cache.integrity[stylesheets[i]]);
        }
        for (var j = 0; j < scripts.length; j++) {
            cache.integrity[scripts[j]].href = scripts[j];
            settings.scripts.push(cache.integrity[scripts[j]]);
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