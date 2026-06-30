const fetch = require('node-fetch'); // just using simple script to see the network intercept if possible, but actually I'll just check node_modules.
// Let's read the node_modules/@supabase/auth-js/dist/main/GoTrueClient.js
const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\Divine\\node_modules\\@supabase\\auth-js\\dist\\main\\GoTrueClient.js', 'utf8');

// Also check the specific method for signUp
console.log(content.substring(content.indexOf('signUp('), content.indexOf('signUp(') + 1500));
