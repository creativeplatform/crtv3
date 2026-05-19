'use client';

import { useEffect, useState } from 'react';
import {
    Joyride,
    EVENTS,
    STATUS,
    type CallBackProps,
    type Step,
} from 'react-joyride';
import { usePathname } from 'next/navigation';
import { useUser } from '@account-kit/react';
import { useTour } from '@/context/TourContext';
import { logger } from '@/lib/utils/logger';

type TourStep = Step & {
    data?: { id: string };
};

const DESKTOP_STEPS: TourStep[] = [
    {
        target: '#connect-wallet-btn',
        content: 'Sign in to get started! Click "Get Started" to create your account with just your email.',
        disableBeacon: true,
        spotlightClicks: true,
        data: { id: 'connect' }
    },
    {
        target: '#nav-user-menu',
        content: 'Click your profile to open the menu, then select "Upload" to start adding content.',
        spotlightClicks: true,
        data: { id: 'user-menu' }
    },
    {
        target: '#upload-video-form',
        content: 'Upload your video file here. You can drag and drop or select a file.',
        placement: 'bottom',
        data: { id: 'upload-form' }
    },
    {
        target: '#publish-video-btn',
        content: 'Once uploaded, click Publish to share it with the world!',
        data: { id: 'publish-btn' }
    },
    {
        target: '#nav-discover-link',
        content: 'Check out what others are creating on the Discover page.',
        data: { id: 'discover' }
    },
    {
        target: '#nav-trade-link',
        content: 'Buy or sell Creative Coins by creators on the platform in the Trading Market.',
        data: { id: 'trade' }
    },
];





export const Tour = () => {
    const { run, stepIndex, setRun, setStepIndex } = useTour();
    const pathname = usePathname();
    const user = useUser();
    const isConnected = !!user;

    // Simple mobile detection
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const MOBILE_STEPS: TourStep[] = [
        {
            target: '#mobile-menu-btn',
            content: 'Tap the menu to get started by signing in.',
            disableBeacon: true,
            data: { id: 'connect' }
        },
        {
            target: '#mobile-menu-btn',
            content: 'In the menu, you can select "Upload" to add your own content.',
            data: { id: 'user-menu' }
        },
        {
            target: '#mobile-menu-btn',
            content: 'Select "Upload" in the menu to access the video upload form.',
            data: { id: 'upload-form' }
        },
        {
            target: '#mobile-menu-btn',
            content: 'After selecting a file, use the "Publish" button to share your video.',
            data: { id: 'publish-btn' }
        },
        {
            target: '#mobile-menu-btn',
            content: 'Use the "Discover" link in the menu to see what others are creating.',
            data: { id: 'discover' }
        },
        {
            target: '#mobile-menu-btn',
            content: 'Access the "Trading Market" via the menu to buy or sell Creative Coins.',
            data: { id: 'trade' }
        },
    ];

    const steps = isMobile ? MOBILE_STEPS : DESKTOP_STEPS;

    // Helper to find step index by ID
    const getStepIndex = (id: string) => {
        return steps.findIndex(s => s.data?.id === id);
    };

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { index, status, type, action } = data;
        const currentStep = steps[index];
        const currentId = currentStep?.data?.id;

        logger.debug("Tour: Callback", { index, status, type, action, currentId });

        if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
            setRun(false);
            localStorage.setItem('crtv3_tour_completed', 'true');
        } else if (type === EVENTS.STEP_AFTER) {
            // Logic to handle specific transitions if needed, 
            // otherwise just let it go to next index
            setStepIndex(index + 1);
        } else if (type === EVENTS.TARGET_NOT_FOUND) {
            // Wait
        }
    };

    // Auto-advance logic refactored to use IDs

    // 1. Authenticated -> Go to next relevant step
    // Desktop: Connect (0) -> User Menu (1)
    // Mobile: Connect (1) -> Open Menu for Upload (2)
    useEffect(() => {
        if (isConnected && run) {
            // If we are on the connect step, move forward
            const connectIndex = getStepIndex('connect');
            if (stepIndex === connectIndex) {
                setStepIndex(connectIndex + 1);
            }
        }
    }, [isConnected, stepIndex, run, steps]);

    // 2. Navigation to /upload
    useEffect(() => {
        if (pathname.startsWith('/upload') && run) {
            const uploadFormIndex = getStepIndex('upload-form');
            if (stepIndex < uploadFormIndex && uploadFormIndex !== -1) {
                setStepIndex(uploadFormIndex);
            }
        }
    }, [pathname, stepIndex, run, steps]);

    // 3. Publish Button Appearance
    useEffect(() => {
        let interval: NodeJS.Timeout;
        const uploadFormIndex = getStepIndex('upload-form');
        const publishBtnIndex = getStepIndex('publish-btn');

        if (stepIndex === uploadFormIndex && run && uploadFormIndex !== -1 && publishBtnIndex !== -1) {
            interval = setInterval(() => {
                if (document.getElementById('publish-video-btn')) {
                    setStepIndex(publishBtnIndex);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [stepIndex, run, steps]);

    // 4. Navigation to /discover
    useEffect(() => {
        if (pathname.startsWith('/discover') && run) {
            const discoverIndex = getStepIndex('discover');
            if (stepIndex < discoverIndex && discoverIndex !== -1) {
                setStepIndex(discoverIndex);
            }
        }
    }, [pathname, stepIndex, run, steps]);


    // Custom Tooltip component
    const TourTooltip = ({
        index,
        step,
        backProps,
        primaryProps,
        skipProps,
        tooltipProps,
        isLastStep,
        size,
    }: any) => {
        return (
            <div {...tooltipProps} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl border border-indigo-100 dark:border-indigo-900 max-w-sm relative overflow-hidden">
                {/* Decorative BG element */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-10 rounded-bl-full -mr-4 -mt-4"></div>

                <div className="relative z-10 text-slate-800 dark:text-slate-100">
                    {step.content}
                </div>

                <div className="mt-6 flex justify-between items-center relative z-10 w-full">
                    <div className="flex gap-2">
                        <button {...skipProps} className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-medium transition">
                            Skip
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button {...primaryProps} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-full hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 dark:shadow-none">
                            {isLastStep ? 'Finish' : 'Next Step'}
                        </button>
                    </div>
                </div>
                <div className="mt-2 text-center text-xs text-slate-400 font-medium">
                    Step {index + 1} of {size}
                </div>
            </div>
        );
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            stepIndex={stepIndex}
            callback={handleJoyrideCallback}
            continuous
            showProgress
            showSkipButton
            disableOverlayClose
            styles={{
                options: {
                    primaryColor: '#4f46e5',
                    zIndex: 10000,
                },
            }}
            tooltipComponent={TourTooltip}
        />
    );
};
