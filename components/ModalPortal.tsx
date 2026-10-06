import React from 'react';
import { createPortal } from 'react-dom';

// Renders its children into document.body via a portal, so a "fixed inset-0"
// overlay can never get trapped behind an ancestor's own stacking/overflow
// context (the bug that caused a modal header to render above its own backdrop).
const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return createPortal(children, document.body);
};

export default ModalPortal;
