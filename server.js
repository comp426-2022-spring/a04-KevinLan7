import minimist from "minimist";
import express from "express";
import {coinFlip,coinFlips,countFlips,flipACoin} from "./coin.mjs";
import fs from 'fs';
import morgan from 'morgan';
import { db } from './database.js';

// Require Express.js
const app = express();

// Make Express use its own built-in body parser for both urlencoded and JSON body data.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let args = minimist(process.argv.slice(2));
let HTTP_PORT = args.port || process.env.PORT || 5000;

// See what is stored in the object produced by minimist
console.log(args)
// Store help text 
const help = (`
server.js [options]

--port	Set the port number for the server to listen on. Must be an integer
            between 1 and 65535.

--debug	If set to true, creates endlpoints /app/log/access/ which returns
            a JSON access log from the database and /app/error which throws 
            an error with the message "Error test successful." Defaults to 
            false.

--log		If set to false, no log files are written. Defaults to true.
            Logs are always written to database.

--help	Return this message and exit.
`)
// If --help or -h, echo help text to STDOUT and exit
if (args.help || args.h) {
    console.log(help)
    process.exit(0)
}

// Start an app server
const server = app.listen(HTTP_PORT, () => {
    console.log('App listening on port %PORT%'.replace('%PORT%',HTTP_PORT));
});

app.use( (req, res, next) => {
    let logdata = {
        remoteaddr: req.ip,
        remoteuser: req.user,
        time: Date.now(),
        method: req.method,
        url: req.url,
        protocol: req.protocol,
        httpversion: req.httpVersion,
        status: res.statusCode,
        referer: req.headers['referer'],
        useragent: req.headers['user-agent']
    }
    const stmt = db.prepare('INSERT INTO userinfo (remoteaddr, remoteuser,time, method, url,protocol, httpversion,status,referer,useragent) VALUES (?, ?,?,?, ?,?,?, ?,?,?);')
    const info = stmt.run(logdata.remoteaddr, logdata.remoteuser,logdata.time,logdata.method,logdata.url,logdata.protocol,logdata.httpversion,logdata.status,logdata.referer,logdata.useragent)
    next();
})

if(args.debug || args.d){
    app.get('/app/log/access',(req,res,next)=>{
        const stmt = db.prepare('SELECT * FROM accesslog').all();
        res.status(200).json(stmt);
    });
    app.get('/app/error',(req,res,next)=>{
        throw new Error("Error test successful.");
    });
}

if(args.log != 'false'){
    const accesslog = fs.createWriteStream('access.log',{flags:'a'});
    app.use(morgan('combined',{stream:accesslog}))
}else{
    console.log("access.log is not created.");
}

app.get('/app/', (req, res) => {
    // Respond with status 200
    res.statusCode = 200;
    // Respond with status message "OK"
    res.statusMessage = 'OK';
    res.writeHead( res.statusCode, { 'Content-Type' : 'text/plain' });
    res.end(res.statusCode+ ' ' +res.statusMessage);
});

app.get('/app/flip',(req,res)=>{
    let flip = coinFlip();
    res.status(200).json({'flip':flip});
});

app.get('/app/flips/:number', (req, res) => {
    let flip = coinFlips(req.params.number);
    let count = countFlips(flip);
    res.status(200).json({'raw':flip,'summary':count});
});

app.get('/app/flip/call/heads',(req,res)=>{
    res.status(200).json(flipACoin("heads"));
});

app.get('/app/flip/call/tails',(req,res)=>{
    res.status(200).json(flipACoin("tails"));
});

// Default response for any other request
app.use(function(req, res){
    res.status(404).send('404 NOT FOUND');
});