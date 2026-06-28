const tsConfigPaths = require('tsconfig-paths');
const path = require('path');
const tsConfig = require('./tsconfig.json');

// The compiled JS lives in dist/ (TypeScript strips the src/ prefix).
// We must remap paths so e.g. @/* -> * instead of @/* -> src/*.
const baseUrl = path.resolve(__dirname, 'dist');

// Strip the leading "src/" from every path mapping value so the aliases
// point at the correct locations inside dist/.
const compiledPaths = {};
for (const [key, values] of Object.entries(tsConfig.compilerOptions.paths)) {
    compiledPaths[key] = values.map((v) => v.replace(/^src\//, ''));
}

tsConfigPaths.register({
    baseUrl,
    paths: compiledPaths,
});
