#!/bin/bash

echo "[🚀] Initializing Novoriq Environment..."

# 1. Create all the sub-directories at once
mkdir -p src/{routes,controllers,services,webhooks,templates,utils}

# 2. Create the index.ts file and inject your TypeScript code into it
cat << 'CODE' > src/index.ts
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet()); 
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'Novoriq OS is running securely on TypeScript.' });
});

app.listen(PORT, () => {
    console.log(`[🚀] Server running on port ${PORT}`);
});
CODE

# 3. Create the .env file
cat << 'ENV' > .env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/novoriq_db"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
WHOP_API_KEY=""
ENV

echo "[✅] Novoriq OS file structure successfully built!"
