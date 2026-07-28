import { createFunction } from './client';

// Example serverless function
export const helloWorld = async (req, res) => {
    res.status(200).json({ message: 'Hello, World!' });
};

// Add more serverless functions as needed
export const anotherFunction = async (req, res) => {
    // Function logic here
    res.status(200).json({ message: 'Another function response' });
};

// Export all functions
export default {
    helloWorld,
    anotherFunction,
};