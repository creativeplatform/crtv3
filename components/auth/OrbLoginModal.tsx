'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useOrbSession } from '@/context/OrbSessionContext';

export function OrbLoginModal() {
  const {
    isLoginModalOpen,
    closeLoginModal,
    connectWithQr,
    isAuthenticated,
  } = useOrbSession();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoginModalOpen) {
      setQrCode(null);
      setDeepLink(null);
      setError(null);
      setIsConnecting(false);
      return;
    }

    if (isAuthenticated) {
      closeLoginModal();
      return;
    }

    let cancelled = false;

    (async () => {
      setIsConnecting(true);
      setError(null);
      try {
        await connectWithQr(({ qrCode: qr, deepLink: link }) => {
          if (cancelled) return;
          setQrCode(qr);
          setDeepLink(link ?? null);
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Orb sign-in failed');
        }
      } finally {
        if (!cancelled) setIsConnecting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoginModalOpen, isAuthenticated, connectWithQr, closeLoginModal]);

  return (
    <Dialog open={isLoginModalOpen} onOpenChange={(open) => !open && closeLoginModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in with Orb</DialogTitle>
          <DialogDescription>
            Scan the QR code with the Orb app to connect your sovereign Lens identity.
            You can still use Account Kit for your smart wallet and transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {isConnecting && !qrCode && (
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          )}
          {qrCode && (
            <div className="relative h-56 w-56 overflow-hidden rounded-lg border bg-white p-2">
              <Image
                src={qrCode}
                alt="Orb sign-in QR code"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          )}
          {deepLink && (
            <Button variant="outline" size="sm" asChild>
              <a href={deepLink} target="_blank" rel="noopener noreferrer">
                Open in Orb app
              </a>
            </Button>
          )}
          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}
          {error && (
            <Button
              variant="secondary"
              onClick={() => {
                setError(null);
                closeLoginModal();
              }}
            >
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
