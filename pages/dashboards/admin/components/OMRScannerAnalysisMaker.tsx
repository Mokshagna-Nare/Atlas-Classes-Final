// import React, { useState } from "react";

// export default function OMRScannerAnalysisMaker() {
//   const [studentId, setStudentId] = useState("");
//   const [questionPaper, setQuestionPaper] = useState<File | null>(null);
//   const [answerKey, setAnswerKey] = useState<File | null>(null);
//   const [omrSheet, setOmrSheet] = useState<File | null>(null);
//   const [isProcessing, setIsProcessing] = useState(false);

//   const handleProcess = async () => {
//     if (!questionPaper || !answerKey || !omrSheet) {
//       alert("Please upload all three files: Question Paper, Answer Key, and OMR Sheet.");
//       return;
//     }
    
//     setIsProcessing(true);
//     // Add logic to upload these three files to Supabase Storage
//     // and trigger your Edge Function for processing.
//     console.log("Uploading:", { questionPaper, answerKey, omrSheet });
//     await new Promise((resolve) => setTimeout(resolve, 2000));
//     setIsProcessing(false);
//     alert("Files uploaded! Analysis generation triggered.");
//   };

//   return (
//     <div className="space-y-6 text-slate-100">
//       <div className="mb-6">
//         <h1 className="text-2xl font-bold">OMR Scanner & Analysis Maker</h1>
//         <p className="text-gray-400">Upload the test documents to generate student performance analytics.</p>
//       </div>

//       <div className="bg-atlas-dark border border-gray-800 p-6 rounded-lg space-y-6">
//         <h2 className="text-lg font-semibold">Student & Exam Mapping</h2>
//         <input
//           className="w-full bg-gray-900 border border-gray-700 rounded p-3"
//           placeholder="Enter Student ID"
//           value={studentId}
//           onChange={(e) => setStudentId(e.target.value)}
//         />

//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//           <FileUpload label="Question Paper" setFile={setQuestionPaper} file={questionPaper} />
//           <FileUpload label="Answer Key" setFile={setAnswerKey} file={answerKey} />
//           <FileUpload label="OMR Sheet" setFile={setOmrSheet} file={omrSheet} />
//         </div>
//       </div>

//       <button
//         onClick={handleProcess}
//         disabled={isProcessing || !studentId}
//         className="w-full bg-atlas-green text-white font-bold py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
//       >
//         {isProcessing ? "Processing..." : "Generate Analytics"}
//       </button>
//     </div>
//   );
// }

// // Sub-component for clean file inputs
// function FileUpload({ label, setFile, file }: { label: string, setFile: any, file: File | null }) {
//   return (
//     <div className="space-y-2">
//       <label className="text-sm text-gray-400">{label}</label>
//       <input
//         type="file"
//         onChange={(e) => setFile(e.target.files?.[0] || null)}
//         className="block w-full text-sm text-gray-400 file:mr-4 file:bg-gray-800 file:text-white file:border-0 file:px-3 file:py-2 rounded cursor-pointer hover:file:bg-gray-700 border border-gray-700 p-1"
//       />
//       {file && <p className="text-xs text-emerald-400 truncate">Selected: {file.name}</p>}
//     </div>
//   );
// }