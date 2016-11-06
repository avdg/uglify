var fs = require("fs");

describe("hasBuild", function() {
    it("Should have index.html in the docs folder", function() {
        fs.accessSync(__dirname + "/../docs/index.html");
    });
});