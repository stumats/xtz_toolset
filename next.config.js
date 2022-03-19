module.exports = {
    reactStrictMode: true,
    poweredByHeader: false,
    trailingSlash: false,
    images: {
        domains: ['services.tzkt.io'],
    },
    async redirects() {
        return [
            {
                source: '/emergency',
                destination: '/swap/emergency',
                permanent: true,
            },
            {
                source: '/transfer',
                destination: '/migrate/transfer',
                permanent: true,
            },
        ]
    },
    async rewrites() {
        return {
            // After checking all Next.js pages (including dynamic routes)
            // and static files we proxy any other requests
            fallback: [
                {
                    source: '/:path*',
                    destination: `/tools/:path*.html`,
                },
            ],
        }
    }
}