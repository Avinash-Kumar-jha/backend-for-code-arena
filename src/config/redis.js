const { createClient }  = require('redis');

const redisClient = createClient({
    username: 'default',
    password: process.env.REDIS_PASS,
    socket: {
       host: 'redis-17521.c256.us-east-1-2.ec2.cloud.redislabs.com',
        port: 17521
    }
});

module.exports = redisClient;