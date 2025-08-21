# Real-Time Audio Transcription Chrome Extension

> Developed by: Wesley Wei

## About

This is a Chrome Extension designed to capture audio and provide real-time transcription. It has two different audio processing modes: tab and microphone. There are also two different transcript processing modes: real-time and chunks. After transcribing the audio, the user can then either copy the transcript to their clipboard or download TXT/JSON files.

The audio transcription is provided by Google's Speech-to-Text API, so an API key is required in order to make this Chrome Extension to work properly.

### Example Use Cases

-   Opening up a YouTube/Netflix/SoundCloud tab and recording transcriptions.
-   Opening up a random Google Chrome tab a, selecting microphone as an audio source, and record a video meeting conversation (where the microphone picks up your speech and the other speaker's speech from the speakers).
    > _Both cases they could copy or download (TXT/JSON) the transcript_

## Demo

🎥[Watch the demo on Google Drive](https://drive.google.com/file/d/1Qq7iBDKAIlUiGs1FKgin6YG8V0D8GG8w/view?usp=sharing)

## Setup

#### Development

-   Local Development
    1. Download Google Cloud Speech-to-Text API key.
    2. Create `.env` file within `server/` root and add key-value pair (`GOOGLE_CLOUD_SERVICE_KEY=<GOOGLE_CLOUD_SERVICE_KEY_URL_PATH>`).
    3. Install dependencies.
        - `cd client && npm install`
        - `cd server && npm install`
    4. Startup live development.
        - In one terminal:
            1. `cd client`
            2. `npm run dev:live`
        - In second terminal:
            1. `cd server`
            2. `npm run dev`
    5. Load unpacked `client/dist/` bundle via `chrome://extensions/` in Google Chrome with `developer mode` enabled.
    6. Now you can interact with the Chrome Extension by opening the Popup or SidePanel or `chrome-extension://<chrome-extension-id>/home.html`.

## License

This project is licensed under the GNU General Public License v3.0 (GPL).
You are free to use, modify, and distribute the code under the GPL terms.
See the LICENSE file in this repository for full details.

### Commercial Use

If you want to use this software in a closed-source or commercial project, you can contact me for a commercial license at wesley631w@gmail.com.
See LICENSE-COMMERCIAL.txt for details.

## Contributing

Contributions are welcome! Please fork the repo, make your changes, and submit a pull request.
All contributions will be considered under the GPL license and may also be included under the commercial license for future releases.

## Contact

Wesley Wei — wesley631w@gmail.com
GitHub: https://github.com/JourneyToTheWes
