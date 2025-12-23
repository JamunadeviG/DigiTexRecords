import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Adjust path if running from scripts/ folder
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// User Schema (Simplified copy for script)
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    role: { type: String, enum: ['staff', 'public', 'admin'], default: 'public' },
    officeDetails: Object,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const createAdmin = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const email = 'admin@tnreg.gov.in';
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            console.log('⚠️ Admin user already exists.');
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash('Admin@123', 10);

        const adminUser = new User({
            fullName: 'System Administrator',
            email: email,
            password: hashedPassword,
            phone: '0000000000',
            role: 'staff', // Or 'admin' if you distinguish them, but request said "staff" role for staff
            officeDetails: {
                officeName: 'Head Office',
                officeCode: 'HO-001',
                district: 'Chennai',
                taluk: 'Chennai'
            }
        });

        await adminUser.save();
        console.log(`✅ Admin user created: ${email} / Admin@123`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

createAdmin();
