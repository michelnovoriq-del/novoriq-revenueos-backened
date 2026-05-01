"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = exports.login = void 0;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma = new client_1.PrismaClient();
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find the user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // Verify the hash
        const isValid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // Generate the VIP Pass (JWT)
        const token = jsonwebtoken_1.default.sign({ userId: user.id, organizationId: user.organizationId, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, organizationId: user.organizationId });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.login = login;
// NEW: The Registration Engine
const register = async (req, res) => {
    try {
        const { email, password, organizationName } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }
        if (!process.env.JWT_SECRET) {
            console.error('[Register Error]: JWT_SECRET is missing from environment.');
            res.status(500).json({ error: 'Server authentication configuration error' });
            return;
        }
        // 1. Ensure the user doesn't already exist
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(400).json({ error: 'User already exists with this email' });
            return;
        }
        // 2. Securely hash the password
        const saltRounds = 10;
        const passwordHash = await bcrypt_1.default.hash(password, saltRounds);
        // 3. Fallback for organization name if the frontend didn't send one
        const orgName = organizationName || `${email.split('@')[0]}'s Organization`;
        // 4. Create the User AND their Organization in one database transaction
        const newUser = await prisma.user.create({
            data: {
                email,
                passwordHash,
                role: 'ADMIN', // The creator is always the Admin of their new org
                organization: {
                    create: {
                        name: orgName,
                        tier: 'INACTIVE', // Default tier before payment or promo code
                    }
                }
            }
        });
        // 5. Instantly log them in by generating a token
        const token = jsonwebtoken_1.default.sign({ userId: newUser.id, organizationId: newUser.organizationId, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        // 6. Send the token back to the frontend
        res.status(201).json({ token, organizationId: newUser.organizationId });
    }
    catch (error) {
        console.error('[Register Error]:', error);
        res.status(500).json({ error: 'Internal server error during registration' });
    }
};
exports.register = register;
