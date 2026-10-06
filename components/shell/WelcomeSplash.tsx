import React, { useEffect, useState } from 'react';
import ModalPortal from '../ModalPortal';

const HOLD_MS = 3200;
const EXIT_MS = 900;
const SEEN_KEY = 'atlas-welcome-seen-token';

const greetingForHour = (h: number) => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');

// Plays once per login: the flag is tied to the current session token, so a
// page refresh doesn't replay it but the next fresh login does.
export const shouldShowWelcome = (): boolean => {
    try {
        const token = localStorage.getItem('atlas-token');
        return !!token && sessionStorage.getItem(SEEN_KEY) !== token;
    } catch {
        return false;
    }
};

const markWelcomeSeen = () => {
    try {
        const token = localStorage.getItem('atlas-token');
        if (token) sessionStorage.setItem(SEEN_KEY, token);
    } catch { /* storage unavailable — splash simply shows again next time */ }
};

interface WelcomeSplashProps {
    name: string;
    portalLabel: string;
    tagline: string;
    onDone: () => void;
}

const WelcomeSplash: React.FC<WelcomeSplashProps> = ({ name, portalLabel, tagline, onDone }) => {
    const [exiting, setExiting] = useState(false);
    const long = name.length > 18;

    useEffect(() => {
        markWelcomeSeen();
        const exitTimer = setTimeout(() => setExiting(true), HOLD_MS);
        const doneTimer = setTimeout(onDone, HOLD_MS + EXIT_MS);
        return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
    }, [onDone]);

    const skip = () => {
        if (exiting) return;
        setExiting(true);
        setTimeout(onDone, EXIT_MS);
    };

    return (
        <ModalPortal>
            <div
                onClick={skip}
                className={`fixed inset-0 z-[200] flex items-center justify-center bg-atlas-black cursor-pointer overflow-hidden ${exiting ? 'animate-splash-out' : ''}`}
                role="status"
                aria-live="polite"
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18),transparent_55%)]" />
                <div className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-atlas-primary/10 blur-3xl animate-pulse-slow" />
                <div className="absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-emerald-400/10 blur-3xl animate-pulse-slow" />
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }}
                />

                <div className="relative text-center px-6 max-w-5xl">
                    <p className="text-atlas-primary text-[11px] font-black uppercase tracking-[0.5em] mb-6 animate-welcome-sub" style={{ animationDelay: '0.2s' }}>
                        Atlas Classes · {portalLabel}
                    </p>
                    <h1 className={`${long ? 'text-4xl sm:text-6xl' : 'text-5xl sm:text-7xl'} font-black text-white leading-[1.05] animate-welcome-reveal`}>
                        Welcome, <span className="bg-gradient-to-r from-emerald-300 via-atlas-primary to-emerald-500 bg-clip-text text-transparent break-words">{name}</span>
                    </h1>
                    <div className="mx-auto mt-8 h-[2px] w-40 origin-center bg-gradient-to-r from-transparent via-atlas-primary to-transparent animate-welcome-line" />
                    <p className="mt-6 text-gray-400 text-base sm:text-lg font-medium animate-welcome-sub">
                        {greetingForHour(new Date().getHours())} — {tagline}
                    </p>
                    <p className="mt-12 text-[10px] text-gray-600 uppercase tracking-[0.3em] animate-welcome-sub" style={{ animationDelay: '1.6s' }}>
                        Tap anywhere to continue
                    </p>
                </div>
            </div>
        </ModalPortal>
    );
};

export default WelcomeSplash;
