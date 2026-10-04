// Stand-in for SvelteKit's $env/dynamic/private when tests run outside the app.
export const env: Record<string, string | undefined> = process.env;
