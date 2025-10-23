const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');

async function reenrollAdmin(orgName, caUrl, tlsCertPath, mspId, caName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Re-enrolling admin for ${orgName}`);
    console.log('='.repeat(60));

    try {
        // Read TLS certificate
        let tlsCACerts = '';
        if (fs.existsSync(tlsCertPath)) {
            tlsCACerts = fs.readFileSync(tlsCertPath, 'utf8');
            console.log(`✅ TLS certificate loaded from ${tlsCertPath}`);
        } else {
            console.log(`❌ TLS certificate not found at ${tlsCertPath}`);
            console.log(`   Please copy certificate from blockchain network first!`);
            return false;
        }

        // Create CA client with proper configuration
        const caClient = new FabricCAServices(
            caUrl,
            {
                trustedRoots: tlsCACerts,
                verify: false  // Disable hostname verification for IP-based connections
            },
            caName  // Pass CA name as third parameter
        );

        console.log(`📡 Connecting to CA server: ${caUrl}`);
        console.log(`   CA Name: ${caName}`);

        // Enroll admin with bootstrap credentials
        console.log(`\n🔐 Enrolling admin with bootstrap credentials...`);
        const enrollment = await caClient.enroll({
            enrollmentID: 'admin',
            enrollmentSecret: 'adminpw'
        });

        console.log(`✅ Admin enrolled successfully`);

        // Create X509 identity
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes()
            },
            mspId: mspId,
            type: 'X.509'
        };

        // Store in wallet
        const walletPath = path.join(__dirname, '..', 'assets', 'blockchain', 'wallet');

        // Create wallet directory if it doesn't exist
        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
            console.log(`📁 Created wallet directory: ${walletPath}`);
        }

        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const adminId = `admin-${orgName}`;
        await wallet.put(adminId, x509Identity);

        console.log(`✅ Admin identity stored in wallet as: ${adminId}`);
        console.log(`📄 Certificate length: ${enrollment.certificate.length} bytes`);

        return true;

    } catch (error) {
        console.log(`❌ Failed to re-enroll admin for ${orgName}:`, error.message);
        if (error.stack) {
            console.log(`   Stack trace: ${error.stack.split('\n')[1]}`);
        }
        return false;
    }
}

async function main() {
    console.log('\n🔄 Re-enrolling All Admin Users');
    console.log('This will update admin identities in wallet with fresh certificates\n');

    const organizations = [
        {
            name: 'OrgProp',
            caUrl: 'https://13.228.124.49:7054',
            tlsCert: path.join(__dirname, '..', 'assets', 'blockchain', 'tls', 'ca-orgprop.crt'),
            mspId: 'OrgPropMSP',
            caName: 'ca-orgprop'  // CA server name
        },
        {
            name: 'OrgTenant',
            caUrl: 'https://13.228.124.49:8054',
            tlsCert: path.join(__dirname, '..', 'assets', 'blockchain', 'tls', 'ca-orgtenant.crt'),
            mspId: 'OrgTenantMSP',
            caName: 'ca-orgtenant'
        },
        {
            name: 'OrgLandlord',
            caUrl: 'https://13.228.124.49:9054',
            tlsCert: path.join(__dirname, '..', 'assets', 'blockchain', 'tls', 'ca-orglandlord.crt'),
            mspId: 'OrgLandlordMSP',
            caName: 'ca-orglandlord'
        }
    ];

    let successCount = 0;
    let failCount = 0;

    for (const org of organizations) {
        const success = await reenrollAdmin(
            org.name,
            org.caUrl,
            org.tlsCert,
            org.mspId,
            org.caName
        );
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully re-enrolled: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);

    if (successCount === organizations.length) {
        console.log(`\n🎉 All admin users re-enrolled successfully!`);
        console.log(`\n📝 Next steps:`);
        console.log(`   1. Restart the application: npm run start:dev`);
        console.log(`   2. Admin identities will now work with the new blockchain network`);
        console.log(`   3. User identities may also need to be re-enrolled if they fail\n`);
    } else {
        console.log(`\n⚠️  Some admin enrollments failed!`);
        console.log(`\n💡 Troubleshooting:`);
        console.log(`   1. Ensure blockchain network is running: docker ps`);
        console.log(`   2. Verify TLS certificates exist in assets/blockchain/tls/`);
        console.log(`   3. Check CA servers are accessible: curl -k https://13.228.124.49:7054/cainfo`);
        console.log(`   4. Verify AWS Security Group allows ports 7054, 8054, 9054\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });