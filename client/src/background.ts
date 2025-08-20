chrome.runtime.onInstalled.addListener(() => {
    console.log("Welcome to Wesley Wei's Real-Time Audio Transcription");

    chrome.tabs.create({
        url: chrome.runtime.getURL("home.html"),
        active: true,
    });
});
