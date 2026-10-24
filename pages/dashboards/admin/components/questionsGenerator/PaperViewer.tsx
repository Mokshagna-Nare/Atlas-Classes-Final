import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { qgBlob } from './api';
import MathText from './MathText';
import { QGConfig, Question, RunResult, countQuestions } from './types';
import { Modal, Notice, PrimaryButton } from './ui';

// The question paper exactly as the Word file lays it out: one
// 17-row table per question, the figure inside the #Question* cell.
const PaperViewer: React.FC<{ result: RunResult; config: QGConfig; onClose: () => void }> = ({ result, config, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = countQuestions(result.pages);

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const { blob, fileName } = await qgBlob('/docx', {
        json: {
          mode: result.mode,
          pages: result.pages,
          grade: result.grade,
          subject: result.subject,
          topic: result.topic,
          source_name: result.source_name,
        },
      });
      saveAs(blob, fileName);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  };

  const remark = (question: Question, index: number, count: number, page: RunResult['pages'][number]) =>
    result.mode === 'generate'
      ? `Question ${index + 1} of ${count} for selected page ${page.page_number}.` +
        (question.figure ? ` Includes the source figure from page ${page.page_number}.` : '')
      : `Extracted question ${index + 1} of ${count} from ${page.label}.`;

  let number = 0;

  return (
    <Modal title={`Question paper — ${total} question(s)`} onClose={onClose} wide>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <p className="text-sm text-gray-400">
          {result.subject} · Grade {result.grade} · {result.topic} · Source: {result.source_name}
        </p>
        <PrimaryButton onClick={download} disabled={downloading}>
          {downloading ? 'Preparing Word file…' : '⬇️ Download Word file'}
        </PrimaryButton>
      </div>
      {error && (
        <div className="mb-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}

      <div className="space-y-6">
        {result.pages.map((page) =>
          page.questions.map((question, index) => {
            number += 1;
            const numerical = question.question_type === 'Numerical';
            const options = numerical
              ? Array(4).fill(config.numerical_option_text)
              : [...(question.options || []), '', '', '', ''].slice(0, 4);
            const flags = question.review_flags || [];
            const values: React.ReactNode[] = [
              result.grade,
              result.subject,
              result.topic,
              page.subtopic,
              question.question_type || 'MCQ',
              question.bloom_level || '',
              question.difficulty || '',
              <>
                <MathText text={question.question} />
                {question.figure?.image && (
                  <div className="mt-2 flex justify-center">
                    <img src={question.figure.image} alt="Figure" className="max-h-72 max-w-full bg-white rounded" />
                  </div>
                )}
              </>,
              ...options.map((option, i) => <MathText key={i} text={option} />),
              question.key || '',
              <MathText text={question.explanation || ''} />,
              result.source_name,
              remark(question, index, page.questions.length, page),
              flags.length ? flags.join('; ') : 'None — no automated concerns flagged.',
            ];

            return (
              <div key={`${number}`}>
                <p className="text-xs font-bold text-green-400 mb-1">Q{number}</p>
                <table className="w-full text-sm border-collapse bg-white text-gray-900 rounded-lg overflow-hidden">
                  <tbody>
                    {config.field_labels.map((label, row) => (
                      <tr key={label} className="border border-gray-300">
                        <td className="w-44 px-3 py-1.5 border border-gray-300 font-semibold align-top bg-gray-50">{label}</td>
                        <td
                          className={`px-3 py-1.5 border border-gray-300 align-top ${
                            label === '#Review Notes*' && flags.length ? 'text-amber-700' : ''
                          }`}
                        >
                          {values[row]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }),
        )}
      </div>
    </Modal>
  );
};

export default PaperViewer;
