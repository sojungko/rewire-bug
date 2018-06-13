
// test/myModule.test.js
var rewire = require("rewire");

var myModule = rewire("./myModule.js");

myModule.__set__("path", "/dev/null");
console.log(myModule.__get__("path")); // = '/dev/null'