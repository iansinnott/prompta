<!-- display a screenshot -->
<div align="center">

[<img src="src-tauri/icons/icon_256x256.png" alt="prompta logo" width=128>](https://www.prompta.dev)<br>

# Prompta

Yet another interface for chatting with ChatGPT (or GPT-4).

[Website](https://www.prompta.dev)
| [Downloads](releases)
| [Launch App](https://chat.prompta.dev)

</div>

<div align="center">

![](static/screenshot_20230513023629.png)

</div>

| Mobile                                       | Search chats                      | Keyboard Centric                                            | Comments                                    |
| -------------------------------------------- | --------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| ![mobile view](static/screenshot_mobile.png) | ![fts](static/screenshot_fts.png) | ![keyboard centric](static/screenshot_keyboard_centric.png) | ![comments](static/screenshot_comments.png) |

## Features

- [x] Search all previous conversations (full-text!)
- [x] Sync your chat history across devices
- [x] Keyboard centric
- [x] Leave notes on responses, such as "working code!" or "not working"
- [x] Keep all your chat history stored locally
- [x] Search previous chat threads
- [x] Chat with ChatGPT / GPT-4
- [x] Use local LLMs like Llama, Mistral, etc

## Roadmap

- [ ] Context-window compression (See #1)
- [ ] Chat history awareness (See #2)

## How to use

- Use in your web browser: [chat.prompta.dev](https://chat.prompta.dev)
- Download the desktop app: Download the latest build from the [releases page](releases)

### Running on macOS

For macOS users you will need to right-click the app and select "Open" the first time you run it. This is because the app is signed but not notarized.

| Right-click to open                           | Now you can click "Open"                      |
| --------------------------------------------- | --------------------------------------------- |
| ![macOS open](static/screenshot_macopen1.png) | ![macOS open](static/screenshot_macopen2.png) |

## Developing

The following examples use `npm` but `yarn` or `pnpm` will also work:

```bash
npm install
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

## Releasing a new Version

```bash
npm run release
```

You will be prompted to enter a new version number. New versions that don't contain a suffix such as `-beta` or `-alpha` will be published to GitHub.

## Built With

- [SQLite](https://www.sqlite.org/index.html) via [vlcn/cr-sqlite](https://vlcn.io/) - SQLite compiled to WASM running in the browser using CRDTs for conflict-free replication.
- [Tauri](https://tauri.studio) - A Rust-based alternative to Electron (Only used in desktop builds)
- [Svelte](https://svelte.dev) - Reactive UI framework
