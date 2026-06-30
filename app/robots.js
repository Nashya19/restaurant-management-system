export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/api/'],
        disallow: [
          '/dashboard',
          '/kitchen',
          '/orders',
          '/menu',
          '/tables',
          '/users',
          '/schedule',
          '/surplus',
        ],
      },
      // Specifically allow AI bots to read the llms.txt context file
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'Anthropic-ai', 'Claude-Web', 'PerplexityBot'],
        allow: ['/llms.txt', '/'],
      }
    ],
  }
}
