import React, { useState } from "react";
import { supabase } from "../../../../../services/supabase";
import { parseDocxOneTablePerQuestion, MCQInsert } from "./parseDocxQuestions";

type Props = {
  onDone?: () => void;
};

// Theme Color Constant
const THEME_COLOR = "#29A34A";

const BulkUploadDocx: React.FC<Props> = ({ onDone }) => {
  // 1. STATE MANAGEMENT
  const [questions, setQuestions] = useState<MCQInsert[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // 2. PARSE FUNCTION
  const handleParse = async (f: File) => {
    setLoading(true);
    setErrors([]);
    setUploadSuccess(false);
    
    try {
      const res = await parseDocxOneTablePerQuestion(f);
      
      if (res.errors && res.errors.length > 0) {
        setErrors(res.errors);
      }
      
      if (res.rows && res.rows.length > 0) {
        setQuestions(res.rows);
      } else if (res.errors.length === 0) {
        setErrors(["No valid questions found in the document."]);
      }
    } catch (e: any) {
      setErrors([e?.message ?? "Failed to parse document"]);
    } finally {
      setLoading(false);
    }
  };

  // 3. UPLOAD FUNCTION (Commit to DB)
  const handleUpload = async () => {
    if (!questions.length) return;

    setLoading(true);
    setErrors([]);
    try {
      const { error } = await supabase.from("mcqs").insert(questions);
      if (error) throw error;
      
      setUploadSuccess(true);
      setQuestions([]); 
    } catch (e: any) {
      setErrors([e?.message ?? "Bulk insert failed"]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQuestions([]);
    setErrors([]);
    setUploadSuccess(false);
  };

  const removeQuestion = (indexToRemove: number) => {
    setQuestions(questions.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col h-[600px] text-white">
      
      {/* --- HEADER --- */}
      <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          {/* Document Icon in Theme Color */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={THEME_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
          <span className="text-white">Bulk Upload Questions</span>
        </h3>
        {questions.length > 0 && !uploadSuccess && (
            <span 
              className="text-sm px-3 py-1 rounded-full border"
              style={{ 
                backgroundColor: `${THEME_COLOR}20`, // 20% opacity
                borderColor: `${THEME_COLOR}50`,     // 50% opacity
                color: THEME_COLOR 
              }}
            >
                Reviewing {questions.length} Questions
            </span>
        )}
      </div>

      {/* --- ERROR BANNER --- */}
      {errors.length > 0 && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 overflow-y-auto max-h-32">
          <p className="font-bold text-red-400 mb-2 flex items-center gap-2">
            ⚠️ Errors Detected
          </p>
          <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
            {errors.map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        </div>
      )}

      {/* --- SUCCESS STATE --- */}
      {uploadSuccess ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-in fade-in">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center border"
            style={{ 
              backgroundColor: `${THEME_COLOR}20`, 
              borderColor: `${THEME_COLOR}50`,
              color: THEME_COLOR 
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h4 className="text-xl font-bold" style={{ color: THEME_COLOR }}>Upload Successful!</h4>
          <p className="text-gray-400">Your questions have been added to the bank.</p>
          <div className="flex gap-3 mt-4">
             <button onClick={onDone} className="px-5 py-2 rounded-xl border border-gray-700 text-gray-300 hover:text-white">Close</button>
             <button 
               onClick={handleReset} 
               className="px-5 py-2 rounded-xl text-white font-medium hover:opacity-90 transition-opacity"
               style={{ backgroundColor: THEME_COLOR }}
             >
               Upload Another
             </button>
          </div>
        </div>
      ) : (
        <>
          {/* --- STATE 1: UPLOAD INPUT --- */}
          {questions.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition-colors relative group">
               {loading && <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10">Processing...</div>}
               
               <input
                type="file"
                accept=".docx"
                id="docx-upload"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleParse(f);
                }}
                className="hidden"
              />
              <label htmlFor="docx-upload" className="cursor-pointer flex flex-col items-center gap-3 p-10 w-full h-full justify-center">
                <div className="p-4 bg-gray-700 rounded-full shadow-lg transition-transform group-hover:scale-110">
                  {/* Upload Cloud Icon in Theme Color */}
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={THEME_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div className="text-center space-y-1">
                    <p className="text-lg font-medium text-gray-200">Click to upload .docx</p>
                    <p className="text-sm text-gray-500">Supports single-table format</p>
                </div>
              </label>
            </div>
          )}

          {/* --- STATE 2: REVIEW LIST --- */}
          {questions.length > 0 && (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {questions.map((q, idx) => (
                        <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl p-4 group">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex gap-2 mb-2">
                                        <span className="text-xs font-mono text-gray-500 bg-gray-900 px-2 py-0.5 rounded">#{idx + 1}</span>
                                        <span className="text-xs text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded border border-blue-900/50">{q.subject}</span>
                                        <span className="text-xs text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded border border-purple-900/50">{q.difficulty}</span>
                                    </div>
                                    <p className="text-gray-200 font-medium mb-3">{q.question}</p>
                                    
                                    {/* Options Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {q.options?.map((opt, i) => {
                                            const isCorrect = opt === q.answer;
                                            return (
                                                <div key={i} className={`text-sm px-3 py-2 rounded border flex items-center justify-between ${
                                                    isCorrect 
                                                    ? "bg-green-900/20 border-green-600/50 text-green-300" 
                                                    : "bg-gray-900/50 border-gray-700 text-gray-400"
                                                }`}>
                                                    <span>{opt}</span>
                                                    {isCorrect && (
                                                      <span style={{ color: THEME_COLOR }}>✔</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => removeQuestion(idx)}
                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Remove this question"
                                >
                                    {/* Trash Icon */}
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-gray-800 flex justify-end gap-3 mt-2">
                    <button
                        onClick={handleReset}
                        className="px-5 py-2 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        className="px-6 py-2 rounded-xl text-white font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg"
                        style={{ backgroundColor: THEME_COLOR, boxShadow: `0 4px 14px 0 ${THEME_COLOR}40` }}
                        disabled={loading}
                    >
                        {/* Save Icon */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                          <polyline points="17 21 17 13 7 13 7 21"/>
                          <polyline points="7 3 7 8 15 8"/>
                        </svg>
                        {loading ? "Uploading..." : "Confirm & Upload"}
                    </button>
                </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BulkUploadDocx;
