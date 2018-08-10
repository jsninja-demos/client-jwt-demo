module.exports = wallaby => ({
  files: ["src/**/*.js"],
  tests: ["tests/**/*.js"],
  env: {
    type: "node",
  },
  compilers: {
    "**/*.js": wallaby.compilers.babel({
      presets: ["@ava/babel-preset-stage-4"],
      plugins: ["@babel/plugin-proposal-object-rest-spread"],
    }),
  },
  debug: true,
  testFramework: "ava",
});
