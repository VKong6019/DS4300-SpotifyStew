import React, { useState } from 'react';
import Dropdown from 'react-dropdown';
import 'react-dropdown/style.css';
import logo from './logo.svg';
import './App.css';



function App() {

  const blendOptions = [
    'energy', 'valence', 'danceability'
  ];

  const [usernameInput, setUsernameInput] = useState('');
  const [blendOption, setBlendOption] = useState(blendOptions[0]);
  const [results, setResults] = useState([]);
  //let { userId } = useParams();

  const queryParams = new URLSearchParams(window.location.search);
  const userId = queryParams.get('userId');
  const displayName = queryParams.get('displayName');
  
  function sendUsername(){

    fetch(`api/blend?currUser=${userId}&targetUser=${usernameInput}&blendProp=${blendOption}`)
    .then(res => res.json())
    .then((result => {
      console.log(result);
      setResults(result.results);
    }))
  }

  function onSelect(e){
    setBlendOption(e.value);
  }


  return (
    <div className="App">
      <header className="App-header">
        <h1>Hello {displayName}</h1>
        <label>
          Enter a username to blend with:
          <input value={usernameInput} onChange={(inp) => {setUsernameInput(inp.target.value)}}></input>
        </label>
        <Dropdown options={blendOptions} onChange={onSelect} value={blendOption} placeholder="Select an option" />
        <button onClick = {sendUsername}>Blend</button>
        <ul>
        {
          results.map((result) => {
            return <li>Name: {result.song.name}, From User: {result.user}, Identity: {result.identity}, <a target = "_blank" href = {'https://open.spotify.com/track/' + result.song.id}>View Song</a></li>
          })
        }
        </ul>
      </header>
    </div>
  );
}

export default App;
