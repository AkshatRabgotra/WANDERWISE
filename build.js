const fs = require('fs');
const https = require('https');

function fetch(url, cb) {
    https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let loc = res.headers.location;
            if (loc.startsWith('/')) loc = 'https://unpkg.com' + loc;
            return fetch(loc, cb);
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => cb(data));
    });
}

console.log('Building static/bundle.js...');
fetch('https://unpkg.com/@babel/standalone/babel.min.js', (babelCode) => {
    const vm = require('vm');
    const context = { window: {}, navigator: {} };
    vm.createContext(context);
    vm.runInContext(babelCode, context);
    const Babel = context.Babel || context.window.Babel;
    
    const src = fs.readFileSync('static/script.js', 'utf8');
    const compiled = Babel.transform(src, { presets: [['react', { runtime: 'classic' }]] }).code;
    fs.writeFileSync('static/bundle.js', compiled, 'utf8');
    console.log('Successfully compiled static/script.js -> static/bundle.js (' + compiled.length + ' bytes)');
    process.exit(0);
});
