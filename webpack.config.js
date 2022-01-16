const path = require('path');


module.exports = {
    devServer: {
        static: './dist',
        port: 3333,
        historyApiFallback: true,
        watchFiles: './src',
        client: {
          overlay: false,
        },
    },
  entry: './src/index.js',
  output: {
    filename: 'js/index.js',
    path: path.resolve(__dirname, 'dist')
  },
  devtool: 'inline-source-map',
  externals: {
    TWEEN: 'TWEEN',
    Typed: 'Typed',
    Comlink: 'Comlink'
  }
};