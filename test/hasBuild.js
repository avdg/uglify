var fs = require("fs");

describe("hasBuild", function() {
    it("Should have index.html in the docs folder", function() {
        fs.existsSync(__dirname + "/../docs/index.html");
    });
});