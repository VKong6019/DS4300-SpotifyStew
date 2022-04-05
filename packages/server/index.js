import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import querystring from 'query-string';
import base64url from 'base64url';
import randomstring from 'randomstring';
import axios from 'axios';

dotenv.config();
const app = express();
const port = 8080;

// parse application/json

const redirect_uri = 'http://localhost:8080/';

const code_verifier = randomstring.generate(128);

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

const base64Digest = crypto
  .createHash("sha256")
  .update(code_verifier)
  .digest("base64");

const code_challenge = base64url.fromBase64(base64Digest);

app.get('/', (req, res) => {
    res.send({'key': 'Hello World!'})

    var code = req.query.code || null;
    var state = req.query.state || null;

    if (state === null) {
        res.redirect('/err')
    } else {
        var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code,
                redirect_uri,
                grant_type: 'authorization_code',
                client_id: process.env.SPOTIFY_CLIENT_ID,
                code_verifier
            },
            headers: {
                'Authorization':  `Basic ${Buffer.from(process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded' 
            },
        };

        axios.post(authOptions.url, querystring.stringify(authOptions.form), {"headers": authOptions.headers}).then(r => console.log(r)).catch(r => console.error(r));
    }
})

app.get('/err', (req, res) => {
    res.status(400).send('Something broke!')
});

app.get('/login', (req, res) => {
    const state = crypto.randomBytes(20).toString('hex');
    const scope = 'user-read-private user-read-email';

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: process.env.SPOTIFY_CLIENT_ID,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state,
            show_dialog: true,
            code_challenge_method: 'S256',
            code_challenge: code_challenge
        }));
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})