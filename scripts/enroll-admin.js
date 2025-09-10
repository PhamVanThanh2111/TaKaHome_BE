const FabricCAServices = require('fabric-ca-client');
const { Wallets, X509Identity } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function enrollAdmin(orgName, caPort, mspId) {
    try {
        // Read the CA cert
        const caCertPath = path.resolve(__dirname, `../assets/blockchain/tls/ca-${orgName.toLowerCase()}.crt`);
        const caCert = fs.readFileSync(caCertPath, 'utf8');

        // Create CA client
        const caURL = `https://localhost:${caPort}`;
        const ca = new FabricCAServices(caURL, {
            trustedRoots: [caCert],
            verify: false
        });

        // Create file system wallet
        const walletPath = path.resolve(__dirname, '../assets/blockchain/wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check if admin already enrolled
        const adminIdentity = await wallet.get(`admin-${orgName}`);
        if (adminIdentity) {
            console.log(`An identity for the admin user admin-${orgName} already exists in the wallet`);
            return;
        }

        // Enroll the admin user
        const enrollment = await ca.enroll({
            enrollmentID: 'admin',
            enrollmentSecret: 'adminpw'
        });

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: mspId,
            type: 'X.509',
        };

        await wallet.put(`admin-${orgName}`, x509Identity);
        console.log(`✅ Successfully enrolled admin user admin-${orgName} and imported it into the wallet`);

        // Also enroll ca-admin
        const caAdminIdentity = await wallet.get(`ca-admin-${orgName}`);
        if (!caAdminIdentity) {
            await wallet.put(`ca-admin-${orgName}`, x509Identity);
            console.log(`✅ Successfully enrolled ca-admin-${orgName} and imported it into the wallet`);
        }

    } catch (error) {
        console.error(`❌ Failed to enroll admin user for ${orgName}:`, error);
    }
}

async function main() {
    console.log('🔧 Starting admin enrollment...');
    
    // Enroll admins for all organizations
    await enrollAdmin('OrgProp', 7054, 'OrgPropMSP');
    await enrollAdmin('OrgTenant', 8054, 'OrgTenantMSP');
    await enrollAdmin('OrgLandlord', 9054, 'OrgLandlordMSP');
    
    console.log('✅ Admin enrollment completed!');
}

main().catch(console.error);
