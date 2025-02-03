// webpack.config.js
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/core.js',
  output: {
    filename: 'analytics.min.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'InsaneAnalytics',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()]
  }
};