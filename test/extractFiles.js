var assert = require("assert");
var uedit = require("../snippets/js/script");

describe("extractFiles", function() {
    it("Should return a list of files to include given some source code from tools/node.js", function() {
        var code = [
            'FILES = ["test", "123"]'
        ];

        assert.deepEqual(
            uedit.extractFiles(code[0]),
            ["test", "123"]
        );
    });
});
