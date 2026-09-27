# Static GitHub Pages setup

This version is a static export. GitHub Pages can host the built files directly, but a static site cannot write back into repository folders at runtime. Content is therefore stored in each visitor's browser using localStorage. Admin mode is a client-side test gate and is not secure; the test token is `cauli-test-admin` and is intentionally visible in the shipped JavaScript.

Build the project and publish the generated `out/` folder with GitHub Pages or any static host. Changes are local to the browser that made them and are not shared between visitors.

---

# Previous server storage setup

The site stores its data in `data/cauli-local.json` in the GitHub repository.
The server talks to GitHub using the Contents API. No GitHub token is sent to the browser.

## Environment variables

Set these in Vercel (or your server environment):

```env
GITHUB_OWNER=cauli-site
GITHUB_REPO=main
GITHUB_BRANCH=main
GITHUB_TOKEN=your_fine_grained_github_token
CAULI_ADMIN_TOKEN=your_admin_token
```

Do not commit a real `.env` file or any token to GitHub.

## GitHub token permissions

Create a fine-grained Personal Access Token and restrict it to the `cauli-site/main` repository.
Give it only:

- Repository permissions → Contents → Read and write

The token is used only by the server to read and update `data/cauli-local.json`.

## First upload

Upload the project to the `cauli-site/main` repository. Make sure this file exists:

```text
data/cauli-local.json
```

The repository may be empty before the first upload; after the project is pushed, the JSON file becomes the persistent store.

## How writes work

A question/content update reads the current JSON file, changes it, and commits the new JSON back to the same path. If two requests race, the code retries after a GitHub SHA conflict so the newer file is reloaded before applying the change again.
