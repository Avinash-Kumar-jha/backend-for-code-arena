const jwt = require("jsonwebtoken");
const User = require("../models/user");
const redisClient = require("../config/redis");

const userMiddleware = async (req, res, next) => {
    try {
        const { token } = req.cookies;
        
        if (!token) {
            return res.status(401).json({ message: "Authentication required" });
        }

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_KEY);
        } catch (jwtErr) {
            if (jwtErr.name === 'TokenExpiredError') {
                return res.status(401).json({ message: "Token expired" });
            }
            return res.status(401).json({ message: "Invalid token" });
        }

        const { _id } = payload;

        if (!_id) {
            return res.status(401).json({ message: "Invalid token payload" });
        }

        const result = await User.findById(_id);

        if (!result) {
            return res.status(401).json({ message: "User not found" });
        }

        // Check Redis blocklist
        const isBlocked = await redisClient.exists(`token:${token}`);

        if (isBlocked) {
            return res.status(401).json({ message: "Token has been revoked" });
        }

        req.result = result;
        next();
    } catch (err) {
        console.error("Middleware Error:", err);
        res.status(401).json({ message: "Authentication failed" });
    }
};

module.exports = userMiddleware;
