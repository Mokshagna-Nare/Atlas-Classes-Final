
import api from './api';
import { Question, TestResult } from '../types';

export const convertHtmlToTest = async (
    htmlContent: string
): Promise<{ 
    testTitle: string; 
    subject: string; 
    questions: Question[] 
}> => {
    try {
        const response = await api.post('/ai/convert-html', { htmlContent });
        return response.data;
    } catch (error) {
        console.error("Error converting HTML via Backend:", error);
        throw new Error("Failed to process HTML on server.");
    }
};

export const convertPdfToTest = async (base64: string): Promise<any> => {
    // Implement similar backend route for PDF
    // For now, placeholder error
    throw new Error("PDF conversion needs backend implementation similar to HTML");
};

export const getPerformanceAnalysis = async (results: TestResult[]): Promise<string> => {
    // This should also be a backend call to protect API keys
    // Returning mock for now to prevent breakage during migration if backend route isn't ready
    return "Analysis generation moving to backend..."; 
};

export const getStudyTips = async (topic: string, score: number): Promise<string> => {
     return "Study tips generation moving to backend...";
};
