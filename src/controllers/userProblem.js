const { getLanguageById, submitBatch, submitToken } = require("../utils/problemUtility");
const Problem = require("../models/problem");
const User = require("../models/user");
const Submission = require("../models/submission");
const SolutionVideo = require("../models/solutionVideo");

const createProblem = async (req, res) => {
    try {
        const {
            title, description, difficulty, tags,
            visibleTestCases, hiddenTestCases, startCode,
            referenceSolution
        } = req.body;

        // Validate reference solutions
        for (const { language, completeCode } of referenceSolution) {
            const languageId = getLanguageById(language);

            const submissions = visibleTestCases.map((testcase) => ({
                source_code: completeCode,
                language_id: languageId,
                stdin: testcase.input,
                expected_output: testcase.output
            }));

            const submitResult = await submitBatch(submissions);
            const resultToken = submitResult.map((value) => value.token);
            const testResult = await submitToken(resultToken);

            for (const test of testResult) {
                if (test.status_id !== 3) {
                    return res.status(400).json({
                        message: "Reference solution failed test cases",
                        details: test
                    });
                }
            }
        }

        const userProblem = await Problem.create({
            ...req.body,
            problemCreator: req.result._id
        });

        res.status(201).json({
            message: "Problem created successfully",
            problem: userProblem
        });
    } catch (err) {
        console.error("Create Problem Error:", err);
        res.status(400).json({ message: err.message || "Failed to create problem" });
    }
};

const updateProblem = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, description, difficulty, tags,
            visibleTestCases, hiddenTestCases, startCode,
            referenceSolution
        } = req.body;

        if (!id) {
            return res.status(400).json({ message: "Problem ID is required" });
        }

        const dsaProblem = await Problem.findById(id);
        if (!dsaProblem) {
            return res.status(404).json({ message: "Problem not found" });
        }

        // Validate reference solutions if provided
        if (referenceSolution && visibleTestCases) {
            for (const { language, completeCode } of referenceSolution) {
                const languageId = getLanguageById(language);

                const submissions = visibleTestCases.map((testcase) => ({
                    source_code: completeCode,
                    language_id: languageId,
                    stdin: testcase.input,
                    expected_output: testcase.output
                }));

                const submitResult = await submitBatch(submissions);
                const resultToken = submitResult.map((value) => value.token);
                const testResult = await submitToken(resultToken);

                for (const test of testResult) {
                    if (test.status_id !== 3) {
                        return res.status(400).json({
                            message: "Reference solution failed test cases"
                        });
                    }
                }
            }
        }

        const newProblem = await Problem.findByIdAndUpdate(
            id,
            { ...req.body },
            { runValidators: true, new: true }
        );

        res.status(200).json({
            message: "Problem updated successfully",
            problem: newProblem
        });
    } catch (err) {
        console.error("Update Problem Error:", err);
        res.status(500).json({ message: err.message || "Failed to update problem" });
    }
};

const deleteProblem = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Problem ID is required" });
        }

        const deletedProblem = await Problem.findByIdAndDelete(id);

        if (!deletedProblem) {
            return res.status(404).json({ message: "Problem not found" });
        }

        res.status(200).json({ message: "Problem deleted successfully" });
    } catch (err) {
        console.error("Delete Problem Error:", err);
        res.status(500).json({ message: "Failed to delete problem" });
    }
};

const getProblemById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Problem ID is required" });
        }

        const getProblem = await Problem.findById(id).select(
            '_id title description difficulty tags visibleTestCases startCode referenceSolution'
        );

        if (!getProblem) {
            return res.status(404).json({ message: "Problem not found" });
        }

        const videos = await SolutionVideo.findOne({ problemId: id });

        if (videos) {
            const responseData = {
                ...getProblem.toObject(),
                secureUrl: videos.secureUrl,
                thumbnailUrl: videos.thumbnailUrl,
                duration: videos.duration,
            };
            return res.status(200).json(responseData);
        }

        res.status(200).json(getProblem);
    } catch (err) {
        console.error("Get Problem Error:", err);
        res.status(500).json({ message: "Failed to fetch problem" });
    }
};

const getAllProblem = async (req, res) => {
    try {
        const getProblems = await Problem.find({}).select('_id title difficulty tags');

        if (getProblems.length === 0) {
            return res.status(200).json([]); // Return empty array instead of 404
        }

        res.status(200).json(getProblems);
    } catch (err) {
        console.error("Get All Problems Error:", err);
        res.status(500).json({ message: "Failed to fetch problems" });
    }
};

const solvedAllProblembyUser = async (req, res) => {
    try {
        const userId = req.result._id;

        const user = await User.findById(userId).populate({
            path: "problemSolved",
            select: "_id title difficulty tags"
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user.problemSolved || []);
    } catch (err) {
        console.error("Solved Problems Error:", err);
        res.status(500).json({ message: "Failed to fetch solved problems" });
    }
};

const submittedProblem = async (req, res) => {
    try {
        const userId = req.result._id;
        const problemId = req.params.pid;

        const submissions = await Submission.find({ userId, problemId });

        res.status(200).json(submissions);
    } catch (err) {
        console.error("Submitted Problem Error:", err);
        res.status(500).json({ message: "Failed to fetch submissions" });
    }
};

module.exports = {
    createProblem,
    updateProblem,
    deleteProblem,
    getProblemById,
    getAllProblem,
    solvedAllProblembyUser,
    submittedProblem
};
