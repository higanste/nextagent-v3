# NextAgent v3

The intelligent edge for AI agent deployment. Built with Next.js 15, Auth.js v5, Drizzle ORM, and Neon PostgreSQL — deployed on Vercel.

## Stack

- **Framework**: Next.js 15 (App Router)
- **Auth**: Auth.js v5 (Google OAuth)
- **Database**: Neon PostgreSQL + Drizzle ORM
- **AI**: Groq (Llama 3), OpenRouter (Claude/GPT-4o)
- **Payments**: Stripe
- **Deploy**: Vercel

## Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your values in .env.local

# Push schema to your Neon database
npm run db:push

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

See `.env.example` for all required variables. Add them to your Vercel project settings for production.

## Database

Uses [Neon](https://neon.tech) serverless PostgreSQL with Drizzle ORM.

```bash
npm run db:generate   # Generate migration files
npm run db:migrate    # Run migrations
npm run db:push       # Push schema directly (dev)
```

## Deployment

This project deploys automatically to Vercel on every push to `main`. Connect your Neon database and set all env vars in Vercel project settings.

## License

MIT
