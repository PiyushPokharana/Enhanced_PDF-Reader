/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable strict mode for development
    reactStrictMode: true,

    // Allow external scripts from CDNs
    headers: async () => {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY'
                    }
                ]
            }
        ];
    },

    // Allow PDF.js and Quill CDN imports
    images: {
        domains: ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com']
    },

    // Webpack configuration for PDF.js worker
    webpack: (config, { isServer }) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            path: false,
            crypto: false
        };

        return config;
    }
};

module.exports = nextConfig;
