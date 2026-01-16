const redisClient = require("../config/redis");
const User = require("../models/user");
const validate = require('../utils/validator');
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const Submission = require("../models/submission");

// Cookie configuration helper
const getCookieOptions = () => ({
    httpOnly: true,
    maxAge: 60 * 60 * 1000, // 1 hour
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production', // true in production
    path: '/'
});

const register = async (req, res) => {
    try {
        validate(req.body);
        const { firstName, emailId, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ emailId });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        req.body.password = await bcrypt.hash(password, 10);
        req.body.role = 'user';

        const user = await User.create(req.body);
        const token = jwt.sign(
            { _id: user._id, emailId: emailId, role: 'user' },
            process.env.JWT_KEY,
            { expiresIn: '1h' }
        );

        const reply = {
            firstName: user.firstName,
            emailId: user.emailId,
            _id: user._id,
            role: user.role,
        };

        res.cookie('token', token, getCookieOptions());
        res.status(201).json({
            user: reply,
            message: "Registered Successfully"
        });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(400).json({ message: err.message || "Registration failed" });
    }
};

const login = async (req, res) => {
    try {
        const { emailId, password } = req.body;

        if (!emailId || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ emailId });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const reply = {
            firstName: user.firstName,
            emailId: user.emailId,
            _id: user._id,
            role: user.role,
        };

        const token = jwt.sign(
            { _id: user._id, emailId: emailId, role: user.role },
            process.env.JWT_KEY,
            { expiresIn: '1h' }
        );

        res.cookie('token', token, getCookieOptions());
        res.status(200).json({
            user: reply,
            message: "Login Successfully"
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Login failed" });
    }
};

const logout = async (req, res) => {
    try {
        const { token } = req.cookies;
        
        if (!token) {
            return res.status(400).json({ message: "No token found" });
        }

        const payload = jwt.decode(token);

        if (payload && payload.exp) {
            await redisClient.set(`token:${token}`, 'Blocked');
            await redisClient.expireAt(`token:${token}`, payload.exp);
        }

        res.cookie("token", '', {
            ...getCookieOptions(),
            maxAge: 0
        });
        
        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        console.error("Logout Error:", err);
        res.status(500).json({ message: "Logout failed" });
    }
};

const adminRegister = async (req, res) => {
    try {
        validate(req.body);
        const { firstName, emailId, password } = req.body;

        req.body.password = await bcrypt.hash(password, 10);

        const user = await User.create(req.body);
        const token = jwt.sign(
            { _id: user._id, emailId: emailId, role: user.role },
            process.env.JWT_KEY,
            { expiresIn: '1h' }
        );

        res.cookie('token', token, getCookieOptions());
        res.status(201).json({ message: "Admin registered successfully" });
    } catch (err) {
        console.error("Admin Register Error:", err);
        res.status(400).json({ message: err.message || "Registration failed" });
    }
};

const deleteProfile = async (req, res) => {
    try {
        const userId = req.result._id;

        await User.findByIdAndDelete(userId);
        // Optionally delete submissions: await Submission.deleteMany({userId});

        res.cookie("token", '', {
            ...getCookieOptions(),
            maxAge: 0
        });

        res.status(200).json({ message: "Profile deleted successfully" });
    } catch (err) {
        console.error("Delete Profile Error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { register, login, logout, adminRegister, deleteProfile };
