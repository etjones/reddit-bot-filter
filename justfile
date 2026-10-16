run:
    npx --yes web-ext run --source-dir extension --start-url https://old.reddit.com/

lint:
    npx --yes web-ext lint --source-dir extension

test:
    node --test tests/*.test.js
