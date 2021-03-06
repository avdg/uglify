var UglifyJS;
var cache = {sleep: true};
var uedit = {
    baseUrl: "https://raw.githubusercontent.com/mishoo/UglifyJS2/",
    refsUrl: "https://api.github.com/repos/mishoo/UglifyJS2/git/refs/",
    prInfoUrl: "https://api.github.com/repos/mishoo/UglifyJS2/pulls?state=all&per_page=100",
    shaRef: /^[A-F0-9a-f]{3,40}\^*$/m,
    prRef: /^(?:PR\s?(?:[-#]\s?)?|#)([0-9]*)$/im,
    prRefPath: /refs\/pull\/[0-9]+\/head/,
    unsafeRef: /^(?:\s*\^)*\s*[A-F0-9a-f]{3,40}(?:\s*\^)*\s*$|[\0-\x20\*:\?\~\[\\\{\}\x7f-\uffff]|\.{2,}/m,
    invalidRef: /[\0-\x20\*:\?\~\[\x7f-\uffff]|^$/m,
    nonReferingUglifyError: /\[.*:[0-9]+,[0-9]+\]$/,
    hashValidKey: /^[a-zA-Z]+$/,
    hashHexHex: /^[A-F0-9a-f]{2}$/,
    hash4Hex: /^[A-F0-9a-f]{4}$/,
    decDigits: /^[0-9]+$/,
    singleHexCharacter: /^[A-F0-9a-f]$/,
    singleAlphaNumeric:/^[a-zA-Z0-9]$/,
    messages_en: {
        confirmResetSettings: "Click to confirm resetting settings",
        refsGotUpdates: "Some refs got updates"
    },
    notify: {}
};
uedit.messages = uedit.messages_en;
uedit.sort_biggest_num = function(first, second) {
    if (first.length !== second.length) {
        return first.length > second.length ? -1 : 1;
    }
    first = parseInt(first);
    second = parseInt(second);
    if (first > second) {
        return -1;
    } else if (first < second) {
        return 1;
    }
    return 0;
};
uedit.sortRefsByQuery = function(query) {
    var points = {};
    cache.points = points;
    var score = function(a) {
        if (points[a]) {
            return points[a];
        } else if (a === query) {
            points[a] = 10 * a.length + 10;
            return points[a];
        }
        points[a] = 0;
        for (var i = 0; a[i] === query[i] && i < query.length; i++) {
            points[a] += 10;
        }
        if (cache.versions_info[a] === undefined || cache.versions_info[a].open !== true) {
            points[a] = Math.max(0, points[a] - 1);
        }
        return points[a];
    };
    return function(a, b) {
        score_a = score(a);
        score_b = score(b);
        if (score_a !== score_b) {
            return score_a > score_b ? -1 : 1;
        } else if (a[0] === b[0]) {
            if (a[1] === b[1] && a[2] === b[2] && a.substr(0, 3) === "PR-") {
                var a_num = a.substr(3);
                var b_num = b.substr(3);
                if (uedit.decDigits.test(a_num) && uedit.decDigits.test(b_num)) {
                    return uedit.sort_biggest_num(a_num, b_num);
                }
            } else if (a[0] === "v") {
                var i = 1;
                for (; a[i] === b[i] && i < a.length; i++) {}
                var a_num = "";
                var b_num = "";
                for (var j = i; uedit.decDigits.test(a[j]); j++) {a_num += a[j]}
                for (var j = i; uedit.decDigits.test(b[j]); j++) {b_num += b[j]}
                if (a.length > 0 && b.length > 0) {
                    return uedit.sort_biggest_num(a_num, b_num);
                }
            }
        }
        return 0;
    };
};
uedit.parseUrl = function() {
    if (!location.hash) return {};

    var hash = location.hash.substr(1).split("-");
    var result = {};

    for (var i = 0; i < hash.length; i++) {
        var pos = hash[i].indexOf("_");
        var key = hash[i].substr(0, pos);
        if (!uedit.hashValidKey.test(key)) continue;
        result[key] = "";
        var value = hash[i].substr(pos + 1);
        for (var j = 0; j < value.length; j++) {
            if (value[j] !== "_") {
                result[key] += value[j];
                continue;
            } else if (++j >= value.length) {
                break;
            }
            switch(value[j]) {
                case "n": result[key] += "\n"; continue;
                case "r": result[key] += "\r"; continue;
                case "t": result[key] += "\t"; continue;
                case "b": result[key] += "\b"; continue;
                case "v": result[key] += "\u000b"; continue;
                case "f": result[key] += "\f"; continue;
                case "s":
                    result[key] += " ";
                    for (var k = parseInt(value[++j], 16);k > 0;k--) {
                        result[key] += " ";
                    }
                    continue;
                case "x":
                    var tmp = value.substr(++j, 2); j++;
                    if (tmp.length === 2 && uedit.hashHexHex.test(tmp)) {
                        result[key] += String.fromCharCode(parseInt(tmp, 16));
                    }
                    continue;
                case "u":
                    if (value[++j] === "{") {
                        var content = "";
                        while(value[++j] != "}") {
                            if (content !== false && uedit.singleHexCharacter.test(value[j])) {
                                content += value[j];
                            }
                            invalid = false;
                        }
                        if (content === false) {
                            continue;
                        }
                        content = parseInt(content, 16);
                        if (content <= 0xffff) {
                            result[key] += String.fromCharCode(content);
                        }
                    } else {
                        var tmp = value.substr(j, 4); j += 3;
                        if (tmp.length === 4 && uedit.hash4Hex.test(tmp)) {
                            result[key] += String.fromCharCode(parseInt(tmp, 16));
                        }
                    }
                    continue;
                default: result[key] += value[j];
            }
        }
    }

    return result;
};
uedit.getHash = function(state) {
    var convert = function(input) {
        var output = "";
        var padding = function(input, length) {
            while (input.length < length) {
                input = "0" + input;
            }
            return input;
        };
        for (var i = 0; i < input.length; i++) {
            switch(input[i]) {
                case "\n": output += "_n"; continue;
                case "\r": output += "_r"; continue;
                case "\t": output += "_t"; continue;
                case "\b": output += "_b"; continue;
                case "\v": output += "_v"; continue;
                case "\f": output += "_f"; continue;
                case "_": output += "__"; continue;
                case " ":
                    var c = 0;
                    while (c < 15 && i < input.length && input[i + 1] === " ") {
                        c++; i++;
                    }
                    output += "_s" + c.toString(16);
                    continue;
            }
            if (uedit.singleAlphaNumeric.test(input[i])) {
                output += input[i];
            } else if (input.charCodeAt(i) <= 0xff) {
                output += "_x" + padding(input.charCodeAt(i).toString(16), 2);
            } else {
                output += "_u" + padding(input.charCodeAt(i).toString(16), 2);
            }
        }
        return output;
    };
    var hash = [];
    for (var i in state) {
        if (!uedit.hashValidKey.test(i)) continue;
        if (typeof state[i] !== "string" || state[i] === "") continue;
        hash.push(i + "_" + convert(state[i]));
    }
    return "#" + hash.join("-");
};
uedit.request = function(url, done, options) {
    var oReq = new XMLHttpRequest();
    function reqListener () {
        if (oReq.readyState !== XMLHttpRequest.DONE) {
            return;
        }
        done(this.responseText, this);
    }
    function reqError() {
        done("", this);
    }

    options = options || {};

    if (typeof options.headers === "object") {
        for (var i in options.headers) {
            oReq.setRequestHeader(i, options.headers[i]);
        }
    }

    oReq.addEventListener("load", reqListener);
    oReq.addEventListener("error", reqError);
    oReq.open("GET", url);
    oReq.send();
};
uedit.getRefs = function(done, warnings) {
    done = done || function() {};
    uedit.request(uedit.refsUrl, function(result, res) {
        var log = [];
        var doNotify = false;
        cache.sleep = true;
        var addRef = function(ref, sha) {
            if (!cache.versions[ref]) {
                log.push({ref: ref, new: sha, old: null, type: "add",
                    msg: "Added ref " + ref + " (" + sha.substr(0, 10) + ")"
                });
            } else if (cache.versions[ref] !== sha) {
                log.push({ref: ref, new: sha, old: cache.versions[ref], type: "changed",
                    msg: "Updated ref " + ref + " from " + cache.versions[ref].substr(0, 10) + " to " + sha.substr(0, 10)
                });
            }
            cache.versions[ref] = sha;
        };
        if (res.status !== 200 && res.status !== 304) {
            return done({success: false, updated: false, error: res.status, res: res});
        } else if (res.status === 304 && typeof cache.versions === "object") {
            done({success: true, updated: false, error: false, res: res});
            return;
        } else if (typeof cache.versions !== "object") {
            cache.versions = {};
            doNotify = true;
        }
        var data = JSON.parse(result);
        for (var i in data) {
            if (uedit.prRefPath.test(data[i].ref)) {
                addRef("PR-" + data[i].ref.substring(10, data[i].ref.indexOf("/", 10)), data[i].object.sha);
            } else if (data[i].ref.substr(0, 11) === "refs/heads/") {
                addRef(data[i].ref.substr(11), data[i].object.sha);
            } else if (data[i].ref.substr(0, 10) === "refs/tags/") {
                var ref = data[i].ref.substr(10);
                addRef(ref, ref);
            } else if (warnings && !/$refs\/(?:__gh__|pull)\//) {
                console.debug(i + " is not used as reference");
            }
        }
        done({success: true, updated: log, error: false, res: res});
        if (doNotify && typeof uedit.notify.refs === "function") {
            uedit.notify.refs(done);
        }
    });
    uedit.getPullRequestInfo();
};
uedit.getPullRequestInfo = function(done) {
    done = done || function() {};
    uedit.request(uedit.prInfoUrl, function(result, res) {
        if (res.status !== 200 && res.status !== 304) {
            return done({success: false, updated: false, error: res.status, res: res});
        } else if (res.status === 304 && typeof cache.pr === object) {
            return done({success: true, updated: false, error: false, res: res});
        } else if (typeof cache.versions_info !== "object") {
            cache.versions_info = {};
        }
        var data = JSON.parse(result);
        for (var i in data) {
            var key = "PR-" + data[i].number;
            cache.versions_info[key] = cache.versions_info[key] || {};
            cache.versions_info[key].title = data[i].title;
            cache.versions_info[key].open = data[i].state === "open";
        }
    });
};
uedit.getRef = function(ref, done) {
    var result;
    ref = (ref + "").trim();
    if ((result = uedit.prRef.exec(ref)) !== null && result[1] !== "") {
        ref = "PR-" + result[1];
    } else if (uedit.shaRef.test(ref)) {
        done(ref);
        return;
    } else if (uedit.invalidRef.test(ref)) {
        done();
        return;
    }
    if (typeof cache.versions !== "object") {
        uedit.notify.refs = function() {
            uedit.getRef(ref, done);
        };
        return;
    } else if (cache.versions[ref]) {
        done(cache.versions[ref]);
    } else {
        done();
    }
};
uedit.extractFiles = function(code) {
    var start = code.indexOf("FILES = [");
    if (start === -1) {
        return;
    }
    var end = code.indexOf("]", start);
    if (end === -1) {
        return;
    }
    var data = code.substring(start + 8, end + 1).replace(/,\s*\]/, "]");

    return JSON.parse(data);
};
uedit.getUglify = function(ref, done) {
    uedit.getRef(ref, function(checkedRef) {
        if (checkedRef === undefined) {
            done();
            return;
        }
        var urlRef = escape(checkedRef);

        uedit.request(uedit.baseUrl + urlRef + "/tools/node.js", function(res) {
            var handleRequest = function(url) {
                return new Promise(function(success, fail) {
                    uedit.request(url, function(file, res) {
                        if (res.status >= 400) {
                            fail(file);
                        }
                        success(file);
                    });
                });
            };
            if (typeof res !== "string" || res === "" || res.status >= 400) {
                done();
                return;
            }
            var files = uedit.extractFiles(res);

            if (files === undefined) {
                done();
                return;
            }

            for (var i = 0; i < files.length; i++) {
                if (files[i].substr(0, 3) === "../") {
                    files[i] = uedit.baseUrl + urlRef + "/" + files[i].substr(3);
                } else if (files[i].substr(0, 2) === "./") {
                    files[i] = uedit.baseUrl + urlRef + "/tools/" + files[i].substr(2);
                } else {
                    throw Error("Invalid file");
                }
                files[i] = handleRequest(files[i]);
            }

            if (/v2\.[0-4].[0-9]+/.test(urlRef)) {
                files.push(handleRequest(uedit.baseUrl + "v2.5.0/tools/exports.js"));
            }

            Promise.all(files).then(function(results) {
                var code = results.join("\n\n");

                if (!/mangle_properties\(/.test(code)) {
                    code = "function mangle_properties(ast) { return ast; }; // FIX make sure mangle_properties is defined\n\n" + code;
                }

                var uglify = {version: checkedRef, code: code};
                new Function("MOZ_SourceMap", "exports", "DEBUG", code)(
                    sourceMap,
                    uglify,
                    !!window.UGLIFY_DEBUG
                );
                done({
                    uglify: uglify,
                    ref: checkedRef,
                    request: ref,
                    code: code
                });
            });
        });
    });
};
uedit.updateUglify = function(done, check) {
    var ref = uedit.parseUrl().ref;
    done = typeof done === "function" ? done : function() {};
    if ((UglifyJS || {}).version === ref && typeof ref === "string") {
        done(ref);
        return;
    } else if (cache["uglify-" + ref]) {
        UglifyJS = cache["uglify-" + ref];
        done(ref);
        return;
    }
    if (check && uedit.unsafeRef.test(ref) && !confirm("Do you want to load external code from " + ref + "? This might be unsafe!")) {
        return done();
    }
    uedit.getUglify(ref || "master", function(result) {
        if (typeof result === "object") {
            cache["uglify-" + result.ref] = result.uglify;
            UglifyJS = result.uglify;
        }
        done(result);
    });
};
uedit.collection = function(type) {
    var buffers = {};
    type = type || Object;
    return {
        get: function(name) {
            return buffers["$" + name];
        },
        set: function(name, buffer) {
            if (buffer instanceof type) {
                buffers["$" + name] = buffer;
            }
            return buffer; // Allow chaining
        },
        create: function(name, text, mode) {
            return (buffers["$" + name] = new type(text, mode));
        },
        delete: function(name) {
            buffers["$" + name] = undefined;
        },
        has: function(name) {
            return buffers["$" + name] !== undefined;
        }
    }
};
if (typeof ace === "object") {
    uedit.aceSessions = uedit.collection(ace.EditSession);
}
uedit.aceViews = uedit.collection();
uedit.updateState = function(result) {
    cache.requestRef = "";
    if (result === undefined) {
        $("#uglify-checkout-status")[0].innerHTML = "Invalid version";
        $("#uglify-compile").addClass("disabled");
        $("#uglify-statusbar").removeClass("has-success has-warning").addClass("has-error");
    } else {
        var ref;
        if (uedit.shaRef.test(result.ref) && result.request !== result.ref) {
            ref = '<a href="https://github.com/mishoo/UglifyJS2/tree/' + result.ref + '" target="_blank">' + result.ref.substr(0, 10) + "</a>";
            var tmp;
            if ((tmp = uedit.prRef.exec(result.request)) !== null && tmp[1] !== "") {
                cache.requestRef = "PR-" + tmp[1];
                ref += ' (<a href="https://github.com/mishoo/UglifyJS2/pull/' + tmp[1] + '" target="_blank">PR-' + tmp[1] + '</a>)';
            } else {
                cache.requestRef = result.request;
                ref += " (" + result.request + ")";
            }
        } else {
            ref = result.ref;
        }
        $("#uglify-checkout-status")[0].innerHTML = '<span class="hidden-xs">Using </span>' + ref;
        $("#uglify-compile").removeClass("disabled");
        $("#uglify-statusbar").removeClass("has-error has-warning").addClass("has-success");

        $("#uglify-quick-version-change")[0].innerHTML = "Switch to " +
            (cache.requestRef === "master" ? "harmony" : "master");
    }
    document.getElementById("uglify-url-copy").setAttribute("data-clipboard-text", location.toString());
};
uedit.getRefsAndUpdateState = function() {
    if (cache.sleep) {
        return;
    }
    uedit.getRefs(function(changes) {
        var statusbar = $("#uglify-statusbar");
        if (cache.requestRef === "") {
            return;
        }
        if (!Array.isArray(changes.updated) || changes.updated.length === 0) {
            return;
        }
        if (!Array.isArray(cache.refsChanges)) {
            cache.refsChanges = [];
            cache.refsUpdates = [];
        }
        cache.refsChanges.push(changes.updated);
        cache.refsUpdates.push(new Date().toUTCString());

        var dropdown = $("#uglify-version-change-dropdown");
        if (!dropdown.hasClass("dropdown-with-updates")) {
            dropdown.addClass("dropdown-with-updates");
            $("#uglify-update-state").text(uedit.messages.refsGotUpdates);
        }
        for (var i = 0; i < changes.updated.length; i++) {
            if (changes.updated[i].ref === cache.requestRef && !statusbar.hasClass("has-warning")) {
                $("#uglify-checkout-status")[0].innerHTML = $("#uglify-checkout-status")[0].innerHTML.replace("(", "(outdated ");
                statusbar.removeClass("has-error has-success").addClass("has-warning");
            }
        }
    });
};
uedit.showIntroHelp = function() {
    var output = uedit.aceViews.get("output");
    output.getSession().setMode("ace/mode/text");
    output.setValue(uedit.messages.welcome);
    output.gotoLine(0, 0, false);
};
uedit.showUpdatesSummary = function() {
    var c = 0;
    var limit = 256;
    var content = "Update log:\n\n";
    if (Array.isArray(cache.refsChanges)) {
        for (var i = cache.refsChanges.length - 1; i >= 0 && c < limit; i--) {
            var d = new Date(cache.refsUpdates[i]);
            content += "On " + d.toLocaleTimeString() + " at " + d.toDateString() + "\n\n";
            for (var j = 0; j < cache.refsChanges[i].length; j++) {
                content += " - " + cache.refsChanges[i][j].msg + "\n";
                c++;
            }
            content += "\n\n";
        }
        content = content.substr(0, content.length - 2);
    } else {
        content += "No updates yet!";
    }

    var output = uedit.aceViews.get("output");
    output.getSession().setMode("ace/mode/text");
    output.setValue(content);
    output.gotoLine(0, 0, false);
};
uedit.fallbackMinify = function(input, options) {
    var ast = UglifyJS.parse(input, options.parser);
    var count = 0;
    var errors = [];

    // Compress
    if (options.compress) {
        if (typeof options.compress.global_defs === "string") {
            options.compress.global_defs = options.compress.global_defs.split(",");
        } else {
            options.compress.global_defs = undefined;
        }
        var compress = { warnings: options.warnings };
        UglifyJS.merge(compress, options.compress);
        ast.figure_out_scope();
        var sq = UglifyJS.Compressor(compress);
        ast = ast.transform(sq);

        // Pop up warning in editor
        for (var i in sq.warnings_produced) {
            if (!uedit.nonReferingUglifyError.test(i)) {
                continue;
            }
            count++;
            var line_pos = i.lastIndexOf(":");
            var col_pos = i.lastIndexOf(",");
            var msg_pos = i.lastIndexOf(" [");
            errors.push({
                row: i.substring(line_pos + 1, col_pos) - 1,
                text: "UglifyJS compressor: " + i.substr(0, msg_pos),
                type: "warning",
                uglify: true
            });
        }
    }

    // Mangle properties
    if (options.mangle.mangleProperties) {
        if (typeof options.mangleProperties.reserved === "string") {
            options.mangleProperties.reserved = options.mangleProperties.reserved.split(",");
        } else {
            options.mangleProperties.reserved = undefined;
        }
        if (options.mangleProperties.regex !== undefined) {
            var regex_pos = options.mangleProperties.regex.lastIndexOf("/");
            options.mangleProperties.regex = new RegExp(
                options.mangleProperties.regex.substr(1, regex_pos - 1),
                options.mangleProperties.regex.substr(regex_pos + 1)
            );
        }
        ast = UglifyJS.mangle_properties(ast, options.mangleProperties);
    }

    // Mangle
    if (options.mangle) {
        if (typeof options.mangle.except === "string") {
            options.mangle.except = options.mangle.except.split(",");
        } else {
            options.mangle.except = undefined;
        }
        ast.figure_out_scope(options.output);
        ast.compute_char_frequency();
        ast.mangle_names(options.mangle);

        // Reset option before outputstreams throws us with warnings
        delete options.output.cache;
    }

    // Print
    var stream = UglifyJS.OutputStream(options.output);
    ast.print(stream);
    var generated = stream.toString();

    return {
        generated: generated,
        count: count,
        errors: errors
    };
};

var loader = function(){
    if (cache.loaded) return;
    cache.loaded = true;
    var optionsBinary = {
        opt_html5:             {type: "parse", url: "html",         uglify: "html5_comments"},
        opt_shebang:           {type: "parse", url: "shebang",      uglify: "shebang"},
        opt_bare:              {type: "parse", url: "bare" ,        uglify: "bare_returns"},
        opt_compress:          {type: "options", url: "compr",       uglify: "compress"},
        opt_mangler:           {type: "options", url: "mangle",      uglify: "mangle"},
        opt_mangle_properties: {type: "options", url: "mangle-prop", uglify: "mangleProperties"},
        opt_seq:           {type: "compress", url: "seq",           uglify: "sequences"},
        opt_prop:          {type: "compress", url: "prop",          uglify: "properties"},
        opt_dead_code:     {type: "compress", url: "deadcode",      uglify: "dead_code"},
        opt_drop_debugger: {type: "compress", url: "dropdebug",     uglify: "drop_debugger"},
        opt_unsafe:        {type: "compress", url: "unsafe",        uglify: "unsafe"},
        opt_unsafe_comps:  {type: "compress", url: "unsafecomps",   uglify: "unsafe_comps"},
        opt_cond:          {type: "compress", url: "cond",          uglify: "conditionals"},
        opt_comparisons:   {type: "compress", url: "comp",          uglify: "comparisons"},
        opt_evaluate:      {type: "compress", url: "evaluate",      uglify: "evaluate"},
        opt_bools:         {type: "compress", url: "bool",          uglify: "booleans"},
        opt_loops:         {type: "compress", url: "loops",         uglify: "loops"},
        opt_unused:        {type: "compress", url: "unused",        uglify: "unused"},
        opt_hoist_funs:    {type: "compress", url: "hoist-funs",    uglify: "hoist_funs"},
        opt_keep_fargs:    {type: "compress", url: "keep-fargs",    uglify: "keep_fargs"},
        opt_keep_fnames:   {type: "compress", url: "keep-fnames",   uglify: "keep_fnames"},
        opt_hoist_vars:    {type: "compress", url: "hoist-vars",    uglify: "hoist_vars"},
        opt_if_return:     {type: "compress", url: "if-return",     uglify: "if_return"},
        opt_join_vars:     {type: "compress", url: "join-vars",     uglify: "join_vars"},
        opt_collapse_vars: {type: "compress", url: "collapse-vars", uglify: "collapse_vars"},
        opt_cascade:       {type: "compress", url: "cascade",       uglify: "cascade"},
        opt_side_effects:  {type: "compress", url: "side-effects",  uglify: "side_effects"},
        opt_pure_getters:  {type: "compress", url: "pure-getters",  uglify: "pure_getters"},
        opt_negate_iife:   {type: "compress", url: "negate-iife",   uglify: "negate_iife"},
        opt_screw_ie8:     {type: "compress", url: "screw",         uglify: "screw_ie8"},
        opt_drop_console:  {type: "compress", url: "drop-console",  uglify: "drop_console"},
        opt_angular:       {type: "compress", url: "angular",       uglify: "angular"},
        opt_ignore_quoted: {type: "mangleProperties", url: "ignore-quoted", uglify: "ignore_quoted"},
        opt_mangle_toplevel:    {type: "mangle", url: "mangle-toplevel",    uglify: "toplevel"},
        opt_mangle_eval:        {type: "mangle", url: "mangle-eval",        uglify: "eval"},
        opt_screw_ie8_mangle:   {type: "mangle", url: "screw-mangle",       uglify: "screw_ie8"},
        opt_keep_fnames_mangle: {type: "mangle", url: "keep-fnames-mangle", uglify: "keep_fnames"},
        opt_beautify:          {type: "output", url: "beautify",        uglify: "beautify"},
        opt_quote_keys:        {type: "output", url: "quotekey",        uglify: "quote_keys"},
        opt_space_colon:       {type: "output", url: "spacecol",        uglify: "space_colon"},
        opt_ascii_only:        {type: "output", url: "ascii",           uglify: "ascii_only"},
        opt_unescape_regexps:  {type: "output", url: "unescape-regexp", uglify: "unescape_regexps"},
        opt_inline_script:     {type: "output", url: "inline-script",   uglify: "inline_script"},
        opt_bracketize:        {type: "output", url: "bracketize",      uglify: "bracketize"},
        opt_semi:              {type: "output", url: "semi",            uglify: "semicolons"},
        opt_comments:          {type: "output", url: "comments",        uglify: "comments"},
        opt_shebang_out:       {type: "output", url: "shebang-out",     uglify: "shebang"},
        opt_preserve:          {type: "output", url: "preserve",        uglify: "preserve_line"},
        opt_screw_ie8_out:     {type: "output", url: "screw-out",       uglify: "screw_ie8"},
        opt_keep_quoted_props: {type: "output", url: "keep-quoteprops", uglify: "keep_quoted_props"},
    };
    var optionsText = {
        opt_pure_funcs: {type: "compress", convertInt:!1, url: "pure-funcs", uglify: "pure_funcs"},
        opt_globals:    {type: "compress", convertInt:!1, url: "globals",    uglify: "global_defs"},
        opt_passes:     {type: "compress", convertInt:!0, url: "passes",     uglify: "passes"},
        opt_reserved:   {type: "mangleProperties", convertInt: !1, url: "reserved",   uglify: "reserved"},
        opt_prop_regex: {type: "mangleProperties", convertInt: !1, url: "prop-regex", uglify: "regex"},
        opt_mangle_except: {type: "mangle", convertInt: !1, url: "mangle-except", uglify: "except"},
        opt_indent_start: {type: "output", convertInt:!0, url: "indent-start", uglify: "indent_start"},
        opt_indent_level: {type: "output", convertInt:!0, url: "indent-level", uglify: "indent_level"},
        opt_width:        {type: "output", convertInt:!0, url: "width",        uglify: "width"},
        opt_max_line_len: {type: "output", convertInt:!0, url: "max-line-len", uglify: "max_line_len"},
        opt_preamble:     {type: "output", convertInt:!1, url: "preamble",     uglify: "preamble"},
        opt_quote_style:  {type: "output", convertInt:!0, url: "quote_style",  uglify: "quote_style"},
        opt_ecma:         {type: "output", convertInt:!0, url: "ecma",         uglify: "ecma"},
    };
    uedit.messages_en.welcome = document.getElementById("summary").innerHTML.replace(/<br>/g, "\n");
    uedit.getRefs();
    cache.refCheck = setInterval(uedit.getRefsAndUpdateState, 15e4);
    document.addEventListener("mousemove", function(){cache.sleep=false;}, false);
    document.addEventListener("keydown", function(){cache.sleep=false;}, false);
    var state = uedit.parseUrl();
    var clipboardCopyUrl;
    var hideResetCancel = function() {
        var resetCancelButton = document.getElementById("uglify-reset-settings-cancel");
        resetCancelButton.style.display = "none";
        $(resetCancelButton.parentElement).removeClass("btn-group");
    };
    var blockUglifyAnnotation = function(a) {
        return (a || {}).uglify !== true;
    };
    var updateUrl = function() {
        var hash = uedit.getHash(state);
        if (hash.length > 1e4) {
            var edit = state.editor;
            state.editor = undefined;
            hash = uedit.getHash(state);
            state.editor = edit;
            if (hash.length > 1e4) {
                $("#uglify-hash-warning").addClass("hidden");
                $("#uglify-hash-error").removeClass("hidden");
                return "";
            } else {
                $("#uglify-hash-warning").removeClass("hidden");
                $("#uglify-hash-error").addClass("hidden");
            }
        } else {
            $("#uglify-hash-warning").addClass("hidden");
            $("#uglify-hash-error").addClass("hidden");
        }

        return hash;
    };

    var storeInHash = function() {
        state = uedit.parseUrl();
        state.editor = uedit.aceSessions.get("editor").getValue();
        if (state.editor === "") {
            state.editor = undefined;
        }
        var element;
        state.bool = "";
        for (var i in optionsBinary) {
            element = document.getElementById(i.replace(/_/g, "-"));
            if (element.checked !== element.defaultChecked) {
                state.bool += optionsBinary[i].url + (element.checked ? "0" : "1");
            }
        }
        state.set = "";
        for (var i in optionsText) {
            element = document.getElementById(i.replace(/_/g, "-"));
            if (element.value !== element.defaultValue) {
                if (state.set !== "") {
                    state.set += "z";
                }
                state.set += optionsText[i].url + "\t" + ("" + element.value).replace(/\z/g, "zz");
            }
        }
        var hash = updateUrl(state);
        location.hash = hash;
    };
    var searchBox = $("#uglify-checkout-version");
    searchBox[0].value = state.ref || "master";
    cache.versions_info = cache.versions_info || {};
    searchBox.autocomplete({
        delay: 50,
        source: function(req, res) {
            if (typeof cache.versions !== "object") {
                res([]);
                return;
            }
            var prResult;
            if ((prResult = uedit.prRef.exec(req.term)) !== null) {
                req.term = "PR-" + prResult[1];
            }
            var f = new RegExp($.ui.autocomplete.escapeRegex(req.term));
            var items = Object.keys(cache.versions).filter(function(a) {
                return f.test(a);
            });
            items = items.sort(uedit.sortRefsByQuery(req.term)).slice(0, 10);
            for (var i = 0; i < items.length; i++) {
                var info = cache.versions_info[items[i]];
                items[i] = {
                    label: info ? items[i] + (info.open ? ": " : " [CLOSED]: ") + info.title : items[i],
                    value: items[i]
                };
            }
            res(items);
        }
    });
    var changeVersion = function(ref) {
        state = uedit.parseUrl();
        var oldRef = state.ref;
        state.ref = ref;
        var updatedHash = updateUrl(state);
        if (location.hash !== updatedHash) {
            location.hash = updateUrl(state);
        } else if (oldRef === state.ref && $("#uglify-statusbar").hasClass("has-warning")) {
            var event = document.createEvent("HTMLEvents");
            event.initEvent("hashchange");
            window.dispatchEvent(event);
        }
    };
    $("#uglify-version-change").click(function() {
        changeVersion($("#uglify-checkout-version")[0].value);
    });
    $("#uglify-quick-version-change").click(function() {
        changeVersion($("#uglify-quick-version-change")[0].innerHTML === "Switch to master" ?
            "master" : "harmony"
        );
    });
    $("#uglify-update-refresh").click(function() {
        clearInterval(cache.refCheck);
        uedit.getRefsAndUpdateState();
        cache.refCheck = setInterval(uedit.getRefsAndUpdateState, 15e4);
    });
    $("#uglify-update-info").click(function() {
        uedit.showUpdatesSummary();
    });
    $("#uglify-version-change-group").on("hidden.bs.dropdown", function() {
        var state = $("#uglify-update-state");
        if (state.text() === "Some refs got updates") {
            state.text("No ref changes since last check");
            $("#uglify-version-change-dropdown").removeClass("dropdown-with-updates");
        }
    });
    $("#uglify-show-intro").click(function() {
        uedit.showIntroHelp();
    });
    $("#load-from-external-url").click(function() {
        var editor = uedit.aceViews.get("editor");
        state = uedit.parseUrl();
        state.editor = undefined;
        state.from = $("#external-url")[0].value;
        if (state.from === "") {
            return;
        }
        editor.setReadOnly(true);
        uedit.request(state.from, function(content) {
           editor.setValue(content);
           editor.setReadOnly(false);
        });
        location.hash = updateUrl(state);
    });
    $("#uglify-url-store").click(function() {
        storeInHash();
    });
    (function /* loadSettings */ () {
        var binarySettings = ("" + state.bool).split(/[01]/);
        for (var i = 0; i < binarySettings.length; i++) {
            for (var j in optionsBinary) {
                if (optionsBinary[j].url !== binarySettings[i]) {
                    continue;
                }
                var element = document.getElementById(j.replace(/_/g, "-"));
                element.checked = !element.defaultChecked;
                break;
            }
        }
        var textSettings = ("" + state.set).split(/z(?!z)/).reduce(function(c, a) {
            var decoded = a.replace(/zz/g, "z");
            if (c.concat) {
                c.parts[c.parts.length - 1] += decoded;
            } else {
                c.parts.push(decoded);
            }
            var pos = a.length - 1;
            for(;a[pos] === "z";pos--){}
            c.concat = !((a.length - pos) % 2);
            return c;
        },{parts: [], concat: false});
        textSettings = textSettings.parts;
        for (var i = 0; i < textSettings.length; i++) {
            var pos = textSettings[i].indexOf("\t");
            pos = pos === -1 ? textSettings[i].length : pos;
            var key = textSettings[i].substr(0, pos);
            var value = textSettings[i].substr(pos + 1);
            for (var j in optionsText) {
                if (optionsText[j].url !== key) {
                    continue;
                }
                var element = document.getElementById(j.replace(/_/g, "-"));
                element.value = value;
                break;
            }
        }
    })();
    $("#uglify-compile").click(function() {
        var editor = uedit.aceSessions.get("editor");
        var output = uedit.aceViews.get("output");
        var errors = [];

        if (UglifyJS.DefaultsError) {
            var defaultsErrorBackup = UglifyJS.DefaultsError.croak;
            UglifyJS.DefaultsError.croak = function(msg, defs) {
                errors.push({
                    row: 0,
                    text: msg,
                    type: "warning",
                    uglify: true
                });
            };
        }
        try {
            var options = {
                options: {},
                parse: {},
                compress: {
                    warnings: true
                },
                mangle: {},
                mangleProperties: {},
                output: {}
            };

            // Collect options
            for (var i in optionsBinary) {
                options[optionsBinary[i].type][optionsBinary[i].uglify] = document.getElementById(i.replace(/_/g, "-")).checked;
            }
            for (var i in optionsText) {
                options[optionsText[i].type][optionsText[i].uglify] = document.getElementById(i.replace(/_/g, "-")).value;
                if (optionsText[i].convertInt) {
                    options[optionsText[i].type][optionsText[i].uglify] = parseInt(options[optionsText[i].type][optionsText[i].uglify]);
                    if (options[optionsText[i].type][optionsText[i].uglify] !== options[optionsText[i].type][optionsText[i].uglify]) {
                        options[optionsText[i].type][optionsText[i].uglify] = undefined;
                    }
                }
            }

            options.mangle.properties = options.mangleProperties;
            if (!options.options.compress) {
                options.compress = false;
            }
            if (!options.options.mangle) {
                options.mangle = false;
            }

            // Get content
            var input = editor.getValue();
            var result;
            var generated;
            var count = 0;

            if (typeof UglifyJS.minify === "function") {
                options.compress.ie8 = options.compress.screw_ie8;
                options.mangle.ie8 = options.mangle.screw_ie8;
                options.output.ie8 = options.output.screw_ie8;
                delete options.options;
                delete options.compress.screw_ie8;
                delete options.compress.angular;
                delete options.mangleProperties;
                delete options.mangle.screw_ie8;
                delete options.mangle.except;
                delete options.output.screw_ie8;
                delete options.output.ecma;
                delete options.output.space_colon;
                delete options.output.unescape_regexps;
                result = UglifyJS.minify(input, options);

                if (result.error) {
                    throw result.error;
                }

                generated = result.code ;
            } else {
                result = uedit.fallbackMinify(input, options);
                generated = result.generated;
                count += result.count;
                errors = errors.concat(result.errors);
            }

            output.getSession().setMode("ace/mode/javascript");
            output.setValue(generated);

            // Additional info in editor
            errors.push({
                row: 0,
                text: count + " UglifyJS compression warnings found.\n" +
                    (input.length - generated.length) + " characters were removed" +
                        (input.length === 0 ? "." : " (" + (Math.round(
                                (input.length - generated.length) / input.length * 10000
                            ) / 100) + "%)."
                        ),
                type: "info",
                uglify: true
            });
        } catch (e) {
            if (e.message === undefined && typeof e.msg === "string") {
                e.message = e.msg;
            }

            if (typeof e.message === "string") {
                var msg = e.message;

                if (e.line || e.col) {
                    msg += "\n\nAt ";
                    if (e.line) {
                        msg += "line " + e.line + " ";
                        errors =[{
                            row: e.line - 1,
                            text: "UglifyJS error: " + e.message,
                            type: "error",
                            uglify: true
                        }, {
                            row: 0,
                            text: "UglifyJS error at line " + e.line,
                            type: "info",
                            uglify: true
                        }];
                    }
                    if (e.col) msg += "col " + e.col;
                }

                output.getSession().setMode("ace/mode/text");
                output.setValue(msg);
            }

            throw e;
        }

        // Set default error to a state like before
        if (UglifyJS.DefaultsError) {
            UglifyJS.DefaultsError.croak = defaultsErrorBackup;
        }

        // Pass uglify warning to editor
        editor.setAnnotations(
            editor.getAnnotations().filter(blockUglifyAnnotation).concat(errors)
        );
    });
    $("#uglify-show-options").click(function() {
        if (this.classList.contains("active")) {
            $(this).removeClass("active");
            document.getElementById("uglify-options").style.display = "none";
        } else {
            $(this).addClass("active");
            document.getElementById("uglify-options").style.display = "inherit";
        }
    });
    var doReset = false;
    var doResetTimers = [];
    var resetResetState = function() {
        if (!doReset) return;
        hideResetCancel();
        document.getElementById("uglify-reset-settings").innerHTML = "Reset settings";
        doReset = false;
        var timer;
        while ((timer = doResetTimers.pop()) !== undefined) {
            window.clearTimeout(timer);
        }
    };
    $("#uglify-reset-settings").click(function() {
        var self = this;
        if (!doReset) {
            var resetCancelButton = document.getElementById("uglify-reset-settings-cancel");
            doReset = true;
            self.innerHTML = uedit.messages.confirmResetSettings;
            resetCancelButton.style.display = "inherit";
            $(resetCancelButton.parentElement).addClass("btn-group");
            doResetTimers.push(
                window.setTimeout(resetResetState, 30000)
            );
            return;
        }
        resetResetState();
        var element;
        for (var i in optionsBinary) {
            element = document.getElementById(i.replace(/_/g, "-"));
            element.checked = element.defaultChecked;
        }
        for (var i in optionsText) {
            element = document.getElementById(i.replace(/_/g, "-"));
            element.value = element.defaultValue;
        }
    });
    hideResetCancel();
    $("#uglify-reset-settings-cancel").click(resetResetState);
    if (state.from) {
        $("#external-url")[0].value = state.from;
    }
    if (typeof Clipboard === "function") {
        clipboardCopyUrl = new Clipboard("#uglify-url-copy", {
            text: function(trigger) {
                storeInHash();
                return location.toString();
            }
        });
    } else {
        var uglifyUrlCopy = document.getElementById("uglify-url-copy");
        uglifyUrlCopy.style.display = "none";
        $(uglifyUrlCopy.parentElement).removeClass("btn-group");
    }

    uedit.updateUglify(uedit.updateState, true);
    window.addEventListener("hashchange",  function() {
        uedit.updateUglify(uedit.updateState);
    }, false);

    ace.require("ace/ext/language_tools");
    var editor = uedit.aceViews.set("editor", ace.edit("editor"));
    var output = uedit.aceViews.set("output", ace.edit("output"));
    var editorSession = uedit.aceSessions.set("editor", editor.getSession());
    var outputSession = uedit.aceSessions.set("welcome", output.getSession());
    editor.$blockScrolling = output.$blockScrolling = Infinity; // Disable warning

    editor.setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: false
    });
    editor.setTheme("ace/theme/monokai");
    editorSession.setMode("ace/mode/javascript");
    if (state.editor) {
        editor.setValue(state.editor);
    } else if(state.from) {
        editor.setReadOnly(true);
        uedit.request(state.from, function(content) {
           editor.setValue(content);
           editor.setReadOnly(false);
        });
    }

    output.setTheme("ace/theme/chrome");
    output.setReadOnly(true);
    output.setOption("wrap", true);
    uedit.showIntroHelp();
    output.setReadOnly = function(){};

    editor.focus();
    if ('' === editor.getValue()) {
        editor.setValue('console.log("1) Paste some javascript code over here");\nconsole.log("2) Press the compile button below");\nconsole.log("3) Get minified code");');
    }

    window._gaq=window._gaq||[];
    _gaq.push(["_setAccount","UA-37350177-1"],["_trackPageview"]),function(){var t,e=document.createElement("script");
    e.type="text/javascript",e.async=!0,e.src=("https:"==document.location.protocol?"https://ssl":"http://www")+".google-analytics.com/ga.js",t=document.getElementsByTagName("script")[0],t.parentNode.insertBefore(e,t)}();
};

if (typeof module === "object") {
    module.exports = uedit;
    uedit.cache = cache;
} else {
    document.addEventListener("DOMContentLoaded", document.onload = loader);
}