import React, { useState } from 'react';
import Dropdown from 'react-dropdown';
import 'react-dropdown/style.css';
import './App.css';

const moodMap = {
  20: ["depressed 😭", "#aeb5bf"],
  40: ["gloomy 😔", "#0047AB"],
  60: ["calm 😐", "#8800CC"],
  80: ["cheerful 🙂", "#FF6680"],
  100: ["euphoric 😂", "#FFFF33"]
}

function describeAudioAura(avgValence) {
  for (let moodMapKey in moodMap) {
    if (avgValence <= Number(moodMapKey)) {
      return moodMap[moodMapKey];
    }
  }
}

function App() {

  const blendOptions = [
    'energy', 'valence', 'danceability'
  ];

  const [usernameInput, setUsernameInput] = useState('nzp15');
  const [blendOption, setBlendOption] = useState(blendOptions[0]);

  const [results, setResults] = useState([]);
  const [users, setUsers] = useState([]);

  const [aggStats, setAggStats] = useState({});
  //let { userId } = useParams();

  const queryParams = new URLSearchParams(window.location.search);
  const userId = queryParams.get('userId');
  const displayName = queryParams.get('displayName');
  fetch(`api/users`)
  .then(res => res.json())
  .then((result => {
    console.log(result);
    setUsers(result);
  }))
  const sendUsername = async () =>{
    await fetch(`api/blend?currUser=${userId}&targetUser=${usernameInput}&blendProp=${blendOption}`)
    .then(res => res.json())
    .then((result => {
      console.log(result);
      setResults(result.results);
    }))

    await fetch(`api/stats?currUser=${userId}&targetUser=${usernameInput}`)
        .then(res => res.json())
        .then((result => {
          console.log(result);
          setAggStats(result);
        }))

        
  }
  const CompileStats = () => {
    const currAudioAura = describeAudioAura(aggStats["v1"]);
    const targetAudioAura = describeAudioAura(aggStats["v2"]);
    const compareValence = `Your music is ${aggStats["vdelta"]}% ${aggStats["vdelta"] > 0 ? "" : "less"} happier 🌤️ than ${usernameInput}`;
    const compareEnergy = `Your music is ${aggStats["edelta"]}% ${aggStats["edelta"] > 0 ? "" : "less"} livelier 🎤 than ${usernameInput}`;
    const compareDanceability = `Your music is ${aggStats["ddelta"]}% ${aggStats["ddelta"] > 0 ? "more" : "less"} danceable 🕺🏽 than ${usernameInput}`;

    // TODO:  will fix the styling :sweats:
    return (
        <>
          <h2>Between you and {usernameInput}:</h2>
          <h3>You seem to listen to {currAudioAura[0]} music</h3>
          <h3>Here's your audio aura!</h3>
          <div className="square" style={{ background: currAudioAura[1]}}/>
          <h3>{usernameInput} seems to listen to {targetAudioAura[0]} music</h3>
          <h3>Here's {usernameInput} audio aura!</h3>
          <div className="square" style={{ background: targetAudioAura[1]}}/>
          <h3>{compareValence}</h3>
          <h3>{compareEnergy}</h3>
          <h3>{compareDanceability}</h3>
        </>
    )
  }


  function onSelect(e){
    setBlendOption(e.value);
  }
  function onUserSelect(e){
    setUsernameInput(e.value);
  }


  return (
    <div className="App">
      <header className="App-header">
        <h1>Hello {displayName}</h1>
        <div className="Blend-Panel">
          <label>
            Select a username to blend with:
            {users ? (<Dropdown options={users} onChange={onUserSelect} value={usernameInput} placeholder="Select an option" />) : (<br></br>)}
          </label>
        </div>
        <label>
            Blend Options
            <Dropdown options={blendOptions} onChange={onSelect} value={blendOption} placeholder="Select an option" />
          </label>
          <button className = "button1" onClick = {sendUsername}>Blend</button>

        {Object.keys(aggStats).length !== 0 && <CompileStats/>}
        <ul>
          {results.length > 0 ? (
        <table>
          <tr>
            <th>Name</th>
            <th>From User</th>
            <th>Identity</th>
            <th>View on spotify</th>
          </tr>
          {
          results.map((result) => {
            return <tr>
            <td>{result.song.name}</td>
            <td>{result.user}</td>
            <td>{result.identity}</td>
            <td><a target = "_blank" href = {'https://open.spotify.com/track/' + result.song.id}>View Song</a></td>
          </tr>
          })
        }
          
        </table>) : (<br></br>) }
        
        </ul>
      </header>
    </div>
  );
}

export default App;
