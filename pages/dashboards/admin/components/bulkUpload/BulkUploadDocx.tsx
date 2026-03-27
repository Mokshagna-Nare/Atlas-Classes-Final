import React, { useState } from "react";
import { supabase } from "../../../../../services/supabase";
import { parseDocxOneTablePerQuestion, MCQInsert } from "./parseDocxQuestions";
import { getQuestionPrefix, getNextSequenceNumber, checkDuplicate } from "../MCQUpload"; 

type Props = {
  onDone?: () => void;
};

const THEME_COLOR = "#29A34A";

const uploadImageToSupabase = async (base64Data: string): Promise<string | null> => {
  if (!base64Data || !base64Data.startsWith('data:image')) return null;
  try {
    const res = await fetch(base64Data);
    const blob = await res.blob();
    const fileExt = blob.type.split('/')[1] || 'png';
    const fileName = `bulk_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error } = await supabase.storage.from('question-images').upload(filePath, blob);
    if (error) throw error;
    const { data } = supabase.storage.from('question-images').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error("Image upload failed:", error);
    return null;
  }
};

const BulkUploadDocx: React.FC<Props> = ({ onDone }) => {
  const [questions, setQuestions] = useState<MCQInsert[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(""); 
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateList, setDuplicateList] = useState<{index: number, q: string}[]>([]);

  const handleParse = async (f: File) => {
    setLoading(true);
    setErrors([]);
    setUploadSuccess(false);
    setStatusMessage("Parsing document...");
    
    try {
      const res = await parseDocxOneTablePerQuestion(f);
      if (res.errors && res.errors.length > 0) setErrors(res.errors);
      if (res.rows && res.rows.length > 0) {
        setQuestions(res.rows);
      } else if (res.errors.length === 0) {
        setErrors(["No valid questions found in the document."]);
      }
    } catch (e: any) {
      setErrors([e?.message ?? "Failed to parse document"]);
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  const handlePreUploadCheck = async () => {
    setLoading(true);
    setStatusMessage("Checking for duplicate questions...");
    
    const dups = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const isDup = await checkDuplicate(q.question || "", q.options || []);
      if (isDup) {
        dups.push({ index: i, q: q.question || "Image-based question" });
      }
    }
    
    setLoading(false);
    
    if (dups.length > 0) {
      setDuplicateList(dups);
      setDuplicateModalOpen(true);
    } else {
      handleUpload(false);
    }
  };

  const handleUpload = async (skipDuplicates: boolean) => {
    if (!questions.length) return;

    setLoading(true);
    setErrors([]);
    setStatusMessage("Preparing upload...");

    try {
      const finalQuestions = skipDuplicates 
        ? questions.filter((_, i) => !duplicateList.find(d => d.index === i))
        : questions;

      if (finalQuestions.length === 0) {
        setErrors(["No questions left to upload after skipping duplicates."]);
        setLoading(false);
        return;
      }

      const processedQuestions: MCQInsert[] = [];
      const prefixTrackers: Record<string, number> = {};

      for (let i = 0; i < finalQuestions.length; i++) {
        const q = finalQuestions[i];
        setStatusMessage(`Uploading resources ${i + 1}/${finalQuestions.length}...`);

        let finalImageUrl = q.imageUrl;
        if (q.imageUrl && q.imageUrl.startsWith('data:image')) {
            const url = await uploadImageToSupabase(q.imageUrl);
            if (url) finalImageUrl = url;
        }

        const currentOptImages = q.option_images || new Array(4).fill(null);
        const finalOptionImages = await Promise.all(
            currentOptImages.map(async (img) => {
                if (img && img.startsWith('data:image')) return await uploadImageToSupabase(img);
                return img; 
            })
        );

        const rawCode = q.question_code?.trim().toLowerCase();
        let finalCode = q.question_code;
        
        if (!rawCode || rawCode === 'no code' || rawCode === '') {
          const prefix = getQuestionPrefix(q.subject || 'X', q.grade || '11');
          
          if (prefixTrackers[prefix] === undefined) {
             prefixTrackers[prefix] = await getNextSequenceNumber(prefix);
          }
          
          prefixTrackers[prefix]++; 
          finalCode = `${prefix}${prefixTrackers[prefix].toString().padStart(2, '0')}`;
        }

        processedQuestions.push({
            ...q,
            question_code: finalCode,
            imageUrl: finalImageUrl,
            option_images: finalOptionImages
        });
      }

      setStatusMessage("Saving questions to database...");
      const { error } = await supabase.from("mcqs").insert(processedQuestions);
      if (error) throw error;
      
      setUploadSuccess(true);
      setQuestions([]); 
    } catch (e: any) {
      console.error(e);
      setErrors([e?.message ?? "Bulk insert failed"]);
    } finally {
      setLoading(false);
      setStatusMessage("");
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
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col h-[600px] text-white relative">
      
      {duplicateModalOpen && (
        <div className="absolute inset-0 bg-gray-900/95 flex items-center justify-center z-50 p-6 rounded-2xl backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full h-full flex flex-col border border-orange-500/30 rounded-xl p-6 bg-gray-900 shadow-2xl">
            <h3 className="text-2xl font-bold text-orange-500 mb-2">⚠️ {duplicateList.length} Duplicates Detected</h3>
            <p className="text-gray-300 mb-4 text-sm">The following questions already exist in your database. Review them below:</p>
            <div className="flex-1 overflow-y-auto bg-gray-800 rounded-xl p-4 mb-6 space-y-3 custom-scrollbar border border-gray-700">
              {duplicateList.map((d, i) => (
                 <div key={i} className="text-sm text-gray-300 bg-gray-900 p-3 rounded-lg border border-gray-700 shadow-sm">
                    <span className="font-bold text-orange-400 mr-2">Question #{d.index + 1}:</span> 
                    <span className="opacity-90">{d.q}</span>
                 </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 shrink-0 pt-4 border-t border-gray-800">
              <button onClick={() => setDuplicateModalOpen(false)} className="px-5 py-3 text-gray-400 hover:text-white border border-gray-700 rounded-xl transition">Cancel Upload</button>
              <button onClick={() => { setDuplicateModalOpen(false); handleUpload(true); }} className="px-5 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition">Skip Duplicates & Upload Rest</button>
              <button onClick={() => { setDuplicateModalOpen(false); handleUpload(false); }} className="px-5 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-900/20 transition">Upload All Anyway</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
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
            <span className="text-sm px-3 py-1 rounded-full border" style={{ backgroundColor: `${THEME_COLOR}20`, borderColor: `${THEME_COLOR}50`, color: THEME_COLOR }}>
                Reviewing {questions.length} Questions
            </span>
        )}
      </div>

      {errors.length > 0 && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 overflow-y-auto max-h-32">
          <p className="font-bold text-red-400 mb-2 flex items-center gap-2">⚠️ Errors Detected</p>
          <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
            {errors.map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        </div>
      )}

      {uploadSuccess ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-full flex items-center justify-center border" style={{ backgroundColor: `${THEME_COLOR}20`, borderColor: `${THEME_COLOR}50`, color: THEME_COLOR }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h4 className="text-xl font-bold" style={{ color: THEME_COLOR }}>Upload Successful!</h4>
          <p className="text-gray-400">Your questions have been added to the bank.</p>
          <div className="flex gap-3 mt-4">
             {/* Updated Close button to completely reset and return to normal mode */}
             <button onClick={() => { handleReset(); if (onDone) onDone(); }} className="px-5 py-2 rounded-xl border border-gray-700 text-gray-300 hover:text-white">Close</button>
             <button onClick={handleReset} className="px-5 py-2 rounded-xl text-white font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: THEME_COLOR }}>Upload Another</button>
          </div>
        </div>
      ) : (
        <>
          {questions.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition-colors relative group">
               {loading && (
                   <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center z-10 gap-2">
                       <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: THEME_COLOR }}></div>
                       <p className="text-gray-300 text-sm animate-pulse">{statusMessage || "Processing..."}</p>
                   </div>
               )}
               <input type="file" accept=".docx" id="docx-upload" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleParse(f); }} className="hidden" />
              <label htmlFor="docx-upload" className="cursor-pointer flex flex-col items-center gap-3 p-10 w-full h-full justify-center">
                <div className="p-4 bg-gray-700 rounded-full shadow-lg transition-transform group-hover:scale-110">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={THEME_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div className="text-center space-y-1">
                    <p className="text-lg font-medium text-gray-200">Click to upload .docx</p>
                    <p className="text-sm text-gray-500">Supports text & images inside tables</p>
                </div>
              </label>
            </div>
          )}

          {questions.length > 0 && (
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {loading && (
                   <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center z-20 gap-3">
                       <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: THEME_COLOR }}></div>
                       <p className="text-white font-medium">{statusMessage || "Uploading..."}</p>
                   </div>
                )}
                
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

                                    <div className="flex items-start gap-4 mb-3">
                                        {q.imageUrl && <img src={q.imageUrl} alt="Question" className="h-16 w-16 object-cover rounded border border-gray-600 shrink-0 bg-black" />}
                                        <p className="text-gray-200 font-medium">{q.question || <span className="italic text-gray-500">Image Only Question</span>}</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {q.options?.map((opt, i) => {
                                            const isCorrect = opt === q.answer; 
                                            const optImg = q.option_images && q.option_images[i];
                                            return (
                                                <div key={i} className={`text-sm px-3 py-2 rounded border flex items-center justify-between gap-2 ${isCorrect ? "bg-green-900/20 border-green-600/50 text-green-300" : "bg-gray-900/50 border-gray-700 text-gray-400"}`}>
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <span className="text-xs opacity-50 font-mono shrink-0">{i+1}.</span>
                                                        {optImg && <img src={optImg} alt="Opt" className="h-8 w-8 object-cover rounded border border-gray-600 shrink-0 bg-black" />}
                                                        <span className="truncate">{opt || <span className="italic text-xs opacity-50">Image Only</span>}</span>
                                                    </div>
                                                    {isCorrect && <span style={{ color: THEME_COLOR }} className="shrink-0">✔</span>}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                                <button onClick={() => removeQuestion(idx)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors" title="Remove this question">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-4 border-t border-gray-800 flex justify-end gap-3 mt-2">
                    <button onClick={handleReset} className="px-5 py-2 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800" disabled={loading}>
                        Cancel
                    </button>
                    <button onClick={handlePreUploadCheck} className="px-6 py-2 rounded-xl text-white font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg" style={{ backgroundColor: THEME_COLOR, boxShadow: `0 4px 14px 0 ${THEME_COLOR}40` }} disabled={loading}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                          <polyline points="17 21 17 13 7 13 7 21"/>
                          <polyline points="7 3 7 8 15 8"/>
                        </svg>
                        {loading ? "Processing..." : "Confirm & Upload"}
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