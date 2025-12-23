import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const verification = async () => {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected");

    console.log("\n--- USERS ---");
    const users = await mongoose.connection.db.collection('users').find().toArray();
    if (users.length === 0) console.log("No users found.");
    users.forEach(u => console.log(`User: ${u.email} | ID: ${u._id}`));

    console.log("\n--- DOCUMENTS ---");
    const docs = await mongoose.connection.db.collection('documents').find().toArray();
    if (docs.length === 0) console.log("No documents found.");

    docs.forEach(d => {
        console.log(`Document: ${d.fileName}`);
        console.log(`   > Linked User ID: ${d.userId}`);

        let linkedEmail = "NOT LINKED";
        if (d.userId) {
            const user = users.find(u => u._id.toString() === d.userId.toString());
            if (user) linkedEmail = user.email;
        }
        console.log(`   > Uploaded By: ${linkedEmail}`);
        console.log('-----------------------------------');
    });

    await mongoose.disconnect();
    console.log("\nDone.");
};

verification().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});
