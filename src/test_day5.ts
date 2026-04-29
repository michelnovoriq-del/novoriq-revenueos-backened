import { server } from './index';

async function runAudit() {
    console.log("\n[🔒] Running Network & Security Audit...\n");

    try {
        // 1. Simulate frontend login
        console.log("-> Attempting Login as admin@novoriq.local...");
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@novoriq.local', password: 'admin123!' })
        });
        
        const loginData = await loginRes.json();
        
        if (!loginData.token) {
            throw new Error("Failed to receive JWT from login route.");
        }
        console.log("[✅] Login Successful. JWT Received.");

        // 2. Fetch protected organization data
        console.log("\n-> Fetching secure Organization data using JWT...");
        const orgRes = await fetch('http://localhost:3000/api/organizations/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${loginData.token}` }
        });

        const orgData = await orgRes.json();
        console.log("[✅] Protected Data Accessed:");
        console.log(orgData);

    } catch (err) {
        console.error("\n[❌] Audit Failed:", err);
    } finally {
        // Shut down the server to free up the port
        server.close();
        process.exit(0);
    }
}

// Give the server 1 second to fully boot, then run the audit
setTimeout(runAudit, 1000);
