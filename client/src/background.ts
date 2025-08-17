chrome.runtime.onInstalled.addListener(() => {
    console.log("Welcome to Wesley Wei's Real-Time Audio Transcription");
});

chrome.action.onClicked.addListener((tab) => {
    // Do something when the extension icon is clicked
    console.log("The extension has been clicked.");
});
