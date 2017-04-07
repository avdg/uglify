var assert = require("assert");
var uedit = require("../snippets/js/script");

describe("getFilter", function() {
    before(function() {
        uedit.cache.versions = {
            "PR-1": "abcdefg",
            "PR-2": "bcdefgh"
        };
    });

    after(function() {
        uedit.cache.versions = undefined;
    });

    describe("format test", function() {
        var tests = [
            ["#1",      "abcdefg"],
            ["#2",      "bcdefgh"],
            ["PR-1",    "abcdefg"],
            [" #1 ",    "abcdefg"],
            ["#1 ",     "abcdefg"],
            [" #1",     "abcdefg"],
            [" PR 1",   "abcdefg"],
            ["123",     "123"],
            ["abcdef6789123456789012345678901234567890",
             "abcdef6789123456789012345678901234567890"],
            ["abcdef6789123456789012345678901234567890^^^^^^^^",
             "abcdef6789123456789012345678901234567890^^^^^^^^"],

            // Negative tests
            ["abcdef123451234567890123456789012345678901",
             undefined],
            ["\n", undefined],
            ["*", undefined],
            ["1#", undefined],
            ["1 PR", undefined]
        ];

        var execute = function(input, output) {
            return it("Should output " + output + " when " + input + " is passed", function(done) {
                uedit.getRef(input, function(result) {
                    assert.strictEqual(result, output);
                    done();
                });
            });
        };

        for (var i = 0; i < tests.length; i++) {
            execute(tests[i][0], tests[i][1]);
        }
    });
});
