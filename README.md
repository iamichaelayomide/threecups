# Cup Chase

A mobile-first 3D cup-and-stone memory game built with React, Vite, TypeScript, Three.js, and GSAP.

## Live Deploy

GitHub Pages URL after the first successful deploy:

https://iamichaelayomide.github.io/threecups/

## Local Development

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run test
npm run build
```

## Deployment

This repo includes a GitHub Actions workflow at `.github/workflows/deploy.yml`.

Every push to `main` will:

1. Install dependencies with `npm ci`
2. Run the game logic tests
3. Build the Vite app with `--base=/threecups/`
4. Publish `dist/` to GitHub Pages
