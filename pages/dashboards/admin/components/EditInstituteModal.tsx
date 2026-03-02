import React, { useState } from 'react';
import { Institute } from '../../../../types'; // Adjust path if needed
import { useData } from '../../../../contexts/DataContext'; // Adjust path if needed
import api from '../../../../services/api'; // Adjust path if needed

// Fallback Icon
const PencilSquareIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

interface EditInstituteModalProps {
  institute: Institute;
  onClose: () => void;
}

const EditInstituteModal: React.FC<EditInstituteModalProps> = ({ institute, onClose }) => {
  const { refreshInstitutes } = useData();
  
  // Set initial state to the exact values passed in from the institute row
  const [name, setName] = useState(institute.name || '');
  const [email, setEmail] = useState(institute.email || '');
  const [password, setPassword] = useState(''); 
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let finalLogoUrl = institute.logo_url; // Default to existing logo

      // 1. Upload new logo to Cloudinary if user selected one
      if (logoFile) {
        const CLOUD_NAME = 'dj0gekofh'; // Your Cloudinary Name
        const UPLOAD_PRESET = 'Institute Logos'; // Your Cloudinary Preset

        const cloudinaryData = new FormData();
        cloudinaryData.append('file', logoFile);
        cloudinaryData.append('upload_preset', UPLOAD_PRESET);
        cloudinaryData.append('cloud_name', CLOUD_NAME);
        
        const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: cloudinaryData,
        });
        
        const imgData = await cloudinaryResponse.json();
        
        if (cloudinaryResponse.ok && (imgData.secure_url || imgData.url)) {
           finalLogoUrl = imgData.secure_url || imgData.url;
        } else {
           throw new Error("Cloudinary upload failed.");
        }
      }

      // 2. Build the Payload exactly as the backend expects it
      // Send ALL fields so the backend always has data
      const payload = { 
        name: name,
        email: email,
        password: password !== '' ? password : undefined, // Only send password if typed
        logo_url: finalLogoUrl 
      };

      console.log("Sending Update Payload to backend:", payload); // Debugging

      // 3. Send update request to backend
      const response = await api.put(`/auth/update-institute/${institute.id}`, payload);
      
      if (response.status === 200) {
          // 4. Force a re-fetch of the table data so the UI updates instantly
          await refreshInstitutes();
          onClose(); // Close modal on success
      }

    } catch (err: any) {
      console.error("Failed to update:", err);
      setError(err.response?.data?.message || err.message || 'Failed to update institute');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className="bg-[#0f1115] border border-gray-800 rounded-3xl p-8 w-full max-w-md shadow-2xl relative mt-10 mb-10">
        
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
            ✕
        </button>

        <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <PencilSquareIcon className="h-6 w-6 text-blue-500" />
            </div>
            <div>
                <h3 className="text-2xl font-black text-white">Modify Profile</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#00e599] mt-1">
                    Updating ID: {institute.id.split('-')[0]}
                </p>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
            {/* LOGO UPDATE FIELD */}
            <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-2 ml-1">Institute Logo</label>
                <div className="flex items-center gap-4 bg-[#0a0a0a] border border-gray-800 p-2 rounded-2xl focus-within:border-[#00e599] transition-colors">
                    {logoFile ? (
                        <img src={URL.createObjectURL(logoFile)} alt="Preview" className="h-12 w-12 object-contain rounded-xl bg-white p-1" />
                    ) : institute.logo_url ? (
                        <img src={institute.logo_url} alt="Current" className="h-12 w-12 object-contain rounded-xl bg-white p-1" />
                    ) : (
                        <div className="h-12 w-12 rounded-xl bg-gray-800 flex items-center justify-center">
                            <span className="text-xs text-gray-500">None</span>
                        </div>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                setLogoFile(e.target.files[0]);
                            } else {
                                setLogoFile(null);
                            }
                        }}
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700 cursor-pointer transition-colors"
                    />
                </div>
            </div>

            {/* NAME FIELD */}
            <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-2 ml-1">Institute Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-4 bg-[#0a0a0a] border border-gray-800 rounded-2xl focus:outline-none focus:border-[#00e599] text-white transition-all font-medium"
                  required
                />
            </div>

            {/* EMAIL FIELD */}
            <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-2 ml-1">Official Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-4 bg-[#0a0a0a] border border-gray-800 rounded-2xl focus:outline-none focus:border-[#00e599] text-white transition-all font-medium"
                  required
                />
            </div>

            {/* PASSWORD FIELD */}
            <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-2 ml-1">Update Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="w-full p-4 bg-[#0a0a0a] border border-gray-800 rounded-2xl focus:outline-none focus:border-[#00e599] text-white transition-all font-medium placeholder-gray-600"
                />
            </div>

            {error && <p className="text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-xl">{error}</p>}

            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 mt-4 rounded-2xl font-black text-xs uppercase tracking-widest text-[#0a0a0a] bg-white hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
                {isLoading ? 'Updating...' : 'Commit Record Changes'}
            </button>
        </form>
      </div>
    </div>
  );
};

export default EditInstituteModal;
