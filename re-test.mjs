const s = 'x+(b)/(2a)';
console.log('plain:', JSON.stringify(s.match(/\(([^()\s]+)\)\/([^()\s]+)/)));
console.log('lbfree:', JSON.stringify(s.match(/([^()\s]+)\)\/([^()\s]+)/)));
console.log('esc:', JSON.stringify(s.match(/\(b\)\/2a/)));
console.log('class:', JSON.stringify(s.match(/[^()\s]+/)));
console.log('split:', JSON.stringify(s.split('')));
