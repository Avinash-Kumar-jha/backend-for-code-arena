const axios = require('axios');

const getLanguageById = (lang) => {
    const language = {
        "c++": 54,
        "java": 62,
        "javascript": 63,
        "python": 71,
        "c": 50
    }
    return language[lang.toLowerCase()];
}

const submitBatch = async (submissions) => {
    // Encode all string data to base64
    const encodedSubmissions = submissions.map(sub => ({
        ...sub,
        source_code: Buffer.from(sub.source_code).toString('base64'),
        stdin: sub.stdin ? Buffer.from(sub.stdin.toString()).toString('base64') : '',
        expected_output: sub.expected_output ? Buffer.from(sub.expected_output.toString()).toString('base64') : ''
    }));
    
    const options = {
        method: 'POST',
        url: 'https://judge0-ce.p.rapidapi.com/submissions/batch',
        params: {
            base64_encoded: 'true'  // Changed to true
        },
        headers: {
            'x-rapidapi-key': process.env.JUDGE0_KEY,
            'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
            'Content-Type': 'application/json'
        },
        data: {
            submissions: encodedSubmissions  // Use encoded submissions
        }
    };

    try {
        const response = await axios.request(options);
        return response.data;
    } catch (error) {
        console.error('Batch submission error:', error.response?.data || error.message);
        throw error;
    }
}

// Fixed waiting function
const waiting = (timer) => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(1);
        }, timer);
    });
}

const submitToken = async (resultToken) => {
    const options = {
        method: 'GET',
        url: 'https://judge0-ce.p.rapidapi.com/submissions/batch',
        params: {
            tokens: resultToken.join(","),
            base64_encoded: 'true',  // Changed to true - this was the main issue!
            fields: '*'
        },
        headers: {
            'x-rapidapi-key': process.env.JUDGE0_KEY,
            'x-rapidapi-host': 'judge0-ce.p.rapidapi.com'
        }
    };

    let attempts = 0;
    const maxAttempts = 20; // Prevent infinite loop

    while (attempts < maxAttempts) {
        try {
            const response = await axios.request(options);
            
            // Decode base64 results
            const decodedSubmissions = response.data.submissions.map(submission => ({
                ...submission,
                stdout: submission.stdout ? Buffer.from(submission.stdout, 'base64').toString('utf-8') : null,
                stderr: submission.stderr ? Buffer.from(submission.stderr, 'base64').toString('utf-8') : null,
                compile_output: submission.compile_output ? Buffer.from(submission.compile_output, 'base64').toString('utf-8') : null,
                message: submission.message ? Buffer.from(submission.message, 'base64').toString('utf-8') : null
            }));
            
            const IsResultObtained = decodedSubmissions.every((r) => r.status_id > 2);

            if (IsResultObtained) {
                console.log(`Results obtained after ${attempts + 1} attempts`);
                return decodedSubmissions;
            }

            console.log(`Attempt ${attempts + 1}: Still processing...`);
            await waiting(2000); // Wait 2 seconds
            attempts++;
            
        } catch (error) {
            console.error('Token fetch error:', error.response?.data || error.message);
            
            if (attempts >= maxAttempts - 1) {
                throw error;
            }
            
            await waiting(2000);
            attempts++;
        }
    }
    
    throw new Error('Timeout: Submissions did not complete after maximum attempts');
}

module.exports = { getLanguageById, submitBatch, submitToken };