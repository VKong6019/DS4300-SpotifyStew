import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
const port = 8080;

console.log("WOW MY SECRET IS" + process.env.SPOTIFY_CLIENT_ID);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})