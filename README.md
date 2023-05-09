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

![](static/CleanShot%202023-04-23%20at%2015.02.37.jpg)

</div>

## Features

- [x] Sync your chat history across devices
- [x] Keep all your chat history stored locally
- [x] Search previous chat threads
- [x] Chat with ChatGPT or GPT-4
- [x] Keyboard focused
- [x] Leave notes on GPT's responses, such as "working code!" or "not working"

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
- [Tauri](https://tauri.studio) - A Rust-based alternative to Electron
- [Svelte](https://svelte.dev) - Reactive UI framework
