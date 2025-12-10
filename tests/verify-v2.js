const BASE_URL = 'http://localhost:3000';

async function run() {
    try {
        console.log('1. Registering User...');
        const email = `user_${Date.now()}@test.com`;
        const resReg = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: 'password' })
        });
        const regData = await resReg.json();
        if (!resReg.ok) throw new Error(JSON.stringify(regData));
        console.log('User registered:', regData.user.email);
        const token = regData.token;

        console.log('2. Deploying App...');
        const appName = `app-${Date.now()}`;
        const resDeploy = await fetch(`${BASE_URL}/deploy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                repoUrl: 'https://github.com/railwayapp-templates/node-express',
                name: appName
            })
        });
        const deployData = await resDeploy.json();
        if (!resDeploy.ok) console.error('Deploy failed:', deployData);
        else console.log('Deploy initiated:', deployData.app.name);

        console.log('3. Listing Apps...');
        const resList = await fetch(`${BASE_URL}/apps`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const apps = await resList.json();
        console.log('Apps found:', apps.length);

        if (apps.find(a => a.name === appName)) {
            console.log('SUCCESS: App found in list.');
        } else {
            console.error('FAILURE: App not found.');
        }

    } catch (e) {
        console.error(e);
    }
}

run();
