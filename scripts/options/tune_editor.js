$(function(){
var pitchTemplate, playButton, saveButton, tune, activeTownTuneSaveState, townTuneSaveStates;
const defaultTune = ["C3", "E3", "C3", "G2", "F2", "G2", "B2", "D3", "C3", "zZz", "?", "zZz", "C3", "-", "-", "zZz"]; // From AC: Wild World
const defaultTownTuneSaveStates = [
  {
    "name": "TownTune #1",
    "tune": defaultTune
  }
];
var tuneLength = 16;
var availableColors = ["#A4A4FF", "#FFB0FF", "#52D3FE", "#12FEE0", "#53FD8A", "#79FC4E", "#A8FD35", "#D0FE47",
                       "#E4FD39", "#F9FE2E", "#FEFA43", "#FEF03F", "#FCD03A", "#FCB141", "#FE912E", "#FE7929"];
var editorControls = [];
var pitchNames = [];
var flashColor = '#FFFFFF';
var audioContext = new AudioContext;

var booper     = createBooper(audioContext);  // Instrument for the town tune editor
var sampler    = createSampler(audioContext); // Instrument for the town tune playing at the hour
var tunePlayer = createTunePlayer(audioContext); // Responsible for playing town tunes
var availablePitches = tunePlayer.availablePitches;
var rest = availablePitches[0];

var defaultTownTuneVolume = 0.75; // Default town tune volume, used as fallback when retreiving town tune volume from chrome storage. (Just here to make it easier to change)

$(".pitch-template > .pitch-slider")[0].max = availablePitches.length-1;

const townTuneSaveSlotsSelect = document.querySelector('#town-tune-save-slots');
const townTuneRenameSaveSlotBtn = document.querySelector('#town-town-rename-save-slot')
const townTuneNewSaveSlotBtn = document.querySelector('#town-tune-new-save-slot');
const townTuneDeleteSaveSlotBtn = document.querySelector('#town-tune-delete-save-slot');

const getCurrentSaveSlotOption = () => {
  return townTuneSaveSlotsSelect.options[townTuneSaveSlotsSelect.options.selectedIndex];
}

var createPitchControl = function(index) {
  var pitch = pitchTemplate.cloneNode(true);
  var name = pitch.querySelector('.pitch-name');
  var slider = pitch.querySelector('.pitch-slider');

  pitch.className = 'pitch';
  pitch.id = 'pitch' + index;

  name.value = tune[index];
  name.style.borderColor = "transparent";

  name.onchange = function() {
    var val = name.value.toUpperCase();
    var pitchIndex = availablePitches.indexOf(val);
    if (pitchIndex != -1) {
      slider.value = pitchIndex;
      name.value = val;
    } else {
      slider.value = 0;
      name.value = rest;
      val = rest;
    }
    updateTune(index, val);
    saveButton.textContent = 'Save';
  };

  slider.value = availablePitches.indexOf(tune[index]);

  slider.oninput = function() {
    var val = slider.value;
    name.value =       availablePitches[val];
    updateTune (index, availablePitches[val]);
	  updateColor(index, availablePitches[val]);
    saveButton.textContent = 'Save';
  };

  pitchNames.push(name);
  editorControls.push(name, slider);

  return pitch;
};

var initControls = function() {
  var index, newPitchControl, staff;

  var staff1 = document.querySelector('.staff1');
  var staff2 = document.querySelector('.staff2');
  pitchTemplate = document.querySelector('.pitch-template');
  playButton = document.querySelector('.play-tune');
  resetButton = document.querySelector('.reset-tune');
  randomizeButton = document.querySelector('.randomize-tune');
  saveButton = document.querySelector('.save-tune');
  let volumeSlider = document.getElementById("townTuneVolume");

  for (index = 0; index < tuneLength; index++) {
    newPitchControl = createPitchControl(index);
    staff = (index < tuneLength/2) ? staff1 : staff2;
    staff.appendChild(newPitchControl);
	  updateColor(index, tune[index]);
  }

  playButton.onclick  = playTune;
  resetButton.onclick = resetTune;
  randomizeButton.onclick = randomizeTune;
  saveButton.onclick = function(){
    saveTune();
    saveOptions();
  }

  editorControls.push(playButton);
  editorControls.push(resetButton);
  editorControls.push(randomizeButton);
  editorControls.push(volumeSlider);

  // select town tune save slot
  townTuneSaveSlotsSelect.addEventListener('change', () => {
    activeTownTuneSaveState = townTuneSaveSlotsSelect.options.selectedIndex;
    tune = townTuneSaveStates[activeTownTuneSaveState].tune;
    setTuneSliders();
  });

  // rename town tune save slot
  townTuneRenameSaveSlotBtn.addEventListener('click', () => {
    const saveSlot = getCurrentSaveSlotOption();
    const name = window.prompt('Rename save slot:', saveSlot.text).trim();
    if (!name)
      return window.alert('Name cannot be empty!');
    saveSlot.text = name;

    townTuneSaveStates[activeTownTuneSaveState].name = name;
  });

  // new town tune save slot
  townTuneNewSaveSlotBtn.addEventListener('click', () => {
    const saveSlot = document.createElement('option');
    const index = townTuneSaveSlotsSelect.options.length - 1;
    const name = 'TownTune #' + (townTuneSaveSlotsSelect.options.length + 1);
    const tune = defaultTune;

    saveSlot.text = name;
    townTuneSaveSlotsSelect.appendChild(saveSlot);
    townTuneSaveSlotsSelect.options.selectedIndex = index;
    townTuneSaveSlotsSelect.dispatchEvent(new Event('change'));

    townTuneSaveStates[index] = {
      name: name,
      tune: tune
    };
  });

  // delete town tune save slot
  townTuneDeleteSaveSlotBtn.addEventListener('click', () => {
    const saveSlot = getCurrentSaveSlotOption();

    if (townTuneSaveStates.length === 1)
      return window.alert('You must have at lease 1 save slot!');

    if (window.confirm(`Delete save slot "${saveSlot.text}"?`)) {
      townTuneSaveStates.splice(townTuneSaveSlotsSelect.options.selectedIndex, 1);
      townTuneSaveSlotsSelect.removeChild(saveSlot);
    }
  });

  // init town tune selector
  townTuneSaveStates.forEach((saveState) => {
    const saveSlot = document.createElement('option');
    saveSlot.text = saveState.name;
    townTuneSaveSlotsSelect.appendChild(saveSlot);
  });
  townTuneSaveSlotsSelect.options.selectedIndex = activeTownTuneSaveState;
  townTuneSaveSlotsSelect.dispatchEvent(new Event('change'));
};

var disableEditor = function() {
  playButton.textContent = 'Playing!';
  for (var i in editorControls) {
    editorControls[i].disabled = true;
  }
};

var enableEditor = function() {
  playButton.textContent = 'Play!';
  for (var i in editorControls) {
    editorControls[i].disabled = false;
  }
};

var flashName = function(index, duration) {
  var pitchName = pitchNames[index];
  pitchName.style.background = flashColor;
  pitchName.style.borderColor = availableColors[availablePitches.indexOf(tune[index])];
  let pitch = pitchName.value;

  if (pitch == '-'){
    pitchName.style.transform = "scale(1.1) translate(-3px, 0) rotate(-15deg)";
  } else
  if(pitch != "zZz") {
    pitchName.style.transform = "scale(1.25) rotate(10deg)";
  }

  setTimeout(function() {
    updateColor(index, tune[index]);
    pitchName.style.borderColor = "transparent";
    pitchName.style.transform = "initial";
  }, duration * 1000);
};

/**
 * @method playTune
 * @desc   Plays the town tune using createBooper as an instrument, used only by the town tune editor
 */
var playTune = function() {
  chrome.storage.sync.get({townTuneVolume: defaultTownTuneVolume}, function(items){
    disableEditor();
    tunePlayer.playTune(tune, booper, 240, items.townTuneVolume).eachNote(flashName).done(enableEditor);
  });
};

var resetTune = function() {
  tune = Array.from(defaultTune);
  setTuneSliders();
}

const setTuneSliders = () => {
  let tuneSliders = document.getElementsByClassName("pitch");
  for (let i = 0; i < tuneLength; i++) {
    let range = tuneSliders[i].getElementsByClassName("pitch-slider")[0];
    let label = tuneSliders[i].getElementsByClassName("pitch-name")[0];
    label.value = tune[i];
    range.value = availablePitches.indexOf(tune[i]);
    updateColor(i,tune[i]);
  }
}

var randomizeTune = function(){
  let tuneSliders = document.getElementsByClassName("pitch");

  // Randomizing sliders
  for (let i = 0; i < tuneLength; i++) {
    // Selecting a random pitch
    let pitch =  availablePitches[ 2 + Math.floor( Math.random() * availablePitches.length-2 ) ];
    tune[i] = pitch;

    // Setting values
    let range = tuneSliders[i].getElementsByClassName("pitch-slider")[0];
    let label = tuneSliders[i].getElementsByClassName("pitch-name")[0];
    label.value = tune[i];
    range.value = availablePitches.indexOf(tune[i]);
	  updateColor(i,tune[i]);
  }
}

var retrieveTune = function(done) {
  chrome.storage.sync.get({ activeTownTuneSaveState: 0, townTuneSaveStates: defaultTownTuneSaveStates }, function(items){
    activeTownTuneSaveState = items.activeTownTuneSaveState;
    townTuneSaveStates = items.townTuneSaveStates;
    tune = items.townTuneSaveStates[items.activeTownTuneSaveState].tune;
    if (typeof done == 'function') done();
  });
};

var saveTune = function() {
  chrome.storage.sync.set({ activeTownTuneSaveState: activeTownTuneSaveState, townTuneSaveStates: townTuneSaveStates }, function() {
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;
    setTimeout(function() {
      saveButton.textContent = 'Saved!';
      saveButton.disabled = false;
      setTimeout(function() {
        saveButton.textContent = 'Save';
      }, 2000);
    }, 750);
  });
};

var setup = function() {
  retrieveTune(initControls);
};

var updateColor = function(index, pitch){
  var pitchName = pitchNames[index];
  pitchName.style.background = availableColors[availablePitches.indexOf(pitch)];
}

var updateTune = function(index, pitch) {
  chrome.storage.sync.get({townTuneVolume: defaultTownTuneVolume}, function(items){
    tune[index] = pitch;
    booper.playNote(pitch, undefined, undefined, items.townTuneVolume);
  });
};

window.addEventListener('load', setup);
}) //();
// changed execution of tune_editor.js by adding the jQuery document-ready method to the start (https://learn.jquery.com/using-jquery-core/document-ready/)
// (=> This files' content waits until the page is finished loading before it runs)
