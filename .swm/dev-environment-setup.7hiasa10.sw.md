---
title: Dev environment setup
---
To run your local dev environment you will need a few things on your machine. Follow the steps below.

## Installations

- Install [Node JS](https://nodejs.org/en/download/), version `14.x`

- Install an IDE (preferably [VS Code](https://code.visualstudio.com/))

- Install Git (if you don't already have it on your machine).

## Getting the sources

Clone the repository locally:

```
git clone https://github.com/creativeplatform/crtv3.git
```

## Build

- Within the repository directory, run `yarn install` to install the project's dependencies.

- Then, build the project by running `yarn `<SwmToken path="/package.json" pos="5:2:2" line-data="    &quot;dev&quot;: &quot;next dev&quot;,">`dev`</SwmToken>.

Here's what `yarn `<SwmToken path="/package.json" pos="5:2:2" line-data="    &quot;dev&quot;: &quot;next dev&quot;,">`dev`</SwmToken> doing behind the scenes:

<SwmSnippet path="package.json" line="5">

---

&nbsp;

```
    "dev": "next dev",
```

---

</SwmSnippet>

### Troubleshooting

```
Error! Cannot execute command (...) "need executable 'ar' to convert dir to deb"(...)
```

- For electron builder to run, the package `binutils` needs to be installed. Although it should be included when installing electron on the machine/VM - it sometimes fails

- To avoid build issues, please run `sudo apt-get install binutils` to install this dependency before trying to build the app

## Windows additional steps

## Run the Tests

To run all the tests, run:

```
$ yarn test
```

To run subsets of the tests - you can use `yarn test:<name>`. For example:

```
$ yarn test:server
$ yarn test:utils
```

## Run

### macOS and Linux

```
./scripts/run.sh
```

### Windows

```
 .\scripts\run.bat
```

### Web

```
yarn web
```

## Scripts worth mentioning ⚡️✨

Serve your code with a development web server

```
$ yarn dev
```

Pack for Production. This will generate installers.

```
$ yarn pack
```

See package.json for full list of supported yarn scripts:

<SwmSnippetPlaceholder>

Insert a snippet from package.json that shows all the scripts

</SwmSnippetPlaceholder>

## Debugging

- Open DevTools by pressing Command+Option+I (Mac) or Control+Shift+I (Windows, Linux). This shortcut opens the Console panel.

- Click the Sources tab and pick a file from the files navigator.

- A common method for debugging a problem is to insert a lot of console.log() statements into the code, in order to inspect values as the script executes, but breakpoints can get it done faster.

## Congrats

You now have your dev environment ready 🎉

<SwmMeta version="3.0.0" repo-id="Z2l0aHViJTNBJTNBY3J0djMlM0ElM0FjcmVhdGl2ZXBsYXRmb3Jt" repo-name="crtv3"><sup>Powered by [Swimm](https://app.swimm.io/)</sup></SwmMeta>
