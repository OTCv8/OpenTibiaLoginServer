let Config;
try {
    Config = require("./config.json");
} catch (e) {
    try {
        Config = require("../config.json");
    } catch (e) {
        throw "Missing config.json";
    }
}

export default Config;
