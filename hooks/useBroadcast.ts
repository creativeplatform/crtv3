import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';

export type BroadcastStatus = 'idle' | 'loading' | 'live' | 'error';

interface UseBroadcastProps {
    ingestUrl?: string | null;
    streamKey?: string | null;
}

interface UseBroadcastReturn {
    status: BroadcastStatus;
    startBroadcast: () => Promise<void>;
    stopBroadcast: () => void;
    videoRef: React.RefObject<HTMLVideoElement>;
    toggleAudio: () => void;
    toggleVideo: () => void;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    devices: MediaDeviceInfo[];
    selectedAudioDeviceId: string;
    selectedVideoDeviceId: string;
    changeAudioDevice: (deviceId: string) => Promise<void>;
    changeVideoDevice: (deviceId: string) => Promise<void>;
    error: string | null;
    isScreenSharing: boolean;
    toggleScreenShare: () => Promise<void>;
}

export function useBroadcast({ ingestUrl, streamKey }: UseBroadcastProps): UseBroadcastReturn {
    const [status, setStatus] = useState<BroadcastStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');
    const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

    // Enumerate devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                const deviceInfos = await navigator.mediaDevices.enumerateDevices();
                setDevices(deviceInfos);

                // Set defaults if not set
                const audioDevices = deviceInfos.filter(d => d.kind === 'audioinput');
                const videoDevices = deviceInfos.filter(d => d.kind === 'videoinput');

                if (audioDevices.length > 0 && !selectedAudioDeviceId) {
                    setSelectedAudioDeviceId(audioDevices[0].deviceId);
                }
                if (videoDevices.length > 0 && !selectedVideoDeviceId) {
                    setSelectedVideoDeviceId(videoDevices[0].deviceId);
                }
            } catch (err) {
                logger.error('Error enumerating devices:', err);
            }
        };

        getDevices();
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []);

    // Initialize Media Stream
    const initStream = useCallback(async () => {
        try {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }

            const constraints: MediaStreamConstraints = {
                audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true,
                video: selectedVideoDeviceId ? {
                    deviceId: { exact: selectedVideoDeviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } : true
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            mediaStreamRef.current = stream;
            setLocalStream(stream);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.muted = true; // Mute local playback to avoid feedback
            }

            // Sync initial state
            stream.getAudioTracks().forEach(track => track.enabled = isAudioEnabled);
            stream.getVideoTracks().forEach(track => track.enabled = isVideoEnabled);

        } catch (err) {
            logger.error('Error accessing media devices:', err);
            setError('Failed to access camera/microphone');
            toast.error('Failed to access camera/microphone');
        }
    }, [selectedAudioDeviceId, selectedVideoDeviceId]);

    // Initial setup of camera/mic
    useEffect(() => {
        initStream();
        return () => {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [initStream]);


    const startBroadcast = async () => {
        if (!ingestUrl && !streamKey) {
            toast.error('No stream key or ingest URL provided');
            return;
        }
        if (!mediaStreamRef.current) {
            await initStream();
            if (!mediaStreamRef.current) return;
        }

        setStatus('loading');
        setError(null);

        try {
            let endpointUrl = ingestUrl;
            let iceServers: RTCIceServer[] = [
                { urls: 'stun:stun.l.google.com:19302' }
            ];

            // Prioritize explicit stream key discovery as per Livepeer documentation
            // "Get the SDP Host ... make a HEAD request to the WebRTC redirect endpoint"
            if (streamKey) {
                try {
                    // Rule: livepeer-in-browser-broadcasting.md
                    const discoveryUrl = `https://livepeer.studio/webrtc/${streamKey}`;
                    logger.debug("Discovering WHIP endpoint from:", discoveryUrl);

                    const headRes = await fetch(discoveryUrl, { method: 'HEAD' });

                    // The fetch API follows redirects by default, so .url is the final destination
                    endpointUrl = headRes.url;
                    logger.debug("Resolved WHIP endpoint:", endpointUrl);

                    // Use host for ICE
                    const host = new URL(endpointUrl).host;
                    iceServers = [
                        { urls: `stun:${host}` },
                        {
                            urls: `turn:${host}`,
                            username: 'livepeer',
                            credential: 'livepeer'
                        }
                    ];
                } catch (e) {
                    logger.error("Failed to discover optimized WHIP endpoint:", e);
                    // Fallback to ingestUrl if available, otherwise error
                }
            }

            if (!endpointUrl) {
                throw new Error("Could not resolve valid WHIP endpoint.");
            }

            const pc = new RTCPeerConnection({ iceServers });
            peerConnectionRef.current = pc;

            // Monitor connection state for mid-stream failures
            pc.onconnectionstatechange = () => {
                const state = pc.connectionState;
                logger.debug('WebRTC connection state:', state);

                switch (state) {
                    case 'disconnected':
                        toast.warning('Connection unstable, attempting to recover...');
                        break;
                    case 'failed':
                        setError('Broadcast connection failed');
                        setStatus('error');
                        toast.error('Broadcast connection lost');
                        stopBroadcast();
                        break;
                    case 'closed':
                        if (status === 'live') {
                            setStatus('idle');
                        }
                        break;
                }
            };

            pc.oniceconnectionstatechange = () => {
                const state = pc.iceConnectionState;
                logger.debug('ICE connection state:', state);

                if (state === 'failed') {
                    setError('Network connection failed');
                    setStatus('error');
                    toast.error('Network connection lost');
                    stopBroadcast();
                }
            };

            // Add tracks — use screen stream if screen sharing, otherwise camera
            const activeStream = screenStreamRef.current || mediaStreamRef.current;
            activeStream.getTracks().forEach(track => {
                pc.addTransceiver(track, { direction: 'sendonly' });
            });

            // Create Offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Wait for ICE gathering
            await new Promise<void>((resolve) => {
                if (pc.iceGatheringState === 'complete') {
                    resolve();
                } else {
                    const checkState = () => {
                        if (pc.iceGatheringState === 'complete') {
                            pc.removeEventListener('icegatheringstatechange', checkState);
                            resolve();
                        }
                    };
                    pc.addEventListener('icegatheringstatechange', checkState);
                    // Fallback timeout
                    setTimeout(() => {
                        pc.removeEventListener('icegatheringstatechange', checkState);
                        resolve();
                    }, 2000);
                }
            });

            const offerSdp = pc.localDescription?.sdp;
            if (!offerSdp) throw new Error('Failed to generate SDP offer');

            // WHIP Request
            logger.debug(`Posting SDP offer to: ${endpointUrl}`);

            const response = await fetch(endpointUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sdp'
                },
                body: offerSdp
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`WHIP Request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const answerSdp = await response.text();
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));

            setStatus('live');
            toast.success('Broadcast started successfully!');

        } catch (err: any) {
            logger.error('Broadcast error:', err);
            setError(err.message || 'Failed to start broadcast');
            setStatus('error');
            toast.error(`Broadcast failed: ${err.message}`);
            stopBroadcast(); // Cleanup
        }
    };

    const stopBroadcast = () => {
        // Stop screen sharing if active
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
            setIsScreenSharing(false);
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Stop media tracks to release camera/mic
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        // Clear video element
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setLocalStream(null);
        setStatus('idle');
    };

    const toggleAudio = () => {
        if (mediaStreamRef.current) {
            const audioTracks = mediaStreamRef.current.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !isAudioEnabled;
            });
            setIsAudioEnabled(!isAudioEnabled);
        }
    };

    const toggleVideo = () => {
        if (mediaStreamRef.current) {
            const videoTracks = mediaStreamRef.current.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = !isVideoEnabled;
            });
            setIsVideoEnabled(!isVideoEnabled);
        }
    };

    const changeAudioDevice = async (deviceId: string) => {
        setSelectedAudioDeviceId(deviceId);
        // InitStream will trigger due to dependency change
    };

    const changeVideoDevice = async (deviceId: string) => {
        setSelectedVideoDeviceId(deviceId);
        // InitStream will trigger due to dependency change
    };

    // Screen sharing — uses replaceTrack for seamless mid-stream switching
    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            // Stop screen share, revert to camera
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(track => track.stop());
                screenStreamRef.current = null;
            }

            // Replace track on peer connection if live
            const pc = peerConnectionRef.current;
            if (pc && mediaStreamRef.current) {
                const cameraTrack = mediaStreamRef.current.getVideoTracks()[0];
                const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (videoSender && cameraTrack) {
                    await videoSender.replaceTrack(cameraTrack);
                }
            }

            // Restore camera preview
            if (videoRef.current && mediaStreamRef.current) {
                videoRef.current.srcObject = mediaStreamRef.current;
            }

            setIsScreenSharing(false);
            toast.success('Screen sharing stopped');
        } else {
            // Start screen share
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true,
                });
                screenStreamRef.current = screenStream;

                // Replace track on peer connection if live
                const pc = peerConnectionRef.current;
                if (pc) {
                    const screenVideoTrack = screenStream.getVideoTracks()[0];
                    const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (videoSender && screenVideoTrack) {
                        await videoSender.replaceTrack(screenVideoTrack);
                    }

                    // If screen share has audio, replace or add audio track
                    const screenAudioTrack = screenStream.getAudioTracks()[0];
                    if (screenAudioTrack) {
                        const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');
                        if (audioSender) {
                            await audioSender.replaceTrack(screenAudioTrack);
                        }
                    }
                }

                // Show screen in local preview
                if (videoRef.current) {
                    videoRef.current.srcObject = screenStream;
                }

                // Auto-revert when user clicks browser's "Stop sharing" button
                screenStream.getVideoTracks()[0].onended = () => {
                    toggleScreenShare(); // Recursively stops screen share
                };

                setIsScreenSharing(true);
                toast.success('Screen sharing started');
            } catch (err: any) {
                // User cancelled the screen picker or error
                if (err.name !== 'NotAllowedError') {
                    logger.error('Screen share error:', err);
                    toast.error('Failed to start screen sharing');
                }
            }
        }
    };

    return {
        status,
        startBroadcast,
        stopBroadcast,
        videoRef,
        toggleAudio,
        toggleVideo,
        isAudioEnabled,
        isVideoEnabled,
        devices,
        selectedAudioDeviceId,
        selectedVideoDeviceId,
        changeAudioDevice,
        changeVideoDevice,
        error,
        isScreenSharing,
        toggleScreenShare
    };
}
