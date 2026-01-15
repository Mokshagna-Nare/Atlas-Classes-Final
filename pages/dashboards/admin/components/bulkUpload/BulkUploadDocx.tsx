import React, { useState } from "react";
import { supabase } from "../../../../../services/supabase";
import { parseDocxOneTablePerQuestion } from "./parseDocxQuestions";

type Props = {
  onDone?: () => void;
};

const BulkUploadDocx: React.FC<Props> = ({ onDone }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedCount, setParsedCount] = useState<number>(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleParse = async (f: File) => {
    setLoading(true);
    setErrors([]);
    setParsedCount(0);
    setPreview([]);
    try {
      const res = await parseDocxOneTablePerQuestion(f);
      setErrors(res.errors);
      setParsedCount(res.rows.length);
      setPreview(res.rows.slice(0, 3)); // show first 3 as preview
      // Store parsed rows in memory by attaching to window or local state (better: add another state)
      (window as any).__bulkMcqs = res.rows;
    } catch (e: any) {
      setErrors([e?.message ?? "Failed to parse document"]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    const rows = (window as any).__bulkMcqs as any[] | undefined;
    if (!rows?.length) {
      setErrors(["No parsed questions to upload."]);
      return;
    }

    setLoading(true);
    setErrors([]);
    try {
      const { error } = await supabase.from("mcqs").insert(rows);
      if (error) throw error;
      onDone?.();
    } catch (e: any) {
      setErrors([e?.message ?? "Bulk insert failed"]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 text-white">
      <h3 className="text-xl font-bold">Bulk Upload (.docx)</h3>

      <input
        type="file"
        accept=".docx"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setFile(f);
          handleParse(f);
        }}
        className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
      />

      {loading && <p className="text-gray-400 text-sm">Working...</p>}

      <div className="text-sm text-gray-300">
        <p>Parsed questions: <span className="font-bold">{parsedCount}</span></p>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="font-bold text-red-400 mb-2">Errors</p>
          <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
            {errors.map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        </div>
      )}

      {preview.length > 0 && (
        <div className="bg-black/30 border border-gray-800 rounded-xl p-4">
          <p className="font-bold text-gray-200 mb-2">Preview (first 3)</p>
          <pre className="text-xs text-gray-400 overflow-auto">
{JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => onDone?.()}
          className="px-5 py-2 rounded-xl border border-gray-700 text-gray-300 hover:text-white"
          disabled={loading}
        >
          Close
        </button>
        <button
          type="button"
          onClick={handleUpload}
          className="px-6 py-2 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-50"
          disabled={loading || parsedCount === 0 || errors.length > 0}
        >
          Upload to Bank
        </button>
      </div>
    </div>
  );
};

export default BulkUploadDocx;
