"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAvatarUpload } from '@/lib/hooks/metokens/useAvatarUpload';
import { useCreatorProfile } from '@/lib/hooks/metokens/useCreatorProfile';
import { useUser } from '@/lib/wallet/react';
import { useWalletStatus } from '@/lib/hooks/accountkit/useWalletStatus';
import { Upload, X, User, AlertCircle, CheckCircle } from 'lucide-react';
import { convertFailingGateway } from '@/lib/utils/image-gateway';
import imageCompression from 'browser-image-compression';

interface AvatarUploadProps {
  targetAddress?: string;
  size?: 'sm' | 'md' | 'lg';
  showUploadButton?: boolean;
  /** When provided (e.g. just-uploaded URL), shown immediately before profile refetch */
  overrideAvatarUrl?: string;
  onUploadComplete?: (url: string) => void;
}

export function AvatarUpload({
  targetAddress,
  size = 'md',
  showUploadButton = true,
  overrideAvatarUrl,
  onUploadComplete
}: AvatarUploadProps) {
  const user = useUser();
  const { smartAccountAddress } = useWalletStatus();
  const { profile } = useCreatorProfile(targetAddress);
  const { isUploading, uploadProgress, error, uploadAvatar, deleteAvatar } = useAvatarUpload(targetAddress);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const isOwner = !targetAddress || targetAddress === user?.address || targetAddress === smartAccountAddress;
  const resolvedUrl = overrideAvatarUrl ?? profile?.avatar_url;
  const currentAvatarUrl = resolvedUrl ? convertFailingGateway(resolvedUrl) : undefined;

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-20 w-20',
    lg: 'h-24 w-24',
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (5MB limit)
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File size must be less than ${MAX_SIZE_MB}MB`);
      return;
    }

    try {
      const options = {
        maxSizeMB: 1, // Target size in MB
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);

      const result = await uploadAvatar(compressedFile);
      if (result.success && result.url && onUploadComplete) {
        onUploadComplete(result.url);
      }
    } catch (error) {
      console.error('Error compressing image:', error);
      // Fallback to uploading original file if compression fails
      const result = await uploadAvatar(file);
      if (result.success && result.url && onUploadComplete) {
        onUploadComplete(result.url);
      }
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDeleteAvatar = async () => {
    if (confirm('Are you sure you want to delete your avatar?')) {
      await deleteAvatar();
    }
  };

  const displayName = profile?.username ||
    `${(targetAddress || user?.address || '').slice(0, 6)}...${(targetAddress || user?.address || '').slice(-4)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div
          className={`relative ${sizeClasses[size]} ${dragOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Avatar className={sizeClasses[size]}>
            <AvatarImage src={currentAvatarUrl} alt={displayName} />
            <AvatarFallback>
              {profile?.username ? profile.username.charAt(0).toUpperCase() : <User className="h-8 w-8" />}
            </AvatarFallback>
          </Avatar>

          {isUploading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <div className="text-white text-xs text-center">
                <div className="mb-1">{uploadProgress}%</div>
                <Progress value={uploadProgress} className="w-12 h-1" />
              </div>
            </div>
          )}
        </div>

        {isOwner && showUploadButton && (
          <div className="space-y-2">
            <input
              id="avatar-upload"
              name="avatarUpload"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {currentAvatarUrl ? 'Change' : 'Upload'}
              </Button>

              {currentAvatarUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteAvatar}
                  disabled={isUploading}
                  className="flex items-center gap-2 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Drag & drop or click to upload
              <br />
              Max 5MB • JPEG, PNG, GIF, WebP
            </p>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isUploading && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Uploading avatar... {uploadProgress}%
          </AlertDescription>
        </Alert>
      )}

      {!isOwner && (
        <p className="text-sm text-muted-foreground">
          Add an avatar
        </p>
      )}
    </div>
  );
}

