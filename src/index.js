"use strict";

var fs = require('fs');
var pathResolve = require('path').resolve;
const dotenv = require('dotenv');

var dotenvContent;

function loadDotenvContent (opts){
    var dotenvPath = pathResolve(process.cwd(), '.env')
    var encoding = 'utf8'
    var debug = false
    if (opts.path != null) {
      dotenvPath = opts.path
    }
    if (opts.encoding != null) {
      encoding = opts.encoding
    }
    if (opts.debug != null) {
      debug = true
    }
    var envFileContent, modeFileContent;
    const babelMode = process.env.BABEL_ENV || process.env.NODE_ENV || 'development';
    try {
        envFileContent = fs.readFileSync(dotenvPath, { encoding: encoding });
        modeFileContent = fs.readFileSync(dotenvPath + '.' + babelMode, {encoding: encoding });
    } catch (e) {}
    const env = envFileContent ? dotenv.parse(envFileContent, { debug: debug }) : {};
    const envMode = modeFileContent ? dotenv.parse(modeFileContent, { debug: debug }) : {};
    dotenvContent = { ...env, ...envMode };
    var dotenvExpand;
    try { dotenvExpand = require('dotenv-expand'); } catch(e) {}
    if (dotenvExpand)
      dotenvContent = dotenvExpand({parsed:dotenvContent, ignoreProcessEnv:opts.systemVar!=="all"}).parsed;
}

function getValue(dotenvContent, systemContent, opts, name) {
  if (opts.env && name in opts.env) return opts.env[name];

  switch (opts.systemVar) {
    case "overwrite":
      if (name in dotenvContent && name in systemContent)
        return systemContent[name];
      if (name in dotenvContent) return dotenvContent[name];
      return;
    case "disable":
      if (name in dotenvContent) return dotenvContent[name];
      return;
    case "all":
    default:
      if (name in systemContent) return systemContent[name];
      if (name in dotenvContent) return dotenvContent[name];
      return;
  }
}

module.exports = function (options) {
  var t = options.types;

  return {
    visitor: {
      MemberExpression: function MemberExpression(path, state) {
        if(t.isAssignmentExpression(path.parent) && path.parent.left == path.node) return;
        if (path.get("object").matchesPattern("process.env")) {
          if (!dotenvContent) {
            loadDotenvContent(state.opts);
          }
          var key = path.toComputedKey();
          if (t.isStringLiteral(key)) {
            var name = key.value;
            var value = getValue(dotenvContent, process.env, state.opts, name)
            var me = t.memberExpression;
            var i = t.identifier;
            var le = t.logicalExpression;
            var replace = state.opts.unsafe
              ? t.valueToNode(value)
              : le(
                  "||",
                  le(
                    "&&",
                    le("&&", i("process"), me(i("process"), i("env"))),
                    me(i("process.env"), i(name))
                  ),
                  t.valueToNode(value)
                );

            path.replaceWith(replace);
          }
        }
      }
    }
  };
};
