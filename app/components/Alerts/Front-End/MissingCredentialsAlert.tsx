'use client';

import React from 'react';
import Alert from './Alert'; // Ensure this points to the correct Alert.tsx
import { AlertProps } from './Alert'; // Import AlertProps directly from Alert.tsx

const MissingCredentialsAlert: React.FC = () => {
  const requiredEnvVars = [
    'NEXT_PUBLIC_TEMPLATE_CLIENT_ID',
    'LIVEPEER_FULL_API_KEY',
    'SNAPSHOT_API_KEY',
    'THIRDWEB_SECRET_KEY',
    'THIRDWEB_ADMIN_PRIVATE_KEY',
  ];

  const missingEnvVars: AlertProps[] = requiredEnvVars
    .filter((envVar) => !process.env[envVar])
    .map((missingEnvVar) => ({
      type: 'error',
      message: `The environment variable ${missingEnvVar} is missing. Please check your configuration.`,
      title: 'Configuration Error',
      dismissible: true,
    }));

  return (
    <>
      {missingEnvVars.map((alert, index) => (
        <Alert key={index} {...alert} />
      ))}
    </>
  );
};

export default MissingCredentialsAlert;