const path = require('path');


module.exports = {
    devServer: {
        inline: true,
        contentBase: './dist',
        port: 3333,
        historyApiFallback: true
    },
  entry: './src/index.js',
  output: {
    filename: 'js/index.js',
    path: path.resolve(__dirname, 'dist')
  },
  externals: {
    TWEEN: 'TWEEN',
    Typed: 'Typed',
    Comlink: 'Comlink'
  }
};