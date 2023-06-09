const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
module.exports = {
   mode: "production",
   entry: {
      background: path.resolve(__dirname, "..", "src", "background.ts"),
   },
   output: {
      path: path.join(__dirname, "../dist"),
      filename: "[name].js",
   },
   resolve: {
      extensions: [".ts", ".js"],
   },
   module: {
      rules: [
         {
            test: /\.tsx?$/,
            loader: "ts-loader",
            exclude: /node_modules/,
         },
         {
            test: require.resolve('sgx-ias-js/src/sgx.ts'),
            loader: 'exports-loader',
            options: {
              exports: {
                syntax: 'named',
                name: 'ENCLAVE_FLAGS_NEEDED'
              }
            }
         }
      ],
   },
   plugins: [
      new CopyPlugin({
         patterns: [{from: ".", to: ".", context: "public"}]
      }),
   ],
};
