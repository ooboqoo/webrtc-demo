module.exports = {
  "root": true,
  "env": {
    "es6": true,
    "browser": true,
  },
  "extends": [
    "standard",
  ],
  /** 0 "off"   1 "warn"   2 "error" */
  rules: {
    "no-multi-spaces": 0,
    "comma-dangle": 0,
    "object-curly-spacing": 0,
    "space-infix-ops": 0,
    "prefer-promise-reject-errors": 0,
    "handle-callback-err": 1,
  },
}
