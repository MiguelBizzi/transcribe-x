const defaults: Record<string, string> = {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret',
    SERVER_PORT: '3333',
    DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/transcribe_test',
    FRONTEND_URL: 'http://127.0.0.1:3000',
    GOOGLE_CLIENT_ID: 'test-google-client',
    GOOGLE_CLIENT_SECRET: 'test-google-secret',
    GOOGLE_REDIRECT_URI: 'http://127.0.0.1:3000/auth/google/callback',
    YOUTUBE_API_KEY: 'test-youtube-key',
}

for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) {
        process.env[key] = value
    }
}
