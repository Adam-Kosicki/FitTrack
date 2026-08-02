import { GoogleGenerativeAI } from '@google/generative-ai';
import GEMINI_API_KEY from '../firebase/gemini-api';

/**
 * Shared Gemini AI client instance.
 * Import this instead of instantiating GoogleGenerativeAI in individual components.
 */
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export default genAI;
