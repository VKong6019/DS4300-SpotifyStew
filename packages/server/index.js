import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import querystring from 'query-string';
import base64url from 'base64url';
import randomstring from 'randomstring';
import axios from 'axios';
import * as neo4j from 'neo4j-driver'


dotenv.config();
const app = express();
const port = 8080;

// parse application/json

const redirect_uri = 'http://localhost:8080/';

const code_verifier = randomstring.generate(128);

// move to ENV
const neo4j_username = process.env.NEO4J_USERNAME;
const neo4j_password = process.env.NEO4J_PASSWORD;
const neo4j_uri = process.env.DB_URI;


const driver = neo4j.driver(neo4j_uri, neo4j.auth.basic(neo4j_username, neo4j_password))
const session = driver.session()

const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const client_id = process.env.SPOTIFY_CLIENT_ID;

const base64Digest = crypto
  .createHash("sha256")
  .update(code_verifier)
  .digest("base64");

const code_challenge = base64url.fromBase64(base64Digest);

app.get('/', async (req, res) => {

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
                client_id,
                code_verifier
            },
            headers: {
                'Authorization':  `Basic ${Buffer.from(client_id + ":" + client_secret).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded' 
            },
        };

        const sessionDetails  = await axios.post(authOptions.url, querystring.stringify(authOptions.form), {"headers": authOptions.headers}).catch(r => console.error(r));
        const userData = await getUserProfile(sessionDetails.data) // .id
        console.log(userData)
        const topTracks = await getUserTopTracks(sessionDetails.data)
        const trackIds = topTracks.map(b => b.id).join(',')
        const audioFeatures = await getAudioFeatures(sessionDetails.data, trackIds)
        let mergedData = []
        // insert into neo4j in for loop?

        for (let i = 0; i < trackIds.length; i++){
            // if !
            if (!topTracks[i].name){
                continue
            }
            //console.log(audioFeatures[i].id,topTracks[i].id) 
            const mergeTrack = {...audioFeatures[i], ...topTracks[i] }
            mergedData.push(mergeTrack)
            // Running into an async error Cannot read property 'name' of undefined... working on it.
            if (!mergeTrack.name){
                continue
            }
            const ranking = i + 1
            
            const query = `MERGE (u:user {name: "${userData.id}"})
                            MERGE (s:song {name: "${mergeTrack.name.replace(/"/g, '\'')}", acousticness: ${mergeTrack.acousticness}, danceability: ${mergeTrack.danceability}, energy: ${mergeTrack.energy}, tempo: ${mergeTrack.tempo}, valence: ${mergeTrack.valence}})
                            MERGE (u)-[:LISTENS_TO {ranking: ${ranking}}]-(s)
                            RETURN u, s`
            
            const writeResult = await session.writeTransaction(tx => tx.run (query, { userData, mergeTrack, ranking }))
        }
        
        res.send({mergedData})
        
    }
})

app.get('/err', (req, res) => {
    res.status(400).send('Something broke!')
});

app.get('/login', (req, res) => {
    const state = crypto.randomBytes(20).toString('hex');
    const scope = 'user-read-private user-read-email user-top-read';

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

app.get('/blend', (req,res) => {
    const username = req.params.username


})

const getUserTopTracks = async (data) => {
    try {
        const resp = await axios.get(`https://api.spotify.com/v1/me/top/tracks?limit=50&offset=0`, { headers: {
            "Authorization": `${data.token_type} ${data.access_token}`
        }});
        return resp.data.items
    } catch (err) {
        console.log(err)
        return []
    }
}
const getUserProfile = async (data) => {
    try {
        const resp = await axios.get("https://api.spotify.com/v1/me", { headers: {
            "Authorization": `${data.token_type} ${data.access_token}`
        }});
        return resp.data
    } catch (err) {
        console.log(err)
        return {}
    }
} 
const getAudioFeatures = async (data,ids) => {
    try {
        const resp = await axios.get(`https://api.spotify.com/v1/audio-features?ids=${ids}`, { headers: {
            "Authorization": `${data.token_type} ${data.access_token}`
        }});
        return resp.data.audio_features
    } catch (err) {
        console.log(err)
        return []
    }
} 