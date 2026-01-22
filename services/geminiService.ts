// geminiService.ts (Safe Mode / AI Disabled)
import { Question, TestResult } from '../types';

// 1. Placeholder for HTML conversion
export const convertHtmlToTest = async (
    htmlContent: string
): Promise<{ 
    testTitle: string; 
    subject: string; 
    questions: Question[] 
}> => {
    console.log("AI is currently disabled.");
    // Return empty dummy data so the app doesn't crash
    return {
        testTitle: "AI Disabled",
        subject: "None",
        questions: []
    };
};

// 2. Placeholder for PDF conversion
export const convertPdfToTest = async (base64: string): Promise<any> => {
    console.log("AI is currently disabled.");
    return null;
};

// 3. Placeholder for Analysis
export const getPerformanceAnalysis = async (results: TestResult[]): Promise<string> => {
    return "AI analysis is disabled.";
};

// 4. Placeholder for Study Tips
export const getStudyTips = async (topic: string, score: number): Promise<string> => {
     return "AI tips are disabled.";
};
