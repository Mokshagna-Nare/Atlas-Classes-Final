
import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, FlagIcon, XIcon } from '../../../../components/icons';
import { useData } from '../../../../contexts/DataContext';
import { MCQ } from '../../../../types';

interface MCQUploadProps {
  editingMcq?: MCQ | null;
  onFinished?: () => void;
}

const MCQUpload: React.FC<MCQUploadProps> = ({ editingMcq, onFinished }) => {
  const { addMCQ, updateMCQ } = useData();
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [subject, setSubject] = useState('Physics');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [marks, setMarks] = useState('4');
  const [question, setQuestion] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isFlagged, setIsFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  useEffect(() => {
    if (editingMcq) {
      setQuestion(editingMcq.question);
      setOptions(editingMcq.options || ['', '', '', '']);
      setCorrectAnswer(editingMcq.answer);
      setExplanation(editingMcq.explanation || '');
      setSubject(editingMcq.subject);
      setTopic(editingMcq.topic);
      setDifficulty(editingMcq.difficulty);
      setMarks(editingMcq.marks.toString());
      setIsFlagged(editingMcq.isFlagged);
      setFlagReason(editingMcq.flagReason || '');
    }
  }, [editingMcq]);

  const handleAddOption = () => setOptions([...options, '']);
  const handleRemoveOption = (index: number) => setOptions(options.filter((_, i) => i !== index));
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || !correctAnswer) {
      alert("Please fill in the question and correct answer.");
      return;
    }

    const mcqData = {
      question,
      type: 'Multiple Choice' as const,
      options: options.filter(opt => opt.trim() !== ''),
      answer: correctAnswer,
      explanation,
      subject,
      topic,
      difficulty,
      marks: parseInt(marks) || 4,
      isFlagged,
      flagReason: isFlagged ? flagReason : ''
    };

    if (editingMcq) {
      await updateMCQ(editingMcq.id!, mcqData);
    } else {
      await addMCQ({
        ...mcqData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      });
    }
    
    if (onFinished) onFinished();
    else {
      setQuestion(''); setCorrectAnswer(''); setExplanation(''); setOptions(['', '', '', '']);
      setIsFlagged(false); setFlagReason('');
    }
    alert(editingMcq ? "Updated!" : "Added to bank!");
  };

  return (
    <div className="max-w-4xl mx-auto reveal-on-scroll">
      <div className="flex flex-col space-y-8">
        <div>
          <h2 className="text-3xl font-extrabold text-white mb-2">{editingMcq ? 'Edit Question' : 'MCQ Upload Panel'}</h2>
          <p className="text-atlas-text-muted text-sm uppercase tracking-widest font-semibold">{editingMcq ? 'Modify existing repository item' : 'New Online Quiz Item'}</p>
        </div>

        <div className="bg-atlas-soft/40 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl">
          <form className="space-y-8" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-atlas-text-muted uppercase tracking-wider ml-1">Subject</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-4 py-3 bg-atlas-dark border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white cursor-pointer">
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Biology">Biology</option>
                  <option value="Mathematics">Mathematics</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-atlas-text-muted uppercase tracking-wider ml-1">Topic</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Thermodynamics" className="w-full px-4 py-3 bg-atlas-dark border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-atlas-text-muted uppercase tracking-wider ml-1">Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full px-4 py-3 bg-atlas-dark border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white cursor-pointer">
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-atlas-text-muted uppercase tracking-wider ml-1">Marks</label>
                <input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} className="w-full px-4 py-3 bg-atlas-dark border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-atlas-text-muted uppercase tracking-wider ml-1">Question</label>
              <textarea rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Type the question here..." className="w-full px-4 py-4 bg-atlas-dark border border-gray-700 rounded-2xl focus:outline-none focus:border-atlas-primary text-white resize-none" />
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-atlas-text-muted uppercase tracking-wider ml-1 block">Options</label>
              <div className="grid gap-3">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-8 text-xs font-bold text-atlas-primary">{idx + 1}</span>
                    <input type="text" value={opt} onChange={(e) => handleOptionChange(idx, e.target.value)} placeholder={`Option ${idx + 1}`} className="flex-1 px-4 py-3 bg-atlas-dark border border-gray-800 rounded-xl focus:outline-none focus:border-atlas-primary text-white" />
                    <button type="button" onClick={() => handleRemoveOption(idx)} className="p-2 text-gray-600 hover:text-red-500 transition"><TrashIcon className="h-5 w-5" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleAddOption} className="text-atlas-primary text-xs font-bold uppercase tracking-widest flex items-center gap-2 px-4 py-2 hover:bg-atlas-primary/5 rounded-lg"><PlusIcon className="h-4 w-4" /> Add Option</button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-atlas-text-muted uppercase tracking-wider ml-1">Correct Answer</label>
                <input type="text" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} placeholder="Exact text of correct option" className="w-full px-4 py-3 bg-atlas-dark border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-atlas-text-muted uppercase tracking-wider ml-1">Explanation (Optional)</label>
                <input type="text" value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Brief solution..." className="w-full px-4 py-3 bg-atlas-dark border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white" />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-800 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={isFlagged} onChange={(e) => setIsFlagged(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:bg-red-600 transition-all relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                <span className="text-sm font-bold text-gray-300 group-hover:text-white flex items-center gap-2"><FlagIcon className={`h-4 w-4 ${isFlagged ? 'text-red-500' : 'text-gray-600'}`} /> Flag for review</span>
              </label>
              {isFlagged && <textarea rows={2} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} placeholder="Why is this flagged?" className="w-full px-4 py-3 bg-red-900/10 border border-red-900/30 rounded-xl focus:outline-none focus:border-red-500 text-white animate-fade-in-up" />}
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-gray-800">
              <button type="button" onClick={() => onFinished?.()} className="px-8 py-3 text-gray-400 font-bold uppercase tracking-widest text-sm hover:text-white transition">Cancel</button>
              <button type="submit" className={`px-10 py-4 font-bold uppercase tracking-widest text-sm rounded-xl transition-all shadow-lg active:scale-95 ${editingMcq ? 'bg-white text-black' : 'bg-atlas-primary text-white shadow-emerald-900/40 hover:bg-emerald-600'}`}>{editingMcq ? 'Update Question' : 'Save to Bank'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MCQUpload;