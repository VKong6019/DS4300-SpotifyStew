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
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const client_id = process.env.SPOTIFY_CLIENT_ID;



const driver = neo4j.driver(neo4j_uri, neo4j.auth.basic(neo4j_username, neo4j_password))
const session = driver.session()



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
        const topTracks = await getUserTopTracks(sessionDetails.data)
        const trackIds = topTracks.map(b => b.id).join(',')
        const audioFeatures = await getAudioFeatures(sessionDetails.data, trackIds)


        res.send(
            {
                userData,
                topTracks, 
                session: sessionDetails.data
            })
        // Insert data into DB after returning tracks. Reduces load time for user
        for (let i = 0; i < audioFeatures.length; i++){
            const ranking = i + 1
            const mergeTrack = {...audioFeatures[i], ...topTracks[i], ranking, userId: userData.id} //{mergeTrack.name.replace(/"/g, '\'')}

            const query = `MERGE (u:user {name: $userId})
                            MERGE (s:song {id: $id, name: $name, acousticness: $acousticness, danceability: $danceability, energy: $energy, tempo: $tempo, valence: $valence})
                            MERGE (u)-[:LISTENS_TO {ranking: $ranking}]-(s)
                            RETURN u, s`
            
            await session.writeTransaction(tx => tx.run (query, mergeTrack))
        }
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

app.get('/blend', async (req,res) => {
    const currUser = req.query.currUser //emilydinh
    const targetUser = req.query.targetUser
    // neo4j query here. Both of these parameters are spotify usernames
    // TODO: replace instance of 'daflyingcactus' and 'emilydinh' with currUser and targetUser respectively
    // this query current compares by average energy. we can just copy and paste this and switch out for other audio properties (valence, danceability,...)
    const query = `match (u:user)--(s:song)
                    call {
                        match (u:user)--(s:song)
                        where u.name= $currUser or u.name= $targetUser
                        return avg(s.energy) as avg_energy
                    }
                    with u, s, avg_energy
                    where (u.name= $currUser or u.name= $targetUser) and s.energy > avg_energy - 0.1 and s.energy < avg_energy + 0.1
                    return u, s
                    order by rand()
                    limit 19
                    
                    union
                    
                    match(u1:user)--(s:song)--(u2:user)
                    call {
                        match (u:user)--(s:song)
                        where u.name= $currUser or u.name= $targetUser
                        return avg(s.energy) as avg_energy
                    }
                    with u1, u2, s, avg_energy
                    where u1.name= $currUser and u2.name= $targetUser and s.energy > avg_energy - 0.1 and s.energy < avg_energy + 0.1
                    return u1 as u, s`
    const results = (await session.run(query, {currUser, targetUser})).records.map(r => ({identity: r._fields[1].identity.low, user: r._fields[0].properties.name, song: r._fields[1].properties}))
    res.send({results})


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