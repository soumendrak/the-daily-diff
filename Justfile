# Restart with fresh edition data and exports, then enable live reload.
dev:
    npx astro dev stop
    npx astro sync --force
    node scripts/generate-latest.js
    npm run dev -- --background

# Show the development server status.
status:
    npx astro dev status

# Follow development server logs.
logs:
    npx astro dev logs

# Stop the background development server.
stop:
    npx astro dev stop
